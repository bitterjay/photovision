// Claude API Client for Image Analysis
// Handles communication with Anthropic's Claude API for vision tasks

const https = require('https');
const sharp = require('sharp');

class ClaudeClient {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.anthropic.com';
        this.version = '2023-06-01';
    }

    /**
     * Analyze an image using Claude's vision capabilities
     * @param {Buffer} imageBuffer - The image data as a buffer
     * @param {string} mimeType - The MIME type of the image (e.g., 'image/jpeg')
     * @param {string} prompt - Optional custom prompt for analysis
     * @returns {Promise<Object>} Analysis result with description and metadata
     */
    async analyzeImage(imageBuffer, mimeType, prompt = null) {
        try {
            // Resize image if it's too large (Claude has a 5MB limit)
            let processedImageBuffer = imageBuffer;
            const maxSize = 5 * 1024 * 1024; // 5MB in bytes
            
            if (imageBuffer.length > maxSize) {
                console.log(`Image too large (${imageBuffer.length} bytes), resizing...`);
                
                // Progressively reduce quality until under 5MB
                let quality = 85;
                do {
                    processedImageBuffer = await sharp(imageBuffer)
                        .jpeg({ quality: quality })
                        .toBuffer();
                    quality -= 10;
                } while (processedImageBuffer.length > maxSize && quality > 10);
                
                console.log(`Image resized to ${processedImageBuffer.length} bytes`);
            }
            
            const base64Image = processedImageBuffer.toString('base64');
            
            const defaultPrompt = `Please analyze this image in detail. Provide a comprehensive description that would be useful for searching and organizing photos. Include:

1. Main subjects (people, objects, animals)
2. Setting and location type
3. Activities or actions taking place
4. Mood, lighting, and atmosphere
5. Colors, composition, and visual elements
6. Any text or signs visible
7. Time of day or season if apparent

Be specific and descriptive to enable natural language searches like "photos of people laughing outdoors" or "sunset landscapes with mountains".`;

            const requestBody = {
                model: "claude-3-haiku-20240307",
                max_tokens: 1000,
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "image",
                                source: {
                                    type: "base64",
                                    media_type: mimeType,
                                    data: base64Image
                                }
                            },
                            {
                                type: "text",
                                text: prompt || defaultPrompt
                            }
                        ]
                    }
                ]
            };

            const response = await this.makeRequest('/v1/messages', 'POST', requestBody);
            
            return {
                success: true,
                description: response.content[0].text,
                model: response.model,
                usage: response.usage,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('[Claude API Error]', error);
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Make an authenticated request to the Claude API
     * @param {string} endpoint - API endpoint path
     * @param {string} method - HTTP method
     * @param {Object} body - Request body
     * @returns {Promise<Object>} API response
     */
    async makeRequest(endpoint, method = 'GET', body = null) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.anthropic.com',
                path: endpoint,
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': this.version
                }
            };

            const req = https.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(response);
                        } else {
                            reject(new Error(`API Error ${res.statusCode}: ${response.error?.message || 'Unknown error'}`));
                        }
                    } catch (parseError) {
                        reject(new Error(`Failed to parse API response: ${parseError.message}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error(`Request failed: ${error.message}`));
            });

            if (body) {
                req.write(JSON.stringify(body));
            }

            req.end();
        });
    }

    /**
     * Test the API connection
     * @returns {Promise<boolean>} True if connection is successful
     */
    async testConnection() {
        try {
            // Create a simple test request to verify API key
            const testBody = {
                model: "claude-3-haiku-20240307",
                max_tokens: 10,
                messages: [
                    {
                        role: "user",
                        content: "Test"
                    }
                ]
            };

            await this.makeRequest('/v1/messages', 'POST', testBody);
            return true;
        } catch (error) {
            console.error('[Claude API Test Failed]', error.message);
            return false;
        }
    }
}

module.exports = ClaudeClient;
