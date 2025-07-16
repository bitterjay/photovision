// Test Album Processing Status Feature
// Tests the new endpoint and functionality for tracking album processing status

require('dotenv').config();

async function testAlbumProcessingStatus() {
    const baseUrl = 'http://localhost:3000';
    
    console.log('=== Testing Album Processing Status Feature ===\n');
    
    try {
        // Test 1: Check SmugMug connection
        console.log('1. Checking SmugMug connection...');
        const statusResponse = await fetch(`${baseUrl}/api/smugmug/status`);
        const statusData = await statusResponse.json();
        
        if (!statusData.success || !statusData.data.connected) {
            console.log('❌ SmugMug not connected. Please connect first.');
            return;
        }
        console.log('✅ SmugMug connected');
        
        // Test 2: Get albums list
        console.log('\n2. Getting albums list...');
        const albumsResponse = await fetch(`${baseUrl}/api/smugmug/albums`);
        const albumsData = await albumsResponse.json();
        
        if (!albumsData.success || !albumsData.data.albums || albumsData.data.albums.length === 0) {
            console.log('❌ No albums found');
            return;
        }
        
        const albums = albumsData.data.albums;
        console.log(`✅ Found ${albums.length} albums`);
        
        // Test 3: Check processing status for first few albums
        console.log('\n3. Checking processing status for albums...');
        const testAlbums = albums.slice(0, Math.min(3, albums.length));
        
        for (const album of testAlbums) {
            console.log(`\n   Testing album: ${album.Name} (${album.AlbumKey})`);
            console.log(`   Total images: ${album.ImageCount || 0}`);
            
            try {
                const statusResponse = await fetch(`${baseUrl}/api/smugmug/album/${album.AlbumKey}/processing-status`);
                const statusData = await statusResponse.json();
                
                if (statusData.success) {
                    const status = statusData.data;
                    console.log(`   ✅ Processing status:`);
                    console.log(`      - Total images: ${status.totalImages}`);
                    console.log(`      - Processed images: ${status.processedImages}`);
                    console.log(`      - Unprocessed images: ${status.unprocessedImages}`);
                    console.log(`      - Progress: ${status.processingProgress}%`);
                    console.log(`      - Completely processed: ${status.isCompletelyProcessed}`);
                    
                    if (status.processedImages > 0) {
                        console.log(`      - Last processed: ${status.lastProcessedAt ? new Date(status.lastProcessedAt).toLocaleString() : 'Unknown'}`);
                    }
                } else {
                    console.log(`   ❌ Failed to get processing status: ${statusData.error}`);
                }
            } catch (error) {
                console.log(`   ❌ Error checking album status: ${error.message}`);
            }
        }
        
        // Test 4: Summary
        console.log('\n4. Getting processed images summary...');
        const imagesResponse = await fetch(`${baseUrl}/api/images`);
        const imagesData = await imagesResponse.json();
        
        if (imagesData.success) {
            const processedImages = imagesData.data;
            const albumGroups = {};
            
            processedImages.forEach(img => {
                if (img.albumKey) {
                    if (!albumGroups[img.albumKey]) {
                        albumGroups[img.albumKey] = 0;
                    }
                    albumGroups[img.albumKey]++;
                }
            });
            
            console.log(`✅ Total processed images: ${processedImages.length}`);
            console.log(`✅ Albums with processed images: ${Object.keys(albumGroups).length}`);
            
            if (Object.keys(albumGroups).length > 0) {
                console.log('\nProcessed images by album:');
                Object.entries(albumGroups).forEach(([albumKey, count]) => {
                    const album = albums.find(a => a.AlbumKey === albumKey);
                    const albumName = album ? album.Name : `Album ${albumKey}`;
                    console.log(`   - ${albumName}: ${count} images`);
                });
            }
        }
        
        console.log('\n=== Album Processing Status Test Complete ===');
        
    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

// Utility function for fetch (since we're in Node.js)
global.fetch = require('node-fetch');

// Run the test
testAlbumProcessingStatus()
    .then(() => {
        console.log('\nTest completed successfully!');
        process.exit(0);
    })
    .catch(error => {
        console.error('Test failed:', error);
        process.exit(1);
    });
