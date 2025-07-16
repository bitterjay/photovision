// Test album hierarchy functionality
// Run this after implementing the changes to verify album path processing

const SmugMugClient = require('./lib/smugmugClient');
const DataManager = require('./lib/dataManager');

async function testAlbumHierarchy() {
    console.log('Testing Album Hierarchy Implementation...\n');
    
    try {
        // Load config
        const dataManager = new DataManager();
        const config = await dataManager.getConfig();
        
        if (!config.smugmug || !config.smugmug.accessToken) {
            console.log('❌ SmugMug not connected. Please complete OAuth first.');
            return;
        }
        
        console.log('✅ SmugMug credentials found');
        
        // Initialize SmugMug client
        const smugmugClient = new SmugMugClient(
            config.smugmug.apiKey,
            config.smugmug.apiSecret
        );
        
        // Test getUserAlbums with hierarchy
        console.log('\n📡 Fetching albums with hierarchy information...');
        const albumsResult = await smugmugClient.getUserAlbums(
            config.smugmug.accessToken,
            config.smugmug.accessTokenSecret,
            config.smugmug.userUri
        );
        
        if (!albumsResult.success) {
            console.log('❌ Failed to fetch albums:', albumsResult.error);
            return;
        }
        
        const albums = albumsResult.albums;
        console.log(`✅ Retrieved ${albums.length} albums with hierarchy\n`);
        
        // Display first few albums with hierarchy info
        console.log('📋 Album Hierarchy Preview:');
        console.log('=' .repeat(60));
        
        albums.slice(0, 10).forEach((album, index) => {
            const indent = '  '.repeat(album.IndentLevel || 0);
            const pathTags = album.PathTags ? album.PathTags.join('] [') : 'Root';
            
            console.log(`${index + 1}. ${indent}${album.Name}`);
            console.log(`   📁 Path: ${album.FullDisplayPath || 'Root > ' + album.Name}`);
            console.log(`   🏷️  Tags: [${pathTags}]`);
            console.log(`   📊 Images: ${album.ImageCount || 0}`);
            console.log(`   🔢 Indent Level: ${album.IndentLevel || 0}`);
            console.log();
        });
        
        // Test path processing with mock data
        console.log('\n🧪 Testing Path Processing Logic:');
        console.log('=' .repeat(60));
        
        const testCases = [
            {
                Name: 'Finals',
                Uris: { UrlPath: '/2025/Collegiate-Target-Nationals/Finals' }
            },
            {
                Name: 'Summer Photos',
                UrlPath: '/2024/Summer-Events/Summer-Photos'
            },
            {
                Name: 'Root Album',
                // No path info - should use fallback
            }
        ];
        
        testCases.forEach((testAlbum, index) => {
            const pathInfo = smugmugClient.extractPathInformation(testAlbum);
            console.log(`Test ${index + 1}: ${testAlbum.Name}`);
            console.log(`  Hierarchy: ${pathInfo.hierarchy.join(' > ')}`);
            console.log(`  Tags: [${pathInfo.tags.join('] [')}]`);
            console.log(`  Indent Level: ${pathInfo.indentLevel}`);
            console.log(`  Sort Key: ${pathInfo.sortKey}`);
            console.log();
        });
        
        // Summary
        const hierarchyLevels = albums.reduce((acc, album) => {
            const level = album.IndentLevel || 0;
            acc[level] = (acc[level] || 0) + 1;
            return acc;
        }, {});
        
        console.log('📊 Hierarchy Distribution:');
        Object.entries(hierarchyLevels).forEach(([level, count]) => {
            const indent = '  '.repeat(parseInt(level));
            console.log(`${indent}Level ${level}: ${count} albums`);
        });
        
        console.log('\n✅ Album hierarchy test completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run the test
if (require.main === module) {
    testAlbumHierarchy();
}

module.exports = { testAlbumHierarchy };
