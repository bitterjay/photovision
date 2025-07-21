#!/usr/bin/env node

const SearchFunctions = require('./lib/searchFunctions');

async function testAllMethods() {
    console.log('=== Testing Different Search Methods ===\n');
    
    const searchFunctions = new SearchFunctions();
    
    // Test 1: Direct searchImages call
    console.log('1. Using searchImages with negativeKeywords:');
    const searchImagesResults = await searchFunctions.searchImages({
        negativeKeywords: ['people', 'person', 'face', 'faces'],
        maxResults: 10
    });
    console.log(`   Found: ${searchImagesResults.length} results\n`);
    
    // Test 2: Get all images and filter
    console.log('2. Getting all images (no filters):');
    const allImages = await searchFunctions.getAllImages();
    console.log(`   Total images: ${allImages.length}`);
    console.log(`   First few: ${allImages.slice(0, 3).map(img => img.filename).join(', ')}\n`);
    
    // Test 3: Search by keywords with empty keywords
    console.log('3. Using searchByKeywords with empty keywords:');
    try {
        const keywordResults = await searchFunctions.searchByKeywords({
            keywords: []
        });
        console.log(`   Found: ${keywordResults.length} results\n`);
    } catch (e) {
        console.log(`   Error: ${e.message}\n`);
    }
    
    // Test 4: Check what Claude might be doing differently
    console.log('4. Checking parseNaturalLanguageQuery:');
    const parsed = searchFunctions.parseNaturalLanguageQuery("pictures with no people");
    console.log('   Parsed query:', JSON.stringify(parsed, null, 2));
    
    // Test 5: Try different phrasings
    const phrasings = [
        "photos",
        "images", 
        "pictures",
        "all photos without people"
    ];
    
    console.log('\n5. Testing different phrasings:');
    for (const phrase of phrasings) {
        const results = await searchFunctions.intelligentSearch({
            query: phrase,
            maxResults: 5,
            enableVisionVerification: false
        });
        console.log(`   "${phrase}": ${results.length} results`);
    }
}

testAllMethods().catch(console.error);