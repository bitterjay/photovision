# SmugMug OAuth 1.0a Integration Reference

## Overview

This document provides comprehensive guidance for implementing SmugMug OAuth 1.0a authentication in the PhotoVision project. It addresses the "consumer_key_unknown" error and provides step-by-step setup instructions.

## Current Error Analysis

**Error**: `oauth_problem=consumer_key_unknown`
**Status**: HTTP 401

This error indicates that SmugMug's servers don't recognize the provided API key. Common causes:
1. Invalid or incorrectly formatted API key
2. Application not properly registered or approved
3. Using test/development keys in production endpoints
4. Typos in environment variable configuration

## SmugMug API Key Setup Process

### Step 1: Register Your Application

1. **Visit SmugMug Developer Portal**
   - Go to: https://www.smugmug.com/api/developer/apply
   - Sign in with your SmugMug account (requires active subscription)

2. **Complete Application Form**
   - **Application Name**: PhotoVision Image Discovery Platform
   - **Application Description**: Conversational image discovery platform for SmugMug photo collections using AI-powered natural language search
   - **Application Website**: Your domain or GitHub repository URL
   - **Application Type**: Web Application
   - **Callback URL**: `http://localhost:3000/api/smugmug/callback` (for development)

3. **Request API Access**
   - **Access Level**: Public (for reading public photos)
   - **Permissions**: Read (to access albums and images)
   - **Data Usage**: Describe how you'll use photo data (AI analysis for search)

### Step 2: Wait for Approval

- SmugMug reviews applications manually
- Approval can take 1-7 business days
- You'll receive email notification when approved
- **Important**: Keys won't work until application is approved

### Step 3: Obtain API Credentials

Once approved, you'll receive:
- **API Key** (Consumer Key): Used to identify your application
- **API Secret** (Consumer Secret): Used to sign requests
- **Application Status**: Active/Approved

## OAuth 1.0a Flow Implementation

### Flow Overview

```
1. Get Request Token    → SmugMug returns temporary token
2. User Authorization   → User grants permission on SmugMug
3. Get Access Token     → Exchange for permanent access token
4. Make API Calls       → Use access token for authenticated requests
```

### Step 1: Request Token

**Endpoint**: `https://secure.smugmug.com/services/oauth/1.0a/getRequestToken`
**Method**: POST
**Parameters**:
- `oauth_callback`: Your callback URL
- OAuth signature parameters

**Response Format**:
```
oauth_token=REQUEST_TOKEN&oauth_token_secret=REQUEST_SECRET&oauth_callback_confirmed=true
```

### Step 2: User Authorization

