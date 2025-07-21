#!/usr/bin/env node

/**
 * Test script for vision verification feature
 * Tests the new Claude vision verification for search results
 */

const SearchFunctions = require('./lib/searchFunctions');

// Simple logging function
function log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${type}: ${message}`);
}

async function testVisionVerification() {
    console.log('=== Testing Vision Verification Feature ===\n');
    
    try {
        const searchFunctions = new SearchFunctions();
        
        // Test query: "archery targets without people"
        const testQuery = "archery targets without people";
        console.log(`Test Query: "${testQuery}"\n`);
        
        // First, test without vision verification
        console.log('1. Testing WITHOUT vision verification:');
        console.log('----------------------------------------');
        const resultsWithoutVision = await searchFunctions.intelligentSearch({
            query: testQuery,
            maxResults: 10,
            enableVisionVerification: false
        });
        
        console.log(`Found ${resultsWithoutVision.length} results without vision verification`);
        if (resultsWithoutVision.length > 0) {
            console.log('\nFirst 3 results:');
            resultsWithoutVision.slice(0, 3).forEach((result, index) => {
                console.log(`${index + 1}. ${result.filename || 'Unknown'}`);
                console.log(`   Description: ${(result.description || '').substring(0, 100)}...`);
                console.log(`   Keywords: ${(result.keywords || []).slice(0, 5).join(', ')}`);
            });
        }
        
        // Now test with vision verification
        console.log('\n\n2. Testing WITH vision verification:');
        console.log('----------------------------------------');
        console.log('This will download and verify images with Claude...\n');
        
        const resultsWithVision = await searchFunctions.intelligentSearch({
            query: testQuery,
            maxResults: 10,
            enableVisionVerification: true
        });
        
        console.log(`\nFound ${resultsWithVision.length} verified results with vision`);
        if (resultsWithVision.length > 0) {
            console.log('\nVerified results:');
            resultsWithVision.slice(0, 3).forEach((result, index) => {
                console.log(`${index + 1}. ${result.filename || 'Unknown'}`);
                console.log(`   Description: ${(result.description || '').substring(0, 100)}...`);
                console.log(`   SmugMug URL: ${result.smugmugUrl ? 'Available' : 'Not available'}`);
            });
        }
        
        // Compare results
        console.log('\n\n3. Results Comparison:');
        console.log('----------------------');
        console.log(`Without vision: ${resultsWithoutVision.length} results`);
        console.log(`With vision: ${resultsWithVision.length} results`);
        console.log(`Difference: ${resultsWithoutVision.length - resultsWithVision.length} images filtered out by vision`);
        
        // Test with a different query
        console.log('\n\n4. Testing another query: "landscape photos"');
        console.log('--------------------------------------------');
        
        const landscapeResults = await searchFunctions.intelligentSearch({
            query: "landscape photos",
            maxResults: 5,
            enableVisionVerification: true
        });
        
        console.log(`Found ${landscapeResults.length} landscape photos`);
        
    } catch (error) {
        console.error('\nError during test:', error.message);
        console.error('Stack trace:', error.stack);
    }
    
    console.log('\n=== Test Complete ===');
}

// Run the test
testVisionVerification().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});