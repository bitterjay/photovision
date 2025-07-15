require('dotenv').config();
const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const url = require('url');
const DataManager = require('./lib/dataManager');
const ClaudeClient = require('./lib/claudeClient');
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

        const albumsResult = await smugmugClient.getUserAlbums(
          smugmugConfig.accessToken,
          smugmugConfig.accessTokenSecret,
          smugmugConfig.user.Uris.User
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

    // Batch processing endpoints

    // Start batch processing endpoint
    if (pathname === '/api/batch/start' && method === 'POST') {
      log('Batch processing start request');

      try {
        const requestData = await parseJSON(req);
        
        if (!requestData.albumKey) {
          return sendError(res, 400, 'Album key is required');
        }

        // Check SmugMug connection
        const config = await dataManager.getConfig();
        const smugmugConfig = config.smugmug || {};

        if (!smugmugConfig.connected || !smugmugConfig.accessToken) {
          return sendError(res, 401, 'SmugMug not connected');
        }

        // Get album images
        const albumUri = `/api/v2/album/${requestData.albumKey}`;
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

        // Create jobs for each image
        const jobs = imagesResult.images
          .filter(img => img.LargestImage && img.LargestImage.ImageUrl)
          .slice(0, requestData.maxImages || 50) // Limit batch size
          .map((image, index) => ({
            id: `img_${requestData.albumKey}_${image.ImageKey}`,
            type: 'image_analysis',
            data: {
              imageUrl: image.LargestImage.ImageUrl,
              imageKey: image.ImageKey,
              filename: image.FileName || `image_${index + 1}`,
              title: image.Title || '',
              caption: image.Caption || ''
            },
            albumKey: requestData.albumKey,
            imageName: image.FileName || `image_${index + 1}`
          }));

        if (jobs.length === 0) {
          return sendError(res, 400, 'No processable images found in album');
        }

        // Add jobs to queue
        const batchInfo = jobQueue.addBatch(jobs, requestData.batchName || `Album ${requestData.albumKey}`);

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

        // Create image analysis processor
        const processors = {
          image_analysis: async (imageData, job) => {
            log(`Processing image: ${imageData.filename}`);
            
            // Fetch image from SmugMug
            const imageResponse = await fetch(imageData.imageUrl);
            if (!imageResponse.ok) {
              throw new Error(`Failed to fetch image: ${imageResponse.status}`);
            }
            
            const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
            const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
            
            // Analyze with Claude
            const analysisResult = await claudeClient.analyzeImage(imageBuffer, contentType, null);
            
            if (!analysisResult.success) {
              throw new Error(analysisResult.error);
            }

            // Store the result
            const imageRecord = {
              id: generateUniqueId(),
              filename: imageData.filename,
              smugmugImageKey: imageData.imageKey,
              smugmugUrl: imageData.imageUrl,
              title: imageData.title,
              caption: imageData.caption,
              albumKey: job.albumKey,
              description: analysisResult.description,
              keywords: analysisResult.keywords || [],
              metadata: {
                model: analysisResult.model,
                timestamp: analysisResult.timestamp,
                batchId: job.batchId,
                jobId: job.id
              }
            };

            // Save to data storage
            await dataManager.addImage(imageRecord);
            
            return {
              imageKey: imageData.imageKey,
              description: analysisResult.description,
              keywords: analysisResult.keywords,
              saved: true
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
          albumKey: requestData.albumKey,
          message: `Started processing ${batchInfo.jobCount} images`
        }, 'Batch processing started');

      } catch (error) {
        return sendError(res, 500, 'Failed to start batch processing', error);
      }
    }

    // Batch status endpoint
    if (pathname === '/api/batch/status' && method === 'GET') {
      log('Batch status request');
      
      try {
        const status = jobQueue.getStatus();
        return sendSuccess(res, status, 'Batch status retrieved');
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
        // Create processors again for resume
        const processors = {
          image_analysis: async (imageData, job) => {
            log(`Processing image: ${imageData.filename}`);
            
            const imageResponse = await fetch(imageData.imageUrl);
            if (!imageResponse.ok) {
              throw new Error(`Failed to fetch image: ${imageResponse.status}`);
            }
            
            const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
            const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
            
            const analysisResult = await claudeClient.analyzeImage(imageBuffer, contentType, null);
            
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
              description: analysisResult.description,
              keywords: analysisResult.keywords || [],
              metadata: {
                model: analysisResult.model,
                timestamp: analysisResult.timestamp,
                batchId: job.batchId,
                jobId: job.id
              }
            };

            await dataManager.addImage(imageRecord);
            
            return {
              imageKey: imageData.imageKey,
              description: analysisResult.description,
              keywords: analysisResult.keywords,
              saved: true
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
