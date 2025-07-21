#!/usr/bin/env node

/**
 * Test how Claude might interpret "pictures with no people" differently
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

async function testQueries() {
    console.log('=== Testing How Chat Endpoint Handles Different Queries ===\n');
    
    const queries = [
        "pictures with no people",
        "photos without people",
        "images without people",
        "show me all photos",
        "archery without people"
    ];
    
    for (const query of queries) {
        console.log(`\nTesting: "${query}"`);
        console.log('-'.repeat(50));
        
        try {
            const response = await makeRequest('/api/chat', 'POST', {
                message: query
            });
            
            if (response.success) {
                const resultCount = response.data.results ? response.data.results.length : 0;
                console.log(`Results: ${resultCount}`);
                
                if (resultCount > 0 && response.data.results[0]) {
                    console.log(`First result: ${response.data.results[0].filename}`);
                }
                
                // Show the actual message if available
                if (response.data.message) {
                    console.log(`Claude's response: ${response.data.message.substring(0, 100)}...`);
                }
            } else {
                console.log('Error:', response.error);
            }
        } catch (error) {
            console.log('Request failed:', error.message);
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n\n=== Analysis ===');
    console.log('Claude in the chat interface might be:');
    console.log('1. Interpreting "pictures" more broadly');
    console.log('2. Using getAllImages and then filtering');
    console.log('3. Calling multiple search functions');
    console.log('4. Using a different interpretation of the query');
}

testQueries().catch(console.error);