// PhotoVision Album Data Manager
// Handles album-based JSON storage for scalable image data management

const fs = require('fs/promises');
const path = require('path');

class AlbumDataManager {
    constructor(dataDir) {
        this.dataDir = dataDir || path.join(__dirname, '..', 'data');
        this.albumsDir = path.join(this.dataDir, 'albums');
        this.imageRegistryFile = path.join(this.dataDir, 'imageRegistry.json');
        this.searchIndexFile = path.join(this.dataDir, 'searchIndex.json');
        
        // LRU cache for recently accessed albums
        this.albumCache = new Map();
        this.cacheMaxSize = 10; // Keep 10 albums in memory
        
        // In-memory indices
        this.imageRegistry = null;
        this.searchIndex = null;
        this.indicesLoaded = false;
    }

    // Initialize album storage structure
    async initialize() {
        try {
            // Create albums directory if it doesn't exist
            await fs.mkdir(this.albumsDir, { recursive: true });
            
            // Load indices into memory
            await this.loadIndices();
            
            console.log('Album data manager initialized');
        } catch (error) {
            console.error('Error initializing album data manager:', error.message);
            throw error;
        }
    }

    // Load image registry and search index
    async loadIndices() {
        try {
            // Load image registry
            try {
                const registryData = await fs.readFile(this.imageRegistryFile, 'utf8');
                this.imageRegistry = JSON.parse(registryData);
            } catch (error) {
                if (error.code === 'ENOENT') {
                    this.imageRegistry = {};
                } else {
                    throw error;
                }
            }

            // Load search index
            try {
                const indexData = await fs.readFile(this.searchIndexFile, 'utf8');
                const parsed = JSON.parse(indexData);
                
                // Convert arrays back to Sets for in-memory usage
                this.searchIndex = {
                    keywords: {},
                    descriptions: {}
                };
                
                // Convert keyword arrays to Sets
                for (const [keyword, albums] of Object.entries(parsed.keywords || {})) {
                    this.searchIndex.keywords[keyword] = new Set(albums);
                }
                
                // Convert description arrays to Sets
                for (const [word, albums] of Object.entries(parsed.descriptions || {})) {
                    this.searchIndex.descriptions[word] = new Set(albums);
                }
            } catch (error) {
                if (error.code === 'ENOENT') {
                    this.searchIndex = {
                        keywords: {},
                        descriptions: {}
                    };
                } else {
                    throw error;
                }
            }

            this.indicesLoaded = true;
        } catch (error) {
            console.error('Error loading indices:', error.message);
            throw error;
        }
    }

    // Save indices to disk
    async saveIndices() {
        try {
            // Save image registry
            await fs.writeFile(
                this.imageRegistryFile, 
                JSON.stringify(this.imageRegistry, null, 2),
                'utf8'
            );

            // Save search index
            await fs.writeFile(
                this.searchIndexFile,
                JSON.stringify(this.searchIndex, null, 2),
                'utf8'
            );
        } catch (error) {
            console.error('Error saving indices:', error.message);
            throw error;
        }
    }

    // Get album file path
    getAlbumFilePath(albumKey) {
        return path.join(this.albumsDir, `${albumKey}.json`);
    }

    // Load album data with caching
    async loadAlbum(albumKey) {
        if (!albumKey) {
            throw new Error('Album key is required');
        }

        // Check cache first
        if (this.albumCache.has(albumKey)) {
            // Move to end (most recently used)
            const data = this.albumCache.get(albumKey);
            this.albumCache.delete(albumKey);
            this.albumCache.set(albumKey, data);
            return data;
        }

        try {
            const albumPath = this.getAlbumFilePath(albumKey);
            const albumData = await fs.readFile(albumPath, 'utf8');
            const images = JSON.parse(albumData);

            // Add to cache with LRU eviction
            if (this.albumCache.size >= this.cacheMaxSize) {
                // Remove least recently used (first item)
                const firstKey = this.albumCache.keys().next().value;
                this.albumCache.delete(firstKey);
            }
            this.albumCache.set(albumKey, images);

            return images;
        } catch (error) {
            if (error.code === 'ENOENT') {
                // Album doesn't exist yet
                return [];
            }
            console.error(`Error loading album ${albumKey}:`, error.message);
            throw error;
        }
    }

    // Save album data
    async saveAlbum(albumKey, images) {
        if (!albumKey) {
            throw new Error('Album key is required');
        }

        try {
            const albumPath = this.getAlbumFilePath(albumKey);
            await fs.writeFile(
                albumPath,
                JSON.stringify(images, null, 2),
                'utf8'
            );

            // Update cache
            this.albumCache.set(albumKey, images);

            // Update indices for this album
            await this.updateIndicesForAlbum(albumKey, images);

            console.log(`Saved album ${albumKey} with ${images.length} images`);
        } catch (error) {
            console.error(`Error saving album ${albumKey}:`, error.message);
            throw error;
        }
    }

