#!/usr/bin/env node

/**
 * Test vision verification with "pictures with no people" query
 */

const SearchFunctions = require('./lib/searchFunctions');

async function testNoPeopleQuery() {
    console.log('=== Testing "pictures with no people" Query ===\n');
    
    const searchFunctions = new SearchFunctions();
    const query = "pictures with no people";
    
    try {
        // First, test WITHOUT vision verification to see what metadata filtering returns
        console.log('1. WITHOUT Vision Verification:');
        console.log('--------------------------------');
        const resultsNoVision = await searchFunctions.intelligentSearch({
            query: query,
            maxResults: 20,
            enableVisionVerification: false
        });
        
        console.log(`Found ${resultsNoVision.length} results based on metadata filtering\n`);
        
        if (resultsNoVision.length > 0) {
            console.log('Sample results (first 5):');
            resultsNoVision.slice(0, 5).forEach((result, index) => {
                console.log(`${index + 1}. ${result.filename}`);
                console.log(`   Album: ${result.albumName || 'Unknown'}`);
                console.log(`   Description: ${(result.description || '').substring(0, 100)}...`);
                console.log(`   Keywords: ${(result.keywords || []).slice(0, 5).join(', ')}\n`);
            });
        }
        
        // Now test WITH vision verification
        console.log('\n2. WITH Vision Verification:');
        console.log('-----------------------------');
        console.log('Claude will now visually verify each image...\n');
        
        const resultsWithVision = await searchFunctions.intelligentSearch({
            query: query,
            maxResults: 20,
            enableVisionVerification: true
        });
        
        console.log(`\nFound ${resultsWithVision.length} verified results that actually have no people\n`);
        
        if (resultsWithVision.length > 0) {
            console.log('Verified results (first 5):');
            resultsWithVision.slice(0, 5).forEach((result, index) => {
                console.log(`${index + 1}. ${result.filename}`);
                console.log(`   Album: ${result.albumName || 'Unknown'}`);
                console.log(`   Description: ${(result.description || '').substring(0, 100)}...`);
                console.log(`   SmugMug URL: ${result.smugmugUrl ? 'Available' : 'Not available'}\n`);
            });
        }
        
        // Compare results
        console.log('\n3. Results Comparison:');
        console.log('----------------------');
        console.log(`Metadata filtering: ${resultsNoVision.length} results`);
        console.log(`Vision verification: ${resultsWithVision.length} results`);
        console.log(`Difference: ${resultsNoVision.length - resultsWithVision.length} images filtered out by visual verification`);
        
        // Show which images were filtered out
        if (resultsNoVision.length > 0 && resultsWithVision.length < resultsNoVision.length) {
            console.log('\nImages filtered out by vision (had people despite metadata):');
            const verifiedFilenames = new Set(resultsWithVision.map(r => r.filename));
            const filteredOut = resultsNoVision.filter(r => !verifiedFilenames.has(r.filename));
            
            filteredOut.slice(0, 5).forEach((result, index) => {
                console.log(`- ${result.filename} (${result.albumName || 'Unknown album'})`);
            });
            
            if (filteredOut.length > 5) {
                console.log(`... and ${filteredOut.length - 5} more`);
            }
        }
        
    } catch (error) {
        console.error('\nError during test:', error.message);
        console.error('Stack trace:', error.stack);
    }
    
    console.log('\n=== Test Complete ===');
}

// Run the test
testNoPeopleQuery().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});