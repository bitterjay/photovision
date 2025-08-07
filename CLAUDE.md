# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**PhotoVision** is a conversational image discovery platform that transforms SmugMug photo collections into intelligent, searchable archives using natural language. It combines AI image analysis with a web-based chat interface to help users find photos using natural language queries.

## Common Development Commands

### Server Operations
```bash
# Start development server with auto-reload
npm run dev

# Start production server
npm start

# Run specific test files
node test-api-key.js
node test-smugmug-connection.js
node test-batch-processing.js
```

### Development Workflow
```bash
# Install dependencies
npm install

# Check Node.js syntax
node -c server.js
node -c lib/claudeClient.js

# Test specific functionality
node test-comprehensive-duplicate-detection.js
```

## Architecture Overview

### Core Components
- **Frontend**: Vanilla HTML/CSS/JavaScript single-page application with tabbed interface
- **Backend**: Node.js HTTP server with custom routing (no Express framework)
- **Data Storage**: JSON file-based persistence in `/data/` directory
- **External APIs**: Anthropic Claude API for image analysis, SmugMug API for photo access

### Key Backend Modules
- **`server.js`**: Main HTTP server with routing for API endpoints
- **`lib/claudeClient.js`**: Anthropic Claude API integration with automatic image resizing
- **`lib/smugmugClient.js`**: Complete SmugMug OAuth 1.0a implementation
- **`lib/jobQueue.js`**: Batch processing system with progress tracking and retry logic
- **`lib/dataManager.js`**: JSON file operations and search functionality
- **`lib/searchFunctions.js`**: Advanced search capabilities across image metadata
- **`utilities/duplicateDetector.js`**: Duplicate detection and cleanup utilities
- **`utilities/dataMigration.js`**: Data migration and backup functionality

### Frontend Architecture
- **`public/script.js`**: Main application class (`PhotoVision`) with modular functionality
- **`public/style.css`**: Modern CSS with CSS custom properties, responsive design, and dark/light theme support
- **`public/index.html`**: Single-page interface with tabbed navigation

## Key Data Structures

### Image Data Format (`data/images.json`)
```json
{
  "imageId": {
    "originalFilename": "photo.jpg",
    "smugmugUrl": "https://...",
    "claudeDescription": "...",
    "keywords": ["tag1", "tag2"],
    "albumName": "Album Name",
    "albumPath": "/Albums/2024/",
    "albumHierarchy": "2024 > Summer > Vacation",
    "analysisTimestamp": "2024-01-01T00:00:00Z"
  }
}
```

### Configuration Format (`data/config.json`)
```json
{
  "smugmugTokens": {
    "accessToken": "...",
    "tokenSecret": "..."
  },
  "batchProcessing": {
    "maxConcurrentJobs": 3,
    "retryAttempts": 3
  }
}
```

## API Endpoints

### Core Functionality
- **`POST /api/analyze`**: Analyze single image with Claude AI
- **`POST /api/search`**: Search analyzed images using natural language
- **`POST /api/chat`**: Conversational search interface

### SmugMug Integration
- **`GET /api/smugmug/auth/start`**: Initialize OAuth flow
- **`GET /api/smugmug/auth/callback`**: Handle OAuth callback
- **`GET /api/smugmug/status`**: Check connection status
- **`GET /api/smugmug/albums`**: Fetch user's albums with pagination

### Batch Processing
- **`POST /api/batch/start`**: Start batch processing of album images
- **`GET /api/batch/status`**: Get real-time processing status
- **`POST /api/batch/pause|resume|cancel`**: Control batch operations
- **`POST /api/batch/retry`**: Retry failed batch jobs

### Admin Tools
- **`POST /api/admin/duplicates/detect`**: Analyze duplicate images
- **`POST /api/admin/duplicates/cleanup`**: Remove duplicate entries
- **`GET /api/admin/duplicates/backups`**: Manage data backups
- **`POST /api/admin/duplicates/rollback`**: Rollback to previous state

## Image Processing Pipeline

### Claude AI Integration
1. **Image Resizing**: Automatic dimension-based resizing for API compliance
   - Landscape: 2200px wide, auto height
   - Portrait: 2200px tall, auto width
   - File size optimization with progressive quality reduction for 5MB limit
2. **Analysis**: Structured JSON response with description and keywords
3. **Error Handling**: Comprehensive retry logic and fallback mechanisms

### SmugMug OAuth Flow
1. **Request Token**: Generate with proper API signature
2. **User Authorization**: Redirect to SmugMug authorization page
3. **Access Token**: Exchange authorized request token for access token
4. **API Access**: Use access token for all SmugMug API calls