    // Update indices when album is saved
    async updateIndicesForAlbum(albumKey, images) {
        if (!this.indicesLoaded) {
            await this.loadIndices();
        }

        // Clear existing entries for this album
        this.clearAlbumFromIndices(albumKey);

        // Update image registry and search index
        for (const image of images) {
            if (image.smugmugImageKey) {
                // Update image registry
                this.imageRegistry[image.smugmugImageKey] = albumKey;

                // Update keyword index
                if (image.keywords && Array.isArray(image.keywords)) {
                    for (const keyword of image.keywords) {
                        const normalizedKeyword = keyword.toLowerCase();
                        if (!this.searchIndex.keywords[normalizedKeyword]) {
                            this.searchIndex.keywords[normalizedKeyword] = new Set();
                        }
                        this.searchIndex.keywords[normalizedKeyword].add(albumKey);
                    }
                }

                // Update description index (index significant words)
                if (image.description) {
                    const words = this.extractSignificantWords(image.description);
                    for (const word of words) {
                        if (!this.searchIndex.descriptions[word]) {
                            this.searchIndex.descriptions[word] = new Set();
                        }
                        this.searchIndex.descriptions[word].add(albumKey);
                    }
                }
            }
        }

        // Convert Sets to Arrays for JSON serialization
        this.normalizeSearchIndex();

        // Save indices
        await this.saveIndices();
    }

    // Clear album from all indices
    clearAlbumFromIndices(albumKey) {
        // Clear from image registry
        for (const [imageKey, album] of Object.entries(this.imageRegistry)) {
            if (album === albumKey) {
                delete this.imageRegistry[imageKey];
            }
        }

        // Clear from keyword index
        for (const [keyword, albums] of Object.entries(this.searchIndex.keywords)) {
            if (albums instanceof Set) {
                albums.delete(albumKey);
                if (albums.size === 0) {
                    delete this.searchIndex.keywords[keyword];
                }
            } else if (Array.isArray(albums)) {
                const albumSet = new Set(albums);
                albumSet.delete(albumKey);
                if (albumSet.size === 0) {
                    delete this.searchIndex.keywords[keyword];
                } else {
                    this.searchIndex.keywords[keyword] = albumSet;
                }
            }
        }

        // Clear from description index
        for (const [word, albums] of Object.entries(this.searchIndex.descriptions)) {
            if (albums instanceof Set) {
                albums.delete(albumKey);
                if (albums.size === 0) {
                    delete this.searchIndex.descriptions[word];
                }
            } else if (Array.isArray(albums)) {
                const albumSet = new Set(albums);
                albumSet.delete(albumKey);
                if (albumSet.size === 0) {
                    delete this.searchIndex.descriptions[word];
                } else {
                    this.searchIndex.descriptions[word] = albumSet;
                }
            }
        }
    }

