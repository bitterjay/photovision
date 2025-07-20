#!/usr/bin/env node

// Test script for album-based storage functionality

const AlbumDataManager = require('./lib/albumDataManager');
const DataManager = require('./lib/dataManager');

async function testAlbumStorage() {
    console.log('🧪 Testing Album-Based Storage Implementation\\n');
    
    const albumManager = new AlbumDataManager();
    await albumManager.initialize();
    
    try {
        // Test 1: Save images to different albums
        console.log('Test 1: Saving images to albums...');
        
        const testAlbum1 = {
            albumKey: 'test-album-1',
            images: [
                {
                    filename: 'test1.jpg',
                    smugmugImageKey: 'test-key-1',
                    smugmugUrl: 'https://example.com/test1.jpg',
                    albumKey: 'test-album-1',
                    albumName: 'Test Album 1',
                    description: 'A beautiful sunset over the mountains with golden light',
                    keywords: ['sunset', 'mountains', 'golden', 'landscape']
                },
                {
                    filename: 'test2.jpg',
                    smugmugImageKey: 'test-key-2',
                    smugmugUrl: 'https://example.com/test2.jpg',
                    albumKey: 'test-album-1',
                    albumName: 'Test Album 1',
                    description: 'Ocean waves crashing on the beach during a storm',
                    keywords: ['ocean', 'waves', 'beach', 'storm', 'seascape']
                }
            ]
        };
        
        const testAlbum2 = {
            albumKey: 'test-album-2',
            images: [
                {
                    filename: 'test3.jpg',
                    smugmugImageKey: 'test-key-3',
                    smugmugUrl: 'https://example.com/test3.jpg',
                    albumKey: 'test-album-2',
                    albumName: 'Test Album 2',
                    description: 'Portrait of a smiling person in golden hour light',
                    keywords: ['portrait', 'person', 'golden hour', 'smile']
                }
            ]
        };
        
        // Save albums
        for (const image of testAlbum1.images) {
            await albumManager.addImageToAlbum(testAlbum1.albumKey, image);
        }
        console.log(`✓ Saved ${testAlbum1.images.length} images to ${testAlbum1.albumKey}`);
        
        for (const image of testAlbum2.images) {
            await albumManager.addImageToAlbum(testAlbum2.albumKey, image);
        }
        console.log(`✓ Saved ${testAlbum2.images.length} images to ${testAlbum2.albumKey}\\n`);
        
        // Test 2: Load album data
        console.log('Test 2: Loading album data...');
        const loadedAlbum1 = await albumManager.loadAlbum(testAlbum1.albumKey);
        console.log(`✓ Loaded album ${testAlbum1.albumKey}: ${loadedAlbum1.length} images`);
        
        // Test 3: Search functionality
        console.log('\\nTest 3: Testing search...');
        const searchResults1 = await albumManager.searchImages('sunset');
        console.log(`✓ Search for "sunset": ${searchResults1.length} results`);
        
        const searchResults2 = await albumManager.searchImages('golden');
        console.log(`✓ Search for "golden": ${searchResults2.length} results`);
        
        // Test 4: Duplicate detection
        console.log('\\nTest 4: Testing duplicate detection...');
        const exists = await albumManager.imageExists('test-key-1');
        console.log(`✓ Image exists check: ${exists}`);
        
        const foundImage = await albumManager.findImageBySmugmugKey('test-key-1');
        console.log(`✓ Found image by key: ${foundImage ? foundImage.filename : 'not found'}`);
        
        // Test 5: Storage statistics
        console.log('\\nTest 5: Getting storage statistics...');
        const stats = await albumManager.getStorageStatistics();
        console.log(`✓ Storage stats:
  - Total albums: ${stats.totalAlbums}
  - Total images: ${stats.totalImages}
  - Total size: ${(stats.totalSize / 1024).toFixed(2)} KB`);
        
        // Test 6: DataManager integration
        console.log('\\nTest 6: Testing DataManager integration...');
        const dataManager = new DataManager();
        
        // Switch to album mode
        await dataManager.setStorageMode('album');
        const mode = await dataManager.getStorageMode();
        console.log(`✓ Storage mode set to: ${mode}`);
        
        // Test search through DataManager
        const dmSearchResults = await dataManager.searchImages('ocean');
        console.log(`✓ DataManager search for "ocean": ${dmSearchResults.length} results`);
        
        // Clean up test data
        console.log('\\nCleaning up test data...');
        await albumManager.clearAllAlbumData();
        console.log('✓ Test data cleaned up');
        
        // Reset to single mode
        await dataManager.setStorageMode('single');
        console.log('✓ Reset to single storage mode');
        
        console.log('\\n✅ All tests passed!');
        
    } catch (error) {
        console.error('\\n❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run tests
testAlbumStorage().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
});