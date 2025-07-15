// Test script to debug batch processing endpoint
require('dotenv').config();

async function testBatchProcessing() {
    const baseUrl = 'http://localhost:3000';
    
    console.log('Testing batch processing endpoint...');
    
    try {
        // First check SmugMug status
        console.log('\n1. Checking SmugMug status...');
        const statusResponse = await fetch(`${baseUrl}/api/smugmug/status`);
        const statusData = await statusResponse.json();
        console.log('SmugMug Status:', statusData);
        
        if (!statusData.success || !statusData.data.connected) {
            console.log('❌ SmugMug not connected. Please connect first.');
            return;
        }
        
        // Get albums
        console.log('\n2. Getting albums...');
        const albumsResponse = await fetch(`${baseUrl}/api/smugmug/albums`);
        const albumsData = await albumsResponse.json();
        console.log('Albums Response:', albumsData);
        
        if (!albumsData.success || !albumsData.data.albums || albumsData.data.albums.length === 0) {
            console.log('❌ No albums found');
            return;
        }
        
        // Use the first album for testing
        const testAlbum = albumsData.data.albums[0];
        console.log(`\n3. Testing batch processing with album: ${testAlbum.Name} (${testAlbum.AlbumKey})`);
        
        // First, let's examine the album images structure
        console.log('\n3.1. Getting album images to examine structure...');
        const imagesResponse = await fetch(`${baseUrl}/api/smugmug/album/${testAlbum.AlbumKey}/images`);
        const imagesData = await imagesResponse.json();
        console.log('Images Response Status:', imagesResponse.status);
        console.log('Images Response:', JSON.stringify(imagesData, null, 2));
        
        if (imagesData.success && imagesData.data.images && imagesData.data.images.length > 0) {
            console.log('\n3.2. First image structure:');
            console.log(JSON.stringify(imagesData.data.images[0], null, 2));
        }
        
        const batchRequest = {
            albumKey: testAlbum.AlbumKey,
            maxImages: 5,
            batchName: `Test Batch - ${testAlbum.Name}`
        };
        
        console.log('\n3.3. Batch Request Data:', JSON.stringify(batchRequest, null, 2));
        
        const batchResponse = await fetch(`${baseUrl}/api/batch/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(batchRequest)
        });
        
        console.log('\nBatch Response Status:', batchResponse.status);
        console.log('Batch Response Headers:', Object.fromEntries(batchResponse.headers.entries()));
        
        const batchData = await batchResponse.json();
        console.log('Batch Response Data:', JSON.stringify(batchData, null, 2));
        
        if (batchData.success) {
            console.log('✅ Batch processing started successfully!');
        } else {
            console.log('❌ Batch processing failed:', batchData.error);
        }
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

// Run the test
testBatchProcessing();
