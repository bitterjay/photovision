#!/usr/bin/env node

/**
 * Test the actual chat endpoint to see how it processes queries
 */

const http = require('http');

async function makeRequest(path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3001,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(data);
                }
            });
        });

        req.on('error', reject);
        
        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function testChatEndpoint() {
    console.log('=== Testing Chat Endpoint ===\n');
    
    try {
        // Test the chat endpoint with our query
        const query = "pictures with no people";
        console.log(`Testing query: "${query}"\n`);
        
        const response = await makeRequest('/api/chat', 'POST', {
            message: query
        });
        
        if (response.success) {
            console.log('Response received successfully\n');
            console.log(`Message: ${response.data.message}\n`);
            console.log(`Number of results: ${response.data.results ? response.data.results.length : 0}\n`);
            
            if (response.data.results && response.data.results.length > 0) {
                console.log('First 3 results:');
                response.data.results.slice(0, 3).forEach((result, index) => {
                    console.log(`${index + 1}. ${result.filename}`);
                    console.log(`   Album: ${result.albumName || 'Unknown'}`);
                });
            }
            
            // Check if the response indicates what function was called
            console.log('\nChecking server logs for function calls...');
            console.log('(Check the server console for [Chat] messages)');
            
        } else {
            console.error('Error response:', response);
        }
        
    } catch (error) {
        console.error('Request failed:', error.message);
        console.log('\nMake sure the server is running on port 3001');
    }
}

testChatEndpoint().catch(console.error);