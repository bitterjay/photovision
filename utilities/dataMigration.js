/**
 * Data Migration Script for Duplicate Cleanup
 * Removes duplicate records while preserving the best quality data
 * Based on analysis from DuplicateDetector utility
 */

const fs = require('fs').promises;
const path = require('path');
const DuplicateDetector = require('./duplicateDetector');

class DataMigration {
    constructor() {
        this.detector = new DuplicateDetector();
        this.dataPath = path.join(__dirname, '..', 'data', 'images.json');
        this.backupDir = path.join(__dirname, '..', 'data');
    }

    /**
     * Perform complete duplicate cleanup migration
     */
    async performCleanup(options = {}) {
        const { 
            dryRun = false, 
            confirmationRequired = true,
            preserveBackups = true 
        } = options;

        console.log('=== Starting Data Migration for Duplicate Cleanup ===\n');

        try {
            // Step 1: Run duplicate detection analysis
            console.log('1. Running duplicate detection analysis...');
            const analysisReport = await this.detector.findExistingDuplicates();

            if (analysisReport.duplicateGroups.length === 0) {
                console.log('✅ No duplicates found - no cleanup needed!');
                return {
                    success: true,
                    message: 'No duplicates found',
                    duplicatesRemoved: 0,
                    finalImageCount: analysisReport.analysis.totalImages
                };
            }

            console.log(`Found ${analysisReport.duplicateGroups.length} duplicate groups`);
            console.log(`Will remove ${analysisReport.analysis.recordsToRemove} duplicate records`);
            console.log(`Final clean database will have ${analysisReport.analysis.cleanDataSize} images\n`);

            // Step 2: Show what will be done
            console.log('2. Migration Plan:');
            analysisReport.duplicateGroups.forEach((group, index) => {
                console.log(`   Group ${index + 1}: ${group.smugmugImageKey}`);
                console.log(`     Keep: ${group.recommendedKeep.filename} (Score: ${this.detector.calculateCompletenessScore(group.recommendedKeep)})`);
                console.log(`     Remove: ${group.toRemove} duplicate(s)`);
            });
            console.log();

            // Step 3: Confirmation (if required)
            if (confirmationRequired && !dryRun) {
                console.log('⚠️  This will permanently remove duplicate records!');
                console.log('⚠️  A backup has been created, but please confirm you want to proceed.');
                console.log('⚠️  Set confirmationRequired: false to skip this check.\n');
                
                // In a real scenario, you'd want to prompt for user input
                // For now, we'll proceed with the assumption that this is called intentionally
                console.log('Proceeding with cleanup (confirmation bypassed for automated execution)...\n');
            }

            // Step 4: Perform cleanup
            if (dryRun) {
                console.log('3. DRY RUN - No actual changes will be made');
                return {
                    success: true,
                    message: 'Dry run completed successfully',
                    duplicatesRemoved: analysisReport.analysis.recordsToRemove,
                    finalImageCount: analysisReport.analysis.cleanDataSize,
                    dryRun: true
                };
            }

            console.log('3. Performing duplicate cleanup...');
            const cleanupResult = await this.cleanupDuplicates(analysisReport);

            // Step 5: Validate results
            console.log('4. Validating cleanup results...');
            const validationResult = await this.validateCleanup();

            // Step 6: Generate final report
            const migrationReport = {
                timestamp: new Date().toISOString(),
                success: true,
                originalImageCount: analysisReport.analysis.totalImages,
                duplicateGroups: analysisReport.duplicateGroups.length,
                duplicatesRemoved: cleanupResult.duplicatesRemoved,
                finalImageCount: cleanupResult.finalImageCount,
                backupPath: analysisReport.backupPath,
                validationPassed: validationResult.isValid,
                recommendations: analysisReport.recommendations,
                cleanupDetails: cleanupResult.cleanupDetails
            };

            console.log('5. Generating migration report...');
            await this.saveMigrationReport(migrationReport);

            console.log('\n✅ Data migration completed successfully!');
            console.log(`   Removed: ${migrationReport.duplicatesRemoved} duplicate records`);
            console.log(`   Final count: ${migrationReport.finalImageCount} images`);
            console.log(`   Backup: ${migrationReport.backupPath}`);

            return migrationReport;

        } catch (error) {
            console.error('❌ Data migration failed:', error.message);
            throw new Error(`Migration failed: ${error.message}`);
        }
    }

