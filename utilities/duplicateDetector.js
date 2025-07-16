/**
 * Duplicate Detection Utility
 * Identifies and analyzes duplicate records in the PhotoVision image database
 * Based on smugmugImageKey as the primary duplicate detection key
 */

const fs = require('fs').promises;
const path = require('path');

class DuplicateDetector {
    constructor() {
        this.dataPath = path.join(__dirname, '..', 'data', 'images.json');
        this.backupDir = path.join(__dirname, '..', 'data');
    }

    /**
     * Create automatic backup before any analysis
     */
    async createBackup() {
        const timestamp = Date.now();
        const backupPath = path.join(this.backupDir, `images_backup_${timestamp}.json`);
        
        try {
            const originalData = await fs.readFile(this.dataPath, 'utf8');
            await fs.writeFile(backupPath, originalData);
            console.log(`Backup created: ${backupPath}`);
            return backupPath;
        } catch (error) {
            console.error('Failed to create backup:', error);
            throw new Error('Backup creation failed - aborting duplicate detection');
        }
    }

    /**
     * Load and validate image data structure
     */
    async loadImageData() {
        try {
            const data = await fs.readFile(this.dataPath, 'utf8');
            const images = JSON.parse(data);
            
            if (!Array.isArray(images)) {
                throw new Error('Invalid data structure: expected array of images');
            }
            
            return images;
        } catch (error) {
            console.error('Failed to load image data:', error);
            throw new Error('Could not load image data for duplicate detection');
        }
    }

    /**
     * Select the best record from a group of duplicates
     * Criteria: newest timestamp, most complete data, highest quality analysis
     */
    selectBestRecord(duplicateImages) {
        if (!duplicateImages || duplicateImages.length === 0) {
            return null;
        }

        if (duplicateImages.length === 1) {
            return duplicateImages[0];
        }

        // Sort by completeness score (descending) and then by timestamp (newest first)
        const sorted = duplicateImages.sort((a, b) => {
            const scoreA = this.calculateCompletenessScore(a);
            const scoreB = this.calculateCompletenessScore(b);
            
            if (scoreA !== scoreB) {
                return scoreB - scoreA; // Higher score first
            }
            
            // If completeness is equal, prefer newer timestamp
            const timestampA = new Date(a.timestamp || 0).getTime();
            const timestampB = new Date(b.timestamp || 0).getTime();
            return timestampB - timestampA;
        });

        return sorted[0];
    }

    /**
     * Calculate completeness score for a record
     * Higher score = more complete and higher quality
     */
    calculateCompletenessScore(record) {
        let score = 0;
        
        // Core fields
        if (record.smugmugImageKey) score += 10;
        if (record.filename) score += 5;
        if (record.timestamp) score += 5;
        
        // Analysis data
        if (record.description && record.description.trim()) score += 15;
        if (record.keywords && Array.isArray(record.keywords) && record.keywords.length > 0) score += 10;
        
        // SmugMug integration
        if (record.smugmugUrl) score += 5;
        if (record.albumKey) score += 5;
        if (record.albumName) score += 3;
        if (record.albumPath) score += 3;
        if (record.albumHierarchy) score += 2;
        
        // Image metadata
        if (record.imageType) score += 2;
        if (record.fileSize) score += 2;
        if (record.aiModel) score += 2;
        
        return score;
    }

    /**
     * Find existing duplicates in the image database
     */
    async findExistingDuplicates() {
        console.log('Starting duplicate detection analysis...');
        
        // Create backup first
        const backupPath = await this.createBackup();
        
        // Load and validate data
        const images = await this.loadImageData();
        console.log(`Loaded ${images.length} images for analysis`);
        
        // Group by smugmugImageKey
        const duplicateGroups = {};
        const validImages = [];
        
        images.forEach((image, index) => {
            if (!image.smugmugImageKey) {
                console.warn(`Warning: Image at index ${index} has no smugmugImageKey:`, image.filename || 'unknown');
                return;
            }
            
            validImages.push(image);
            const key = image.smugmugImageKey;
            
            if (!duplicateGroups[key]) {
                duplicateGroups[key] = [];
            }
            duplicateGroups[key].push(image);
        });
        
        // Filter to only duplicate groups (more than 1 image)
        const duplicates = Object.entries(duplicateGroups)
            .filter(([key, images]) => images.length > 1)
            .map(([key, images]) => ({
                smugmugImageKey: key,
                images: images,
                count: images.length,
                recommendedKeep: this.selectBestRecord(images),
                toRemove: images.length - 1
            }));
        
        const report = {
            timestamp: new Date().toISOString(),
            backupPath: backupPath,
            analysis: {
                totalImages: images.length,
                validImages: validImages.length,
                invalidImages: images.length - validImages.length,
                duplicateGroups: duplicates.length,
                totalDuplicates: duplicates.reduce((sum, group) => sum + group.count, 0),
                recordsToRemove: duplicates.reduce((sum, group) => sum + group.toRemove, 0),
                recordsToKeep: duplicates.length,
                cleanDataSize: validImages.length - duplicates.reduce((sum, group) => sum + group.toRemove, 0)
            },
            duplicateGroups: duplicates,
            recommendations: this.generateRecommendations(duplicates)
        };
        
        console.log('Duplicate detection analysis complete');
        console.log(`Found ${duplicates.length} duplicate groups affecting ${report.analysis.totalDuplicates} records`);
        console.log(`Cleanup would remove ${report.analysis.recordsToRemove} records`);
        
        return report;
    }

