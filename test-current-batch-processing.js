// Test script to verify current batch processing works with album hierarchy
// This will process 1 image to see if album hierarchy data is properly stored

require('dotenv').config();
const DataManager = require('./lib/dataManager');
const SmugMugClient = require('./lib/smugmugClient');
const ClaudeClient = require('./lib/claudeClient');

async function testCurrentBatchProcessing() {
    console.log('=== CURRENT BATCH PROCESSING TEST ===');
    
    try {
        const dataManager = new DataManager();
        const smugmugClient = new SmugMugClient(process.env.SMUGMUG_API_KEY, process.env.SMUGMUG_API_SECRET);
        const claudeClient = new ClaudeClient(process.env.ANTHROPIC_API_KEY);
        
        // Step 1: Check SmugMug connection
        console.log('\n1. Checking SmugMug connection...');
        const config = await dataManager.getConfig();
        const smugmugConfig = config.smugmug || {};
        
        if (!smugmugConfig.connected || !smugmugConfig.accessToken) {
            console.log('❌ SmugMug not connected');
            return;
        }
        
        console.log('✅ SmugMug connected');
        
        // Step 2: Get albums to test with
        console.log('\n2. Getting albums...');
        const albumsResult = await smugmugClient.getUserAlbums(
            smugmugConfig.accessToken,
            smugmugConfig.accessTokenSecret,
            smugmugConfig.user.Uri
        );
        
        if (!albumsResult.success || albumsResult.albums.length === 0) {
            console.log('❌ No albums available for testing');
            return;
        }
        
        // Find an album with images
        let testAlbum = null;
        for (const album of albumsResult.albums.slice(0, 5)) { // Test first 5 albums
            if (album.ImageCount > 0) {
                testAlbum = album;
                break;
            }
        }
        
        if (!testAlbum) {
            console.log('❌ No albums with images found');
            return;
        }
        
        console.log(`✅ Using test album: ${testAlbum.Name} (${testAlbum.ImageCount} images)`);
        
        // Step 3: Get album details (this is what the server does)
        console.log('\n3. Getting album details...');
        const albumDetailsResult = await smugmugClient.getAlbumDetails(
            smugmugConfig.accessToken,
            smugmugConfig.accessTokenSecret,
            testAlbum.AlbumKey
        );
        
        if (!albumDetailsResult.success) {
            console.log('❌ Failed to get album details:', albumDetailsResult.error);
            return;
        }
        
        const albumDetails = albumDetailsResult.album;
        console.log('✅ Album details retrieved:');
        console.log(`   Name: ${albumDetails.Name}`);
        console.log(`   Path: ${albumDetails.FullDisplayPath}`);
        console.log(`   Hierarchy: ${JSON.stringify(albumDetails.PathHierarchy)}`);
        
        // Step 4: Get album images
        console.log('\n4. Getting album images...');
        const albumUri = `/api/v2/album/${testAlbum.AlbumKey}`;
        const imagesResult = await smugmugClient.getAlbumImages(
            smugmugConfig.accessToken,
            smugmugConfig.accessTokenSecret,
            albumUri
        );
        
        if (!imagesResult.success || imagesResult.images.length === 0) {
            console.log('❌ Failed to get album images');
            return;
        }
        
        console.log(`✅ Retrieved ${imagesResult.images.length} images`);
        
        // Step 5: Test image record creation (simulate what the server does)
        const testImage = imagesResult.images[0]; // Use first image
        console.log(`\n5. Testing image record creation with: ${testImage.FileName}`);
        
        // Check if image already exists
        const existingImages = await dataManager.getImages();
        const existingImage = existingImages.find(img => img.smugmugImageKey === testImage.ImageKey);
        
        if (existingImage) {
            console.log('   Image already exists in database:');
            console.log(`   - albumKey: ${existingImage.albumKey || 'NOT SET'}`);
            console.log(`   - albumName: ${existingImage.albumName || 'NOT SET'}`);
            console.log(`   - albumPath: ${existingImage.albumPath || 'NOT SET'}`);
            console.log(`   - albumHierarchy: ${existingImage.albumHierarchy ? JSON.stringify(existingImage.albumHierarchy) : 'NOT SET'}`);
            
            console.log('\n   What SHOULD be stored:');
            console.log(`   - albumKey: ${testAlbum.AlbumKey}`);
            console.log(`   - albumName: ${albumDetails.Name}`);
            console.log(`   - albumPath: ${albumDetails.FullDisplayPath}`);
            console.log(`   - albumHierarchy: ${JSON.stringify(albumDetails.PathHierarchy)}`);
            
            if (!existingImage.albumName || !existingImage.albumPath || !existingImage.albumHierarchy) {
                console.log('\n❌ CONFIRMED: Existing image is missing album hierarchy data');
            } else {
                console.log('\n✅ Existing image has album hierarchy data');
            }
        } else {
            console.log('   Image not yet processed - would create new record');
        }
        
        // Step 6: Simulate what the batch processing SHOULD create
        console.log('\n6. What batch processing should create:');
        const simulatedImageRecord = {
            id: 'test_id',
            filename: testImage.FileName || 'test_image',
            smugmugImageKey: testImage.ImageKey,
            smugmugUrl: testImage.ArchivedUri,
            title: testImage.Title || '',
            caption: testImage.Caption || '',
            albumKey: testAlbum.AlbumKey,
            albumName: albumDetails.Name,                    // THIS SHOULD BE INCLUDED
            albumPath: albumDetails.FullDisplayPath,         // THIS SHOULD BE INCLUDED
            albumHierarchy: albumDetails.PathHierarchy,      // THIS SHOULD BE INCLUDED
            description: 'Test description',
            keywords: ['test'],
            metadata: {
                model: 'test-model',
                timestamp: new Date().toISOString(),
                batchId: 'test-batch',
                jobId: 'test-job'
            }
        };
        
        console.log('   Simulated record would include:');
        console.log(`   - albumKey: ${simulatedImageRecord.albumKey}`);
        console.log(`   - albumName: ${simulatedImageRecord.albumName}`);
        console.log(`   - albumPath: ${simulatedImageRecord.albumPath}`);
        console.log(`   - albumHierarchy: ${JSON.stringify(simulatedImageRecord.albumHierarchy)}`);
        
        console.log('\n=== TEST COMPLETE ===');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Full error:', error);
    }
}

// Run the test
if (require.main === module) {
    testCurrentBatchProcessing()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Script failed:', error);
            process.exit(1);
        });
}

module.exports = { testCurrentBatchProcessing };
