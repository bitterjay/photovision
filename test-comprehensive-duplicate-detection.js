// Comprehensive Duplicate Detection Test Suite
// Tests all aspects of Phase 1 and Phase 2 duplicate detection functionality

const DataManager = require('./lib/dataManager');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
    testDataDir: path.join(__dirname, 'data'),
    backupSuffix: '_test_backup',
    testTimeout: 30000
};

// Test data
const SAMPLE_IMAGE_DATA = {
    basic: {
        filename: 'test-image-1.jpg',
        smugmugImageKey: 'TEST123',
        albumKey: 'ALBUM001',
        albumName: 'Test Album',
        albumPath: '/Photos/Test Album',
        albumHierarchy: ['Photos', 'Test Album'],
        description: 'Test image description',
        keywords: ['test', 'sample', 'image'],
        metadata: {
            model: 'claude-3-5-sonnet-20241022',
            timestamp: '2025-07-16T13:00:00Z'
        }
    },
    updated: {
        filename: 'test-image-1-updated.jpg',
        smugmugImageKey: 'TEST123', // Same key for duplicate testing
        albumKey: 'ALBUM001',
        albumName: 'Test Album Updated',
        albumPath: '/Photos/Test Album Updated',
        albumHierarchy: ['Photos', 'Test Album Updated'],
        description: 'Updated test image description',
        keywords: ['test', 'sample', 'image', 'updated'],
        metadata: {
            model: 'claude-3-5-sonnet-20241022',
            timestamp: '2025-07-16T13:01:00Z'
        }
    },
    different: {
        filename: 'test-image-2.jpg',
        smugmugImageKey: 'TEST456',
        albumKey: 'ALBUM002',
        albumName: 'Another Test Album',
        albumPath: '/Photos/Another Test Album',
        albumHierarchy: ['Photos', 'Another Test Album'],
        description: 'Different test image',
        keywords: ['different', 'test', 'image'],
        metadata: {
            model: 'claude-3-5-sonnet-20241022',
            timestamp: '2025-07-16T13:02:00Z'
        }
    }
};

class DuplicateDetectionTester {
    constructor() {
        this.dataManager = new DataManager();
        this.testResults = [];
        this.originalData = null;
    }

