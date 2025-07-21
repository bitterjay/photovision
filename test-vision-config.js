#!/usr/bin/env node

/**
 * Test script for vision verification configuration
 */

const DataManager = require('./lib/dataManager');
const SearchFunctions = require('./lib/searchFunctions');

async function testVisionConfig() {
    console.log('=== Testing Vision Verification Configuration ===\n');
    
    const dataManager = new DataManager();
    
    // Show current configuration
    console.log('1. Current Vision Verification Configuration:');
    console.log('---------------------------------------------');
    const currentConfig = await dataManager.getVisionVerificationConfig();
    console.log(JSON.stringify(currentConfig, null, 2));
    
    // Update configuration
    console.log('\n2. Updating Configuration:');
    console.log('--------------------------');
    const newConfig = {
        enabled: true,
        batchSize: 3,  // Smaller batches
        maxImages: 10, // Limit to 10 images
        model: 'claude-3-5-haiku-20241022' // Use newer Haiku model
    };
    
    const result = await dataManager.saveVisionVerificationConfig(newConfig);
    console.log('Update result:', result.success ? 'Success' : 'Failed');
    if (result.success) {
        console.log('New configuration:', JSON.stringify(result.config, null, 2));
    }
    
    // Test with the new configuration
    console.log('\n3. Testing Search with New Configuration:');
    console.log('-----------------------------------------');
    const searchFunctions = new SearchFunctions();
    
    const results = await searchFunctions.intelligentSearch({
        query: "archery competition",
        maxResults: 15, // Request more than maxImages to test limit
        enableVisionVerification: true
    });
    
    console.log(`\nSearch completed. Found ${results.length} verified results.`);
    console.log('Note: Maximum images to verify was set to', newConfig.maxImages);
    
    // Restore default configuration
    console.log('\n4. Restoring Default Configuration:');
    console.log('-----------------------------------');
    const defaultConfig = {
        enabled: true,
        batchSize: 5,
        maxImages: 30,
        model: 'claude-3-haiku-20240307'
    };
    
    await dataManager.saveVisionVerificationConfig(defaultConfig);
    console.log('Default configuration restored.');
    
    console.log('\n=== Test Complete ===');
}

// Run the test
testVisionConfig().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});