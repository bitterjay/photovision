#!/usr/bin/env node

const SearchFunctions = require('./lib/searchFunctions');

async function testSimple() {
    console.log('Testing vision verification with a simple query...\n');
    
    const searchFunctions = new SearchFunctions();
    
    // First get some results without vision
    const resultsNoVision = await searchFunctions.intelligentSearch({
        query: "archery",
        maxResults: 3,
        enableVisionVerification: false
    });
    
    console.log(`Found ${resultsNoVision.length} results without vision:`);
    resultsNoVision.forEach((r, i) => {
        console.log(`${i+1}. ${r.filename} - ${r.smugmugUrl ? 'Has URL' : 'No URL'}`);
    });
    
    if (resultsNoVision.length > 0) {
        console.log('\nNow testing WITH vision verification...');
        const resultsWithVision = await searchFunctions.intelligentSearch({
            query: "archery",
            maxResults: 3,
            enableVisionVerification: true
        });
        
        console.log(`\nFound ${resultsWithVision.length} results with vision verification`);
    }
}

testSimple().catch(console.error);