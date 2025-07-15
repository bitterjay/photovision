// Test SmugMug OAuth 1.0a implementation
// This script tests the SmugMug client functionality

require('dotenv').config();
const SmugMugClient = require('./lib/smugmugClient');

async function testSmugMugClient() {
    console.log('Testing SmugMug Client...\n');
    
    // Check if API keys are configured
    if (!process.env.SMUGMUG_API_KEY || !process.env.SMUGMUG_API_SECRET) {
        console.log('❌ SmugMug API keys not configured in .env file');
        console.log('Please add SMUGMUG_API_KEY and SMUGMUG_API_SECRET to your .env file');
        return;
    }
    
    const client = new SmugMugClient(process.env.SMUGMUG_API_KEY, process.env.SMUGMUG_API_SECRET);
    
    console.log('✅ SmugMug client initialized with API keys');
    console.log(`API Key: ${process.env.SMUGMUG_API_KEY.substring(0, 10)}...`);
    
    try {
        // Test getting a request token
        console.log('\n🔄 Testing request token generation...');
        const callbackUrl = 'http://localhost:3000/api/smugmug/callback';
        const requestTokenResult = await client.getRequestToken(callbackUrl);
        
        if (requestTokenResult.success) {
            console.log('✅ Request token obtained successfully');
            console.log(`Token: ${requestTokenResult.token.substring(0, 10)}...`);
            
            // Test generating authorization URL
            console.log('\n🔄 Testing authorization URL generation...');
            const authUrl = client.getAuthorizationUrl(requestTokenResult.token, 'Public', 'Read');
            console.log('✅ Authorization URL generated:');
            console.log(authUrl);
            
            console.log('\n📋 Next steps for manual testing:');
            console.log('1. Visit the authorization URL above in your browser');
            console.log('2. Log in to SmugMug and authorize the application');
            console.log('3. You will be redirected back with a verifier code');
            console.log('4. Use the verifier code to complete the OAuth flow');
            
        } else {
            console.log('❌ Failed to get request token:', requestTokenResult.error);
        }
        
    } catch (error) {
        console.log('❌ Error during testing:', error.message);
    }
}

// Run the test
testSmugMugClient().catch(console.error);
