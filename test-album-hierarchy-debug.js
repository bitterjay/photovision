// Test script to debug album hierarchy data storage issue
// This script will help identify why album hierarchy information isn't being saved

require('dotenv').config();
const DataManager = require('./lib/dataManager');
const SmugMugClient = require('./lib/smugmugClient');

async function testAlbumHierarchyDebug() {
    console.log('=== ALBUM HIERARCHY DEBUG TEST ===');
    
    try {
        const dataManager = new DataManager();
        const smugmugClient = new SmugMugClient(process.env.SMUGMUG_API_KEY, process.env.SMUGMUG_API_SECRET);
        
        // Step 1: Check current configuration and tokens
        console.log('\n1. Checking SmugMug configuration...');
        const config = await dataManager.getConfig();
        const smugmugConfig = config.smugmug || {};
        
        if (!smugmugConfig.connected || !smugmugConfig.accessToken) {
            console.log('❌ SmugMug not connected. Please connect first.');
            return;
        }
        
        console.log('✅ SmugMug connected');
        console.log(`   User: ${smugmugConfig.user?.NickName || 'Unknown'}`);
        
        // Step 2: Get existing images to test with
        console.log('\n2. Getting existing images...');
        const existingImages = await dataManager.getImages();
        console.log(`   Found ${existingImages.length} existing images`);
        
        if (existingImages.length === 0) {
            console.log('❌ No existing images to test with');
            return;
        }
        
        // Test with the first image that has an albumKey
        const testImage = existingImages.find(img => img.albumKey);
        if (!testImage) {
            console.log('❌ No images with albumKey found');
            return;
        }
        
        console.log(`   Testing with image: ${testImage.filename}`);
        console.log(`   Album Key: ${testImage.albumKey}`);
        console.log(`   Has albumName: ${!!testImage.albumName}`);
        console.log(`   Has albumPath: ${!!testImage.albumPath}`);
        console.log(`   Has albumHierarchy: ${!!testImage.albumHierarchy}`);
        
        // Step 3: Test getAlbumDetails with the albumKey
        console.log('\n3. Testing getAlbumDetails...');
        const albumDetailsResult = await smugmugClient.getAlbumDetails(
            smugmugConfig.accessToken,
            smugmugConfig.accessTokenSecret,
            testImage.albumKey
        );
        
        if (!albumDetailsResult.success) {
            console.log('❌ Failed to get album details:', albumDetailsResult.error);
            return;
        }
        
        console.log('✅ Successfully retrieved album details');
        const albumDetails = albumDetailsResult.album;
        console.log(`   Album Name: ${albumDetails.Name}`);
        console.log(`   Full Display Path: ${albumDetails.FullDisplayPath}`);
        console.log(`   Path Hierarchy: ${JSON.stringify(albumDetails.PathHierarchy)}`);
        console.log(`   Path Tags: ${JSON.stringify(albumDetails.PathTags)}`);
        console.log(`   Indent Level: ${albumDetails.IndentLevel}`);
        
        // Step 4: Test what should be stored in image record
        console.log('\n4. What should be stored in image records:');
        console.log(`   albumName: "${albumDetails.Name}"`);
        console.log(`   albumPath: "${albumDetails.FullDisplayPath}"`);
        console.log(`   albumHierarchy: ${JSON.stringify(albumDetails.PathHierarchy)}`);
        
        // Step 5: Check if there's a mismatch in the server code
        console.log('\n5. Checking server implementation...');
        console.log('   The server should be calling getAlbumDetails and storing:');
        console.log('   - albumName: albumDetails.Name');
        console.log('   - albumPath: albumDetails.FullDisplayPath');
        console.log('   - albumHierarchy: albumDetails.PathHierarchy');
        
        // Step 6: Test a small batch to see if the issue is fixed
        console.log('\n6. Testing current batch processing (simulation)...');
        console.log('   This would create a job with:');
        console.log(`   albumKey: ${testImage.albumKey}`);
        console.log(`   albumName: ${albumDetails.Name}`);
        console.log(`   albumPath: ${albumDetails.FullDisplayPath}`);
        console.log(`   albumHierarchy: ${JSON.stringify(albumDetails.PathHierarchy)}`);
        
        // Step 7: Compare with existing data
        console.log('\n7. Data comparison:');
        console.log('   EXISTING IMAGE:');
        console.log(`   - albumKey: ${testImage.albumKey || 'NOT SET'}`);
        console.log(`   - albumName: ${testImage.albumName || 'NOT SET'}`);
        console.log(`   - albumPath: ${testImage.albumPath || 'NOT SET'}`);
        console.log(`   - albumHierarchy: ${testImage.albumHierarchy ? JSON.stringify(testImage.albumHierarchy) : 'NOT SET'}`);
        
        console.log('\n   WHAT SHOULD BE STORED:');
        console.log(`   - albumKey: ${testImage.albumKey}`);
        console.log(`   - albumName: ${albumDetails.Name}`);
        console.log(`   - albumPath: ${albumDetails.FullDisplayPath}`);
        console.log(`   - albumHierarchy: ${JSON.stringify(albumDetails.PathHierarchy)}`);
        
        // Step 8: Check if we can identify when this data was missing
        console.log('\n8. Analysis:');
        if (!testImage.albumName && !testImage.albumPath && !testImage.albumHierarchy) {
            console.log('❌ CONFIRMED: Album hierarchy data is missing from stored images');
            console.log('   This suggests either:');
            console.log('   a) The getAlbumDetails call failed during processing');
            console.log('   b) The album details were fetched but not properly saved');
            console.log('   c) The processing happened before this feature was implemented');
        } else {
            console.log('✅ Album hierarchy data is present');
        }
        
        console.log('\n=== DEBUG COMPLETE ===');
        
    } catch (error) {
        console.error('❌ Debug test failed:', error.message);
        console.error('Full error:', error);
    }
}

// Run the test
if (require.main === module) {
    testAlbumHierarchyDebug()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Script failed:', error);
            process.exit(1);
        });
}

module.exports = { testAlbumHierarchyDebug };
