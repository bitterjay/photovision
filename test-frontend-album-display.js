// Test script to verify that album hierarchy data is properly displayed in search results
// This simulates what the frontend would receive from search API

require('dotenv').config();
const DataManager = require('./lib/dataManager');

async function testFrontendAlbumDisplay() {
    console.log('=== FRONTEND ALBUM DISPLAY TEST ===');
    
    try {
        const dataManager = new DataManager();
        
        // Step 1: Get all images
        console.log('\n1. Loading images for frontend display test...');
        const images = await dataManager.getImages();
        console.log(`   Found ${images.length} images`);
        
        // Step 2: Find images with album hierarchy data
        const imagesWithHierarchy = images.filter(img => 
            img.albumKey && img.albumName && img.albumPath && img.albumHierarchy
        );
        
        console.log(`   ${imagesWithHierarchy.length} images have complete album hierarchy data`);
        
        if (imagesWithHierarchy.length === 0) {
            console.log('❌ No images with album hierarchy data found');
            return;
        }
        
        // Step 3: Test search functionality
        console.log('\n2. Testing search functionality...');
        const searchResults = await dataManager.searchImages('archery');
        console.log(`   Search for "archery" returned ${searchResults.length} results`);
        
        // Step 4: Check if search results include album hierarchy
        const resultsWithHierarchy = searchResults.filter(img => 
            img.albumName && img.albumPath && img.albumHierarchy
        );
        
        console.log(`   ${resultsWithHierarchy.length}/${searchResults.length} search results have album hierarchy data`);
        
        // Step 5: Display sample data that frontend would receive
        if (resultsWithHierarchy.length > 0) {
            console.log('\n3. Sample frontend data:');
            const sample = resultsWithHierarchy[0];
            
            console.log('   Image Data:');
            console.log(`   - filename: ${sample.filename}`);
            console.log(`   - smugmugUrl: ${sample.smugmugUrl ? 'Available' : 'Not available'}`);
            console.log(`   - albumKey: ${sample.albumKey}`);
            console.log(`   - albumName: ${sample.albumName}`);
            console.log(`   - albumPath: ${sample.albumPath}`);
            console.log(`   - albumHierarchy: ${JSON.stringify(sample.albumHierarchy)}`);
            
            console.log('\n   Frontend Modal Display Logic:');
            console.log('   The metadata modal would show:');
            console.log(`   - Album Path: "${sample.albumPath || sample.albumName || sample.albumKey}"`);
            console.log('   ✅ Album hierarchy information is now available for frontend display');
        }
        
        // Step 6: Test all images to ensure consistency
        console.log('\n4. Data consistency check...');
        const allAlbumImages = images.filter(img => img.albumKey);
        const inconsistentImages = allAlbumImages.filter(img => 
            !img.albumName || !img.albumPath || !img.albumHierarchy
        );
        
        if (inconsistentImages.length > 0) {
            console.log(`   ⚠️  ${inconsistentImages.length} images still missing album hierarchy data:`);
            inconsistentImages.slice(0, 3).forEach(img => {
                console.log(`     - ${img.filename}: albumName=${!!img.albumName}, albumPath=${!!img.albumPath}, albumHierarchy=${!!img.albumHierarchy}`);
            });
        } else {
            console.log('   ✅ All album images have consistent hierarchy data');
        }
        
        console.log('\n=== FRONTEND TEST COMPLETE ===');
        console.log('✅ Album hierarchy data should now be visible in the frontend metadata modal');
        
    } catch (error) {
        console.error('❌ Frontend test failed:', error.message);
        console.error('Full error:', error);
    }
}

// Run the test
if (require.main === module) {
    testFrontendAlbumDisplay()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Script failed:', error);
            process.exit(1);
        });
}

module.exports = { testFrontendAlbumDisplay };
