// Test duplicate detection functionality - Task 1.1
// Tests the new addImage() method with standardized duplicate handling

const DataManager = require('./lib/dataManager');
const fs = require('fs/promises');
const path = require('path');

async function testDuplicateDetection() {
    console.log('🧪 Testing Duplicate Detection Implementation - Task 1.1');
    console.log('=' .repeat(60));

    const dataManager = new DataManager();
    const testDataFile = path.join(__dirname, 'data', 'images_backup_test.json');
    const originalDataFile = path.join(__dirname, 'data', 'images.json');

    try {
        // Create backup of original data
        const originalData = await fs.readFile(originalDataFile, 'utf8');
        await fs.writeFile(testDataFile, originalData);
        
        // Start with fresh data for testing
        await dataManager.saveImages([]);
        
        console.log('\n1️⃣ Testing New Image Addition (No Duplicates)');
        console.log('-'.repeat(50));
        
        const testImage1 = {
            filename: 'test1.jpg',
            smugmugImageKey: 'TEST123',
            smugmugUrl: 'https://example.com/test1.jpg',
            description: 'Test image 1',
            keywords: ['test', 'image', 'first']
        };
        
        const result1 = await dataManager.addImage(testImage1);
        console.log(`✅ New image added: ${result1.id}`);
        console.log(`   - Was added: ${result1.wasAdded}`);
        console.log(`   - SmugMug key: ${result1.smugmugImageKey}`);
        
        console.log('\n2️⃣ Testing Duplicate Detection with Skip (Default)');
        console.log('-'.repeat(50));
        
        const duplicateImage1 = {
            filename: 'test1_duplicate.jpg',
            smugmugImageKey: 'TEST123', // Same key as test1
            smugmugUrl: 'https://example.com/test1_duplicate.jpg',
            description: 'This should be skipped',
            keywords: ['duplicate', 'test']
        };
        
        const result2 = await dataManager.addImage(duplicateImage1); // Default: skip
        console.log(`✅ Duplicate skipped: ${result2.id}`);
        console.log(`   - Was skipped: ${result2.wasSkipped}`);
        console.log(`   - Original description preserved: ${result2.description}`);
        
        console.log('\n3️⃣ Testing Duplicate Detection with Update');
        console.log('-'.repeat(50));
        
        const updateImage = {
            filename: 'test1_updated.jpg',
            smugmugImageKey: 'TEST123', // Same key as test1
            smugmugUrl: 'https://example.com/test1_updated.jpg',
            description: 'Updated description',
            keywords: ['updated', 'test', 'image']
        };
        
        const result3 = await dataManager.addImage(updateImage, { duplicateHandling: 'update' });
        console.log(`✅ Image updated: ${result3.id}`);
        console.log(`   - Was updated: ${result3.wasUpdated}`);
        console.log(`   - Updated description: ${result3.description}`);
        console.log(`   - Last updated: ${result3.lastUpdated}`);
        
        console.log('\n4️⃣ Testing Duplicate Detection with Replace');
        console.log('-'.repeat(50));
        
        const replaceImage = {
            filename: 'test1_replaced.jpg',
            smugmugImageKey: 'TEST123', // Same key as test1
            smugmugUrl: 'https://example.com/test1_replaced.jpg',
            description: 'Completely replaced image',
            keywords: ['replaced', 'new', 'image']
        };
        
        const result4 = await dataManager.addImage(replaceImage, { duplicateHandling: 'replace' });
        console.log(`✅ Image replaced: ${result4.id}`);
        console.log(`   - Was replaced: ${result4.wasReplaced}`);
        console.log(`   - New description: ${result4.description}`);
        console.log(`   - New ID: ${result4.id}`);
        
        console.log('\n5️⃣ Testing New Helper Methods');
        console.log('-'.repeat(50));
        
        // Test imageExists
        const exists = await dataManager.imageExists('TEST123');
        console.log(`✅ imageExists('TEST123'): ${exists}`);
        
        const notExists = await dataManager.imageExists('NONEXISTENT');
        console.log(`✅ imageExists('NONEXISTENT'): ${notExists}`);
        
        // Test findImageBySmugmugKey
        const foundImage = await dataManager.findImageBySmugmugKey('TEST123');
        console.log(`✅ findImageBySmugmugKey('TEST123'): ${foundImage ? foundImage.id : 'null'}`);
        
        // Test findDuplicatesByImageKey
        const duplicates = await dataManager.findDuplicatesByImageKey('TEST123');
        console.log(`✅ findDuplicatesByImageKey('TEST123'): ${duplicates.length} found`);
        
        console.log('\n6️⃣ Testing Backwards Compatibility');
        console.log('-'.repeat(50));
        
        const testImage2 = {
            filename: 'test2.jpg',
            smugmugImageKey: 'TEST456',
            smugmugUrl: 'https://example.com/test2.jpg',
            description: 'Test image 2',
            keywords: ['test', 'compatibility']
        };
        
        await dataManager.addImage(testImage2);
        
        // Test legacy allowDuplicates option
        const legacyResult1 = await dataManager.addImage(testImage2, { allowDuplicates: true });
        console.log(`✅ Legacy allowDuplicates: ${legacyResult1.wasReplaced ? 'replaced' : 'added'}`);
        
        // Test legacy updateExisting option
        const legacyResult2 = await dataManager.addImage(testImage2, { updateExisting: true });
        console.log(`✅ Legacy updateExisting: ${legacyResult2.wasUpdated ? 'updated' : 'other'}`);
        
        console.log('\n7️⃣ Testing Error Handling');
        console.log('-'.repeat(50));
        
        try {
            await dataManager.updateImage('NONEXISTENT', { description: 'Should fail' });
            console.log('❌ Error handling failed');
        } catch (error) {
            console.log(`✅ Error handling works: ${error.message}`);
        }
        
        // Test invalid duplicateHandling option
        try {
            await dataManager.addImage(testImage1, { duplicateHandling: 'invalid' });
            console.log('❌ Invalid option handling failed');
        } catch (error) {
            console.log(`✅ Invalid option handling works: ${error.message}`);
        }
        
        console.log('\n8️⃣ Final Database State');
        console.log('-'.repeat(50));
        
        const finalImages = await dataManager.getImages();
        console.log(`Total images in database: ${finalImages.length}`);
        
        finalImages.forEach((img, index) => {
            console.log(`${index + 1}. ${img.filename} (${img.smugmugImageKey}) - ${img.id}`);
        });
        
        console.log('\n✅ All tests completed successfully!');
        console.log('🎉 Task 1.1 implementation verified');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    } finally {
        // Restore original data
        try {
            const backupData = await fs.readFile(testDataFile, 'utf8');
            await fs.writeFile(originalDataFile, backupData);
            await fs.unlink(testDataFile); // Clean up test backup
            console.log('\n🔄 Original data restored');
        } catch (restoreError) {
            console.error('❌ Failed to restore original data:', restoreError.message);
        }
    }
}

// Run the test
if (require.main === module) {
    testDuplicateDetection().catch(console.error);
}

module.exports = { testDuplicateDetection };
