#!/usr/bin/env node

/**
 * Simulate exactly what Claude does when processing "pictures with no people"
 */

const SearchFunctions = require('./lib/searchFunctions');

async function simulateClaude() {
    console.log('=== Simulating Claude\'s Function Call ===\n');
    
    const searchFunctions = new SearchFunctions();
    
    // This is what Claude would call based on the function definition
    console.log('Claude sees "pictures with no people" and calls intelligentSearch with:');
    const parameters = {
        query: "pictures with no people",
        maxResults: 20,
        includeSemanticExpansion: true
        // Note: enableVisionVerification is NOT in the function definition Claude sees!
    };
    console.log(JSON.stringify(parameters, null, 2));
    
    console.log('\nExecuting function...\n');
    
    // Execute exactly as Claude would
    const results = await searchFunctions.executeFunction('intelligentSearch', parameters);
    
    console.log(`\nResults: ${results.length} images found\n`);
    
    if (results.length > 0) {
        console.log('First 5 results:');
        results.slice(0, 5).forEach((result, index) => {
            console.log(`${index + 1}. ${result.filename}`);
            console.log(`   Album: ${result.albumName || 'Unknown'}`);
            console.log(`   Description: ${(result.description || '').substring(0, 80)}...`);
        });
    }
    
    // Now let's trace what's happening
    console.log('\n\n=== Analyzing the Difference ===');
    console.log('1. Claude calls intelligentSearch WITHOUT enableVisionVerification parameter');
    console.log('2. The function defaults to enableVisionVerification=true');
    console.log('3. BUT the query "pictures with no people" might not find ANY results in metadata');
    console.log('4. So vision verification never runs (no results to verify)');
    
    // Let's test a more specific query
    console.log('\n\n=== Testing a More Specific Query ===');
    const betterQuery = "archery equipment without people";
    console.log(`Query: "${betterQuery}"\n`);
    
    const betterResults = await searchFunctions.executeFunction('intelligentSearch', {
        query: betterQuery,
        maxResults: 10
    });
    
    console.log(`Results: ${betterResults.length} images found`);
}

simulateClaude().catch(console.error);