    /**
     * Generate recommendations based on duplicate analysis
     */
    generateRecommendations(duplicates) {
        const recommendations = [];
        
        if (duplicates.length === 0) {
            recommendations.push({
                type: 'success',
                message: 'No duplicates found - data is clean'
            });
        } else {
            recommendations.push({
                type: 'warning',
                message: `Found ${duplicates.length} duplicate groups - cleanup recommended`
            });
            
            // Check for high-impact duplicates
            const highImpactGroups = duplicates.filter(group => group.count > 3);
            if (highImpactGroups.length > 0) {
                recommendations.push({
                    type: 'alert',
                    message: `${highImpactGroups.length} groups have 4+ duplicates - priority cleanup needed`
                });
            }
            
            // Check for data quality issues
            const lowQualityGroups = duplicates.filter(group => 
                this.calculateCompletenessScore(group.recommendedKeep) < 30
            );
            if (lowQualityGroups.length > 0) {
                recommendations.push({
                    type: 'warning',
                    message: `${lowQualityGroups.length} groups have low-quality data - manual review recommended`
                });
            }
        }
        
        return recommendations;
    }

    /**
     * Generate human-readable report
     */
    generateHumanReadableReport(analysisReport) {
        const { analysis, duplicateGroups, recommendations } = analysisReport;
        
        let report = '\n=== DUPLICATE DETECTION REPORT ===\n';
        report += `Generated: ${analysisReport.timestamp}\n`;
        report += `Backup: ${analysisReport.backupPath}\n\n`;
        
        report += '=== SUMMARY ===\n';
        report += `Total Images: ${analysis.totalImages}\n`;
        report += `Valid Images: ${analysis.validImages}\n`;
        report += `Invalid Images: ${analysis.invalidImages}\n`;
        report += `Duplicate Groups: ${analysis.duplicateGroups}\n`;
        report += `Total Duplicates: ${analysis.totalDuplicates}\n`;
        report += `Records to Remove: ${analysis.recordsToRemove}\n`;
        report += `Final Clean Size: ${analysis.cleanDataSize}\n\n`;
        
        report += '=== RECOMMENDATIONS ===\n';
        recommendations.forEach(rec => {
            report += `[${rec.type.toUpperCase()}] ${rec.message}\n`;
        });
        report += '\n';
        
        if (duplicateGroups.length > 0) {
            report += '=== DUPLICATE GROUPS ===\n';
            duplicateGroups.forEach((group, index) => {
                report += `Group ${index + 1}: ${group.smugmugImageKey} (${group.count} duplicates)\n`;
                report += `  Recommended Keep: ${group.recommendedKeep.filename || 'unknown'}\n`;
                report += `  Timestamp: ${group.recommendedKeep.timestamp}\n`;
                report += `  Completeness Score: ${this.calculateCompletenessScore(group.recommendedKeep)}\n`;
                report += `  To Remove: ${group.toRemove} records\n\n`;
            });
        }
        
        return report;
    }

    /**
     * Save analysis report to file
     */
    async saveReport(analysisReport) {
        const timestamp = Date.now();
        const reportPath = path.join(this.backupDir, `duplicate_analysis_${timestamp}.json`);
        const readableReportPath = path.join(this.backupDir, `duplicate_report_${timestamp}.txt`);
        
        try {
            // Save JSON report
            await fs.writeFile(reportPath, JSON.stringify(analysisReport, null, 2));
            
            // Save human-readable report
            const readableReport = this.generateHumanReadableReport(analysisReport);
            await fs.writeFile(readableReportPath, readableReport);
            
            console.log(`Analysis report saved: ${reportPath}`);
            console.log(`Human-readable report saved: ${readableReportPath}`);
            
            return { jsonReport: reportPath, textReport: readableReportPath };
        } catch (error) {
            console.error('Failed to save report:', error);
            throw new Error('Could not save analysis report');
        }
    }
}

module.exports = DuplicateDetector;
