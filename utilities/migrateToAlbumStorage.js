#!/usr/bin/env node

// PhotoVision Storage Migration Utility
// Migrates from single images.json to album-based storage

const fs = require('fs/promises');
const path = require('path');
const DataManager = require('../lib/dataManager');
const AlbumDataManager = require('../lib/albumDataManager');

class StorageMigration {
    constructor() {
        this.dataDir = path.join(__dirname, '..', 'data');
        this.imagesFile = path.join(this.dataDir, 'images.json');
        this.backupDir = path.join(this.dataDir, 'backups');
        this.dataManager = new DataManager();
        this.albumDataManager = new AlbumDataManager(this.dataDir);
        
        this.stats = {
            totalImages: 0,
            migratedImages: 0,
            albumsCreated: 0,
            errors: [],
            startTime: null,
            endTime: null
        };
    }

    // Create backup before migration
    async createBackup() {
        try {
            await fs.mkdir(this.backupDir, { recursive: true });
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = path.join(this.backupDir, `images_backup_${timestamp}.json`);
            
            // Copy images.json to backup
            const imagesData = await fs.readFile(this.imagesFile, 'utf8');
            await fs.writeFile(backupFile, imagesData, 'utf8');
            
            // Also backup config
            const configFile = path.join(this.dataDir, 'config.json');
            const configBackup = path.join(this.backupDir, `config_backup_${timestamp}.json`);
            const configData = await fs.readFile(configFile, 'utf8');
            await fs.writeFile(configBackup, configData, 'utf8');
            
            console.log(`✓ Created backup: ${backupFile}`);
            return backupFile;
        } catch (error) {
            console.error('Error creating backup:', error.message);
            throw error;
        }
    }

    // Validate migration readiness
    async validateMigration() {
        try {
            // Check if images.json exists
            await fs.access(this.imagesFile);
            
            // Check current storage mode
            const config = await this.dataManager.getConfig();
            if (config.storageConfig && config.storageConfig.mode === 'album') {
                throw new Error('Already in album storage mode');
            }
            
            // Load images to check format
            const images = await this.dataManager.getImages();
            if (!Array.isArray(images)) {
                throw new Error('Invalid images.json format');
            }
            
            this.stats.totalImages = images.length;
            console.log(`✓ Validated ${this.stats.totalImages} images ready for migration`);
            
            return true;
        } catch (error) {
            console.error('Validation failed:', error.message);
            throw error;
        }
    }

    // Perform the migration
    async migrate(options = {}) {
        const { dryRun = false, verbose = false } = options;
        
        console.log('\\n🚀 Starting PhotoVision Storage Migration');
        console.log(`Mode: ${dryRun ? 'DRY RUN' : 'ACTUAL MIGRATION'}`);
        
        this.stats.startTime = new Date();
        
        try {
            // Step 1: Validate
            await this.validateMigration();
            
            // Step 2: Create backup (skip in dry run)
            if (!dryRun) {
                await this.createBackup();
            }
            
            // Step 3: Initialize album data manager
            await this.albumDataManager.initialize();
            
            // Step 4: Load all images
            const images = await this.dataManager.getImages();
            
            // Step 5: Group images by album
            const albumGroups = this.groupImagesByAlbum(images);
            console.log(`\\n📁 Found ${Object.keys(albumGroups).length} albums to create`);
            
            // Step 6: Migrate each album
            for (const [albumKey, albumImages] of Object.entries(albumGroups)) {
                try {
                    if (verbose) {
                        console.log(`\\nMigrating album: ${albumKey} (${albumImages.length} images)`);
                    }
                    
                    if (!dryRun) {
                        // Save album data
                        await this.albumDataManager.saveAlbum(albumKey, albumImages);
                    }
                    
                    this.stats.albumsCreated++;
                    this.stats.migratedImages += albumImages.length;
                    
                    // Show progress
                    if (this.stats.albumsCreated % 10 === 0) {
                        const progress = Math.round((this.stats.migratedImages / this.stats.totalImages) * 100);
                        console.log(`Progress: ${progress}% (${this.stats.migratedImages}/${this.stats.totalImages} images)`);
                    }
                } catch (error) {
                    this.stats.errors.push({
                        albumKey,
                        error: error.message,
                        imageCount: albumImages.length
                    });
                    console.error(`Error migrating album ${albumKey}:`, error.message);
                }
            }
            
            // Step 7: Update storage mode in config (skip in dry run)
            if (!dryRun) {
                await this.dataManager.setStorageMode('album');
                await this.dataManager.updateConfig('storageConfig.migrationStatus', 'completed');
                await this.dataManager.updateConfig('storageConfig.migrationDate', new Date().toISOString());
            }
            
            // Step 8: Verify migration
            if (!dryRun) {
                await this.verifyMigration(images.length);
            }
            
            this.stats.endTime = new Date();
            this.printSummary();
            
            return this.stats;
        } catch (error) {
            console.error('\\n❌ Migration failed:', error.message);
            throw error;
        }
    }

