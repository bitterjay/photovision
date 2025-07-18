// PhotoVision SmugMug Client
// Handles OAuth 1.0a authentication and API communication with SmugMug

const crypto = require('crypto');
const https = require('https');
const { URL, URLSearchParams } = require('url');

class SmugMugClient {
    constructor(apiKey, apiSecret) {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.baseUrl = 'https://api.smugmug.com';
        this.oauthBaseUrl = 'https://secure.smugmug.com';
        
        // OAuth URLs
        this.requestTokenUrl = this.oauthBaseUrl + '/services/oauth/1.0a/getRequestToken';
        this.authorizeUrl = this.oauthBaseUrl + '/services/oauth/1.0a/authorize';
        this.accessTokenUrl = this.oauthBaseUrl + '/services/oauth/1.0a/getAccessToken';
    }

    // Generate OAuth 1.0a signature
    generateSignature(method, url, params, consumerSecret, tokenSecret = '') {
        // Create parameter string
        const sortedParams = Object.keys(params)
            .sort()
            .map(key => `${this.percentEncode(key)}=${this.percentEncode(params[key])}`)
            .join('&');

        // Create signature base string
        const signatureBaseString = [
            method.toUpperCase(),
            this.percentEncode(url),
            this.percentEncode(sortedParams)
        ].join('&');

        // Create signing key
        const signingKey = `${this.percentEncode(consumerSecret)}&${this.percentEncode(tokenSecret)}`;

        // Generate HMAC-SHA1 signature
        const signature = crypto
            .createHmac('sha1', signingKey)
            .update(signatureBaseString)
            .digest('base64');

        return signature;
    }

    // Percent encode for OAuth
    percentEncode(str) {
        return encodeURIComponent(str)
            .replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
    }

    // Generate OAuth nonce
    generateNonce() {
        return crypto.randomBytes(16).toString('hex');
    }

    // Generate OAuth timestamp
    generateTimestamp() {
        return Math.floor(Date.now() / 1000).toString();
    }

    // Create OAuth parameters
    createOAuthParams(token = null) {
        const params = {
            oauth_consumer_key: this.apiKey,
            oauth_nonce: this.generateNonce(),
            oauth_signature_method: 'HMAC-SHA1',
            oauth_timestamp: this.generateTimestamp(),
            oauth_version: '1.0'
        };

        if (token) {
            params.oauth_token = token;
        }

        return params;
    }

    // Make signed HTTP request
    async makeRequest(method, url, params = {}, token = null, tokenSecret = '') {
        return new Promise((resolve, reject) => {
            try {
                // Create OAuth parameters
                const oauthParams = this.createOAuthParams(token);
                
                // Combine all parameters for signature
                const allParams = { ...params, ...oauthParams };
                
                // Generate signature
                const signature = this.generateSignature(method, url, allParams, this.apiSecret, tokenSecret);
                oauthParams.oauth_signature = signature;

                // Create authorization header (include oauth_callback if present)
                const authParams = { ...oauthParams };
                if (params.oauth_callback) {
                    authParams.oauth_callback = params.oauth_callback;
                }
                if (params.oauth_verifier) {
                    authParams.oauth_verifier = params.oauth_verifier;
                }
                
                const authHeader = 'OAuth ' + Object.keys(authParams)
                    .map(key => `${this.percentEncode(key)}="${this.percentEncode(authParams[key])}"`)
                    .join(', ');

                // Parse URL
                const urlObj = new URL(url);
                
                // Prepare request options
                const requestOptions = {
                    hostname: urlObj.hostname,
                    port: urlObj.port || 443,
                    path: urlObj.pathname + urlObj.search,
                    method: method.toUpperCase(),
                    headers: {
                        'Authorization': authHeader,
                        'Accept': 'application/json',
                        'User-Agent': 'PhotoVision/1.0'
                    }
                };

                // Add query parameters for GET requests
                if (method.toUpperCase() === 'GET' && Object.keys(params).length > 0) {
                    const searchParams = new URLSearchParams(params);
                    requestOptions.path += (urlObj.search ? '&' : '?') + searchParams.toString();
                }

                // Create request
                const req = https.request(requestOptions, (res) => {
                    let data = '';
                    
                    res.on('data', (chunk) => {
                        data += chunk;
                    });

                    res.on('end', () => {
                        try {
                            if (res.statusCode >= 200 && res.statusCode < 300) {
                                // Try to parse JSON response
                                try {
                                    const jsonResponse = JSON.parse(data);
                                    resolve({
                                        success: true,
                                        data: jsonResponse,
                                        statusCode: res.statusCode
                                    });
                                } catch (parseError) {
                                    // If not JSON, return raw data (for OAuth token responses)
                                    resolve({
                                        success: true,
                                        data: data,
                                        statusCode: res.statusCode
                                    });
                                }
                            } else {
                                reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                            }
                        } catch (error) {
                            reject(error);
                        }
                    });
                });

                req.on('error', (error) => {
                    reject(new Error(`Network error: ${error.message}`));
                });

                // Send request
                req.end();

            } catch (error) {
                reject(new Error(`Request setup error: ${error.message}`));
            }
        });
    }

