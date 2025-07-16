// Test script to verify album path enhancement functionality
require('dotenv').config();

const SmugMugClient = require('./lib/smugmugClient');
const DataManager = require('./lib/dataManager');

async function testAlbumEnhancement() {
    console.log('Testing Album Path Enhancement...\n');
    
    try {
        // Initialize clients
        const smugmugClient = new SmugMugClient(process.env.SMUGMUG_API_KEY, process.env.SMUGMUG_API_SECRET);
        const dataManager = new DataManager();
        
        // Get stored credentials
        const config = await dataManager.getConfig();
        const smugmugConfig = config.smugmug || {};
        
        if (!smugmugConfig.connected || !smugmugConfig.accessToken) {
            console.log('❌ SmugMug not connected. Please connect first.');
            return;
        }
        
        console.log('✅ SmugMug connected, testing album details fetching...\n');
        
        // Test getting album details for a known album
        const existingImages = await dataManager.getImages();
        if (existingImages.length === 0) {
            console.log('❌ No images found to test with.');
            return;
        }
        
        // Find an image with albumKey
        const testImage = existingImages.find(img => img.albumKey);
        if (!testImage) {
            console.log('❌ No images with albumKey found to test with.');
            return;
        }
        
        console.log(`📂 Testing with album: ${testImage.albumKey}`);
        
        // Test getAlbumDetails method
        const albumDetailsResult = await smugmugClient.getAlbumDetails(
            smugmugConfig.accessToken,
            smugmugConfig.accessTokenSecret,
            testImage.albumKey
        );
        
        if (albumDetailsResult.success) {
            console.log('✅ Album details retrieved successfully!');
            console.log(`   Album Name: ${albumDetailsResult.album.Name}`);
            console.log(`   Full Path: ${albumDetailsResult.album.FullDisplayPath}`);
            console.log(`   Hierarchy: ${JSON.stringify(albumDetailsResult.album.PathHierarchy)}`);
            console.log(`   Path Tags: ${JSON.stringify(albumDetailsResult.album.PathTags)}`);
            console.log(`   Indent Level: ${albumDetailsResult.album.IndentLevel}`);
        } else {
            console.log('❌ Failed to get album details:', albumDetailsResult.error);
            return;
        }
        
        // Check if any existing images already have album path information
        const enhancedImages = existingImages.filter(img => img.albumPath);
        console.log(`\n📊 Image Records Status:`);
        console.log(`   Total images: ${existingImages.length}`);
        console.log(`   Images with album path: ${enhancedImages.length}`);
        console.log(`   Images needing enhancement: ${existingImages.length - enhancedImages.length}`);
        
        // Show example of enhanced vs non-enhanced
        if (enhancedImages.length > 0) {
            console.log(`\n✅ Example enhanced image:`);
            const enhanced = enhancedImages[0];
            console.log(`   Filename: ${enhanced.filename}`);
            console.log(`   Album Path: ${enhanced.albumPath}`);
            console.log(`   Album Name: ${enhanced.albumName}`);
            console.log(`   Album Key: ${enhanced.albumKey}`);
        }
        
        if (existingImages.length > enhancedImages.length) {
            const nonEnhanced = existingImages.find(img => !img.albumPath);
            console.log(`\n⏳ Example non-enhanced image:`);
            console.log(`   Filename: ${nonEnhanced.filename}`);
            console.log(`   Album: ${nonEnhanced.albumName || nonEnhanced.albumKey || 'Unknown'}`);
            console.log(`   Album Key: ${nonEnhanced.albumKey || 'None'}`);
        }
        
        console.log(`\n🎯 Next Steps:`);
        console.log(`   1. Process new albums to test the enhancement`);
        console.log(`   2. Check the metadata modal in the web interface`);
        console.log(`   3. Look for "Album Path" instead of just "Album ID"`);
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run the test
testAlbumEnhancement();