**Endpoint**: `https://secure.smugmug.com/services/oauth/1.0a/authorize`
**Method**: GET (redirect user's browser)
**Parameters**:
- `oauth_token`: Request token from Step 1
- `Access`: Public|Full (optional, default: Public)
- `Permissions`: Read|Add|Modify (optional, default: Read)

**User Flow**:
1. User logs into SmugMug
2. User sees permission request for your app
3. User clicks "Allow" or "Deny"
4. User redirected to your callback URL with verifier

### Step 3: Access Token Exchange

**Endpoint**: `https://secure.smugmug.com/services/oauth/1.0a/getAccessToken`
**Method**: POST
**Parameters**:
- `oauth_token`: Request token
- `oauth_verifier`: Verifier from callback
- OAuth signature (using request token secret)

**Response Format**:
```
oauth_token=ACCESS_TOKEN&oauth_token_secret=ACCESS_SECRET
```

### Step 4: API Calls

**Base URL**: `https://api.smugmug.com/api/v2`
**Authentication**: OAuth 1.0a signature with access token
**Common Endpoints**:
- `/api/v2!authuser` - Get authenticated user info
- `/api/v2/user/{username}!albums` - Get user albums
- `/api/v2/album/{albumkey}!images` - Get album images

## OAuth 1.0a Signature Generation

### Signature Base String

```
HTTP_METHOD&
percent_encode(BASE_URL)&
percent_encode(NORMALIZED_PARAMETERS)
```

### Parameter Normalization

1. Collect all parameters (OAuth + request parameters)
2. Sort alphabetically by key
3. Percent-encode keys and values
4. Join with `&`: `key1=value1&key2=value2`

### Signing Key

```
percent_encode(CONSUMER_SECRET)&percent_encode(TOKEN_SECRET)
```

### HMAC-SHA1 Signature

```javascript
const signature = crypto
    .createHmac('sha1', signingKey)
    .update(signatureBaseString)
    .digest('base64');
```

## Common OAuth Errors and Solutions

### `consumer_key_unknown`
**Cause**: API key not recognized
**Solutions**:
- Verify API key is correctly copied from SmugMug
- Ensure application is approved/active
- Check for extra spaces/characters in .env file
- Confirm using production keys, not test keys

### `signature_invalid`
**Cause**: OAuth signature doesn't match
**Solutions**:
- Verify signature generation algorithm
- Check percent-encoding implementation
- Ensure all parameters included in signature
- Validate timestamp and nonce generation

### `token_expired`
**Cause**: Request token expired (10 minutes)
**Solutions**:
- Complete OAuth flow within time limit
- Generate new request token if expired
- Implement proper error handling for timeouts

### `permission_denied`
**Cause**: User denied authorization
**Solutions**:
- Handle user rejection gracefully
- Restart OAuth flow with new request token
- Provide clear explanation of permissions needed

## Environment Configuration

### .env File Setup

```env
# SmugMug API Configuration
SMUGMUG_API_KEY=your_api_key_here
SMUGMUG_API_SECRET=your_api_secret_here

# OAuth Callback URL (development)
SMUGMUG_CALLBACK_URL=http://localhost:3000/api/smugmug/callback

# Production callback URL
# SMUGMUG_CALLBACK_URL=https://yourdomain.com/api/smugmug/callback
```

### Validation Checklist

- [ ] API key is exactly as provided by SmugMug (no extra characters)
- [ ] API secret is exactly as provided by SmugMug
- [ ] No trailing spaces in environment variables
- [ ] .env file is in project root directory
- [ ] Application status is "Approved" in SmugMug developer portal

## Testing and Debugging

### Step 1: Validate API Keys

```javascript
// Test basic API key recognition
const testUrl = 'https://secure.smugmug.com/services/oauth/1.0a/getRequestToken';
const params = {
    oauth_callback: 'http://localhost:3000/callback',
    oauth_consumer_key: process.env.SMUGMUG_API_KEY,
    // ... other OAuth parameters
};
```

### Step 2: Debug Signature Generation

```javascript
// Log signature components for debugging
console.log('Signature Base String:', signatureBaseString);
console.log('Signing Key:', signingKey);
console.log('Generated Signature:', signature);
```

### Step 3: Test Request Token

Run `node test-smugmug-connection.js` and check for:
- Successful HTTP 200 response
- Valid oauth_token in response
- oauth_callback_confirmed=true

### Debug Logging

Enable detailed logging in SmugMugClient:

```javascript
// Add to makeRequest method
console.log('Request URL:', url);
console.log('Request Method:', method);
console.log('OAuth Params:', oauthParams);
console.log('Authorization Header:', authHeader);
```

## API Rate Limits and Best Practices

### Rate Limits
- **Request Token**: No specific limit
- **API Calls**: 5000 requests per hour per application
- **Burst Limit**: Up to 100 requests per minute

### Best Practices
1. **Cache Access Tokens**: Store tokens securely for reuse
2. **Handle Rate Limits**: Implement exponential backoff
3. **Monitor Usage**: Track API call frequency
4. **Error Handling**: Graceful degradation for API failures

## Production Deployment Considerations

### Security
- Use HTTPS for all callback URLs in production
- Store tokens securely (encrypted database/secure storage)
- Implement token refresh logic
- Never expose API secrets in client-side code

### Callback URLs
- Register production callback URLs with SmugMug
- Handle both development and production environments
- Ensure callback URLs are accessible from internet

### Error Monitoring
- Log OAuth failures for debugging
- Monitor API response times and errors
- Set up alerts for authentication failures

## Troubleshooting Guide

### If Request Token Fails
1. Check API key validity in SmugMug developer portal
2. Verify application approval status
3. Test with minimal OAuth implementation
4. Check network connectivity and SSL certificates

### If Signature Validation Fails
1. Compare signature generation with OAuth 1.0a specification
2. Validate percent-encoding implementation
3. Check parameter sorting and concatenation
4. Test with known working OAuth libraries

### If User Authorization Fails
1. Verify authorization URL format
2. Check callback URL registration
3. Test with different browsers
4. Ensure SmugMug account has necessary permissions

## Resources and References

### Official Documentation
- [SmugMug API v2 Documentation](https://api.smugmug.com/api/v2/doc)
- [OAuth 1.0a Specification](https://tools.ietf.org/html/rfc5849)
- [SmugMug OAuth Tutorial](https://api.smugmug.com/api/v2/doc/tutorial/authorization.html)

### Useful Tools
- [OAuth Signature Generator](https://oauth1-signature-generator.netlify.app/) - Test signatures
- [Postman OAuth 1.0a](https://learning.postman.com/docs/sending-requests/authorization/) - API testing
- [JWT.io OAuth](https://jwt.io/) - Token debugging

### SmugMug Support
- Developer Forum: SmugMug Developer Community
- Email Support: api-support@smugmug.com
- Response Time: 1-3 business days

## Next Steps for PhotoVision

1. **Verify API Key Status**: Check SmugMug developer portal for application approval
2. **Test with Valid Keys**: Replace placeholder keys with approved credentials
3. **Complete OAuth Flow**: Test full authentication workflow
4. **Implement Token Storage**: Add secure token persistence
5. **Build Album Integration**: Connect to user's photo collections

## Implementation Checklist

- [ ] SmugMug application approved and active
- [ ] Valid API key and secret in .env file
- [ ] OAuth signature generation working correctly
- [ ] Request token flow successful
- [ ] User authorization URL accessible
- [ ] Access token exchange implemented
- [ ] Authenticated API calls working
- [ ] Error handling for all OAuth steps
- [ ] Token storage and management
- [ ] Integration with PhotoVision image analysis pipeline
