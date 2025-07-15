const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const url = require('url');
const DataManager = require('./lib/dataManager');

const PORT = process.env.PORT || 3000;
const dataManager = new DataManager();

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
