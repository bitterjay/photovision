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

    // Get user's albums
    async getUserAlbums(accessToken, accessTokenSecret, userUri) {
        try {
            console.log('SmugMug: Getting user albums...');
            
            const response = await this.makeRequest(
                'GET',
                `${this.baseUrl}${userUri}!albums`,
                {},
                accessToken,
                accessTokenSecret
            );

            if (!response.success) {
                throw new Error('Failed to get user albums');
            }

            console.log(`SmugMug: Retrieved ${response.data.Response.Album.length} albums`);
            return {
                success: true,
                albums: response.data.Response.Album
            };

        } catch (error) {
            console.error('SmugMug albums error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get album images
    async getAlbumImages(accessToken, accessTokenSecret, albumUri) {
        try {
            console.log(`SmugMug: Getting images for album ${albumUri}...`);
            
            const response = await this.makeRequest(
                'GET',
                `${this.baseUrl}${albumUri}!images`,
                {},
                accessToken,
                accessTokenSecret
            );

            if (!response.success) {
                throw new Error('Failed to get album images');
            }

            const images = response.data.Response.AlbumImage || [];
            console.log(`SmugMug: Retrieved ${images.length} images from album`);
            return {
                success: true,
                images: images
            };

        } catch (error) {
            console.error('SmugMug album images error:', error.message);
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
