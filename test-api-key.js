// Test script to diagnose API key issues
require('dotenv').config();
const https = require('https');

async function testAPIKey() {
    console.log('=== API Key Diagnostic Test ===');
    
    const rawKey = process.env.ANTHROPIC_API_KEY;
    console.log('Raw API Key exists:', !!rawKey);
    console.log('API Key length:', rawKey?.length);
    console.log('API Key (first 20 chars):', rawKey?.substring(0, 20) + '...');
    console.log('API Key (last 10 chars):', '...' + rawKey?.substring(rawKey.length - 10));
    
    // Check for formatting issues
    const trimmedKey = rawKey?.trim();
    console.log('Has leading/trailing whitespace:', rawKey !== trimmedKey);
    console.log('Trimmed length:', trimmedKey?.length);
    
    // Check for invisible characters
    const hasInvisibleChars = rawKey !== rawKey?.replace(/[^\x20-\x7E]/g, '');
    console.log('Has invisible characters:', hasInvisibleChars);
    
    if (hasInvisibleChars) {
        console.log('Clean key:', rawKey?.replace(/[^\x20-\x7E]/g, ''));
    }
    
    // Test with trimmed key
    console.log('\n=== Testing API Key ===');
    
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
    
    const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': trimmedKey,
            'anthropic-version': '2023-06-01'
        }
    };
    
    try {
        const response = await makeRequest(options, testBody);
        console.log('✅ API Key is valid!');
        console.log('Response:', response);
    } catch (error) {
        console.error('❌ API Key test failed:', error.message);
        console.log('\n=== Troubleshooting ===');
        console.log('1. Check if your API key is active in the Anthropic Console');
        console.log('2. Verify you have sufficient credits/usage limits');
        console.log('3. Try generating a new API key if this one is old');
        console.log('4. Make sure the key has the correct permissions');
        console.log('\nAnthropic Console: https://console.anthropic.com/');
    }
}

function makeRequest(options, body) {
    return new Promise((resolve, reject) => {
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

testAPIKey();