    // Utility methods
    log(message, type = 'INFO') {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${type}: ${message}`;
        console.log(logMessage);
    }

    async backupData() {
        try {
            this.originalData = await this.dataManager.getImages();
            this.log(`Backed up ${this.originalData.length} existing images`);
        } catch (error) {
            this.log(`Failed to backup data: ${error.message}`, 'ERROR');
            throw error;
        }
    }

    async restoreData() {
        try {
            if (this.originalData) {
                await this.dataManager.saveImages(this.originalData);
                this.log(`Restored ${this.originalData.length} original images`);
            }
        } catch (error) {
            this.log(`Failed to restore data: ${error.message}`, 'ERROR');
            throw error;
        }
    }

    async clearTestData() {
        try {
            await this.dataManager.saveImages([]);
            this.log('Cleared all test data');
        } catch (error) {
            this.log(`Failed to clear test data: ${error.message}`, 'ERROR');
            throw error;
        }
    }

    // Test methods
    async testDuplicateDetectionSkip() {
        this.log('Testing duplicate detection with SKIP handling...');
        
        try {
            // Add initial image
            const result1 = await this.dataManager.addImage(SAMPLE_IMAGE_DATA.basic, {
                duplicateHandling: 'skip'
            });
            
            if (!result1.wasAdded) {
                throw new Error('First image should be added');
            }
            
            // Try to add duplicate - should be skipped
            const result2 = await this.dataManager.addImage(SAMPLE_IMAGE_DATA.basic, {
                duplicateHandling: 'skip'
            });
            
            if (!result2.wasSkipped) {
                throw new Error('Duplicate image should be skipped');
            }
            
            // Verify only one image exists
            const images = await this.dataManager.getImages();
            const duplicates = images.filter(img => img.smugmugImageKey === 'TEST123');
            
            if (duplicates.length !== 1) {
                throw new Error(`Expected 1 image, found ${duplicates.length}`);
            }
            
            this.log('✓ Duplicate detection SKIP test passed');
            return true;
            
        } catch (error) {
            this.log(`✗ Duplicate detection SKIP test failed: ${error.message}`, 'ERROR');
            return false;
        }
    }

    async testDuplicateDetectionUpdate() {
        this.log('Testing duplicate detection with UPDATE handling...');
        
        try {
            await this.clearTestData();
            
            // Add initial image
            const result1 = await this.dataManager.addImage(SAMPLE_IMAGE_DATA.basic, {
                duplicateHandling: 'update'
            });
            
            if (!result1.wasAdded) {
                throw new Error('First image should be added');
            }
            
            const originalId = result1.id;
            
            // Update with new data
            const result2 = await this.dataManager.addImage(SAMPLE_IMAGE_DATA.updated, {
                duplicateHandling: 'update'
            });
            
            if (!result2.wasUpdated) {
                throw new Error('Duplicate image should be updated');
            }
            
            // Verify ID remained the same but data was updated
            if (result2.id !== originalId) {
                throw new Error('ID should remain the same when updating');
            }
            
            if (result2.albumName !== 'Test Album Updated') {
                throw new Error('Album name should be updated');
            }
            
            // Verify only one image exists
            const images = await this.dataManager.getImages();
            const duplicates = images.filter(img => img.smugmugImageKey === 'TEST123');
            
            if (duplicates.length !== 1) {
                throw new Error(`Expected 1 image, found ${duplicates.length}`);
            }
            
            this.log('✓ Duplicate detection UPDATE test passed');
            return true;
            
        } catch (error) {
            this.log(`✗ Duplicate detection UPDATE test failed: ${error.message}`, 'ERROR');
            return false;
        }
    }

    async testDuplicateDetectionReplace() {
        this.log('Testing duplicate detection with REPLACE handling...');
        
        try {
            await this.clearTestData();
            
            // Add initial image
            const result1 = await this.dataManager.addImage(SAMPLE_IMAGE_DATA.basic, {
                duplicateHandling: 'replace'
            });
            
            if (!result1.wasAdded) {
                throw new Error('First image should be added');
            }
            
            const originalId = result1.id;
            
            // Replace with new data
            const result2 = await this.dataManager.addImage(SAMPLE_IMAGE_DATA.updated, {
                duplicateHandling: 'replace'
            });
            
            if (!result2.wasReplaced) {
                throw new Error('Duplicate image should be replaced');
            }
            
            // Verify ID changed (new image created)
            if (result2.id === originalId) {
                throw new Error('ID should change when replacing');
            }
            
            if (result2.albumName !== 'Test Album Updated') {
                throw new Error('Album name should be updated');
            }
            
            // Verify only one image exists
            const images = await this.dataManager.getImages();
            const duplicates = images.filter(img => img.smugmugImageKey === 'TEST123');
            
            if (duplicates.length !== 1) {
                throw new Error(`Expected 1 image, found ${duplicates.length}`);
            }
            
            this.log('✓ Duplicate detection REPLACE test passed');
            return true;
            
        } catch (error) {
            this.log(`✗ Duplicate detection REPLACE test failed: ${error.message}`, 'ERROR');
            return false;
        }
    }

    async testHelperMethods() {
        this.log('Testing helper methods...');
        
        try {
            await this.clearTestData();
            
            // Add test images
            await this.dataManager.addImage(SAMPLE_IMAGE_DATA.basic);
            await this.dataManager.addImage(SAMPLE_IMAGE_DATA.different);
            
            // Test imageExists
            const exists1 = await this.dataManager.imageExists('TEST123');
            const exists2 = await this.dataManager.imageExists('TEST456');
            const exists3 = await this.dataManager.imageExists('NONEXISTENT');
            
            if (!exists1 || !exists2 || exists3) {
                throw new Error('imageExists method not working correctly');
            }
            
            // Test findImageBySmugmugKey
            const found1 = await this.dataManager.findImageBySmugmugKey('TEST123');
            const found2 = await this.dataManager.findImageBySmugmugKey('NONEXISTENT');
            
            if (!found1 || found1.smugmugImageKey !== 'TEST123') {
                throw new Error('findImageBySmugmugKey failed to find existing image');
            }
            
            if (found2 !== null) {
                throw new Error('findImageBySmugmugKey should return null for non-existent image');
            }
            
            // Test findDuplicatesByImageKey
            const duplicates1 = await this.dataManager.findDuplicatesByImageKey('TEST123');
            const duplicates2 = await this.dataManager.findDuplicatesByImageKey('NONEXISTENT');
            
            if (duplicates1.length !== 1 || duplicates2.length !== 0) {
                throw new Error('findDuplicatesByImageKey not working correctly');
            }
            
            this.log('✓ Helper methods test passed');
            return true;
            
        } catch (error) {
            this.log(`✗ Helper methods test failed: ${error.message}`, 'ERROR');
            return false;
        }
    }

    async testBackwardsCompatibility() {
        this.log('Testing backwards compatibility...');
        
        try {
            await this.clearTestData();
            
            // Test old-style addImage call (no options)
            const result1 = await this.dataManager.addImage(SAMPLE_IMAGE_DATA.basic);
            
            if (!result1.wasAdded) {
                throw new Error('Backwards compatible call should work');
            }
            
            // Test legacy allowDuplicates option
            const result2 = await this.dataManager.addImage(SAMPLE_IMAGE_DATA.basic, {
                allowDuplicates: true
            });
            
            if (!result2.wasReplaced) {
                throw new Error('Legacy allowDuplicates should work as replace');
            }
            
            // Test legacy updateExisting option
            const result3 = await this.dataManager.addImage(SAMPLE_IMAGE_DATA.updated, {
                updateExisting: true
            });
            
            if (!result3.wasUpdated) {
                throw new Error('Legacy updateExisting should work as update');
            }
            
            this.log('✓ Backwards compatibility test passed');
            return true;
            
        } catch (error) {
            this.log(`✗ Backwards compatibility test failed: ${error.message}`, 'ERROR');
            return false;
        }
    }

    async testAlbumProcessingStatus() {
        this.log('Testing album processing status...');
        
        try {
            await this.clearTestData();
            
            // Mock SmugMug images
            const mockSmugMugImages = [
                { ImageKey: 'TEST123', FileName: 'test1.jpg' },
                { ImageKey: 'TEST456', FileName: 'test2.jpg' },
                { ImageKey: 'TEST789', FileName: 'test3.jpg' }
            ];
            
            // Add one processed image
            await this.dataManager.addImage({
                ...SAMPLE_IMAGE_DATA.basic,
                smugmugImageKey: 'TEST123'
            });
            
            // Test album processing status
            const status = await this.dataManager.getAlbumProcessingStatus('ALBUM001', mockSmugMugImages);
            
            if (status.totalImages !== 3) {
                throw new Error(`Expected 3 total images, got ${status.totalImages}`);
            }
            
            if (status.processedImages !== 1) {
                throw new Error(`Expected 1 processed image, got ${status.processedImages}`);
            }
            
            if (status.unprocessedImages !== 2) {
                throw new Error(`Expected 2 unprocessed images, got ${status.unprocessedImages}`);
            }
            
            if (status.processingProgress !== 33) {
                throw new Error(`Expected 33% progress, got ${status.processingProgress}%`);
            }
            
            if (!status.processedImageKeys.includes('TEST123')) {
                throw new Error('ProcessedImageKeys should include TEST123');
            }
            
            if (!status.unprocessedImageKeys.includes('TEST456') || !status.unprocessedImageKeys.includes('TEST789')) {
                throw new Error('UnprocessedImageKeys should include TEST456 and TEST789');
            }
            
            this.log('✓ Album processing status test passed');
            return true;
            
        } catch (error) {
            this.log(`✗ Album processing status test failed: ${error.message}`, 'ERROR');
            return false;
        }
    }

    async testErrorHandling() {
        this.log('Testing error handling...');
        
        try {
            // Test invalid duplicate handling option
            try {
                await this.dataManager.addImage(SAMPLE_IMAGE_DATA.basic, {
                    duplicateHandling: 'invalid'
                });
                throw new Error('Should have thrown error for invalid option');
            } catch (error) {
                if (!error.message.includes('Invalid duplicateHandling option')) {
                    throw new Error('Wrong error message for invalid option');
                }
            }
            
            // Test updateImage with non-existent key
            try {
                await this.dataManager.updateImage('NONEXISTENT', {});
                throw new Error('Should have thrown error for non-existent image');
            } catch (error) {
                if (!error.message.includes('not found')) {
                    throw new Error('Wrong error message for non-existent image');
                }
            }
            
            this.log('✓ Error handling test passed');
            return true;
            
        } catch (error) {
            this.log(`✗ Error handling test failed: ${error.message}`, 'ERROR');
            return false;
        }
    }

    // Main test runner
    async runAllTests() {
        this.log('Starting comprehensive duplicate detection test suite...');
        
        try {
            // Backup existing data
            await this.backupData();
            
            // Run all tests
            const tests = [
                this.testDuplicateDetectionSkip.bind(this),
                this.testDuplicateDetectionUpdate.bind(this),
                this.testDuplicateDetectionReplace.bind(this),
                this.testHelperMethods.bind(this),
                this.testBackwardsCompatibility.bind(this),
                this.testAlbumProcessingStatus.bind(this),
                this.testErrorHandling.bind(this)
            ];
            
            let passed = 0;
            let failed = 0;
            
            for (const test of tests) {
                try {
                    const result = await test();
                    if (result) {
                        passed++;
                    } else {
                        failed++;
                    }
                } catch (error) {
                    this.log(`Test failed with exception: ${error.message}`, 'ERROR');
                    failed++;
                }
            }
            
            // Test summary
            this.log(`\n=== TEST SUMMARY ===`);
            this.log(`Total tests: ${tests.length}`);
            this.log(`Passed: ${passed}`);
            this.log(`Failed: ${failed}`);
            this.log(`Success rate: ${Math.round((passed / tests.length) * 100)}%`);
            
            if (failed === 0) {
                this.log('🎉 All tests passed! Duplicate detection is working correctly.');
            } else {
                this.log(`⚠️  ${failed} test(s) failed. Please review the errors above.`);
            }
            
            return failed === 0;
            
        } catch (error) {
            this.log(`Test suite failed: ${error.message}`, 'ERROR');
            return false;
        } finally {
            // Restore original data
            await this.restoreData();
        }
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const tester = new DuplicateDetectionTester();
    
    tester.runAllTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Test suite crashed:', error);
            process.exit(1);
        });
}

module.exports = DuplicateDetectionTester;
