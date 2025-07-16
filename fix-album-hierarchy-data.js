// Script to fix missing album hierarchy data in existing images
// This will update all images that have albumKey but are missing album hierarchy info

require('dotenv').config();
const DataManager = require('./lib/dataManager');
const SmugMugClient = require('./lib/smugmugClient');
const fs = require('fs').promises;

async function fixAlbumHierarchyData() {
    console.log('=== FIXING ALBUM HIERARCHY DATA ===');
    
    try {
        const dataManager = new DataManager();
        const smugmugClient = new SmugMugClient(process.env.SMUGMUG_API_KEY, process.env.SMUGMUG_API_SECRET);
        
        // Step 1: Check SmugMug connection
        console.log('\n1. Checking SmugMug connection...');
        const config = await dataManager.getConfig();
        const smugmugConfig = config.smugmug || {};
        
        if (!smugmugConfig.connected || !smugmugConfig.accessToken) {
            console.log('❌ SmugMug not connected. Please connect first.');
            return;
        }
        
        console.log('✅ SmugMug connected');
        
        // Step 2: Get all existing images
        console.log('\n2. Loading existing images...');
        const existingImages = await dataManager.getImages();
        console.log(`   Found ${existingImages.length} existing images`);
        
        // Step 3: Find images missing album hierarchy data
        const imagesNeedingUpdate = existingImages.filter(img => 
            img.albumKey && (!img.albumName || !img.albumPath || !img.albumHierarchy)
        );
        
        console.log(`   ${imagesNeedingUpdate.length} images need album hierarchy data`);
        
        if (imagesNeedingUpdate.length === 0) {
            console.log('✅ All images already have album hierarchy data');
            return;
        }
        
        // Step 4: Get unique album keys to minimize API calls
        const uniqueAlbumKeys = [...new Set(imagesNeedingUpdate.map(img => img.albumKey))];
        console.log(`   Need to fetch details for ${uniqueAlbumKeys.length} unique albums`);
        
        // Step 5: Fetch album details for each unique album
        console.log('\n3. Fetching album details...');
        const albumDetailsCache = new Map();
        
        for (let i = 0; i < uniqueAlbumKeys.length; i++) {
            const albumKey = uniqueAlbumKeys[i];
            console.log(`   Fetching details for album ${i + 1}/${uniqueAlbumKeys.length}: ${albumKey}`);
            
            try {
                const albumDetailsResult = await smugmugClient.getAlbumDetails(
                    smugmugConfig.accessToken,
                    smugmugConfig.accessTokenSecret,
                    albumKey
                );
                
                if (albumDetailsResult.success) {
                    albumDetailsCache.set(albumKey, albumDetailsResult.album);
                    console.log(`     ✅ ${albumDetailsResult.album.Name} - ${albumDetailsResult.album.FullDisplayPath}`);
                } else {
                    console.log(`     ❌ Failed: ${albumDetailsResult.error}`);
                }
                
                // Small delay to be respectful to the API
                if (i < uniqueAlbumKeys.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            } catch (error) {
                console.log(`     ❌ Error: ${error.message}`);
            }
        }
        
        console.log(`\n   Successfully fetched details for ${albumDetailsCache.size} albums`);
        
        // Step 6: Update images with album hierarchy data
        console.log('\n4. Updating images with album hierarchy data...');
        const updatedImages = existingImages.map(img => {
            if (img.albumKey && albumDetailsCache.has(img.albumKey)) {
                const albumDetails = albumDetailsCache.get(img.albumKey);
                
                // Only update if data is missing
                if (!img.albumName || !img.albumPath || !img.albumHierarchy) {
                    return {
                        ...img,
                        albumName: albumDetails.Name,
                        albumPath: albumDetails.FullDisplayPath,
                        albumHierarchy: albumDetails.PathHierarchy
                    };
                }
            }
            return img;
        });
        
        // Step 7: Count how many images will be updated
        const actualUpdates = updatedImages.filter((img, index) => {
            const original = existingImages[index];
            return original.albumKey && (
                !original.albumName || 
                !original.albumPath || 
                !original.albumHierarchy
            ) && img.albumName;
        });
        
        console.log(`   Will update ${actualUpdates.length} images`);
        
        if (actualUpdates.length === 0) {
            console.log('   No images to update');
            return;
        }
        
        // Step 8: Backup existing data
        console.log('\n5. Creating backup...');
        const backupPath = `data/images_backup_${Date.now()}.json`;
        await fs.writeFile(backupPath, JSON.stringify(existingImages, null, 2));
        console.log(`   ✅ Backup created: ${backupPath}`);
        
        // Step 9: Save updated data
        console.log('\n6. Saving updated data...');
        await fs.writeFile('data/images.json', JSON.stringify(updatedImages, null, 2));
        console.log('   ✅ Updated images.json with album hierarchy data');
        
        // Step 10: Verify the update
        console.log('\n7. Verification...');
        const verificationImages = await dataManager.getImages();
        const imagesWithHierarchy = verificationImages.filter(img => 
            img.albumKey && img.albumName && img.albumPath && img.albumHierarchy
        );
        
        console.log(`   ${imagesWithHierarchy.length}/${verificationImages.filter(img => img.albumKey).length} images now have complete album hierarchy data`);
        
        // Step 11: Show sample of updated data
        console.log('\n8. Sample of updated data:');
        const sampleImage = verificationImages.find(img => img.albumName && img.albumPath);
        if (sampleImage) {
            console.log(`   Filename: ${sampleImage.filename}`);
            console.log(`   Album Name: ${sampleImage.albumName}`);
            console.log(`   Album Path: ${sampleImage.albumPath}`);
            console.log(`   Album Hierarchy: ${JSON.stringify(sampleImage.albumHierarchy)}`);
        }
        
        console.log('\n=== ALBUM HIERARCHY DATA FIXED ===');
        console.log('✅ Images should now display album paths in the frontend metadata modal');
        
    } catch (error) {
        console.error('❌ Fix script failed:', error.message);
        console.error('Full error:', error);
    }
}

// Run the fix
if (require.main === module) {
    fixAlbumHierarchyData()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Script failed:', error);
            process.exit(1);
        });
}

module.exports = { fixAlbumHierarchyData };
