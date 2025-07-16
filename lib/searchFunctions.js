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
            default:
                throw new Error(`Unknown function: ${functionName}`);
        }
    }

    /**
     * Search images by keywords
     * @param {Object} params - Search parameters
     * @returns {Promise<Array>} Matching images
     */
    async searchByKeywords(params) {
        const { keywords, searchDescription = true } = params;
        const dataManager = new DataManager();
        const images = await dataManager.getImages();
        
        return images.filter(image => {
            // Search in keywords array
            const keywordMatches = image.keywords && image.keywords.some(keyword =>
                keywords.some(searchTerm => 
                    keyword.toLowerCase().includes(searchTerm.toLowerCase())
                )
            );
            
            // Search in description if enabled
            const descriptionMatches = searchDescription && image.description && 
                keywords.some(searchTerm => 
                    image.description.toLowerCase().includes(searchTerm.toLowerCase())
                );
            
            // Search in album hierarchy
            const albumHierarchyMatches = image.albumHierarchy && 
                keywords.some(searchTerm => 
                    image.albumHierarchy.some(level => 
                        level.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                );
            
            // Search in album name and path
            const albumNameMatches = image.albumName && 
                keywords.some(searchTerm => 
                    image.albumName.toLowerCase().includes(searchTerm.toLowerCase())
                );
            
            const albumPathMatches = image.albumPath && 
                keywords.some(searchTerm => 
                    image.albumPath.toLowerCase().includes(searchTerm.toLowerCase())
                );
            
            return keywordMatches || descriptionMatches || albumHierarchyMatches || albumNameMatches || albumPathMatches;
        });
    }

    /**
     * Search for images containing specific types of people
     * @param {Object} params - Search parameters
     * @returns {Promise<Array>} Matching images
     */
    async searchByPeople(params) {
        const { peopleType, ageRange } = params;
        const dataManager = new DataManager();
        const images = await dataManager.getImages();
        
        return images.filter(image => {
            const text = `${image.description} ${image.keywords?.join(' ')}`.toLowerCase();
            
            // Check for people type
            const peopleMatch = text.includes(peopleType.toLowerCase());
            
            // Check for age range if specified
            let ageMatch = true;
            if (ageRange) {
                ageMatch = text.includes(ageRange.toLowerCase()) ||
                          (ageRange.includes('young') && (text.includes('child') || text.includes('girl') || text.includes('boy'))) ||
                          (ageRange.includes('adult') && (text.includes('woman') || text.includes('man')));
            }
            
            return peopleMatch && ageMatch;
        });
    }

    /**
     * Search for images showing specific activities
     * @param {Object} params - Search parameters
     * @returns {Promise<Array>} Matching images
     */
    async searchByActivity(params) {
        const { activity } = params;
        const dataManager = new DataManager();
        const images = await dataManager.getImages();
        
        return images.filter(image => {
            const text = `${image.description} ${image.keywords?.join(' ')}`.toLowerCase();
            return text.includes(activity.toLowerCase());
        });
    }

    /**
     * Search for images with specific moods or emotions
     * @param {Object} params - Search parameters
     * @returns {Promise<Array>} Matching images
     */
    async searchByMood(params) {
        const { mood } = params;
        const dataManager = new DataManager();
        const images = await dataManager.getImages();
        
        // Map mood terms to related words
        const moodMappings = {
            'smiling': ['smiling', 'smile', 'happy', 'cheerful', 'joyful'],
            'happy': ['happy', 'smiling', 'joyful', 'cheerful', 'celebration', 'joy'],
            'celebrating': ['celebrating', 'celebration', 'celebratory', 'achievement', 'accomplishment', 'proud'],
            'proud': ['proud', 'pride', 'accomplishment', 'achievement', 'success'],
            'serious': ['serious', 'focused', 'concentrated', 'determined'],
            'peaceful': ['peaceful', 'calm', 'serene', 'tranquil']
        };
        
        const searchTerms = moodMappings[mood.toLowerCase()] || [mood.toLowerCase()];
        
        return images.filter(image => {
            const text = `${image.description} ${image.keywords?.join(' ')}`.toLowerCase();
            return searchTerms.some(term => text.includes(term));
        });
    }

    /**
     * Search for images taken in specific locations or settings
     * @param {Object} params - Search parameters
     * @returns {Promise<Array>} Matching images
     */
    async searchByLocation(params) {
        const { location } = params;
        const dataManager = new DataManager();
        const images = await dataManager.getImages();
        
        // Map location terms to related words
        const locationMappings = {
            'outdoor': ['outdoor', 'field', 'grass', 'sky', 'nature', 'outside'],
            'indoor': ['indoor', 'inside', 'backdrop', 'stage', 'venue'],
            'field': ['field', 'grass', 'outdoor', 'grounds', 'area'],
            'archery range': ['archery', 'targets', 'range', 'field', 'competition']
        };
        
        const searchTerms = locationMappings[location.toLowerCase()] || [location.toLowerCase()];
        
        return images.filter(image => {
            const text = `${image.description} ${image.keywords?.join(' ')}`.toLowerCase();
            return searchTerms.some(term => text.includes(term));
        });
    }

    /**
     * Search for images from specific albums or album hierarchies
     * @param {Object} params - Search parameters
     * @returns {Promise<Array>} Matching images
     */
    async searchByAlbum(params) {
        const { albumTerm } = params;
        const dataManager = new DataManager();
        const images = await dataManager.getImages();
        
        return images.filter(image => {
            // Check album hierarchy array
            const hierarchyMatch = image.albumHierarchy && 
                image.albumHierarchy.some(level => 
                    level.toLowerCase().includes(albumTerm.toLowerCase())
                );
            
            // Check album name
            const nameMatch = image.albumName && 
                image.albumName.toLowerCase().includes(albumTerm.toLowerCase());
            
            // Check album path
            const pathMatch = image.albumPath && 
                image.albumPath.toLowerCase().includes(albumTerm.toLowerCase());
            
            return hierarchyMatch || nameMatch || pathMatch;
        });
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
