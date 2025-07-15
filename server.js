require('dotenv').config();
const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const url = require('url');
const DataManager = require('./lib/dataManager');
const ClaudeClient = require('./lib/claudeClient');

const PORT = process.env.PORT || 3000;
const dataManager = new DataManager();
const claudeClient = new ClaudeClient(process.env.ANTHROPIC_API_KEY);

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
  '.ico': 'image/x-icon'
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

    // Chat endpoint (placeholder for future implementation)
    if (pathname === '/api/chat' && method === 'POST') {
      const requestData = await parseJSON(req);
      log(`Chat request: ${requestData.message}`);
      
      // Placeholder response
      const response = {
        message: "I'm not fully connected yet, but I received your message: " + requestData.message,
        timestamp: new Date().toISOString(),
        type: 'placeholder'
      };
      
      return sendSuccess(res, response, 'Message processed');
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

        // Analyze image with Claude
        const analysisResult = await claudeClient.analyzeImage(
          formData.image.data,
          formData.image.type,
          formData.prompt || null
        );

        if (!analysisResult.success) {
          log(`Image analysis failed: ${analysisResult.error}`, 'ERROR');
          return sendError(res, 500, 'Image analysis failed: ' + analysisResult.error);
        }

        // Create image record
        const imageRecord = {
          id: generateUniqueId(),
          filename: formData.image.filename || 'uploaded_image',
          mimeType: formData.image.type,
          size: formData.image.data.length,
          uploadedAt: new Date().toISOString(),
          analysis: {
            description: analysisResult.description,
            model: analysisResult.model,
            usage: analysisResult.usage,
            analyzedAt: analysisResult.timestamp
          }
        };

        // Store the analysis result
        const saveResult = await dataManager.addImage(imageRecord);
        
        if (!saveResult.success) {
          log(`Failed to save image record: ${saveResult.error}`, 'ERROR');
          return sendError(res, 500, 'Failed to save analysis result');
        }

        log('Image analysis completed successfully');

        return sendSuccess(res, {
          imageId: imageRecord.id,
          analysis: analysisResult.description,
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
  log('  POST /api/analyze   - Analyze image with Claude');
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