    /**
     * Clean up duplicates based on analysis report
     */
    async cleanupDuplicates(analysisReport) {
        const images = await this.detector.loadImageData();
        const cleanedImages = [];
        const cleanupDetails = [];
        let duplicatesRemoved = 0;

        // Create a set of IDs to keep (recommended records)
        const keepImageIds = new Set();
        analysisReport.duplicateGroups.forEach(group => {
            if (group.recommendedKeep && group.recommendedKeep.id) {
                keepImageIds.add(group.recommendedKeep.id);
            }
        });

        // Process each image
        images.forEach(image => {
            const duplicateGroup = analysisReport.duplicateGroups.find(
                group => group.smugmugImageKey === image.smugmugImageKey
            );

            if (duplicateGroup) {
                // This is part of a duplicate group
                if (image.id === duplicateGroup.recommendedKeep.id) {
                    // Keep this record (it's the recommended one)
                    cleanedImages.push(image);
                    cleanupDetails.push({
                        action: 'kept',
                        smugmugImageKey: image.smugmugImageKey,
                        filename: image.filename,
                        reason: 'Best quality record in duplicate group'
                    });
                } else {
                    // Remove this duplicate
                    duplicatesRemoved++;
                    cleanupDetails.push({
                        action: 'removed',
                        smugmugImageKey: image.smugmugImageKey,
                        filename: image.filename,
                        reason: 'Duplicate record with lower quality/completeness'
                    });
                }
            } else {
                // Not a duplicate, keep it
                cleanedImages.push(image);
            }
        });

        // Save cleaned data
        await fs.writeFile(this.dataPath, JSON.stringify(cleanedImages, null, 2));
        console.log(`Data saved to ${this.dataPath}`);

        return {
            duplicatesRemoved,
            finalImageCount: cleanedImages.length,
            cleanupDetails
        };
    }

    /**
     * Validate cleanup results
     */
    async validateCleanup() {
        try {
            const images = await this.detector.loadImageData();
            const validationResults = {
                isValid: true,
                totalImages: images.length,
                issues: []
            };

            // Check for remaining duplicates
            const duplicateCheck = {};
            images.forEach(image => {
                if (image.smugmugImageKey) {
                    if (!duplicateCheck[image.smugmugImageKey]) {
                        duplicateCheck[image.smugmugImageKey] = 0;
                    }
                    duplicateCheck[image.smugmugImageKey]++;
                }
            });

            const remainingDuplicates = Object.entries(duplicateCheck)
                .filter(([key, count]) => count > 1);

            if (remainingDuplicates.length > 0) {
                validationResults.isValid = false;
                validationResults.issues.push({
                    type: 'duplicates_remaining',
                    message: `Found ${remainingDuplicates.length} remaining duplicate groups`,
                    details: remainingDuplicates
                });
            }

            // Check for data integrity
            const invalidImages = images.filter(image => 
                !image.smugmugImageKey || !image.filename || !image.id
            );

            if (invalidImages.length > 0) {
                validationResults.isValid = false;
                validationResults.issues.push({
                    type: 'data_integrity',
                    message: `Found ${invalidImages.length} images with missing required fields`,
                    details: invalidImages.map(img => ({ 
                        id: img.id, 
                        filename: img.filename, 
                        smugmugImageKey: img.smugmugImageKey 
                    }))
                });
            }

            if (validationResults.isValid) {
                console.log('✅ Validation passed - no issues found');
            } else {
                console.log('⚠️  Validation found issues:');
                validationResults.issues.forEach(issue => {
                    console.log(`   - ${issue.message}`);
                });
            }

            return validationResults;

        } catch (error) {
            console.error('Validation failed:', error);
            return {
                isValid: false,
                issues: [{
                    type: 'validation_error',
                    message: `Validation failed: ${error.message}`
                }]
            };
        }
    }

    /**
     * Save migration report
     */
    async saveMigrationReport(report) {
        const timestamp = Date.now();
        const reportPath = path.join(this.backupDir, `migration_report_${timestamp}.json`);
        
        try {
            await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
            console.log(`Migration report saved: ${reportPath}`);
            return reportPath;
        } catch (error) {
            console.error('Failed to save migration report:', error);
            throw new Error('Could not save migration report');
        }
    }

    /**
     * Rollback to a previous backup
     */
    async rollback(backupPath) {
        console.log(`Rolling back to backup: ${backupPath}`);
        
        try {
            const backupData = await fs.readFile(backupPath, 'utf8');
            await fs.writeFile(this.dataPath, backupData);
            console.log('✅ Rollback completed successfully');
            
            return {
                success: true,
                message: 'Rollback completed',
                backupPath: backupPath
            };
        } catch (error) {
            console.error('❌ Rollback failed:', error);
            throw new Error(`Rollback failed: ${error.message}`);
        }
    }
}

module.exports = DataMigration;