    // Extract significant words from description for indexing
    extractSignificantWords(description) {
        // Remove common words and extract significant terms
        const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
            'before', 'after', 'above', 'below', 'between', 'under', 'again',
            'further', 'then', 'once', 'is', 'are', 'was', 'were', 'been', 'be',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
            'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these',
            'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'them', 'their'
        ]);

        const words = description.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2 && !stopWords.has(word));

        return [...new Set(words)]; // Remove duplicates
    }

    // Normalize search index (convert Sets to Arrays for JSON)
    normalizeSearchIndex() {
        // Normalize keywords
        for (const [keyword, albums] of Object.entries(this.searchIndex.keywords)) {
            if (albums instanceof Set) {
                this.searchIndex.keywords[keyword] = Array.from(albums);
            }
        }

        // Normalize descriptions
        for (const [word, albums] of Object.entries(this.searchIndex.descriptions)) {
            if (albums instanceof Set) {
                this.searchIndex.descriptions[word] = Array.from(albums);
            }
        }
    }

    // Get all images (loads all albums - use sparingly)
    async getAllImages() {
        try {
            const albumFiles = await fs.readdir(this.albumsDir);
            const allImages = [];

            for (const file of albumFiles) {
                if (file.endsWith('.json')) {
                    const albumKey = file.replace('.json', '');
                    const images = await this.loadAlbum(albumKey);
                    allImages.push(...images);
                }
            }

            return allImages;
        } catch (error) {
            console.error('Error getting all images:', error.message);
            throw error;
        }
    }

    // Find image by SmugMug key using registry
    async findImageBySmugmugKey(smugmugImageKey) {
        if (!this.indicesLoaded) {
            await this.loadIndices();
        }

        const albumKey = this.imageRegistry[smugmugImageKey];
        if (!albumKey) {
            return null;
        }

        const images = await this.loadAlbum(albumKey);
        return images.find(img => img.smugmugImageKey === smugmugImageKey) || null;
    }

    // Check if image exists
    async imageExists(smugmugImageKey) {
        if (!this.indicesLoaded) {
            await this.loadIndices();
        }
        return this.imageRegistry.hasOwnProperty(smugmugImageKey);
    }

    // Add image to specific album
    async addImageToAlbum(albumKey, imageData) {
        const images = await this.loadAlbum(albumKey);
        
        // Check for duplicates within album
        const existingIndex = images.findIndex(
            img => img.smugmugImageKey === imageData.smugmugImageKey
        );

        if (existingIndex >= 0) {
            // Update existing image
            images[existingIndex] = {
                ...images[existingIndex],
                ...imageData,
                lastUpdated: new Date().toISOString()
            };
        } else {
            // Add new image
            images.push({
                id: Date.now().toString(36) + Math.random().toString(36).substr(2),
                timestamp: new Date().toISOString(),
                ...imageData
            });
        }

        await this.saveAlbum(albumKey, images);
        return images[existingIndex >= 0 ? existingIndex : images.length - 1];
    }

    // Search images using indices
    async searchImages(query) {
        if (!this.indicesLoaded) {
            await this.loadIndices();
        }

        const lowercaseQuery = query.toLowerCase();
        const relevantAlbums = new Set();

        // Search in keywords
        for (const [keyword, albums] of Object.entries(this.searchIndex.keywords)) {
            if (keyword.includes(lowercaseQuery)) {
                albums.forEach(album => relevantAlbums.add(album));
            }
        }

        // Search in description words
        const queryWords = lowercaseQuery.split(/\s+/);
        for (const queryWord of queryWords) {
            if (this.searchIndex.descriptions[queryWord]) {
                this.searchIndex.descriptions[queryWord].forEach(
                    album => relevantAlbums.add(album)
                );
            }
        }

        // Load relevant albums and search within them
        const results = [];
        for (const albumKey of relevantAlbums) {
            const images = await this.loadAlbum(albumKey);
            
            const matches = images.filter(image => {
                // Search in description
                const descriptionMatch = image.description && 
                    image.description.toLowerCase().includes(lowercaseQuery);
                
                // Search in keywords
                const keywordMatch = image.keywords && 
                    image.keywords.some(keyword => 
                        keyword.toLowerCase().includes(lowercaseQuery));
                
                // Search in filename
                const filenameMatch = image.filename && 
                    image.filename.toLowerCase().includes(lowercaseQuery);
                
                return descriptionMatch || keywordMatch || filenameMatch;
            });

            results.push(...matches);
        }

        console.log(`Search for "${query}" found ${results.length} results from ${relevantAlbums.size} albums`);
        return results;
    }

    // Get album processing status
    async getAlbumProcessingStatus(albumKey, totalExpectedImages) {
        const images = await this.loadAlbum(albumKey);
        const processedCount = images.length;
        
        return {
            albumKey: albumKey,
            processedImages: processedCount,
            totalImages: totalExpectedImages,
            processingProgress: totalExpectedImages > 0 
                ? Math.round((processedCount / totalExpectedImages) * 100) 
                : 0,
            isCompletelyProcessed: processedCount === totalExpectedImages && totalExpectedImages > 0,
            lastProcessedAt: images.length > 0 
                ? Math.max(...images.map(img => new Date(img.timestamp || 0).getTime()))
                : null
        };
    }

    // Clear all album data (use with caution)
    async clearAllAlbumData() {
        try {
            // Clear cache
            this.albumCache.clear();

            // Remove all album files
            const albumFiles = await fs.readdir(this.albumsDir);
            for (const file of albumFiles) {
                if (file.endsWith('.json')) {
                    await fs.unlink(path.join(this.albumsDir, file));
                }
            }

            // Clear indices
            this.imageRegistry = {};
            this.searchIndex = { keywords: {}, descriptions: {} };
            await this.saveIndices();

            console.log('All album data cleared');
        } catch (error) {
            console.error('Error clearing album data:', error.message);
            throw error;
        }
    }

    // Get statistics about album storage
    async getStorageStatistics() {
        try {
            const albumFiles = await fs.readdir(this.albumsDir);
            const stats = {
                totalAlbums: 0,
                totalImages: 0,
                totalSize: 0,
                largestAlbum: null,
                albums: []
            };

            for (const file of albumFiles) {
                if (file.endsWith('.json')) {
                    const albumKey = file.replace('.json', '');
                    const albumPath = this.getAlbumFilePath(albumKey);
                    const fileStat = await fs.stat(albumPath);
                    const images = await this.loadAlbum(albumKey);

                    const albumInfo = {
                        albumKey: albumKey,
                        imageCount: images.length,
                        fileSize: fileStat.size
                    };

                    stats.albums.push(albumInfo);
                    stats.totalAlbums++;
                    stats.totalImages += images.length;
                    stats.totalSize += fileStat.size;

                    if (!stats.largestAlbum || images.length > stats.largestAlbum.imageCount) {
                        stats.largestAlbum = albumInfo;
                    }
                }
            }

            return stats;
        } catch (error) {
            console.error('Error getting storage statistics:', error.message);
            throw error;
        }
    }
}

module.exports = AlbumDataManager;