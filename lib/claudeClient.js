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
     * @param {string} preContext - Optional pre-context to add before the main prompt
     * @param {string} model - Optional model to use for analysis (defaults to claude-3-haiku-20240307)
     * @returns {Promise<Object>} Analysis result with description and metadata
     */
    async analyzeImage(imageBuffer, mimeType, prompt = null, preContext = null, model = 'claude-3-haiku-20240307') {
        try {
            let processedImageBuffer = imageBuffer;
            
            // Step 1: Check and resize image dimensions if needed (Claude has 8000px limit)
            try {
                const metadata = await sharp(imageBuffer).metadata();
                const { width, height } = metadata;
                
                console.log(`Original image dimensions: ${width}x${height}`);
                
                // Check if image exceeds dimension limits
                const maxDimension = 2200; // Conservative limit well below 8000px
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
            
            // Step 2: Check file size and reduce quality if needed (Claude has 5MB limit)
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

            // Build the complete prompt with optional pre-context
            const completePrompt = this.buildCompletePrompt(preContext, prompt || defaultPrompt);

            const requestBody = {
                model: model,
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
                                text: completePrompt
                            }
                        ]
                    }
                ]
            };

            const response = await this.makeRequest('/v1/messages', 'POST', requestBody);
            
            // Parse the JSON response from Claude
            let analysisData;
            try {
                analysisData = JSON.parse(response.content[0].text);
            } catch (parseError) {
                // Fallback if Claude doesn't return valid JSON
                console.warn('Claude response was not valid JSON, using fallback parsing');
                analysisData = {
                    description: response.content[0].text,
                    keywords: []
                };
            }
            
            return {
                success: true,
                description: analysisData.description || response.content[0].text,
                keywords: analysisData.keywords || [],
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
     * Build complete prompt with optional pre-context
     * @param {string} preContext - Optional pre-context to add before the main prompt
     * @param {string} mainPrompt - Main analysis prompt
     * @returns {string} Complete prompt with pre-context and main prompt
     */
    buildCompletePrompt(preContext, mainPrompt) {
        if (!preContext || preContext.trim() === '') {
            return mainPrompt;
        }

        return `${preContext.trim()}

${mainPrompt}`;
    }

    /**
     * Process conversational query with function calling
     * @param {string} userQuery - User's natural language query
     * @param {Array} availableFunctions - Array of function definitions
     * @param {string} model - Optional model to use for chat (defaults to claude-3-5-sonnet-20241022)
     * @returns {Promise<Object>} Conversational response with results
     */
    async processConversationalQuery(userQuery, availableFunctions, model = 'claude-3-5-sonnet-20241022') {
        try {
            const systemMessage = `Hey there! I'm PhotoVision, your friendly photo discovery companion! 📸 I absolutely love helping people rediscover amazing moments in their photo collections. Think of me as that enthusiastic photography friend who knows exactly where to find that perfect shot you're looking for.

I've got access to your SmugMug collection filled with incredible archery competitions, award ceremonies, and so many other special moments. Every photo has been carefully analyzed with detailed descriptions and keywords - it's like having a personal photo curator who never forgets a face or moment!

Your photos are beautifully organized by events and dates, like:
• 2025 > Arizona Cup > Friday AM - U21/U18  
• 2025 > Arizona Cup > Friday PM - Sr 50+ practice
• 2025 > Gator Cup > Friday PM - Snrs, 50+, Paras practice

Just tell me what you're looking for in your own words! Want to see "happy kids celebrating" or "focused athletes in competition"? I'll search through everything and find those perfect moments for you.

**IMPORTANT: I understand negative keywords and exclusions!**
When you want to exclude certain elements from your search, you can use phrases like:
- "no people" or "without people" → excludes photos with people
- "no faces" or "without faces" → excludes photos with visible faces
- "exclude crowds" or "no crowds" → excludes photos with crowds
- "archery targets, no people" → finds archery targets but excludes any with people
- "outdoor scenes without buildings" → finds outdoor scenes but excludes any with buildings
- "animals but not dogs" → finds animals but excludes dogs
- "-crowd" → excludes photos with crowds

I'll use the intelligentSearch function for these queries as it automatically detects and processes negative keywords, ensuring you get exactly what you're looking for!

My conversational style:
- I'm genuinely excited about every search - your photos capture amazing stories!
- I'll ask follow-up questions if I need to understand what you're really looking for
- If I can't find exactly what you want, I'll suggest similar alternatives with enthusiasm
- I love sharing interesting details I notice about the photos I find
- I always include direct links so you can easily view and share your favorites
- I speak naturally, like we're having a real conversation about your photo memories

Let's dive in and explore your collection together!`;

            const requestBody = {
                model: model,
                max_tokens: 1500,
                system: systemMessage,
                tools: availableFunctions.map(func => ({
                    name: func.name,
                    description: func.description,
                    input_schema: func.parameters
                })),
                messages: [
                    {
                        role: "user",
                        content: userQuery
                    }
                ]
            };

            const response = await this.makeRequest('/v1/messages', 'POST', requestBody);
            
            return {
                success: true,
                response: response,
                model: response.model,
                usage: response.usage,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('[Claude Conversational Query Error]', error);
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Test the API connection
     * @param {string} model - Optional model to use for testing (defaults to claude-3-haiku-20240307)
     * @returns {Promise<Object>} Connection test result with details
     */
    async testConnection(model = 'claude-3-haiku-20240307') {
        try {
            const connectionTestStart = Date.now();
            
            // Create a simple test request to verify API key
            const testBody = {
                model: model,
                max_tokens: 10,
                messages: [
                    {
                        role: "user",
                        content: "Test connection"
                    }
                ]
            };

            const response = await this.makeRequest('/v1/messages', 'POST', testBody);
            
            return { 
                success: true, 
                model: model,
                responseTime: Date.now() - connectionTestStart
            };
        } catch (error) {
            console.error('[Claude API Test Failed]', error.message);
            throw new Error(`Claude API connection failed: ${error.message}`);
        }
    }
}

module.exports = ClaudeClient;
