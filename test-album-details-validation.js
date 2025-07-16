// Test Album Details Validation
// Verifies that album details are properly fetched and validated

require('dotenv').config();
const DataManager = require('./lib/dataManager');
const SmugMugClient = require('./lib/smugmugClient');

async function testAlbumDetailsValidation() {
    console.log('=== Album Details Validation Test ===\n');

    try {
        const dataManager = new DataManager();
        const smugmugClient = new SmugMugClient(process.env.SMUGMUG_API_KEY, process.env.SMUGMUG_API_SECRET);

        // Get SmugMug configuration
        const config = await dataManager.getConfig();
        const smugmugConfig = config.smugmug || {};

        if (!smugmugConfig.connected || !smugmugConfig.accessToken) {
            console.log('❌ SmugMug not connected. Please connect first.');
            return false;
        }

        console.log('✓ SmugMug connection found');

        // Test album key from recent data (one that had missing info)
        const testAlbumKey = 'NKgD8x';
        
        console.log(`\n1. Testing album details fetch for: ${testAlbumKey}`);
        
        const albumDetailsResult = await smugmugClient.getAlbumDetails(
            smugmugConfig.accessToken,
            smugmugConfig.accessTokenSecret,
            testAlbumKey
        );

        if (!albumDetailsResult.success) {
            console.log(`❌ Failed to get album details: ${albumDetailsResult.error}`);
            return false;
        }

        const albumDetails = albumDetailsResult.album;
        console.log('✓ Album details fetched successfully');

        // Validate required fields
        console.log('\n2. Validating album details structure:');

        const validations = [
            { field: 'Name', value: albumDetails.Name, required: true },
            { field: 'FullDisplayPath', value: albumDetails.FullDisplayPath, required: true },
            { field: 'PathHierarchy', value: albumDetails.PathHierarchy, required: true, type: 'array' },
            { field: 'AlbumKey', value: albumDetails.AlbumKey, required: true }
        ];

        let allValid = true;
        for (const validation of validations) {
            const hasValue = validation.value !== undefined && validation.value !== null;
            const isCorrectType = validation.type === 'array' ? Array.isArray(validation.value) : true;
            const isValid = hasValue && isCorrectType && (validation.type !== 'array' || validation.value.length > 0);

            if (validation.required && !isValid) {
                console.log(`❌ ${validation.field}: MISSING or INVALID`);
                console.log(`   Value: ${JSON.stringify(validation.value)}`);
                allValid = false;
            } else {
                console.log(`✓ ${validation.field}: ${validation.type === 'array' ? `[${validation.value.join(', ')}]` : validation.value}`);
            }
        }

        if (!allValid) {
            console.log('\n❌ Album details validation FAILED');
            console.log('\nFull album details object:');
            console.log(JSON.stringify(albumDetails, null, 2));
            return false;
        }

        console.log('\n3. Testing album hierarchy processing:');
        console.log(`   Album Name: ${albumDetails.Name}`);
        console.log(`   Display Path: ${albumDetails.FullDisplayPath}`);
        console.log(`   Hierarchy: [${albumDetails.PathHierarchy.join(' > ')}]`);
        console.log(`   Hierarchy Length: ${albumDetails.PathHierarchy.length}`);

        // Test what would be saved to an image record
        console.log('\n4. Testing image record structure:');
        const mockImageRecord = {
            albumKey: testAlbumKey,
            albumName: albumDetails.Name,
            albumPath: albumDetails.FullDisplayPath,
            albumHierarchy: albumDetails.PathHierarchy
        };

        console.log('Mock image record album fields:');
        console.log(`   albumKey: ${mockImageRecord.albumKey}`);
        console.log(`   albumName: ${mockImageRecord.albumName}`);
        console.log(`   albumPath: ${mockImageRecord.albumPath}`);
        console.log(`   albumHierarchy: [${mockImageRecord.albumHierarchy.join(', ')}]`);

        // Validate that none of the required fields are missing
        const requiredFields = ['albumKey', 'albumName', 'albumPath', 'albumHierarchy'];
        const missingFields = requiredFields.filter(field => !mockImageRecord[field]);
        
        if (missingFields.length > 0) {
            console.log(`❌ Mock image record missing fields: ${missingFields.join(', ')}`);
            return false;
        }

        console.log('✓ Mock image record has all required album fields');

        console.log('\n=== Album Details Validation Test PASSED ===');
        console.log('\nThe album details fetching and validation is working correctly.');
        console.log('The issue might be elsewhere in the batch processing flow.');
        
        return true;

    } catch (error) {
        console.error('\n❌ Test failed with error:', error.message);
        console.error(error.stack);
        return false;
    }
}

// Run the test
if (require.main === module) {
    testAlbumDetailsValidation().then(success => {
        if (!success) {
            process.exit(1);
        }
    }).catch(error => {
        console.error('Test runner failed:', error);
        process.exit(1);
    });
}

module.exports = { testAlbumDetailsValidation };