    // Group images by album key
    groupImagesByAlbum(images) {
        const albumGroups = {};
        
        for (const image of images) {
            const albumKey = image.albumKey || 'unknown';
            if (!albumGroups[albumKey]) {
                albumGroups[albumKey] = [];
            }
            albumGroups[albumKey].push(image);
        }
        
        return albumGroups;
    }

    // Verify migration was successful
    async verifyMigration(expectedImageCount) {
        console.log('\\n🔍 Verifying migration...');
        
        try {
            // Check storage statistics
            const stats = await this.albumDataManager.getStorageStatistics();
            
            if (stats.totalImages !== expectedImageCount) {
                throw new Error(
                    `Image count mismatch: expected ${expectedImageCount}, found ${stats.totalImages}`
                );
            }
            
            // Test search functionality
            const testImages = await this.albumDataManager.getAllImages();
            if (testImages.length !== expectedImageCount) {
                throw new Error('getAllImages() returned incorrect count');
            }
            
            // Test image registry
            const sampleImage = testImages[0];
            if (sampleImage && sampleImage.smugmugImageKey) {
                const found = await this.albumDataManager.findImageBySmugmugKey(
                    sampleImage.smugmugImageKey
                );
                if (!found) {
                    throw new Error('Image registry lookup failed');
                }
            }
            
            console.log('✓ Migration verified successfully');
        } catch (error) {
            console.error('❌ Verification failed:', error.message);
            throw error;
        }
    }

    // Print migration summary
    printSummary() {
        const duration = this.stats.endTime - this.stats.startTime;
        const seconds = Math.round(duration / 1000);
        
        console.log('\\n' + '='.repeat(50));
        console.log('📊 Migration Summary');
        console.log('='.repeat(50));
        console.log(`Total Images: ${this.stats.totalImages}`);
        console.log(`Migrated Images: ${this.stats.migratedImages}`);
        console.log(`Albums Created: ${this.stats.albumsCreated}`);
        console.log(`Errors: ${this.stats.errors.length}`);
        console.log(`Duration: ${seconds} seconds`);
        
        if (this.stats.errors.length > 0) {
            console.log('\\n⚠️  Errors encountered:');
            this.stats.errors.forEach(err => {
                console.log(`  - Album ${err.albumKey}: ${err.error}`);
            });
        }
        
        console.log('\\n✨ Migration complete!');
    }

    // Rollback migration
    async rollback(backupFile) {
        console.log('\\n🔄 Starting rollback...');
        
        try {
            // Restore images.json from backup
            const backupData = await fs.readFile(backupFile, 'utf8');
            await fs.writeFile(this.imagesFile, backupData, 'utf8');
            
            // Clear album data
            await this.albumDataManager.clearAllAlbumData();
            
            // Reset storage mode
            await this.dataManager.setStorageMode('single');
            await this.dataManager.updateConfig('storageConfig.migrationStatus', 'rolled_back');
            
            console.log('✓ Rollback completed successfully');
        } catch (error) {
            console.error('❌ Rollback failed:', error.message);
            throw error;
        }
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    
    const migration = new StorageMigration();
    
    try {
        switch (command) {
            case 'migrate':
                await migration.migrate({ dryRun: false, verbose: args.includes('--verbose') });
                break;
                
            case 'dry-run':
                await migration.migrate({ dryRun: true, verbose: args.includes('--verbose') });
                break;
                
            case 'rollback':
                const backupFile = args[1];
                if (!backupFile) {
                    console.error('Please provide backup file path');
                    process.exit(1);
                }
                await migration.rollback(backupFile);
                break;
                
            case 'status':
                const config = await migration.dataManager.getConfig();
                const storageConfig = config.storageConfig || {};
                console.log('\\nStorage Configuration:');
                console.log(`  Mode: ${storageConfig.mode || 'single'}`);
                console.log(`  Migration Status: ${storageConfig.migrationStatus || 'not_started'}`);
                console.log(`  Migration Date: ${storageConfig.migrationDate || 'N/A'}`);
                
                if (storageConfig.mode === 'album') {
                    const stats = await migration.albumDataManager.getStorageStatistics();
                    console.log('\\nAlbum Storage Statistics:');
                    console.log(`  Total Albums: ${stats.totalAlbums}`);
                    console.log(`  Total Images: ${stats.totalImages}`);
                    console.log(`  Total Size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
                }
                break;
                
            default:
                console.log('PhotoVision Storage Migration Utility');
                console.log('\\nUsage:');
                console.log('  node migrateToAlbumStorage.js migrate [--verbose]  # Perform migration');
                console.log('  node migrateToAlbumStorage.js dry-run [--verbose]  # Test migration');
                console.log('  node migrateToAlbumStorage.js rollback <backup>    # Restore from backup');
                console.log('  node migrateToAlbumStorage.js status               # Check storage status');
        }
    } catch (error) {
        console.error('\\nError:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = StorageMigration;