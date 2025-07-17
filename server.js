require('dotenv').config();
const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const url = require('url');
const DataManager = require('./lib/dataManager');
const ClaudeClient = require('./lib/claudeClient');
const OpenAIClient = require('./lib/openaiClient');
const SmugMugClient = require('./lib/smugmugClient');
const JobQueue = require('./lib/jobQueue');

const PORT = process.env.PORT || 3000;
const dataManager = new DataManager();
const claudeClient = new ClaudeClient(process.env.ANTHROPIC_API_KEY);
const smugmugClient = new SmugMugClient(process.env.SMUGMUG_API_KEY, process.env.SMUGMUG_API_SECRET);
const jobQueue = new JobQueue();

// Simple MIME type mapping
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
};

// Logging utility
function log(message, type = 'INFO') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${type}: ${message}`);
}

// Error response utility
function sendError(res, statusCode, message, error = null) {
  if (error) {
    log(`Error: ${message} - ${error.message}`, 'ERROR');
  } else {
    log(`Error: ${message}`, 'ERROR');
  }
  
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    error: message,
    timestamp: new Date().toISOString()
  }));
}

// Success response utility
function sendSuccess(res, data, message = 'Success') {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  }));
}

// Simple static file server
async function serveStaticFile(filePath, res) {
  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
    log(`Served static file: ${filePath}`);
  } catch (error) {
    log(`Failed to serve static file: ${filePath} - ${error.message}`, 'ERROR');
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('File not found');
  }
}

// Parse JSON body from request
async function parseJSON(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error('Invalid JSON'));
      }
    });
  });
}

// Parse multipart form data for file uploads
async function parseMultipartData(req) {
  return new Promise((resolve, reject) => {
    let body = Buffer.alloc(0);
    
    req.on('data', chunk => {
      body = Buffer.concat([body, chunk]);
    });
    
    req.on('end', () => {
      try {
        const boundary = req.headers['content-type'].split('boundary=')[1];
        const parts = body.toString('binary').split(`--${boundary}`);
        const formData = {};
        
        for (let part of parts) {
          if (part.includes('Content-Disposition: form-data')) {
            const [headers, data] = part.split('\r\n\r\n');
            const nameMatch = headers.match(/name="([^"]+)"/);
            const filenameMatch = headers.match(/filename="([^"]+)"/);
            const typeMatch = headers.match(/Content-Type: ([^\r\n]+)/);
            
            if (nameMatch) {
              const name = nameMatch[1];
              const cleanData = data.replace(/\r\n$/, '');
              
              if (filenameMatch && typeMatch) {
                // File upload
                formData[name] = {
                  filename: filenameMatch[1],
                  type: typeMatch[1],
                  data: Buffer.from(cleanData, 'binary')
                };
              } else {
                // Regular field
                formData[name] = cleanData;
              }
            }
          }
        }
        
        resolve(formData);
      } catch (error) {
        reject(new Error('Failed to parse multipart data'));
      }
    });
    
    req.on('error', error => {
      reject(error);
    });
  });
}

// Generate a unique ID for records
function generateUniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// API Routes
async function handleAPIRoutes(req, res, parsedUrl) {
  const pathname = parsedUrl.pathname;
  const method = req.method;
  const query = parsedUrl.query;

  try {
    // Status endpoint
    if (pathname === '/api/status' && method === 'GET') {
      log('Status request received');
      const status = await dataManager.getStatus();
      return sendSuccess(res, status, 'Status retrieved successfully');
    }

    // Claude AI health check endpoint
    if (pathname === '/api/health/claude' && method === 'GET') {
      log('Claude health check request received');
      
      try {
        // Perform a simple test to verify Claude API is accessible
        const testResult = await claudeClient.testConnection();
        
        return sendSuccess(res, { 
          status: 'connected',
          model: testResult.model || 'claude-3-5-sonnet-20241022',
          timestamp: new Date().toISOString()
        }, 'Claude AI connection test successful');

      } catch (error) {
        log(`Claude health check failed: ${error.message}`, 'ERROR');
        return sendError(res, 500, 'Claude AI connection failed: ' + error.message);
      }
    }

    // Search endpoint
    if (pathname === '/api/search' && method === 'GET') {
      const searchQuery = query.q;
      if (!searchQuery) {
        return sendError(res, 400, 'Search query parameter "q" is required');
      }
      
      log(`Search request: "${searchQuery}"`);
      const results = await dataManager.searchImages(searchQuery);
      return sendSuccess(res, results, `Found ${results.length} images`);
    }

    // Load more results endpoint
    if (pathname === '/api/chat/load-more' && method === 'POST') {
      const requestData = await parseJSON(req);
      log(`Load more request: page ${requestData.page} for query "${requestData.originalQuery}"`);
      
      if (!requestData.originalQuery || typeof requestData.originalQuery !== 'string') {
        return sendError(res, 400, 'Original query is required');
      }

      try {
        // Import SearchFunctions
        const SearchFunctions = require('./lib/searchFunctions');
        const searchFunctions = new SearchFunctions();
        
        // Get AI configuration and determine which provider to use
        const config = await dataManager.getConfig();
        const aiConfig = config.ai || { provider: 'claude' };
        const provider = aiConfig.provider || 'claude';
        
        log(`Processing load more with AI provider: ${provider}`, 'DEBUG');
        
        // Re-execute the original search to get all results
        const availableFunctions = searchFunctions.getFunctionDefinitions();
        
        let aiResponse;
        if (provider === 'openai') {
          const apiKey = aiConfig.apiKeys?.openai || process.env.OPENAI_API_KEY;
          if (!apiKey) {
            throw new Error('OpenAI API key not configured');
          }
          const openaiAnalyzer = new OpenAIClient(apiKey);
          const model = aiConfig.models?.openai || 'gpt-4-turbo-preview';
          aiResponse = await openaiAnalyzer.processConversationalQuery(requestData.originalQuery, availableFunctions, model);
        } else {
          // Default to Claude
          const apiKey = aiConfig.apiKeys?.claude || process.env.ANTHROPIC_API_KEY;
          if (!apiKey) {
            throw new Error('Claude API key not configured');
          }
          const claudeAnalyzer = new ClaudeClient(apiKey);
          aiResponse = await claudeAnalyzer.processConversationalQuery(requestData.originalQuery, availableFunctions);
        }
        
        if (!aiResponse.success) {
          throw new Error(aiResponse.error);
        }
        
        let searchResults = [];
        const response = aiResponse.response;
        
        // Process function calls to get search results
        if (response.content) {
          for (const contentBlock of response.content) {
            if (contentBlock.type === 'tool_use') {
              try {
                const functionResult = await searchFunctions.executeFunction(
                  contentBlock.name, 
                  contentBlock.input
                );
                
                if (Array.isArray(functionResult)) {
                  searchResults = searchResults.concat(functionResult);
                }
              } catch (funcError) {
                console.error(`[Load More] Function ${contentBlock.name} error:`, funcError.message);
              }
            }
          }
        }
        
        // Apply pagination
        const page = parseInt(requestData.page || '1');
        const limit = parseInt(requestData.limit || '10');
        const paginatedData = searchFunctions.paginateResults(searchResults, page, limit);
        
        return sendSuccess(res, {
          results: searchFunctions.formatResults(paginatedData.results),
          pagination: paginatedData.pagination,
          resultCount: searchResults.length
        }, 'More results loaded');
        
      } catch (error) {
        log(`Load more error: ${error.message}`, 'ERROR');
        return sendError(res, 500, 'Failed to load more results: ' + error.message);
      }
    }

    // Chat endpoint with conversational search functionality
    if (pathname === '/api/chat' && method === 'POST') {
      const requestData = await parseJSON(req);
      log(`Chat request: ${requestData.message}`);
      
      if (!requestData.message || typeof requestData.message !== 'string') {
        return sendError(res, 400, 'Message is required');
      }

      try {
        // Import SearchFunctions
        const SearchFunctions = require('./lib/searchFunctions');
        const searchFunctions = new SearchFunctions();
        
        console.log(`[Chat] Processing query: "${requestData.message}"`);
        
        // Get AI configuration and determine which provider to use
        const config = await dataManager.getConfig();
        const aiConfig = config.ai || { provider: 'claude' };
        const provider = aiConfig.provider || 'claude';
        
        log(`Processing chat with AI provider: ${provider}`, 'DEBUG');
        
        // Get available search functions
        const availableFunctions = searchFunctions.getFunctionDefinitions();
        
        // Process query with specified AI provider
        let aiResponse;
        if (provider === 'openai') {
          const apiKey = aiConfig.apiKeys?.openai || process.env.OPENAI_API_KEY;
          if (!apiKey) {
            throw new Error('OpenAI API key not configured');
          }
          const openaiAnalyzer = new OpenAIClient(apiKey);
          const model = aiConfig.models?.openai || 'gpt-4-turbo-preview';
          aiResponse = await openaiAnalyzer.processConversationalQuery(requestData.message, availableFunctions, model);
        } else {
          // Default to Claude
          const apiKey = aiConfig.apiKeys?.claude || process.env.ANTHROPIC_API_KEY;
          if (!apiKey) {
            throw new Error('Claude API key not configured');
          }
          const claudeAnalyzer = new ClaudeClient(apiKey);
          aiResponse = await claudeAnalyzer.processConversationalQuery(requestData.message, availableFunctions);
        }
        
        if (!aiResponse.success) {
          throw new Error(aiResponse.error);
        }
        
        // Handle AI response and function calls
        let finalResponse = '';
        let searchResults = [];
        
        const response = aiResponse.response;
        
        // Process any function calls Claude made
        if (response.content) {
          for (const contentBlock of response.content) {
            if (contentBlock.type === 'tool_use') {
              console.log(`[Chat] Executing function: ${contentBlock.name} with params:`, contentBlock.input);
              
              try {
                const functionResult = await searchFunctions.executeFunction(
                  contentBlock.name, 
                  contentBlock.input
                );
                
                // Store results for final response
                if (Array.isArray(functionResult)) {
                  searchResults = searchResults.concat(functionResult);
                }
                
                console.log(`[Chat] Function ${contentBlock.name} returned ${Array.isArray(functionResult) ? functionResult.length : 'non-array'} results`);
                
              } catch (funcError) {
                console.error(`[Chat] Function ${contentBlock.name} error:`, funcError.message);
              }
            } else if (contentBlock.type === 'text') {
              finalResponse += contentBlock.text;
            }
          }
        }
        
        // If AI made function calls but we need the final response, make another request
        if (response.content.some(block => block.type === 'tool_use') && !finalResponse) {
          console.log(`[Chat] Getting final response from ${provider} with search results`);
          
          // Create a follow-up request with the search results
          if (provider === 'openai') {
            const apiKey = aiConfig.apiKeys?.openai || process.env.OPENAI_API_KEY;
            const openaiAnalyzer = new OpenAIClient(apiKey);
            const model = aiConfig.models?.openai || 'gpt-4-turbo-preview';
            
            const followUpBody = {
              model: model,
              max_tokens: 1000,
              messages: [
                {
                  role: "system",
                  content: `You are PhotoVision, an intelligent image discovery assistant. Format the search results into a helpful conversational response.`
                },
                {
                  role: "user",
                  content: requestData.message
                },
                {
                  role: "assistant",
                  content: JSON.stringify(response.content)
                },
                {
                  role: "user",
                  content: `Here are the search results: ${JSON.stringify(searchFunctions.formatResults(searchResults), null, 2)}. Please provide a conversational response about these results.`
                }
              ]
            };
            
            const followUpResponse = await openaiAnalyzer.makeRequest('/v1/chat/completions', 'POST', followUpBody);
            
            if (followUpResponse.choices && followUpResponse.choices[0] && followUpResponse.choices[0].message) {
              finalResponse = followUpResponse.choices[0].message.content || 'I found some results but had trouble formatting the response.';
            }
          } else {
            // Claude
            const apiKey = aiConfig.apiKeys?.claude || process.env.ANTHROPIC_API_KEY;
            const claudeAnalyzer = new ClaudeClient(apiKey);
            
            const followUpBody = {
              model: "claude-3-5-sonnet-20241022",
              max_tokens: 1000,
              system: `You are PhotoVision, an intelligent image discovery assistant. Format the search results into a helpful conversational response.`,
              messages: [
                {
                  role: "user",
                  content: requestData.message
                },
                {
                  role: "assistant",
                  content: response.content
                },
                {
                  role: "user",
                  content: `Here are the search results: ${JSON.stringify(searchFunctions.formatResults(searchResults), null, 2)}. Please provide a conversational response about these results.`
                }
              ]
            };
            
            const followUpResponse = await claudeAnalyzer.makeRequest('/v1/messages', 'POST', followUpBody);
            
            if (followUpResponse.content && followUpResponse.content[0]) {
              finalResponse = followUpResponse.content[0].text || 'I found some results but had trouble formatting the response.';
            }
          }
        }
        
        // Apply pagination to results (limit to 10 by default)
        const page = parseInt(requestData.page || '0');
        const limit = parseInt(requestData.limit || '10');
        const paginatedData = searchFunctions.paginateResults(searchResults, page, limit);
        
        // Fallback response if no text was generated
        if (!finalResponse) {
          if (searchResults.length > 0) {
            const showing = `Showing ${paginatedData.pagination.startIndex + 1}-${paginatedData.pagination.endIndex} of ${paginatedData.pagination.total}`;
            finalResponse = `I found ${searchResults.length} photo${searchResults.length === 1 ? '' : 's'} matching your query. ${showing} results with their SmugMug links.`;
          } else {
            finalResponse = "I didn't find any photos matching your query. Try different search terms like 'archery', 'competition', 'celebration', or describe what you're looking for.";
          }
        }
        
        return sendSuccess(res, {
          response: finalResponse,
          results: searchFunctions.formatResults(paginatedData.results),
          pagination: paginatedData.pagination,
          resultCount: searchResults.length,
          originalQuery: requestData.message
        }, 'Chat message processed');
        
      } catch (error) {
        log(`Chat processing error: ${error.message}`, 'ERROR');
        return sendError(res, 500, 'Failed to process chat message: ' + error.message);
      }
    }

    // Images endpoint
    if (pathname === '/api/images' && method === 'GET') {
      log('Images list request');
      const images = await dataManager.getImages();
      return sendSuccess(res, images, `Retrieved ${images.length} images`);
    }

    // Config endpoint
    if (pathname === '/api/config' && method === 'GET') {
      log('Config request');
      const config = await dataManager.getConfig();
      return sendSuccess(res, config, 'Configuration retrieved');
    }

    // Update config endpoint
    if (pathname === '/api/config' && method === 'POST') {
      const requestData = await parseJSON(req);
      log(`Config update request: ${JSON.stringify(requestData)}`);
      
      if (!requestData.key || requestData.value === undefined) {
        return sendError(res, 400, 'Both "key" and "value" are required');
      }
      
      const config = await dataManager.updateConfig(requestData.key, requestData.value);
      return sendSuccess(res, config, 'Configuration updated');
    }

    // Image analysis endpoint
    if (pathname === '/api/analyze' && method === 'POST') {
      log('Image analysis request received');
      
      // Check if Claude API key is configured
      if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_anthropic_api_key_here') {
        return sendError(res, 500, 'Claude API key not configured');
      }

      const contentType = req.headers['content-type'];
      if (!contentType || !contentType.startsWith('multipart/form-data')) {
        return sendError(res, 400, 'Expected multipart/form-data');
      }

      try {
        const formData = await parseMultipartData(req);
        
        if (!formData.image) {
          return sendError(res, 400, 'No image provided');
        }

        // Validate image type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(formData.image.type)) {
          return sendError(res, 400, 'Unsupported image type');
        }

        log('Starting image analysis...');

        // Get AI configuration and determine which provider to use
        const config = await dataManager.getConfig();
        const aiConfig = config.ai || { provider: 'claude' };
        const provider = aiConfig.provider || 'claude';
        
        log(`Starting image analysis with provider: ${provider}...`);

        // Analyze image with specified AI provider
        let analysisResult;
        if (provider === 'openai') {
          const apiKey = aiConfig.apiKeys?.openai || process.env.OPENAI_API_KEY;
          if (!apiKey) {
            return sendError(res, 500, 'OpenAI API key not configured');
          }
          const openaiAnalyzer = new OpenAIClient(apiKey);
          const model = aiConfig.models?.openai || 'gpt-4-vision-preview';
          analysisResult = await openaiAnalyzer.analyzeImage(
            formData.image.data,
            formData.image.type,
            formData.prompt || null,
            model
          );
        } else {
          // Default to Claude
          const apiKey = aiConfig.apiKeys?.claude || process.env.ANTHROPIC_API_KEY;
          if (!apiKey) {
            return sendError(res, 500, 'Claude API key not configured');
          }
          const claudeAnalyzer = new ClaudeClient(apiKey);
          analysisResult = await claudeAnalyzer.analyzeImage(
            formData.image.data,
            formData.image.type,
            formData.prompt || null
          );
        }

        if (!analysisResult.success) {
          log(`Image analysis failed: ${analysisResult.error}`, 'ERROR');
          return sendError(res, 500, 'Image analysis failed: ' + analysisResult.error);
        }

        log('Image analysis completed successfully');

        return sendSuccess(res, {
          filename: formData.image.filename || 'uploaded_image',
          mimeType: formData.image.type,
          size: formData.image.data.length,
          analysis: {
            description: analysisResult.description,
            keywords: analysisResult.keywords || []
          },
          metadata: {
            model: analysisResult.model,
            usage: analysisResult.usage,
            timestamp: analysisResult.timestamp
          }
        }, 'Image analyzed successfully');

      } catch (error) {
        return sendError(res, 500, 'Failed to process image', error);
      }
    }

    // AI provider test endpoint
    if (pathname === '/api/ai/test' && method === 'POST') {
      log('AI provider test request');
      
      try {
        const requestData = await parseJSON(req);
        const { provider, apiKey } = requestData;
        
        if (!provider || !apiKey) {
          return sendError(res, 400, 'Provider and API key are required');
        }
        
        let testResult;
        
        if (provider === 'claude') {
          const testClient = new ClaudeClient(apiKey);
          testResult = await testClient.testConnection();
          testResult.provider = 'claude';
        } else if (provider === 'openai') {
          const testClient = new OpenAIClient(apiKey);
          testResult = await testClient.testConnection();
          testResult.provider = 'openai';
        } else {
          return sendError(res, 400, `Unsupported provider: ${provider}`);
        }
        
        return sendSuccess(res, testResult, `${provider} API connection test completed`);
        
      } catch (error) {
        return sendError(res, 500, `API test failed: ${error.message}`);
      }
    }

    // AI provider configuration endpoint
    if (pathname === '/api/ai/config' && method === 'GET') {
      log('AI config request');
      
      try {const config = await dataManager.getConfig();
        const aiConfig = config.ai || {
          provider: 'claude',
          apiKeys: {},
          models: {
            claude: 'claude-3-5-sonnet-20241022',
            openai: 'gpt-4-vision-preview'
          }
        };
        
        // Return configuration with hasApiKey flags for security
        const safeConfig = {
          ...aiConfig,
          hasApiKey: !!(aiConfig.apiKeys && (aiConfig.apiKeys.claude || aiConfig.apiKeys.openai))
        };
        
        // Don't return actual API keys
        delete safeConfig.apiKeys;
        
        return sendSuccess(res, safeConfig, 'AI configuration retrieved');
        
      } catch (error) {
        return sendError(res, 500, 'Failed to get AI configuration', error);
      }
    }

    if (pathname === '/api/ai/config' && method === 'POST') {
      log('AI config update request');
      
      try {
        const requestData = await parseJSON(req);
        const { provider, apiKey, model } = requestData;
        
        if (!provider) {
          return sendError(res, 400, 'Provider is required');
        }
        
        // Get current config
        const config = await dataManager.getConfig();
        const aiConfig = config.ai || {
          provider: 'claude',
          apiKeys: {},
          models: {
            claude: 'claude-3-5-sonnet-20241022',
            openai: 'gpt-4-vision-preview'
          }
        };
        
        // Update provider
        aiConfig.provider = provider;
        
        // Update API key if provided
        if (apiKey) {
          aiConfig.apiKeys = aiConfig.apiKeys || {};
          aiConfig.apiKeys[provider] = apiKey;
        }
        
        // Update model if provided
        if (model) {
          aiConfig.models = aiConfig.models || {};
          aiConfig.models[provider] = model;
        }
        
        // Save updated config
        await dataManager.updateConfig('ai', aiConfig);
        
        return sendSuccess(res, aiConfig, 'AI configuration updated');
        
      } catch (error) {
        return sendError(res, 500, 'Failed to update AI configuration', error);
      }
    }

    if (pathname === '/api/ai/config' && method === 'DELETE') {
      log('AI config clear request');
      
      try {
        // Clear all AI configuration
        await dataManager.updateConfig('ai', {
          provider: 'claude',
          apiKeys: {},
          models: {
            claude: 'claude-3-5-sonnet-20241022',
            openai: 'gpt-4-vision-preview'
          }
        });
        
        return sendSuccess(res, {}, 'AI configuration cleared');
        
      } catch (error) {
        return sendError(res, 500, 'Failed to clear AI configuration', error);
      }
    }

    // AI provider models endpoint
    if (pathname === '/api/ai/models' && method === 'GET') {
      log('AI models request');
      
      try {
        const provider = query.provider;
        
        if (!provider) {
          return sendError(res, 400, 'Provider query parameter is required');
        }
        
        let models = [];
        
        if (provider === 'claude') {
          // Claude models are fixed - we define them here
          models = [
            { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', capabilities: ['vision', 'chat', 'functions'] },
            { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', capabilities: ['vision', 'chat', 'functions'] },
            { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', capabilities: ['vision', 'chat', 'functions'] }
          ];
        } else if (provider === 'openai') {
          // For OpenAI, we can try to fetch models dynamically if API key is available
          const config = await dataManager.getConfig();
          const apiKey = config.ai?.apiKeys?.openai || process.env.OPENAI_API_KEY;
          
          if (apiKey) {
            try {
              const testClient = new OpenAIClient(apiKey);
              models = await testClient.getAvailableModels();
            } catch (error) {
              log(`Failed to fetch OpenAI models: ${error.message}`, 'WARN');
              // Fallback to default models
              models = [
                { id: 'gpt-4-vision-preview', name: 'GPT-4 Vision Preview', capabilities: ['vision', 'chat'] },
                { id: 'gpt-4-turbo-preview', name: 'GPT-4 Turbo Preview', capabilities: ['chat', 'functions'] },
                { id: 'gpt-4o', name: 'GPT-4o', capabilities: ['vision', 'chat', 'functions'] }
              ];
            }
          } else {
            // Default models when no API key
            models = [
              { id: 'gpt-4-vision-preview', name: 'GPT-4 Vision Preview', capabilities: ['vision', 'chat'] },
              { id: 'gpt-4-turbo-preview', name: 'GPT-4 Turbo Preview', capabilities: ['chat', 'functions'] },
              { id: 'gpt-4o', name: 'GPT-4o', capabilities: ['vision', 'chat', 'functions'] }
            ];
          }
        } else {
          return sendError(res, 400, `Unsupported provider: ${provider}`);
        }
        
        return sendSuccess(res, { models }, `Retrieved ${models.length} models for ${provider}`);
        
      } catch (error) {
        return sendError(res, 500, 'Failed to get models', error);
      }
    }

    // SmugMug OAuth start endpoint
    if (pathname === '/api/smugmug/auth-start' && method === 'POST') {
      log('SmugMug OAuth start request');
      
      // Check if SmugMug API keys are configured
      if (!process.env.SMUGMUG_API_KEY || !process.env.SMUGMUG_API_SECRET) {
        return sendError(res, 500, 'SmugMug API keys not configured');
      }

      try {
        const callbackUrl = `http://localhost:${PORT}/api/smugmug/callback`;
        const requestTokenResult = await smugmugClient.getRequestToken(callbackUrl);
        
        if (!requestTokenResult.success) {
          return sendError(res, 500, 'Failed to get request token: ' + requestTokenResult.error);
        }

        // Store request token in config for later use
        await dataManager.updateConfig('smugmug.requestToken', requestTokenResult.token);
        await dataManager.updateConfig('smugmug.requestTokenSecret', requestTokenResult.tokenSecret);
        
        // Generate authorization URL
        const authUrl = smugmugClient.getAuthorizationUrl(
          requestTokenResult.token,
          'Public', // Access level
          'Read'    // Permissions
        );

        return sendSuccess(res, {
          authUrl: authUrl,
          requestToken: requestTokenResult.token
        }, 'Authorization URL generated');

      } catch (error) {
        return sendError(res, 500, 'OAuth start failed', error);
      }
    }

    // SmugMug OAuth callback endpoint
    if (pathname === '/api/smugmug/callback' && method === 'GET') {
      log('SmugMug OAuth callback received');
      
      const verifier = query.oauth_verifier;
      const token = query.oauth_token;
      
      if (!verifier || !token) {
        return sendError(res, 400, 'Missing OAuth verifier or token');
      }

      try {
        // Get stored request token secret
        const config = await dataManager.getConfig();
        const requestTokenSecret = config.smugmug.requestTokenSecret;
        
        if (!requestTokenSecret) {
          return sendError(res, 400, 'Request token secret not found');
        }

        // Exchange for access token
        const accessTokenResult = await smugmugClient.getAccessToken(
          token,
          requestTokenSecret,
          verifier
        );
        
        if (!accessTokenResult.success) {
          return sendError(res, 500, 'Failed to get access token: ' + accessTokenResult.error);
        }

        // Store access tokens
        await dataManager.updateConfig('smugmug.accessToken', accessTokenResult.token);
        await dataManager.updateConfig('smugmug.accessTokenSecret', accessTokenResult.tokenSecret);
        await dataManager.updateConfig('smugmug.connected', true);
        await dataManager.updateConfig('smugmug.lastSync', new Date().toISOString());

        // Get user info
        const userResult = await smugmugClient.getAuthUser(
          accessTokenResult.token,
          accessTokenResult.tokenSecret
        );

        if (userResult.success) {
          await dataManager.updateConfig('smugmug.user', userResult.user);
        }

        // Clean up request tokens
        await dataManager.updateConfig('smugmug.requestToken', null);
        await dataManager.updateConfig('smugmug.requestTokenSecret', null);

        // Redirect to success page
        res.writeHead(302, {
          'Location': '/?smugmug=connected'
        });
        res.end();

      } catch (error) {
        return sendError(res, 500, 'OAuth callback failed', error);
      }
    }

    // SmugMug disconnect endpoint
    if (pathname === '/api/smugmug/disconnect' && method === 'POST') {
      log('SmugMug disconnect request');
      
      try {
        // Clear all SmugMug tokens and data
        await dataManager.updateConfig('smugmug.connected', false);
        await dataManager.updateConfig('smugmug.accessToken', null);
        await dataManager.updateConfig('smugmug.accessTokenSecret', null);
        await dataManager.updateConfig('smugmug.user', null);
        await dataManager.updateConfig('smugmug.lastSync', null);

        return sendSuccess(res, {}, 'SmugMug account disconnected');

      } catch (error) {
        return sendError(res, 500, 'Disconnect failed', error);
      }
    }

    // SmugMug connection status endpoint
    if (pathname === '/api/smugmug/status' && method === 'GET') {
      log('SmugMug status request');
      
      try {
        const config = await dataManager.getConfig();
        const smugmugConfig = config.smugmug || {};

        // Test connection if we have tokens
        let connectionValid = false;
        let user = null;

        if (smugmugConfig.connected && smugmugConfig.accessToken && smugmugConfig.accessTokenSecret) {
          const testResult = await smugmugClient.testConnection(
            smugmugConfig.accessToken,
            smugmugConfig.accessTokenSecret
          );
          
          connectionValid = testResult.success;
          user = testResult.user || smugmugConfig.user;
          
          // Update connection status if test failed
          if (!connectionValid) {
            await dataManager.updateConfig('smugmug.connected', false);
          }
        }

        return sendSuccess(res, {
          connected: connectionValid,
          user: user,
          lastSync: smugmugConfig.lastSync
        }, 'SmugMug status retrieved');

      } catch (error) {
        return sendError(res, 500, 'Status check failed', error);
      }
    }

    // SmugMug albums endpoint
    if (pathname === '/api/smugmug/albums' && method === 'GET') {
      log('SmugMug albums request');
      
      try {
        const config = await dataManager.getConfig();
        const smugmugConfig = config.smugmug || {};

        if (!smugmugConfig.connected || !smugmugConfig.accessToken) {
          return sendError(res, 401, 'SmugMug not connected');
        }

        // Check if user object and URI exist
        if (!smugmugConfig.user || !smugmugConfig.user.Uri) {
          return sendError(res, 500, 'SmugMug user information not available');
        }

        // Use the base user URI (the getUserAlbums method will append !albums)
        const albumsResult = await smugmugClient.getUserAlbums(
          smugmugConfig.accessToken,
          smugmugConfig.accessTokenSecret,
          smugmugConfig.user.Uri
        );

        if (!albumsResult.success) {
          return sendError(res, 500, 'Failed to get albums: ' + albumsResult.error);
        }

        return sendSuccess(res, {
          albums: albumsResult.albums
        }, `Retrieved ${albumsResult.albums.length} albums`);

      } catch (error) {
        return sendError(res, 500, 'Albums request failed', error);
      }
    }

    // SmugMug album images endpoint
    if (pathname.startsWith('/api/smugmug/album/') && pathname.endsWith('/images') && method === 'GET') {
      const albumKey = pathname.split('/')[4]; // Extract album key from URL
      log(`SmugMug album images request for album: ${albumKey}`);
      
      try {
        const config = await dataManager.getConfig();
        const smugmugConfig = config.smugmug || {};

        if (!smugmugConfig.connected || !smugmugConfig.accessToken) {
          return sendError(res, 401, 'SmugMug not connected');
        }

        const albumUri = `/api/v2/album/${albumKey}`;
        const imagesResult = await smugmugClient.getAlbumImages(
          smugmugConfig.accessToken,
          smugmugConfig.accessTokenSecret,
          albumUri
        );

        if (!imagesResult.success) {
          return sendError(res, 500, 'Failed to get album images: ' + imagesResult.error);
        }

        return sendSuccess(res, {
          albumKey: albumKey,
          images: imagesResult.images
        }, `Retrieved ${imagesResult.images.length} images from album`);

      } catch (error) {
        return sendError(res, 500, 'Album images request failed', error);
      }
    }

    // SmugMug album processing status endpoint
    if (pathname.startsWith('/api/smugmug/album/') && pathname.endsWith('/processing-status') && method === 'GET') {
      const albumKey = pathname.split('/')[4]; // Extract album key from URL
      log(`SmugMug album processing status request for album: ${albumKey}`);
      
      try {
        const config = await dataManager.getConfig();
        const smugmugConfig = config.smugmug || {};

        if (!smugmugConfig.connected || !smugmugConfig.accessToken) {
          return sendError(res, 401, 'SmugMug not connected');
        }

        // Get album images from SmugMug
        const albumUri = `/api/v2/album/${albumKey}`;
        const imagesResult = await smugmugClient.getAlbumImages(
          smugmugConfig.accessToken,
          smugmugConfig.accessTokenSecret,
          albumUri
        );

        if (!imagesResult.success) {
          return sendError(res, 500, 'Failed to get album images: ' + imagesResult.error);
        }

        // Get processed images for this album
        const albumProcessingStatus = await dataManager.getAlbumProcessingStatus(albumKey, imagesResult.images);

        // Get actual duplicate statistics by checking individual images
        const processedImageKeys = new Set(albumProcessingStatus.processedImageKeys);
        const duplicateAnalysis = imagesResult.images.map(img => ({
          imageKey: img.ImageKey,
          filename: img.FileName || 'unknown',
          isProcessed: processedImageKeys.has(img.ImageKey),
          duplicateStatus: processedImageKeys.has(img.ImageKey) ? 'duplicate' : 'new'
        }));

        // Calculate accurate duplicate statistics
        const duplicateStats = duplicateAnalysis.reduce((stats, img) => {
          if (img.isProcessed) {
            stats.duplicatesFound++;
          } else {
            stats.newImagesAvailable++;
          }
          return stats;
        }, {
          duplicatesFound: 0,
          newImagesAvailable: 0,
          skippedDuplicates: 0,
          updatedDuplicates: 0,
          replacedDuplicates: 0
        });

        // Enhanced response with detailed duplicate detection statistics
        const enhancedStatus = {
          ...albumProcessingStatus,
          duplicateHandlingOptions: ['skip', 'update', 'replace'],
          duplicateStatistics: {
            ...duplicateStats,
            totalDuplicatesDetected: duplicateStats.duplicatesFound,
            duplicatePercentage: albumProcessingStatus.totalImages > 0 ? 
              Math.round((duplicateStats.duplicatesFound / albumProcessingStatus.totalImages) * 100) : 0,
            processingEfficiency: albumProcessingStatus.totalImages > 0 ? 
              Math.round((duplicateStats.newImagesAvailable / albumProcessingStatus.totalImages) * 100) : 100
          },
          processingModes: {
            available: ['normal', 'force_reprocessing'],
            recommended: albumProcessingStatus.isCompletelyProcessed ? 'force_reprocessing' : 'normal',
            descriptions: {
              normal: 'Skip already processed images (recommended for regular processing)',
              force_reprocessing: 'Reprocess all images regardless of duplicates (use for updating analysis)'
            }
          },
          duplicateDetectionEnabled: true,
          processingRecommendation: {
            shouldProcess: !albumProcessingStatus.isCompletelyProcessed || duplicateStats.newImagesAvailable > 0,
            reason: albumProcessingStatus.isCompletelyProcessed ? 
              'All images have been processed - use force reprocessing to update analysis' : 
              `${duplicateStats.newImagesAvailable} new images available for processing`,
            suggestedMode: albumProcessingStatus.isCompletelyProcessed ? 'force_reprocessing' : 'normal',
            estimatedTime: Math.ceil(duplicateStats.newImagesAvailable * 0.5), // Estimated minutes (30 seconds per image)
            duplicateHandlingSuggestion: duplicateStats.duplicatesFound > 0 ? 'skip' : 'update'
          },
          // Detailed breakdown for UI display
          imageBreakdown: {
            totalImages: albumProcessingStatus.totalImages,
            processedImages: albumProcessingStatus.processedImages,
            newImages: duplicateStats.newImagesAvailable,
            duplicates: duplicateStats.duplicatesFound,
            processingProgress: albumProcessingStatus.processingProgress
          }
        };

        return sendSuccess(res, enhancedStatus, `Retrieved enhanced processing status for album ${albumKey}`);

      } catch (error) {
        return sendError(res, 500, 'Album processing status request failed', error);
      }
    }

    // Batch processing endpoints

    // Start batch processing endpoint
    if (pathname === '/api/batch/start' && method === 'POST') {
      log('Batch processing start request');

      try {
        const requestData = await parseJSON(req);
        
        // Extract duplicate handling parameters
        const {
          albumKey,
          duplicateHandling = 'skip',
          forceReprocessing = false,
          maxImages = 50,
          batchName
        } = requestData;
        
        // Debug logging
        log(`Batch start request body: ${JSON.stringify(requestData)}`, 'DEBUG');
        log(`Duplicate handling: ${duplicateHandling}, Force reprocessing: ${forceReprocessing}`, 'DEBUG');
        
        if (!albumKey) {
          log(`Missing albumKey in request: ${JSON.stringify(requestData)}`, 'ERROR');
          return sendError(res, 400, 'Album key is required');
        }

        // Validate duplicate handling parameter
        const validHandlingOptions = ['skip', 'update', 'replace'];
        if (!validHandlingOptions.includes(duplicateHandling)) {
          return sendError(res, 400, `Invalid duplicateHandling option. Must be one of: ${validHandlingOptions.join(', ')}`);
        }

        // Check SmugMug connection
        const config = await dataManager.getConfig();
        const smugmugConfig = config.smugmug || {};

        if (!smugmugConfig.connected || !smugmugConfig.accessToken) {
          return sendError(res, 401, 'SmugMug not connected');
        }

        // Get album details first to include hierarchy information
        log(`Fetching album details for album key: ${albumKey}`, 'DEBUG');
        const albumDetailsResult = await smugmugClient.getAlbumDetails(
          smugmugConfig.accessToken,
          smugmugConfig.accessTokenSecret,
          albumKey
        );

        if (!albumDetailsResult.success) {
          log(`Failed to get album details: ${albumDetailsResult.error}`, 'ERROR');
          return sendError(res, 500, 'Failed to get album details: ' + albumDetailsResult.error);
        }

        const albumDetails = albumDetailsResult.album;
        
        // Validate that we have the required album information
        if (!albumDetails || !albumDetails.Name) {
          log(`Album details missing or incomplete for album ${albumKey}`, 'ERROR');
          return sendError(res, 500, 'Album details incomplete - missing album name');
        }

        // Validate hierarchy information
        if (!albumDetails.PathHierarchy || !Array.isArray(albumDetails.PathHierarchy) || albumDetails.PathHierarchy.length === 0) {
          log(`Album hierarchy information missing for album ${albumKey}. Album details:`, 'WARN');
          log(JSON.stringify(albumDetails, null, 2), 'DEBUG');
          return sendError(res, 500, 'Album hierarchy information missing - cannot process without path information');
        }

        if (!albumDetails.FullDisplayPath) {
          log(`Album display path missing for album ${albumKey}`, 'WARN');
          return sendError(res, 500, 'Album display path missing - cannot process without path information');
        }

        log(`Album details validated successfully:`, 'DEBUG');
        log(`  - Name: ${albumDetails.Name}`, 'DEBUG');
        log(`  - Path: ${albumDetails.FullDisplayPath}`, 'DEBUG');
        log(`  - Hierarchy: [${albumDetails.PathHierarchy.join(', ')}]`, 'DEBUG');

        // Get album images from SmugMug
        const albumUri = `/api/v2/album/${albumKey}`;
        const imagesResult = await smugmugClient.getAlbumImages(
          smugmugConfig.accessToken,
          smugmugConfig.accessTokenSecret,
          albumUri
        );

        if (!imagesResult.success) {
          return sendError(res, 500, 'Failed to get album images: ' + imagesResult.error);
        }

        if (imagesResult.images.length === 0) {
          return sendError(res, 400, 'No images found in album');
        }

        // Get processing status to identify duplicates
        log(`Getting album processing status for duplicate detection`, 'DEBUG');
        const processingStatus = await dataManager.getAlbumProcessingStatus(albumKey, imagesResult.images);
        
        log(`Processing status: ${processingStatus.processedImages}/${processingStatus.totalImages} images processed`, 'DEBUG');

        // Filter images based on duplicate detection and force reprocessing
        let imagesToProcess = imagesResult.images;
        let skippedImages = [];

        if (!forceReprocessing) {
          // Filter out already processed images
          imagesToProcess = imagesResult.images.filter(img => 
            !processingStatus.processedImageKeys.includes(img.ImageKey)
          );
          
          // Track skipped images
          skippedImages = imagesResult.images.filter(img => 
            processingStatus.processedImageKeys.includes(img.ImageKey)
          );
          
          log(`Filtered ${imagesToProcess.length} unprocessed images, skipped ${skippedImages.length} duplicates`, 'DEBUG');
        } else {
          log('Force reprocessing enabled - processing all images regardless of duplicates', 'DEBUG');
        }

        // Create comprehensive statistics
        const statistics = {
          totalImages: imagesResult.images.length,
          processedImages: processingStatus.processedImages,
          newImages: imagesToProcess.length,
          skippedImages: skippedImages.length,
          duplicateHandling: duplicateHandling,
          forceReprocessing: forceReprocessing,
          processingProgress: processingStatus.processingProgress,
          albumName: albumDetails.Name,
          albumPath: albumDetails.FullDisplayPath
        };

        log(`Batch statistics:`, 'INFO');
        log(`  Total images: ${statistics.totalImages}`, 'INFO');
        log(`  Already processed: ${statistics.processedImages}`, 'INFO');
        log(`  New to process: ${statistics.newImages}`, 'INFO');
        log(`  Skipped duplicates: ${statistics.skippedImages}`, 'INFO');
        log(`  Duplicate handling: ${statistics.duplicateHandling}`, 'INFO');
        log(`  Force reprocessing: ${statistics.forceReprocessing}`, 'INFO');

        // Create jobs for filtered images with album information and duplicate handling context
        const jobs = imagesToProcess
          .filter(img => img.ArchivedUri || (img.Uris && img.Uris.LargestImage))
          .slice(0, maxImages) // Limit batch size
          .map((image, index) => {
            const job = {
              id: `img_${albumKey}_${image.ImageKey}`,
              type: 'image_analysis',
              data: {
                imageUrl: image.ArchivedUri, // Use ArchivedUri for full-resolution image
                imageKey: image.ImageKey,
                filename: image.FileName || `image_${index + 1}`,
                title: image.Title || '',
                caption: image.Caption || ''
              },
              albumKey: albumKey,
              albumName: albumDetails.Name,
              albumPath: albumDetails.FullDisplayPath,
              albumHierarchy: albumDetails.PathHierarchy,
              imageName: image.FileName || `image_${index + 1}`,
              // Add duplicate handling context
              duplicateHandling: duplicateHandling,
              forceReprocessing: forceReprocessing
            };
            
            // Validate that album information is present in each job
            if (!job.albumName || !job.albumPath || !job.albumHierarchy || !Array.isArray(job.albumHierarchy)) {
              log(`Warning: Job ${job.id} missing album information:`, 'WARN');
              log(`  - albumName: ${job.albumName}`, 'DEBUG');
              log(`  - albumPath: ${job.albumPath}`, 'DEBUG');
              log(`  - albumHierarchy: ${JSON.stringify(job.albumHierarchy)}`, 'DEBUG');
            }
            
            return job;
          });

        if (jobs.length === 0) {
          // Check if all images were already processed
          if (imagesToProcess.length === 0 && !forceReprocessing) {
            return sendSuccess(res, {
              message: 'All images in this album have already been processed',
              statistics: statistics,
              batchId: null,
              jobCount: 0
            }, 'No new images to process');
          }
          
          return sendError(res, 400, 'No processable images found in album');
        }

        // Add jobs to queue
        const batchInfo = jobQueue.addBatch(jobs, batchName || `Album ${albumKey}`, statistics);

        // Define progress callback for real-time updates
        const onProgress = (progress) => {
          log(`Batch progress: ${progress.progress}% (${progress.processed}/${progress.total})`);
        };

        // Define completion callback
        const onComplete = (result) => {
          log(`Batch completed: ${result.processed} processed, ${result.failed} failed`);
        };

        // Define error callback
        const onError = (error) => {
          log(`Batch processing error: ${error.message}`, 'ERROR');
        };

        // Create image analysis processor with duplicate handling
        const processors = {
          image_analysis: async (imageData, job) => {
            log(`Processing image: ${imageData.filename} (duplicate handling: ${job.duplicateHandling})`);
            
            // Validate that job has complete album information before processing
            if (!job.albumKey || !job.albumName || !job.albumPath || !job.albumHierarchy) {
              const missingFields = [];
              if (!job.albumKey) missingFields.push('albumKey');
              if (!job.albumName) missingFields.push('albumName');
              if (!job.albumPath) missingFields.push('albumPath');
              if (!job.albumHierarchy) missingFields.push('albumHierarchy');
              
              const errorMsg = `Job ${job.id} missing required album information: ${missingFields.join(', ')}`;
              log(errorMsg, 'ERROR');
              throw new Error(errorMsg);
            }
            
            // Additional validation for albumHierarchy
            if (!Array.isArray(job.albumHierarchy) || job.albumHierarchy.length === 0) {
              const errorMsg = `Job ${job.id} has invalid album hierarchy: ${JSON.stringify(job.albumHierarchy)}`;
              log(errorMsg, 'ERROR');
              throw new Error(errorMsg);
            }
            
            log(`Album info for ${imageData.filename}:`, 'DEBUG');
            log(`  - Album: ${job.albumName}`, 'DEBUG');
            log(`  - Path: ${job.albumPath}`, 'DEBUG');
            log(`  - Hierarchy: [${job.albumHierarchy.join(', ')}]`, 'DEBUG');
            
            // Fetch image from SmugMug
            const imageResponse = await fetch(imageData.imageUrl);
            if (!imageResponse.ok) {
              throw new Error(`Failed to fetch image: ${imageResponse.status}`);
            }
            
            const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
            const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
            
            // Get AI configuration and determine which provider to use
            const config = await dataManager.getConfig();
            const aiConfig = config.ai || { provider: 'claude' };
            const provider = aiConfig.provider || 'claude';
            
            log(`Using AI provider: ${provider}`, 'DEBUG');
            
            // Analyze with specified AI provider
            let analysisResult;
            if (provider === 'openai') {
              const apiKey = aiConfig.apiKeys?.openai || process.env.OPENAI_API_KEY;
              if (!apiKey) {
                throw new Error('OpenAI API key not configured');
              }
              const openaiAnalyzer = new OpenAIClient(apiKey);
              const model = aiConfig.models?.openai || 'gpt-4-vision-preview';
              analysisResult = await openaiAnalyzer.analyzeImage(imageBuffer, contentType, null, model);
            } else {
              // Default to Claude
              const apiKey = aiConfig.apiKeys?.claude || process.env.ANTHROPIC_API_KEY;
              if (!apiKey) {
                throw new Error('Claude API key not configured');
              }
              const claudeAnalyzer = new ClaudeClient(apiKey);
              analysisResult = await claudeAnalyzer.analyzeImage(imageBuffer, contentType, null);
            }
            
            if (!analysisResult.success) {
              throw new Error(analysisResult.error);
            }

            // Store the result with album information and duplicate handling
            const imageRecord = {
              id: generateUniqueId(),
              filename: imageData.filename,
              smugmugImageKey: imageData.imageKey,
              smugmugUrl: imageData.imageUrl,
              title: imageData.title,
              caption: imageData.caption,
              albumKey: job.albumKey,
              albumName: job.albumName,
              albumPath: job.albumPath,
              albumHierarchy: job.albumHierarchy,
              description: analysisResult.description,
              keywords: analysisResult.keywords || [],
              metadata: {
                model: analysisResult.model,
                timestamp: analysisResult.timestamp,
                batchId: job.batchId,
                jobId: job.id
              }
            };

            // Final validation before saving
            const requiredFields = ['albumKey', 'albumName', 'albumPath', 'albumHierarchy'];
            const missingFields = requiredFields.filter(field => !imageRecord[field]);
            
            if (missingFields.length > 0) {
              const errorMsg = `Image record for ${imageData.filename} missing required fields: ${missingFields.join(', ')}`;
              log(errorMsg, 'ERROR');
              throw new Error(errorMsg);
            }
            
            log(`Saving image record with duplicate handling: ${job.duplicateHandling}`, 'DEBUG');

            // Save to data storage with duplicate handling options
            const saveResult = await dataManager.addImage(imageRecord, {
              duplicateHandling: job.duplicateHandling
            });
            
            return {
              imageKey: imageData.imageKey,
              description: analysisResult.description,
              keywords: analysisResult.keywords,
              saved: true,
              duplicateAction: saveResult.wasSkipped ? 'skipped' : 
                             saveResult.wasUpdated ? 'updated' : 
                             saveResult.wasReplaced ? 'replaced' : 'added'
            };
          }
        };

        // Start processing in background
        jobQueue.startProcessing(processors, onProgress, onComplete, onError)
          .catch(error => {
            log(`Batch processing failed: ${error.message}`, 'ERROR');
          });

        return sendSuccess(res, {
          batchId: batchInfo.batchId,
          jobCount: batchInfo.jobCount,
          albumKey: albumKey,
          statistics: statistics,
          message: `Started processing ${batchInfo.jobCount} images${statistics.skippedImages > 0 ? ` (${statistics.skippedImages} duplicates skipped)` : ''}`
        }, 'Batch processing started');

      } catch (error) {
        return sendError(res, 500, 'Failed to start batch processing', error);
      }
    }

    // Batch status endpoint
    if (pathname === '/api/batch/status' && method === 'GET') {
      log('Batch status request');
      
      try {
        const rawStatus = jobQueue.getStatus();
        
        // Transform JobQueue status to frontend-expected format
        const transformedStatus = {
          // Map to frontend-expected property names
          total: rawStatus.totalJobs,
          processed: rawStatus.processedCount,
          failed: rawStatus.failedCount,
          
          // Add missing status flags that frontend expects
          isComplete: !rawStatus.processing && rawStatus.totalJobs > 0 && 
                      (rawStatus.completedJobs + rawStatus.failedJobs) >= rawStatus.totalJobs,
          isPaused: !rawStatus.processing && rawStatus.totalJobs > 0 && 
                    (rawStatus.completedJobs + rawStatus.failedJobs) < rawStatus.totalJobs,
          isProcessing: rawStatus.processing,
          
          // Keep other useful properties
          batchId: rawStatus.batchId,
          currentJob: rawStatus.currentJob,
          progress: rawStatus.progress,
          failedJobs: rawStatus.failedJobDetails || [],
          
          // Additional properties for frontend
          startTime: rawStatus.startTime,
          estimatedCompletion: rawStatus.estimatedCompletion,
          
          // Include duplicate detection statistics
          duplicateStatistics: rawStatus.duplicateStatistics || null
        };
        
        return sendSuccess(res, transformedStatus, 'Batch status retrieved');
      } catch (error) {
        return sendError(res, 500, 'Failed to get batch status', error);
      }
    }

    // Batch pause endpoint
    if (pathname === '/api/batch/pause' && method === 'POST') {
      log('Batch pause request');
      
      try {
        const paused = jobQueue.pause();
        return sendSuccess(res, { paused }, paused ? 'Batch processing paused' : 'Batch not currently processing');
      } catch (error) {
        return sendError(res, 500, 'Failed to pause batch processing', error);
      }
    }

    // Batch resume endpoint
    if (pathname === '/api/batch/resume' && method === 'POST') {
      log('Batch resume request');
      
      try {
        // Create processors again for resume with duplicate handling
        const processors = {
          image_analysis: async (imageData, job) => {
            log(`Resuming processing for image: ${imageData.filename} (duplicate handling: ${job.duplicateHandling || 'skip'})`);
            
            // Validate that job has complete album information before processing
            if (!job.albumKey || !job.albumName || !job.albumPath || !job.albumHierarchy) {
              const missingFields = [];
              if (!job.albumKey) missingFields.push('albumKey');
              if (!job.albumName) missingFields.push('albumName');
              if (!job.albumPath) missingFields.push('albumPath');
              if (!job.albumHierarchy) missingFields.push('albumHierarchy');
              
              const errorMsg = `Resume job ${job.id} missing required album information: ${missingFields.join(', ')}`;
              log(errorMsg, 'ERROR');
              throw new Error(errorMsg);
            }
            
            // Additional validation for albumHierarchy
            if (!Array.isArray(job.albumHierarchy) || job.albumHierarchy.length === 0) {
              const errorMsg = `Resume job ${job.id} has invalid album hierarchy: ${JSON.stringify(job.albumHierarchy)}`;
              log(errorMsg, 'ERROR');
              throw new Error(errorMsg);
            }
            
            const imageResponse = await fetch(imageData.imageUrl);
            if (!imageResponse.ok) {
              throw new Error(`Failed to fetch image: ${imageResponse.status}`);
            }
            
            const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
            const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
            
            // Get AI configuration and determine which provider to use
            const config = await dataManager.getConfig();
            const aiConfig = config.ai || { provider: 'claude' };
            const provider = aiConfig.provider || 'claude';
            
            log(`Resuming with AI provider: ${provider}`, 'DEBUG');
            
            // Analyze with specified AI provider
            let analysisResult;
            if (provider === 'openai') {
              const apiKey = aiConfig.apiKeys?.openai || process.env.OPENAI_API_KEY;
              if (!apiKey) {
                throw new Error('OpenAI API key not configured');
              }
              const openaiAnalyzer = new OpenAIClient(apiKey);
              const model = aiConfig.models?.openai || 'gpt-4-vision-preview';
              analysisResult = await openaiAnalyzer.analyzeImage(imageBuffer, contentType, null, model);
            } else {
              // Default to Claude
              const apiKey = aiConfig.apiKeys?.claude || process.env.ANTHROPIC_API_KEY;
              if (!apiKey) {
                throw new Error('Claude API key not configured');
              }
              const claudeAnalyzer = new ClaudeClient(apiKey);
              analysisResult = await claudeAnalyzer.analyzeImage(imageBuffer, contentType, null);
            }
            
            if (!analysisResult.success) {
              throw new Error(analysisResult.error);
            }

            const imageRecord = {
              id: generateUniqueId(),
              filename: imageData.filename,
              smugmugImageKey: imageData.imageKey,
              smugmugUrl: imageData.imageUrl,
              title: imageData.title,
              caption: imageData.caption,
              albumKey: job.albumKey,
              albumName: job.albumName,
              albumPath: job.albumPath,
              albumHierarchy: job.albumHierarchy,
              description: analysisResult.description,
              keywords: analysisResult.keywords || [],
              metadata: {
                model: analysisResult.model,
                timestamp: analysisResult.timestamp,
                batchId: job.batchId,
                jobId: job.id
              }
            };

            // Final validation before saving
            const requiredFields = ['albumKey', 'albumName', 'albumPath', 'albumHierarchy'];
            const missingFields = requiredFields.filter(field => !imageRecord[field]);
            
            if (missingFields.length > 0) {
              const errorMsg = `Resume image record for ${imageData.filename} missing required fields: ${missingFields.join(', ')}`;
              log(errorMsg, 'ERROR');
              throw new Error(errorMsg);
            }

            // Save with duplicate handling (default to 'skip' if not specified)
            const saveResult = await dataManager.addImage(imageRecord, {
              duplicateHandling: job.duplicateHandling || 'skip'
            });
            
            return {
              imageKey: imageData.imageKey,
              description: analysisResult.description,
              keywords: analysisResult.keywords,
              saved: true,
              duplicateAction: saveResult.wasSkipped ? 'skipped' : 
                             saveResult.wasUpdated ? 'updated' : 
                             saveResult.wasReplaced ? 'replaced' : 'added'
            };
          }
        };

        const resumed = await jobQueue.resume(processors);
        return sendSuccess(res, { resumed }, resumed ? 'Batch processing resumed' : 'No batch to resume');
      } catch (error) {
        return sendError(res, 500, 'Failed to resume batch processing', error);
      }
    }

    // Batch cancel endpoint
    if (pathname === '/api/batch/cancel' && method === 'POST') {
      log('Batch cancel request');
      
      try {
        jobQueue.cancel();
        return sendSuccess(res, {}, 'Batch processing cancelled');
      } catch (error) {
        return sendError(res, 500, 'Failed to cancel batch processing', error);
      }
    }

    // Batch retry failed jobs endpoint
    if (pathname === '/api/batch/retry' && method === 'POST') {
      log('Batch retry failed jobs request');
      
      try {
        const result = jobQueue.retryFailedJobs();
        return sendSuccess(res, result, result.message);
      } catch (error) {
        return sendError(res, 500, 'Failed to retry failed jobs', error);
      }
    }

    // Batch details endpoint
    if (pathname === '/api/batch/details' && method === 'GET') {
      log('Batch details request');
      
      try {
        const details = jobQueue.getQueueDetails();
        return sendSuccess(res, details, 'Batch details retrieved');
      } catch (error) {
        return sendError(res, 500, 'Failed to get batch details', error);
      }
    }

    // Data count endpoint
    if (pathname === '/api/data/count' && method === 'GET') {
      log('Data count request received');
      
      try {
        const images = await dataManager.getImages();
        return sendSuccess(res, { count: images.length }, `Found ${images.length} image records`);
      } catch (error) {
        return sendError(res, 500, 'Failed to get data count', error);
      }
    }

    // Admin duplicate detection endpoint
    if (pathname === '/api/admin/duplicates/detect' && method === 'POST') {
      log('Admin duplicate detection request received');
      
      try {
        const DuplicateDetector = require('./utilities/duplicateDetector');
        const detector = new DuplicateDetector();
        
        // Run duplicate detection analysis
        const report = await detector.findExistingDuplicates();
        
        log(`Duplicate detection completed: ${report.duplicateGroups.length} groups found`);
        
        return sendSuccess(res, {
          analysis: report.analysis,
          duplicateGroups: report.duplicateGroups,
          recommendations: report.recommendations,
          reportPaths: {
            jsonReport: report.jsonReportPath,
            textReport: report.textReportPath
          }
        }, `Duplicate detection completed - found ${report.duplicateGroups.length} duplicate groups`);
        
      } catch (error) {
        return sendError(res, 500, 'Failed to detect duplicates', error);
      }
    }

    // Admin duplicate cleanup endpoint
    if (pathname === '/api/admin/duplicates/cleanup' && method === 'POST') {
      log('Admin duplicate cleanup request received');
      
      try {
        const requestData = await parseJSON(req);
        const { dryRun = false, confirmationRequired = false } = requestData;
        
        // Safety check: require confirmation for actual cleanup
        if (!dryRun && confirmationRequired && requestData.confirmation !== 'CLEANUP_DUPLICATES') {
          return sendError(res, 400, 'Invalid confirmation. Must provide exact text: "CLEANUP_DUPLICATES"');
        }
        
        const DataMigration = require('./utilities/dataMigration');
        const migration = new DataMigration();
        
        // Perform cleanup with specified options
        const result = await migration.performCleanup({
          dryRun: dryRun,
          confirmationRequired: false, // We handle confirmation here
          preserveBackups: true
        });
        
        log(`Duplicate cleanup ${dryRun ? 'dry run' : 'completed'}: ${result.duplicatesRemoved} duplicates removed`);
        
        return sendSuccess(res, {
          success: result.success,
          duplicatesRemoved: result.duplicatesRemoved,
          finalImageCount: result.finalImageCount,
          backupPath: result.backupPath,
          dryRun: dryRun,
          validationPassed: result.validationPassed,
          message: result.message
        }, `Duplicate cleanup ${dryRun ? 'simulation' : 'completed'} - ${result.duplicatesRemoved} duplicates ${dryRun ? 'would be' : 'were'} removed`);
        
      } catch (error) {
        return sendError(res, 500, 'Failed to cleanup duplicates', error);
      }
    }

    // Admin duplicate validation endpoint
    if (pathname === '/api/admin/duplicates/validate' && method === 'POST') {
      log('Admin duplicate validation request received');
      
      try {
        const DataMigration = require('./utilities/dataMigration');
        const migration = new DataMigration();
        
        // Run validation
        const validationResult = await migration.validateCleanup();
        
        log(`Duplicate validation completed: ${validationResult.isValid ? 'PASSED' : 'FAILED'}`);
        
        return sendSuccess(res, {
          isValid: validationResult.isValid,
          totalImages: validationResult.totalImages,
          issues: validationResult.issues || []
        }, `Validation ${validationResult.isValid ? 'passed' : 'failed'} - ${validationResult.issues?.length || 0} issues found`);
        
      } catch (error) {
        return sendError(res, 500, 'Failed to validate duplicates', error);
      }
    }

    // Admin duplicate rollback endpoint
    if (pathname === '/api/admin/duplicates/rollback' && method === 'POST') {
      log('Admin duplicate rollback request received');
      
      try {
        const requestData = await parseJSON(req);
        const { backupPath } = requestData;
        
        if (!backupPath) {
          return sendError(res, 400, 'Backup path is required');
        }
        
        // Safety check: require confirmation
        if (requestData.confirmation !== 'ROLLBACK_TO_BACKUP') {
          return sendError(res, 400, 'Invalid confirmation. Must provide exact text: "ROLLBACK_TO_BACKUP"');
        }
        
        const DataMigration = require('./utilities/dataMigration');
        const migration = new DataMigration();
        
        // Perform rollback
        const result = await migration.rollback(backupPath);
        
        log(`Duplicate rollback completed to: ${backupPath}`);
        
        return sendSuccess(res, {
          success: result.success,
          backupPath: result.backupPath,
          message: result.message
        }, `Rollback completed to backup: ${backupPath}`);
        
      } catch (error) {
        return sendError(res, 500, 'Failed to rollback duplicates', error);
      }
    }

    // Admin duplicate detection utility endpoint
    if (pathname === '/api/admin/duplicates/utility' && method === 'GET') {
      log('Admin duplicate utility info request received');
      
      try {
        const fs = require('fs').promises;
        const path = require('path');
        
        // Get list of backup files
        const dataDir = path.join(__dirname, 'data');
        const files = await fs.readdir(dataDir);
        
        const backupFiles = files
          .filter(file => file.startsWith('images_backup_') && file.endsWith('.json'))
          .map(file => ({
            filename: file,
            path: path.join(dataDir, file),
            timestamp: file.match(/images_backup_(\d+)\.json/)?.[1] || '0'
          }))
          .sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));
        
        const reportFiles = files
          .filter(file => 
            (file.startsWith('duplicate_analysis_') || file.startsWith('duplicate_report_') || file.startsWith('migration_report_')) &&
            (file.endsWith('.json') || file.endsWith('.txt'))
          )
          .map(file => ({
            filename: file,
            path: path.join(dataDir, file),
            type: file.startsWith('duplicate_analysis_') ? 'analysis' : 
                  file.startsWith('duplicate_report_') ? 'report' : 'migration',
            timestamp: file.match(/_(\d+)\./)?.[1] || '0'
          }))
          .sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));
        
        return sendSuccess(res, {
          backupFiles: backupFiles,
          reportFiles: reportFiles,
          utilityInfo: {
            duplicateDetectorAvailable: true,
            dataMigrationAvailable: true,
            validationAvailable: true,
            rollbackAvailable: true
          }
        }, 'Duplicate utility information retrieved');
        
      } catch (error) {
        return sendError(res, 500, 'Failed to get duplicate utility info', error);
      }
    }

    // Admin duplicate backups endpoint
    if (pathname === '/api/admin/duplicates/backups' && method === 'GET') {
      log('Admin duplicate backups request received');
      
      try {
        const fs = require('fs').promises;
        const path = require('path');
        
        // Get list of backup files
        const dataDir = path.join(__dirname, 'data');
        const files = await fs.readdir(dataDir);
        
        const backupFiles = files
          .filter(file => file.startsWith('images_backup_') && file.endsWith('.json'))
          .map(file => ({
            filename: file,
            path: path.join(dataDir, file),
            timestamp: file.match(/images_backup_(\d+)\.json/)?.[1] || '0',
            date: new Date(parseInt(file.match(/images_backup_(\d+)\.json/)?.[1] || '0')).toLocaleString()
          }))
          .sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));
        
        return sendSuccess(res, {
          backups: backupFiles,
          count: backupFiles.length
        }, `Retrieved ${backupFiles.length} backup files`);
        
      } catch (error) {
        return sendError(res, 500, 'Failed to get backup files', error);
      }
    }

    // Admin destroy all data endpoint (frontend-compatible)
    if (pathname === '/api/admin/destroy-all-data' && method === 'POST') {
      log('ADMIN DESTROY ALL DATA request received - TESTING ONLY', 'WARN');
      
      try {
        // Get current images count before destruction
        const currentImages = await dataManager.getImages();
        const imageCount = currentImages.length;
        
        log(`Starting destruction of ${imageCount} image records`, 'WARN');

        // Create backup with timestamp
        const timestamp = Date.now();
        const backupFilename = `images_backup_${timestamp}.json`;
        const backupPath = path.join('./data', backupFilename);
        
        try {
          await fs.writeFile(backupPath, JSON.stringify(currentImages, null, 2));
          log(`Backup created: ${backupFilename}`, 'INFO');
        } catch (backupError) {
          log(`Failed to create backup: ${backupError.message}`, 'ERROR');
          return sendError(res, 500, 'Failed to create backup before destruction: ' + backupError.message);
        }

        // Destroy all data (set to empty array)
        const imagesPath = path.join('./data', 'images.json');
        try {
          await fs.writeFile(imagesPath, JSON.stringify([], null, 2));
          log(`Successfully destroyed ${imageCount} image records`, 'WARN');
        } catch (destroyError) {
          log(`Failed to destroy data: ${destroyError.message}`, 'ERROR');
          return sendError(res, 500, 'Failed to destroy image data: ' + destroyError.message);
        }

        return sendSuccess(res, {
          deletedCount: imageCount,
          backupFile: backupFilename,
          timestamp: new Date().toISOString(),
          message: `Successfully destroyed ${imageCount} image records. Backup saved as ${backupFilename}`
        }, `All image data destroyed - ${imageCount} records deleted`);

      } catch (error) {
        return sendError(res, 500, 'Failed to destroy image data', error);
      }
    }

    // Destroy all images data endpoint (for testing)
    if (pathname === '/api/images/destroy-all' && method === 'DELETE') {
      log('DESTROY ALL DATA request received - TESTING ONLY', 'WARN');
      
      try {
        const requestData = await parseJSON(req);
        
        // Safety check: require confirmation text
        if (!requestData.confirmation || requestData.confirmation !== 'DELETE ALL DATA') {
          log('Destroy all data request denied - invalid confirmation', 'WARN');
          return sendError(res, 400, 'Invalid confirmation. Must provide exact text: "DELETE ALL DATA"');
        }

        // Get current images count before destruction
        const currentImages = await dataManager.getImages();
        const imageCount = currentImages.length;
        
        log(`Starting destruction of ${imageCount} image records`, 'WARN');

        // Create backup with timestamp
        const timestamp = Date.now();
        const backupFilename = `images_backup_${timestamp}.json`;
        const backupPath = path.join('./data', backupFilename);
        
        try {
          await fs.writeFile(backupPath, JSON.stringify(currentImages, null, 2));
          log(`Backup created: ${backupFilename}`, 'INFO');
        } catch (backupError) {
          log(`Failed to create backup: ${backupError.message}`, 'ERROR');
          return sendError(res, 500, 'Failed to create backup before destruction: ' + backupError.message);
        }

        // Destroy all data (set to empty array)
        const imagesPath = path.join('./data', 'images.json');
        try {
          await fs.writeFile(imagesPath, JSON.stringify([], null, 2));
          log(`Successfully destroyed ${imageCount} image records`, 'WARN');
        } catch (destroyError) {
          log(`Failed to destroy data: ${destroyError.message}`, 'ERROR');
          return sendError(res, 500, 'Failed to destroy image data: ' + destroyError.message);
        }

        return sendSuccess(res, {
          deletedCount: imageCount,
          backupFile: backupFilename,
          timestamp: new Date().toISOString(),
          message: `Successfully destroyed ${imageCount} image records. Backup saved as ${backupFilename}`
        }, `All image data destroyed - ${imageCount} records deleted`);

      } catch (error) {
        return sendError(res, 500, 'Failed to destroy image data', error);
      }
    }

    // API route not found
    return sendError(res, 404, `API endpoint not found: ${pathname}`);

  } catch (error) {
    return sendError(res, 500, 'Internal server error', error);
  }
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  log(`${req.method} ${pathname}`);

  // Add CORS headers for API requests
  if (pathname.startsWith('/api/')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    // Handle API routes
    return handleAPIRoutes(req, res, parsedUrl);
  }

  // Handle root path
  if (pathname === '/') {
    return serveStaticFile('./public/index.html', res);
  }

  // Handle static files
  if (pathname.startsWith('/')) {
    const filePath = path.join('./public', pathname);
    return serveStaticFile(filePath, res);
  }

  // Default 404
  log(`404 Not Found: ${pathname}`, 'WARN');
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