    // Parse OAuth response (key=value&key=value format)
    parseOAuthResponse(responseText) {
        const params = {};
        const pairs = responseText.split('&');
        for (const pair of pairs) {
            const [key, value] = pair.split('=');
            if (key && value) {
                params[decodeURIComponent(key)] = decodeURIComponent(value);
            }
        }
        return params;
    }

    // Step 1: Get request token
    async getRequestToken(callbackUrl) {
        try {
            console.log('SmugMug: Getting request token...');
            
            const params = {
                oauth_callback: callbackUrl
            };

            const response = await this.makeRequest('POST', this.requestTokenUrl, params);
            
            if (!response.success) {
                throw new Error('Failed to get request token');
            }

            const tokenData = this.parseOAuthResponse(response.data);
            
            if (!tokenData.oauth_token || !tokenData.oauth_token_secret) {
                throw new Error('Invalid request token response');
            }

            console.log('SmugMug: Request token obtained successfully');
            return {
                success: true,
                token: tokenData.oauth_token,
                tokenSecret: tokenData.oauth_token_secret
            };

        } catch (error) {
            console.error('SmugMug request token error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Step 2: Get authorization URL
    getAuthorizationUrl(requestToken, access = 'Public', permissions = 'Read') {
        const params = new URLSearchParams({
            oauth_token: requestToken,
            Access: access,
            Permissions: permissions
        });

        return `${this.authorizeUrl}?${params.toString()}`;
    }

    // Step 3: Get access token
    async getAccessToken(requestToken, requestTokenSecret, verifier) {
        try {
            console.log('SmugMug: Getting access token...');
            
            const params = {
                oauth_verifier: verifier
            };

            const response = await this.makeRequest(
                'POST', 
                this.accessTokenUrl, 
                params, 
                requestToken, 
                requestTokenSecret
            );
            
            if (!response.success) {
                throw new Error('Failed to get access token');
            }

            const tokenData = this.parseOAuthResponse(response.data);
            
            if (!tokenData.oauth_token || !tokenData.oauth_token_secret) {
                throw new Error('Invalid access token response');
            }

            console.log('SmugMug: Access token obtained successfully');
            return {
                success: true,
                token: tokenData.oauth_token,
                tokenSecret: tokenData.oauth_token_secret
            };

        } catch (error) {
            console.error('SmugMug access token error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get authenticated user info
    async getAuthUser(accessToken, accessTokenSecret) {
        try {
            console.log('SmugMug: Getting authenticated user info...');
            
            const response = await this.makeRequest(
                'GET',
                `${this.baseUrl}/api/v2!authuser`,
                {},
                accessToken,
                accessTokenSecret
            );

            if (!response.success) {
                throw new Error('Failed to get user info');
            }

            console.log('SmugMug: User info retrieved successfully');
            return {
                success: true,
                user: response.data.Response.User
            };

        } catch (error) {
            console.error('SmugMug user info error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get user's albums with path information and pagination
    async getUserAlbums(accessToken, accessTokenSecret, userUri, { start = 1, count = 12 } = {}) {
        try {
            console.log(`SmugMug: Getting user albums page starting at ${start} with count ${count}...`);

            const response = await this.makeRequest(
                'GET',
                `${this.baseUrl}${userUri}!albums`,
                {
                    _expand: 'UrlPath,Parent',
                    _filter: 'AlbumKey,Name,UrlName,UrlPath,ImageCount,Title,Caption,Description,Keywords,LastUpdated,Date,Parent',
                    start: start,
                    count: count
                },
                accessToken,
                accessTokenSecret
            );

            if (!response.success) {
                throw new Error('Failed to get user albums');
            }

            const pageAlbums = response.data.Response.Album || [];
            const pages = response.data.Response.Pages || {};
            const totalCount = pages.Total || 0;

            console.log(`SmugMug: Retrieved ${pageAlbums.length} of ${totalCount} total albums`);

            // Process albums to add hierarchical path information
            const processedAlbums = this.processAlbumsWithHierarchy(pageAlbums);

            console.log('SmugMug: Processed album hierarchy information');
            return {
                success: true,
                albums: processedAlbums,
                pagination: {
                    total: totalCount,
                    start: start,
                    count: count,
                    hasMore: !!pages.NextPage
                }
            };

        } catch (error) {
            console.error('SmugMug albums error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Process albums to add hierarchical path information
    processAlbumsWithHierarchy(albums) {
        return albums.map(album => {
            const processed = { ...album };
            
            // Extract path information from UrlPath or construct fallback
            const pathInfo = this.extractPathInformation(album);
            
            // Add hierarchical information to the album
            processed.PathHierarchy = pathInfo.hierarchy;
            processed.PathTags = pathInfo.tags;
            processed.IndentLevel = pathInfo.indentLevel;
            processed.FullDisplayPath = pathInfo.displayPath;
            processed.SortKey = pathInfo.sortKey;
            
            return processed;
        }).sort((a, b) => {
            // Sort albums by their hierarchical path for proper display order
            return a.SortKey.localeCompare(b.SortKey);
        });
    }

    // Extract and process path information from album data
    extractPathInformation(album) {
        let hierarchy = [];
        let urlPath = null;
        
        // Try to get UrlPath from the album data
        if (album.Uris && album.Uris.UrlPath) {
            urlPath = album.Uris.UrlPath;
        } else if (album.UrlPath) {
            urlPath = album.UrlPath;
        }
        
        if (urlPath) {
            // Parse the URL path to extract hierarchy
            // SmugMug UrlPath format is typically: /folder1/folder2/albumname
            const pathParts = urlPath.split('/').filter(part => part.length > 0);
            
            if (pathParts.length > 1) {
                // All parts except the last are folders, last is the album
                hierarchy = pathParts.slice(0, -1).map(part => 
                    this.cleanPathSegment(part)
                );
                
                // Add the album name as the final level
                hierarchy.push(album.Name || this.cleanPathSegment(pathParts[pathParts.length - 1]));
            } else {
                // Album is at root level
                hierarchy = [album.Name || 'Untitled Album'];
            }
        } else {
            // Fallback: No path information available
            hierarchy = ['Root', album.Name || 'Untitled Album'];
        }
        
        // Create tags from hierarchy (excluding the album name itself for tags)
        const tags = hierarchy.length > 1 ? hierarchy.slice(0, -1) : ['Root'];
        
        // Calculate indent level (0 for root, 1 for first level, etc.)
        const indentLevel = Math.max(0, hierarchy.length - 1);
        
        // Create display path
        const displayPath = hierarchy.join(' > ');
        
        // Create sort key for proper hierarchical ordering
        const sortKey = hierarchy.map(segment => segment.toLowerCase()).join('/');
        
        return {
            hierarchy,
            tags,
            indentLevel,
            displayPath,
            sortKey,
            urlPath
        };
    }

    // Clean and format path segments for display
    cleanPathSegment(segment) {
        return decodeURIComponent(segment)
            .replace(/[-_]/g, ' ')  // Replace hyphens and underscores with spaces
            .replace(/\b\w/g, char => char.toUpperCase())  // Capitalize words
            .trim();
    }

    // Get album images with pagination support
    async getAlbumImages(accessToken, accessTokenSecret, albumUri, { start = 1, count = 500 } = {}) {
        try {
            console.log(`SmugMug: Getting images for album ${albumUri} (start: ${start}, count: ${count})...`);
            
            const response = await this.makeRequest(
                'GET',
                `${this.baseUrl}${albumUri}!images`,
                {
                    start: start,
                    count: count
                },
                accessToken,
                accessTokenSecret
            );

            if (!response.success) {
                throw new Error('Failed to get album images');
            }

            const images = response.data.Response.AlbumImage || [];
            const pages = response.data.Response.Pages || {};
            const totalCount = pages.Total || 0;
            
            console.log(`SmugMug: Retrieved ${images.length} of ${totalCount} total images from album`);
            return {
                success: true,
                images: images,
                pagination: {
                    total: totalCount,
                    start: start,
                    count: count,
                    hasMore: !!pages.NextPage
                }
            };

        } catch (error) {
            console.error('SmugMug album images error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get ALL images from an album by handling pagination automatically
    async getAllAlbumImages(accessToken, accessTokenSecret, albumUri) {
        try {
            console.log(`SmugMug: Getting ALL images for album ${albumUri}...`);
            
            let allImages = [];
            let currentStart = 1;
            const pageSize = 500; // Maximum batch size per request
            let hasMore = true;
            
            while (hasMore) {
                const result = await this.getAlbumImages(
                    accessToken, 
                    accessTokenSecret, 
                    albumUri, 
                    { start: currentStart, count: pageSize }
                );
                
                if (!result.success) {
                    throw new Error(result.error);
                }
                
                allImages = allImages.concat(result.images);
                hasMore = result.pagination.hasMore;
                currentStart += pageSize;
                
                console.log(`SmugMug: Retrieved ${allImages.length} of ${result.pagination.total} total images so far...`);
                
                // Small delay between requests to be respectful to the API
                if (hasMore) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
            
            console.log(`SmugMug: Retrieved ALL ${allImages.length} images from album`);
            return {
                success: true,
                images: allImages
            };

        } catch (error) {
            console.error('SmugMug get all album images error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get individual album details with hierarchy information
    async getAlbumDetails(accessToken, accessTokenSecret, albumKey) {
        try {
            console.log(`SmugMug: Getting album details for ${albumKey}...`);
            
            const response = await this.makeRequest(
                'GET',
                `${this.baseUrl}/api/v2/album/${albumKey}`,
                {
                    _expand: 'UrlPath,Parent'
                },
                accessToken,
                accessTokenSecret
            );

            if (!response.success) {
                throw new Error('Failed to get album details');
            }

            const album = response.data.Response.Album;
            
            if (!album) {
                throw new Error('Album not found in response');
            }

            // Process the album to add hierarchical path information
            const pathInfo = this.extractPathInformation(album);
            
            const processedAlbum = {
                ...album,
                PathHierarchy: pathInfo.hierarchy,
                PathTags: pathInfo.tags,
                IndentLevel: pathInfo.indentLevel,
                FullDisplayPath: pathInfo.displayPath,
                SortKey: pathInfo.sortKey
            };

            console.log(`SmugMug: Album details retrieved for "${album.Name}" with path: ${pathInfo.displayPath}`);
            return {
                success: true,
                album: processedAlbum
            };

        } catch (error) {
            console.error(`SmugMug album details error for ${albumKey}:`, error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Test connection with stored credentials
    async testConnection(accessToken, accessTokenSecret) {
        try {
            console.log('SmugMug: Testing connection...');
            
            const userResult = await this.getAuthUser(accessToken, accessTokenSecret);
            
            if (!userResult.success) {
                return {
                    success: false,
                    error: userResult.error
                };
            }

            console.log('SmugMug: Connection test successful');
            return {
                success: true,
                user: userResult.user
            };

        } catch (error) {
            console.error('SmugMug connection test error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = SmugMugClient;
