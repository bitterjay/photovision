// OpenAI API Client for Image Analysis
// Handles communication with OpenAI's GPT-4V for vision tasks

const https = require('https');
const sharp = require('sharp');

class OpenAIClient {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.openai.com';
    }

    /**
     * Analyze an image using OpenAI's vision capabilities
     * @param {Buffer} imageBuffer - The image data as a buffer
     * @param {string} mimeType - The MIME type of the image (e.g., 'image/jpeg')
     * @param {string} prompt - Optional custom prompt for analysis
     * @param {string} model - OpenAI model to use (default: gpt-4-vision-preview)
     * @returns {Promise<Object>} Analysis result with description and metadata
     */
    async analyzeImage(imageBuffer, mimeType, prompt = null, model = 'gpt-4-vision-preview') {
        try {
            let processedImageBuffer = imageBuffer;
            
            // Step 1: Check and resize image dimensions if needed (OpenAI has similar limits)
            try {
                const metadata = await sharp(imageBuffer).metadata();
                const { width, height } = metadata;
                
                console.log(`Original image dimensions: ${width}x${height}`);
                
                // Check if image exceeds dimension limits
                const maxDimension = 2200; // Conservative limit
                const needsResize = width > maxDimension || height > maxDimension;
                
                if (needsResize) {
                    console.log(`Image dimensions exceed ${maxDimension}px, resizing...`);
                    
                    // Determine orientation and resize accordingly
                    let resizeOptions = {};
                    
                    if (width > height) {
                        // Landscape: resize to 2200px width, auto height
                        resizeOptions.width = maxDimension;
                        console.log(`Landscape image: resizing to ${maxDimension}px width`);
                    } else if (height > width) {
                        // Portrait: resize to 2200px height, auto width
                        resizeOptions.height = maxDimension;
                        console.log(`Portrait image: resizing to ${maxDimension}px height`);
                    } else {
                        // Square: resize to 2200px x 2200px
                        resizeOptions.width = maxDimension;
                        resizeOptions.height = maxDimension;
                        console.log(`Square image: resizing to ${maxDimension}x${maxDimension}px`);
                    }
                    
                    // Apply resize transformation
                    processedImageBuffer = await sharp(imageBuffer)
                        .resize(resizeOptions)
                        .jpeg({ quality: 90 }) // High quality for dimension-resized images
                        .toBuffer();
                    
                    const newMetadata = await sharp(processedImageBuffer).metadata();
                    console.log(`Image resized to ${newMetadata.width}x${newMetadata.height} (${processedImageBuffer.length} bytes)`);
                }
            } catch (dimensionError) {
                console.warn(`Failed to check/resize image dimensions: ${dimensionError.message}`);
                console.log('Continuing with original image...');
                // Continue with original image if dimension processing fails
            }
            
            // Step 2: Check file size and reduce quality if needed (OpenAI has 20MB limit but we'll use 5MB for consistency)
            const maxSize = 5 * 1024 * 1024; // 5MB in bytes
            
            if (processedImageBuffer.length > maxSize) {
                console.log(`Image too large (${processedImageBuffer.length} bytes), reducing quality...`);
                
                // Progressively reduce quality until under 5MB
                let quality = 85;
                do {
                    processedImageBuffer = await sharp(processedImageBuffer)
                        .jpeg({ quality: quality })
                        .toBuffer();
                    quality -= 10;
                } while (processedImageBuffer.length > maxSize && quality > 10);
                
                console.log(`Image compressed to ${processedImageBuffer.length} bytes`);
            }
            
            const base64Image = processedImageBuffer.toString('base64');
            
            const defaultPrompt = `Please analyze this image in detail. Provide a comprehensive description and generate relevant keywords for indexing. Return your response as a JSON object with the following structure:

{
  "description": "A detailed description of the image...",
  "keywords": ["keyword1", "keyword2", "keyword3", ...]
}

For the description, include:
1. Main subjects (people, objects, animals)
2. Setting and location type
3. Activities or actions taking place
4. Mood, lighting, and atmosphere
5. Colors, composition, and visual elements
6. Any text or signs visible
7. Time of day or season if apparent

For keywords, provide 5-10 relevant terms that would help with searching and indexing, such as:
- Main subjects (person, animal, object types)
- Activities (running, eating, playing)
- Settings (outdoor, indoor, beach, forest)
- Emotions/moods (happy, serious, peaceful)
- Visual elements (colorful, black and white, sunset)
- Equipment or objects visible

Be specific and descriptive to enable natural language searches like "photos of people laughing outdoors" or "sunset landscapes with mountains".`;

            const requestBody = {
                model: model,
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: prompt || defaultPrompt
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:${mimeType};base64,${base64Image}`,
                                    detail: "high"
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 1000,
                temperature: 0.1
            };

            const response = await this.makeRequest('/v1/chat/completions', 'POST', requestBody);
            
            // Parse the JSON response from OpenAI
            let analysisData;
            const responseText = response.choices[0].message.content;
            
            try {
                analysisData = JSON.parse(responseText);
            } catch (parseError) {
                // Fallback if OpenAI doesn't return valid JSON
                console.warn('OpenAI response was not valid JSON, using fallback parsing');
                analysisData = {
                    description: responseText,
                    keywords: []
                };
            }
            
            return {
                success: true,
                description: analysisData.description || responseText,
                keywords: analysisData.keywords || [],
                model: response.model,
                usage: response.usage,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('[OpenAI API Error]', error);
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Make an authenticated request to the OpenAI API
     * @param {string} endpoint - API endpoint path
     * @param {string} method - HTTP method
     * @param {Object} body - Request body
     * @returns {Promise<Object>} API response
     */
    async makeRequest(endpoint, method = 'GET', body = null) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.openai.com',
                path: endpoint,
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
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
     * Process conversational query with function calling
     * @param {string} userQuery - User's natural language query
     * @param {Array} availableFunctions - Array of function definitions
     * @param {string} model - OpenAI model to use (default: gpt-4-turbo-preview)
     * @returns {Promise<Object>} Conversational response with results
     */
    async processConversationalQuery(userQuery, availableFunctions, model = 'gpt-4-turbo-preview') {
        try {
            const systemMessage = `You are PhotoVision, an intelligent image discovery assistant. You help users find photos in their SmugMug collections using natural language queries.

Available image database contains photos from archery competitions, award ceremonies, and similar events. You can search through analyzed photos that have detailed descriptions, keywords, and album organization data.

The database includes photos organized by album hierarchy (year > event > specific album) such as:
- 2025 > Arizona Cup > Friday AM - U21/U18
- 2025 > Arizona Cup > Friday PM - Sr 50+ practice  
- 2025 > Gator Cup > Friday PM - Snrs, 50+, Paras practice

When users ask for photos, use the available search functions to find relevant images, then provide a helpful conversational response with the results.

Key guidelines:
1. Use function calls to search the image database
2. Be conversational and helpful in your responses
3. Include relevant photo details and SmugMug links when available
4. If no results found, suggest alternative search terms
5. For specific requests like "find 10 photos", use filterByCount to limit results
6. When users mention events, years, or album names, use searchByAlbum for better results
7. The database contains current photos from 2025 events, so don't assume future dates are invalid`;

            const requestBody = {
                model: model,
                messages: [
                    {
                        role: "system",
                        content: systemMessage
                    },
                    {
                        role: "user",
                        content: userQuery
                    }
                ],
                tools: availableFunctions.map(func => ({
                    type: "function",
                    function: {
                        name: func.name,
                        description: func.description,
                        parameters: func.parameters
                    }
                })),
                tool_choice: "auto",
                max_tokens: 1500,
                temperature: 0.1
            };

            const response = await this.makeRequest('/v1/chat/completions', 'POST', requestBody);
            
            return {
                success: true,
                response: response,
                model: response.model,
                usage: response.usage,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('[OpenAI Conversational Query Error]', error);
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Test the API connection
     * @param {string} model - Model to test with (default: gpt-3.5-turbo)
     * @returns {Promise<Object>} Connection test result with details
     */
    async testConnection(model = 'gpt-3.5-turbo') {
        try {
            const connectionTestStart = Date.now();
            
            // Create a simple test request to verify API key
            const testBody = {
                model: model,
                messages: [
                    {
                        role: "user",
                        content: "Test connection"
                    }
                ],
                max_tokens: 10,
                temperature: 0
            };

            const response = await this.makeRequest('/v1/chat/completions', 'POST', testBody);
            
            return { 
                success: true, 
                model: model,
                responseTime: Date.now() - connectionTestStart
            };
        } catch (error) {
            console.error('[OpenAI API Test Failed]', error.message);
            throw new Error(`OpenAI API connection failed: ${error.message}`);
        }
    }

    /**
     * Get available models for the current API key
     * @returns {Promise<Array>} List of available models
     */
    async getAvailableModels() {
        try {
            const response = await this.makeRequest('/v1/models', 'GET');
            
            // Filter for vision and chat models that are useful for our application
            const relevantModels = response.data.filter(model => {
                const id = model.id;
                return id.includes('gpt-4') && (id.includes('vision') || id.includes('turbo') || id.includes('gpt-4o'));
            });

            return relevantModels.map(model => ({
                id: model.id,
                name: model.id,
                capabilities: this.getModelCapabilities(model.id)
            }));

        } catch (error) {
            console.error('[OpenAI Models Error]', error);
            // Return default models if API call fails
            return [
                { id: 'gpt-4-vision-preview', name: 'GPT-4 Vision Preview', capabilities: ['vision', 'chat'] },
                { id: 'gpt-4-turbo-preview', name: 'GPT-4 Turbo Preview', capabilities: ['chat', 'functions'] },
                { id: 'gpt-4o', name: 'GPT-4o', capabilities: ['vision', 'chat', 'functions'] }
            ];
        }
    }

    /**
     * Get capabilities for a specific model
     * @param {string} modelId - Model identifier
     * @returns {Array} Array of capabilities
     */
    getModelCapabilities(modelId) {
        if (modelId.includes('vision') || modelId.includes('gpt-4o')) {
            return ['vision', 'chat', 'functions'];
        } else if (modelId.includes('gpt-4')) {
            return ['chat', 'functions'];
        } else {
            return ['chat'];
        }
    }
}

module.exports = OpenAIClient;
