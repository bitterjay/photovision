#!/usr/bin/env node

const SearchFunctions = require('./lib/searchFunctions');
const DataManager = require('./lib/dataManager');

async function diagnostics() {
    console.log('=== Search Diagnostics ===\n');
    
    const searchFunctions = new SearchFunctions();
    const dataManager = new DataManager();
    await dataManager.initialize();
    
    // First, check total images
    const allImages = await dataManager.getImages();
    console.log(`Total images in database: ${allImages.length}\n`);
    
    // Show a sample image structure
    if (allImages.length > 0) {
        console.log('Sample image structure:');
        const sample = allImages[0];
        console.log(`Filename: ${sample.filename}`);
        console.log(`Description: ${(sample.description || '').substring(0, 150)}...`);
        console.log(`Keywords: ${(sample.keywords || []).join(', ')}`);
        console.log(`Has SmugMug URL: ${!!sample.smugmugUrl}\n`);
    }
    
    // Test different queries
    const testQueries = [
        "archery",
        "targets",
        "equipment",
        "landscape",
        "no people",
        "without people"
    ];
    
    console.log('Testing various queries (without vision):');
    console.log('-----------------------------------------');
    
    for (const query of testQueries) {
        const results = await searchFunctions.intelligentSearch({
            query: query,
            maxResults: 10,
            enableVisionVerification: false
        });
        console.log(`"${query}": ${results.length} results`);
    }
    
    // Now test a query that should return results and then filter with vision
    console.log('\n\nTesting with targets query + vision:');
    console.log('------------------------------------');
    
    const targetsResults = await searchFunctions.intelligentSearch({
        query: "archery targets",
        maxResults: 10,
        enableVisionVerification: false
    });
    
    console.log(`Found ${targetsResults.length} targets without vision`);
    
    if (targetsResults.length > 0) {
        // Now check which ones have people
        const targetsNoVision = await searchFunctions.intelligentSearch({
            query: "archery targets without people",
            maxResults: 10,
            enableVisionVerification: false
        });
        
        console.log(`Found ${targetsNoVision.length} targets without people (metadata filtering)`);
        
        // Try with vision
        const targetsWithVision = await searchFunctions.intelligentSearch({
            query: "archery targets without people",
            maxResults: 10,
            enableVisionVerification: true
        });
        
        console.log(`Found ${targetsWithVision.length} targets without people (vision verified)`);
    }
}

diagnostics().catch(console.error);