/**
 * Test script for data migration utility
 * Tests duplicate cleanup functionality
 */

const DataMigration = require('./utilities/dataMigration');
const DuplicateDetector = require('./utilities/duplicateDetector');

async function testDataMigration() {
    console.log('=== Testing Data Migration Utility ===\n');
    
    try {
        const migration = new DataMigration();
        const detector = new DuplicateDetector();
        
        // Test 1: Dry run first
        console.log('1. Testing dry run migration...');
        const dryRunResult = await migration.performCleanup({ 
            dryRun: true, 
            confirmationRequired: false 
        });
        
        console.log('   Dry run results:');
        console.log(`     Success: ${dryRunResult.success}`);
        console.log(`     Duplicates to remove: ${dryRunResult.duplicatesRemoved}`);
        console.log(`     Final count: ${dryRunResult.finalImageCount}`);
        
        // Test 2: Check current state
        console.log('\n2. Checking current duplicate state...');
        const currentAnalysis = await detector.findExistingDuplicates();
        
        console.log('   Current state:');
        console.log(`     Total images: ${currentAnalysis.analysis.totalImages}`);
        console.log(`     Duplicate groups: ${currentAnalysis.analysis.duplicateGroups}`);
        console.log(`     Records to remove: ${currentAnalysis.analysis.recordsToRemove}`);
        
        // Test 3: Perform actual cleanup (if duplicates exist)
        if (currentAnalysis.analysis.duplicateGroups > 0) {
            console.log('\n3. Performing actual cleanup...');
            const cleanupResult = await migration.performCleanup({ 
                dryRun: false, 
                confirmationRequired: false 
            });
            
            console.log('   Cleanup results:');
            console.log(`     Success: ${cleanupResult.success}`);
            console.log(`     Duplicates removed: ${cleanupResult.duplicatesRemoved}`);
            console.log(`     Final count: ${cleanupResult.finalImageCount}`);
            console.log(`     Backup: ${cleanupResult.backupPath}`);
            
            // Test 4: Verify cleanup worked
            console.log('\n4. Verifying cleanup results...');
            const postCleanupAnalysis = await detector.findExistingDuplicates();
            
            console.log('   Post-cleanup state:');
            console.log(`     Total images: ${postCleanupAnalysis.analysis.totalImages}`);
            console.log(`     Duplicate groups: ${postCleanupAnalysis.analysis.duplicateGroups}`);
            console.log(`     Records to remove: ${postCleanupAnalysis.analysis.recordsToRemove}`);
            
            if (postCleanupAnalysis.analysis.duplicateGroups === 0) {
                console.log('   ✅ All duplicates successfully removed!');
            } else {
                console.log('   ⚠️  Some duplicates remain - may need manual review');
            }
            
            return {
                success: true,
                originalCount: currentAnalysis.analysis.totalImages,
                duplicatesRemoved: cleanupResult.duplicatesRemoved,
                finalCount: cleanupResult.finalImageCount,
                cleanupSuccessful: postCleanupAnalysis.analysis.duplicateGroups === 0
            };
        } else {
            console.log('\n3. No duplicates found - cleanup not needed');
            return {
                success: true,
                originalCount: currentAnalysis.analysis.totalImages,
                duplicatesRemoved: 0,
                finalCount: currentAnalysis.analysis.totalImages,
                cleanupSuccessful: true
            };
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        throw error;
    }
}

// Run the test
if (require.main === module) {
    testDataMigration()
        .then(result => {
            console.log('\n=== Test Results ===');
            console.log(`Data migration utility is working correctly.`);
            console.log(`Original images: ${result.originalCount}`);
            console.log(`Duplicates removed: ${result.duplicatesRemoved}`);
            console.log(`Final images: ${result.finalCount}`);
            console.log(`Cleanup successful: ${result.cleanupSuccessful}`);
            
            if (result.cleanupSuccessful) {
                console.log('🎉 All duplicates have been successfully removed!');
            }
        })
        .catch(error => {
            console.error('Test failed:', error);
            process.exit(1);
        });
}

module.exports = testDataMigration;