// Start server
server.listen(PORT, () => {
  log(`PhotoVision server running on http://localhost:${PORT}`);
  log('Available API endpoints:');
  log('  GET  /api/status    - Get application status');
  log('  GET  /api/search?q= - Search images');
  log('  POST /api/chat      - Send chat message');
  log('  GET  /api/images    - Get all images');
  log('  GET  /api/config    - Get configuration');
  log('  POST /api/config    - Update configuration');
  log('  POST /api/analyze   - Analyze image with AI provider');
  log('  POST /api/ai/test   - Test AI provider connection');
  log('  GET  /api/ai/config - Get AI configuration');
  log('  POST /api/ai/config - Update AI configuration');
  log('  GET  /api/ai/models - Get available models for provider');
  log('  POST /api/smugmug/auth-start     - Start SmugMug OAuth');
  log('  GET  /api/smugmug/callback       - OAuth callback');
  log('  POST /api/smugmug/disconnect     - Disconnect SmugMug');
  log('  GET  /api/smugmug/status         - SmugMug connection status');
  log('  GET  /api/smugmug/albums         - Get SmugMug albums');
  log('  GET  /api/smugmug/album/:id/images - Get album images');
  log('  POST /api/batch/start            - Start batch processing');
  log('  GET  /api/batch/status           - Get batch status');
  log('  POST /api/batch/pause            - Pause batch processing');
  log('  POST /api/batch/resume           - Resume batch processing');
  log('  POST /api/batch/cancel           - Cancel batch processing');
  log('  POST /api/batch/retry            - Retry failed jobs');
  log('  GET  /api/batch/details          - Get batch details');
  log('  GET  /api/data/count             - Get image data count');
  log('  POST /api/admin/destroy-all-data - Destroy all data (testing)');
  log('  POST /api/admin/duplicates/detect   - Detect duplicate images');
  log('  POST /api/admin/duplicates/cleanup  - Clean up duplicate images');
  log('  POST /api/admin/duplicates/validate - Validate duplicate cleanup');
  log('  POST /api/admin/duplicates/rollback - Rollback duplicate cleanup');
  log('  GET  /api/admin/duplicates/utility  - Get duplicate utility info');
  log('  GET  /api/admin/duplicates/backups  - Get backup files');
  log('Press Ctrl+C to stop');
});

// Graceful shutdown
process.on('SIGINT', () => {
  log('\nShutting down server...');
  server.close(() => {
    log('Server stopped');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log(`Uncaught Exception: ${error.message}`, 'FATAL');
  console.error(error.stack);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  log(`Unhandled Rejection at: ${promise}, reason: ${reason}`, 'FATAL');
  process.exit(1);
});
