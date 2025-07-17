// Search Functions Library for PhotoVision
// Provides structured search capabilities that Claude can call via function calling

const DataManager = require('./dataManager');

class SearchFunctions {
    constructor() {
        // Define available search functions that Claude can call
        this.functions = {
            searchByKeywords: {
                name: 'searchByKeywords',
                description: 'Search images by keywords or description content',
                parameters: {
                    type: 'object',
                    properties: {
                        keywords: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Array of keywords to search for'
                        },
                        searchDescription: {
                            type: 'boolean',
                            description: 'Whether to search in image descriptions as well',
                            default: true
                        }
                    },
                    required: ['keywords']
                }
            },
            searchByPeople: {
                name: 'searchByPeople',
                description: 'Search for images containing specific types of people',
                parameters: {
                    type: 'object',
                    properties: {
                        peopleType: {
                            type: 'string',
                            description: 'Type of people to search for (e.g., "girls", "boys", "women", "men", "children")'
                        },
                        ageRange: {
                            type: 'string',
                            description: 'Age range if specified (e.g., "5-8", "young", "adult")'
                        }
                    },
                    required: ['peopleType']
                }
            },
            searchByActivity: {
                name: 'searchByActivity',
                description: 'Search for images showing specific activities',
                parameters: {
                    type: 'object',
                    properties: {
                        activity: {
                            type: 'string',
                            description: 'Activity to search for (e.g., "archery", "sports", "competition", "awards")'
                        }
                    },
                    required: ['activity']
                }
            },
            searchByMood: {
                name: 'searchByMood',
                description: 'Search for images with specific moods or emotions',
                parameters: {
                    type: 'object',
                    properties: {
                        mood: {
                            type: 'string',
                            description: 'Mood or emotion to search for (e.g., "smiling", "happy", "celebrating", "proud")'
                        }
                    },
                    required: ['mood']
                }
            },
            searchByLocation: {
                name: 'searchByLocation',
                description: 'Search for images taken in specific locations or settings',
                parameters: {
                    type: 'object',
                    properties: {
                        location: {
                            type: 'string',
                            description: 'Location type to search for (e.g., "outdoor", "field", "indoor", "archery range")'
                        }
                    },
                    required: ['location']
                }
            },
            searchByAlbum: {
                name: 'searchByAlbum',
                description: 'Search for images from specific albums or album hierarchies',
                parameters: {
                    type: 'object',
                    properties: {
                        albumTerm: {
                            type: 'string',
                            description: 'Album name, year, event, or hierarchy level to search for (e.g., "2025", "Arizona Cup", "Gator Cup")'
                        }
                    },
                    required: ['albumTerm']
                }
            },
            filterByCount: {
                name: 'filterByCount',
                description: 'Limit search results to a specific number',
                parameters: {
                    type: 'object',
                    properties: {
                        count: {
                            type: 'number',
                            description: 'Maximum number of results to return'
                        },
                        results: {
                            type: 'array',
                            description: 'Array of image results to filter'
                        }
                    },
                    required: ['count', 'results']
                }
            },
            getAllImages: {
                name: 'getAllImages',
                description: 'Get all available images in the database',
                parameters: {
                    type: 'object',
                    properties: {}
                }
            },
            searchImages: {
                name: 'searchImages',
                description: 'Advanced unified search with relevance scoring and multiple criteria. Use this for complex searches that combine multiple factors.',
                parameters: {
                    type: 'object',
                    properties: {
                        keywords: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Array of keywords to search for'
                        },
                        peopleType: {
                            type: 'string',
                            description: 'Type of people to search for (e.g., "girls", "boys", "women", "men", "children")'
                        },
                        activity: {
                            type: 'string',
                            description: 'Activity to search for (e.g., "archery", "sports", "competition")'
                        },
                        mood: {
                            type: 'string',
                            description: 'Mood or emotion (e.g., "smiling", "happy", "celebrating")'
                        },
                        location: {
                            type: 'string',
                            description: 'Location or setting (e.g., "outdoor", "field", "indoor")'
                        },
                        albumTerm: {
                            type: 'string',
                            description: 'Album name, year, or event to search within'
                        },
                        requireAllKeywords: {
                            type: 'boolean',
                            description: 'If true, all keywords must match (AND logic). If false, any keyword can match (OR logic)',
                            default: false
                        },
                        maxResults: {
                            type: 'number',
                            description: 'Maximum number of results to return',
                            default: 50
                        }
                    }
                }
            }
        };
    }

    /**
     * Get function definitions for Claude function calling
     * @returns {Array} Array of function definitions
     */
    getFunctionDefinitions() {
        return Object.values(this.functions);
    }

    /**
     * Execute a function call from Claude
     * @param {string} functionName - Name of function to call
     * @param {Object} parameters - Function parameters
     * @returns {Promise<Array>} Search results
     */
    async executeFunction(functionName, parameters) {
        switch (functionName) {
            case 'searchByKeywords':
                return await this.searchByKeywords(parameters);
            case 'searchByPeople':
                return await this.searchByPeople(parameters);
            case 'searchByActivity':
                return await this.searchByActivity(parameters);
            case 'searchByMood':
                return await this.searchByMood(parameters);
            case 'searchByLocation':
                return await this.searchByLocation(parameters);
            case 'searchByAlbum':
                return await this.searchByAlbum(parameters);
            case 'filterByCount':
                return this.filterByCount(parameters);
            case 'getAllImages':
                return await this.getAllImages();
            case 'searchImages':
                return await this.searchImages(parameters);
            default:
                throw new Error(`Unknown function: ${functionName}`);
        }
    }

    /**
     * Helper function to check if text contains whole word match
     * @param {string} text - Text to search in
     * @param {string} searchTerm - Term to search for
     * @returns {boolean} True if whole word match found
     */
    wholeWordMatch(text, searchTerm) {
        if (!text || !searchTerm) return false;
        const regex = new RegExp(`\\b${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        return regex.test(text);
    }

    /**
     * Calculate relevance score for an image based on search criteria
     * @param {Object} image - Image object
     * @param {Object} criteria - Search criteria
     * @returns {number} Relevance score
     */
    calculateRelevanceScore(image, criteria) {
        let score = 0;
        const { keywords = [], peopleType, activity, mood, location, albumTerm } = criteria;

        // Score based on keyword matches (highest priority)
        if (keywords.length > 0) {
            keywords.forEach(keyword => {
                // Exact keyword matches (weight: 10)
                if (image.keywords && image.keywords.some(k => this.wholeWordMatch(k, keyword))) {
                    score += 10;
                }
                // Title matches (weight: 8)
                if (image.title && this.wholeWordMatch(image.title, keyword)) {
                    score += 8;
                }
                // Caption matches (weight: 6)
                if (image.caption && this.wholeWordMatch(image.caption, keyword)) {
                    score += 6;
                }
                // Description matches (weight: 4)
                if (image.description && this.wholeWordMatch(image.description, keyword)) {
                    score += 4;
                }
                // Album hierarchy matches (weight: 3)
                if (image.albumHierarchy && image.albumHierarchy.some(level => this.wholeWordMatch(level, keyword))) {
                    score += 3;
                }
                // Album name matches (weight: 2)
                if (image.albumName && this.wholeWordMatch(image.albumName, keyword)) {
                    score += 2;
                }
            });
        }

        // Score based on other criteria
        const searchText = `${image.description || ''} ${image.keywords?.join(' ') || ''}`.toLowerCase();
        
        if (peopleType && this.wholeWordMatch(searchText, peopleType)) score += 5;
        if (activity && this.wholeWordMatch(searchText, activity)) score += 5;
        if (mood && this.wholeWordMatch(searchText, mood)) score += 5;
        if (location && this.wholeWordMatch(searchText, location)) score += 5;
        if (albumTerm && (
            (image.albumHierarchy && image.albumHierarchy.some(level => this.wholeWordMatch(level, albumTerm))) ||
            (image.albumName && this.wholeWordMatch(image.albumName, albumTerm))
        )) score += 5;

        return score;
    }

    /**
     * Unified search function that combines multiple criteria with relevance scoring
     * @param {Object} criteria - Search criteria object
     * @returns {Promise<Array>} Ranked matching images
     */
    async searchImages(criteria) {
        const { 
            keywords = [], 
            peopleType, 
            activity, 
            mood, 
            location, 
            albumTerm,
            requireAllKeywords = false,
            maxResults = 50
        } = criteria;

        const dataManager = new DataManager();
        const images = await dataManager.getImages();
        
        // Filter and score images
        const scoredImages = images.map(image => {
            const score = this.calculateRelevanceScore(image, criteria);
            return { image, score };
        })
        .filter(item => {
            // Only include images with a relevance score > 0
            if (item.score === 0) return false;
            
            // If requireAllKeywords is true, check that all keywords match
            if (requireAllKeywords && keywords.length > 0) {
                const searchableText = `${item.image.description || ''} ${item.image.keywords?.join(' ') || ''} ${item.image.title || ''} ${item.image.caption || ''}`.toLowerCase();
                return keywords.every(keyword => this.wholeWordMatch(searchableText, keyword));
            }
            
            return true;
        })
        .sort((a, b) => b.score - a.score) // Sort by relevance score (highest first)
        .slice(0, maxResults) // Limit results
        .map(item => item.image);

        return scoredImages;
    }

    /**
     * Search images by keywords (updated to use unified search)
     * @param {Object} params - Search parameters
     * @returns {Promise<Array>} Matching images
     */
    async searchByKeywords(params) {
        const { keywords, searchDescription = true, requireAllKeywords = false } = params;
        return await this.searchImages({ 
            keywords, 
            requireAllKeywords,
            maxResults: 50 
        });
    }

    /**
     * Search for images containing specific types of people
     * @param {Object} params - Search parameters
     * @returns {Promise<Array>} Matching images
     */
    async searchByPeople(params) {
        const { peopleType, ageRange } = params;
        return await this.searchImages({ peopleType, maxResults: 50 });
    }

    /**
     * Search for images showing specific activities
     * @param {Object} params - Search parameters
     * @returns {Promise<Array>} Matching images
     */
    async searchByActivity(params) {
        const { activity } = params;
        return await this.searchImages({ activity, maxResults: 50 });
    }

    /**
     * Search for images with specific moods or emotions
     * @param {Object} params - Search parameters
     * @returns {Promise<Array>} Matching images
     */
    async searchByMood(params) {
        const { mood } = params;
        return await this.searchImages({ mood, maxResults: 50 });
    }

    /**
     * Search for images taken in specific locations or settings
     * @param {Object} params - Search parameters
     * @returns {Promise<Array>} Matching images
     */
    async searchByLocation(params) {
        const { location } = params;
        return await this.searchImages({ location, maxResults: 50 });
    }

    /**
     * Search for images from specific albums or album hierarchies
     * @param {Object} params - Search parameters
     * @returns {Promise<Array>} Matching images
     */
    async searchByAlbum(params) {
        const { albumTerm } = params;
        return await this.searchImages({ albumTerm, maxResults: 50 });
    }

    /**
     * Limit search results to a specific number
     * @param {Object} params - Filter parameters
     * @returns {Array} Filtered results
     */
    filterByCount(params) {
        const { count, results } = params;
        return results.slice(0, count);
    }

    /**
     * Get all available images
     * @returns {Promise<Array>} All images
     */
    async getAllImages() {
        const dataManager = new DataManager();
        return await dataManager.getImages();
    }

    /**
     * Format image results for conversational response
     * @param {Array} images - Array of image objects
     * @returns {Array} Formatted results with essential information
     */
    formatResults(images) {
        return images.map(image => ({
            id: image.id,
            filename: image.filename,
            description: image.description,
            keywords: image.keywords,
            smugmugUrl: image.smugmugUrl,
            timestamp: image.timestamp,
            title: image.title,
            caption: image.caption,
            albumKey: image.albumKey,
            albumName: image.albumName,
            albumPath: image.albumPath,
            albumHierarchy: image.albumHierarchy
        }));
    }

    /**
     * Apply pagination to search results
     * @param {Array} results - Full search results
     * @param {number} page - Page number (0-based)
     * @param {number} limit - Results per page
     * @returns {Object} Paginated results with metadata
     */
    paginateResults(results, page = 0, limit = 10) {
        const startIndex = page * limit;
        const endIndex = startIndex + limit;
        const paginatedResults = results.slice(startIndex, endIndex);
        
        return {
            results: paginatedResults,
            pagination: {
                page: page,
                limit: limit,
                total: results.length,
                totalPages: Math.ceil(results.length / limit),
                hasMore: endIndex < results.length,
                startIndex: startIndex,
                endIndex: Math.min(endIndex, results.length)
            }
        };
    }
}

module.exports = SearchFunctions;