## Development Guidelines

### File Structure Principles
- **Minimal Dependencies**: Only essential npm packages (`dotenv`, `sharp`, `nodemon`)
- **Clear Separation**: Frontend (`public/`), backend (`lib/`), utilities (`utilities/`)
- **Test Files**: Prefix with `test-` (excluded from nodemon watching)
- **Documentation**: Maintain `cline_docs/` for project documentation

### Code Quality Standards
- **Vanilla JavaScript**: No frameworks, use modern ES6+ features
- **Error Handling**: Comprehensive try-catch blocks with logging
- **Logging**: Use `log(message, type)` utility function throughout
- **Security**: Environment variables for API keys, proper OAuth implementation

### Testing Strategy
- **Integration Tests**: Test files for each major component
- **Manual Testing**: Test each feature incrementally during development
- **API Testing**: Verify external API connections before feature implementation

## Configuration Requirements

### Environment Variables (`.env`)
```env
ANTHROPIC_API_KEY=your_claude_api_key
SMUGMUG_API_KEY=your_smugmug_api_key
SMUGMUG_API_SECRET=your_smugmug_api_secret
PORT=3001
```

### SmugMug OAuth Setup
- Application must be registered with SmugMug developer console
- Callback URL: `http://localhost:3001/api/smugmug/auth/callback`
- OAuth 1.0a implementation with proper signature generation

## Common Issues and Solutions

### Image Analysis Failures
- **Large Images**: Automatic resizing handles dimension and file size limits
- **API Rate Limits**: JobQueue implements exponential backoff and retry logic
- **Network Failures**: Comprehensive error handling with user feedback

### SmugMug Connection Issues
- **OAuth Errors**: Check API key validity and callback URL configuration
- **Token Expiration**: Implement token refresh mechanism in `smugmugClient.js`
- **Album Access**: Handle private album permissions gracefully

### Frontend-Backend Communication
- **Data Structure Mismatches**: Transform JobQueue status to frontend-expected format
- **Polling Issues**: Implement proper completion detection with `isComplete` flags
- **Progress Tracking**: Use real-time status updates with detailed progress information

## Performance Considerations

### Batch Processing Optimization
- **Concurrent Jobs**: Configurable limit (default: 3 concurrent analyses)
- **Memory Management**: Process images in batches to prevent memory overflow
- **Queue Management**: Pause/resume capability for resource management

### Frontend Performance
- **Lazy Loading**: Load images and data as needed
- **Responsive Design**: CSS Grid and Flexbox for efficient layouts
- **Caching**: Implement client-side caching for frequently accessed data

## Security Implementation

### API Security
- **Input Validation**: Sanitize all user inputs before processing
- **Rate Limiting**: Implement API call rate limiting for cost control
- **Error Handling**: Avoid exposing internal system details in error messages

### OAuth Security
- **Token Management**: Secure storage and lifecycle management
- **Signature Generation**: Proper OAuth 1.0a signature implementation
- **Secret Protection**: Environment variables for all sensitive data

## Deployment Configuration

### Railway.app Deployment
- **Configuration File**: `railway.toml` handles build and deployment settings
- **Persistent Storage**: Data volume mounted at `/app/data` for JSON file persistence
- **Environment Detection**: Automatic base URL detection using `RAILWAY_PUBLIC_DOMAIN`
- **OAuth Callback URL**: Dynamic callback URL based on deployment environment
  - Production: `https://[your-app].railway.app/api/smugmug/callback`
  - Development: `http://localhost:3001/api/smugmug/callback`

### Required Environment Variables
```env
ANTHROPIC_API_KEY=your_claude_api_key
SMUGMUG_API_KEY=your_smugmug_api_key
SMUGMUG_API_SECRET=your_smugmug_api_secret
PORT=3001
# Optional: Set if RAILWAY_PUBLIC_DOMAIN not available
BASE_URL=https://your-deployed-url.com
```

### Deployment Steps
1. Push code to GitHub repository
2. Connect Railway to GitHub repo
3. Set environment variables in Railway dashboard
4. Update SmugMug app callback URL to production URL
5. Deploy automatically on push to main branch

## IMPORTANT: Sound Notification

After finishing responding to my request or running a command, run this command to notify me by sound:

```bash
afplay /System/Library/Sounds/Funk.aiff
```

## IMPORTANT: sServer Information

the app is using nodemon, so when testing you don't need to start the server, just test.

for tasks that seem that they will require extra tokens, use gemini mcp server to have gemini help you with solving the problem.