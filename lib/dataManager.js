// PhotoVision Data Manager
// Handles JSON file-based data storage operations

const fs = require('fs/promises');
const path = require('path');

class DataManager {
    constructor() {
        this.dataDir = path.join(__dirname, '..', 'data');
        this.imagesFile = path.join(this.dataDir, 'images.json');
        this.configFile = path.join(this.dataDir, 'config.json');
    }

    // Load JSON data from file
    async loadData(filename) {
        try {
            const filePath = path.join(this.dataDir, filename);
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error(`Error loading ${filename}:`, error.message);
            throw new Error(`Failed to load data from ${filename}`);
        }
    }

    // Save JSON data to file
    async saveData(filename, data) {
        try {
            const filePath = path.join(this.dataDir, filename);
            const jsonData = JSON.stringify(data, null, 2);
            await fs.writeFile(filePath, jsonData, 'utf8');
            console.log(`Data saved to ${filename}`);
        } catch (error) {
            console.error(`Error saving ${filename}:`, error.message);
            throw new Error(`Failed to save data to ${filename}`);
        }
    }

    // Load images data
    async getImages() {
        return await this.loadData('images.json');
    }

    // Save images data
    async saveImages(images) {
        return await this.saveData('images.json', images);
    }

    // Load config data
    async getConfig() {
        return await this.loadData('config.json');
    }

    // Save config data
    async saveConfig(config) {
        return await this.saveData('config.json', config);
    }

    // Add a new image analysis
    async addImage(imageData) {
        try {
            const images = await this.getImages();
            
            // Add timestamp and ID
            const newImage = {
                id: Date.now(),
                timestamp: new Date().toISOString(),
                ...imageData
            };
            
            images.push(newImage);
            await this.saveImages(images);
            
            console.log(`Added new image: ${newImage.id}`);
            return newImage;
        } catch (error) {
            console.error('Error adding image:', error.message);
            throw error;
        }
    }

    // Search images by description and keywords
    async searchImages(query) {
        try {
            const images = await this.getImages();
            const lowercaseQuery = query.toLowerCase();
            
            // Search through descriptions, keywords, and filenames
            const results = images.filter(image => {
                // Search in description
                const descriptionMatch = image.analysis && image.analysis.description && 
                                       image.analysis.description.toLowerCase().includes(lowercaseQuery);
                
                // Search in keywords
                const keywordMatch = image.analysis && image.analysis.keywords && 
                                   image.analysis.keywords.some(keyword => 
                                       keyword.toLowerCase().includes(lowercaseQuery));
                
                // Search in filename
                const filenameMatch = image.filename && 
                                    image.filename.toLowerCase().includes(lowercaseQuery);
                
                return descriptionMatch || keywordMatch || filenameMatch;
            });
            
            console.log(`Search for "${query}" returned ${results.length} results`);
            return results;
        } catch (error) {
            console.error('Error searching images:', error.message);
            throw error;
        }
    }

    // Update config setting
    async updateConfig(key, value) {
        try {
            const config = await this.getConfig();
            
            // Support nested key updates using dot notation
            const keys = key.split('.');
            let current = config;
            
            for (let i = 0; i < keys.length - 1; i++) {
                if (!current[keys[i]]) {
                    current[keys[i]] = {};
                }
                current = current[keys[i]];
            }
            
            current[keys[keys.length - 1]] = value;
            
            await this.saveConfig(config);
            console.log(`Updated config ${key} = ${value}`);
            return config;
        } catch (error) {
            console.error('Error updating config:', error.message);
            throw error;
        }
    }

    // Get processing status
    async getStatus() {
        try {
            const config = await this.getConfig();
            const images = await this.getImages();
            
            return {
                connected: config.smugmug.connected,
                totalImages: images.length,
                processing: config.processing,
                lastSync: config.smugmug.lastSync
            };
        } catch (error) {
            console.error('Error getting status:', error.message);
            throw error;
        }
    }
}

module.exports = DataManager;
