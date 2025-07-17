// Search Functions Library for PhotoVision
// Provides structured search capabilities that Claude can call via function calling

const DataManager = require('./dataManager');

class SearchFunctions {
    constructor() {
        // Initialize semantic concept mappings
        this.initializeSemanticMappings();
        
        // Define available search functions that Claude can call
        this.functions = {
            searchByKeywords: {
                name: 'searchByKeywords',
                description: 'Perfect for when users mention specific keywords or terms they want to find in photos. Great for straightforward searches!',
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
                description: 'Wonderful for finding photos that capture specific feelings and emotions! Use when users want to find "happy moments", "excitement", "pride", etc.',
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
                description: 'Advanced unified search with relevance scoring and multiple criteria. Use this for complex searches that combine multiple factors. Supports negative keywords to exclude unwanted content.',
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
                        negativeKeywords: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Array of keywords to exclude from results (e.g., ["people", "faces"] to exclude photos with people)'
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
            },
            intelligentSearch: {
                name: 'intelligentSearch',
                description: 'This is your go-to function for understanding and finding photos based on natural, conversational descriptions! It\'s perfect when users describe what they\'re looking for in their own words - like "kids having fun" or "that moment when someone won". Use this when the user sounds conversational or describes scenes, emotions, or memories rather than just listing keywords. It automatically understands negative keywords like "no people", "without faces", "exclude crowds", etc.',
                parameters: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'The user\'s natural language description of what they want to find. Examples: "happy kids at a celebration", "athletes looking really focused and determined", "that exciting moment when someone wins", "archery targets, no people", "outdoor scenes without buildings"'
                        },
                        maxResults: {
                            type: 'number',
                            description: 'Maximum number of results to return',
                            default: 20
                        },
                        includeSemanticExpansion: {
                            type: 'boolean',
                            description: 'Whether to include semantic expansion of search terms',
                            default: true
                        }
                    },
                    required: ['query']
                }
            }
        };
    }

    /**
     * Initialize comprehensive semantic concept mappings
     */
    initializeSemanticMappings() {
        this.semanticMappings = {
            // Emotion and mood concepts
            moods: {
                'happy': ['happy', 'joyful', 'cheerful', 'smiling', 'laughing', 'delighted', 'elated', 'pleased', 'content', 'glad'],
                'celebration': ['celebration', 'celebrating', 'party', 'festive', 'jubilant', 'triumphant', 'victorious', 'cheering'],
                'excited': ['excited', 'enthusiastic', 'energetic', 'thrilled', 'animated', 'lively', 'exuberant'],
                'proud': ['proud', 'pride', 'accomplishment', 'achievement', 'success', 'confident', 'satisfied'],
                'focused': ['focused', 'concentrated', 'determined', 'serious', 'intent', 'engaged', 'attentive'],
                'relaxed': ['relaxed', 'calm', 'peaceful', 'serene', 'tranquil', 'restful', 'laid-back'],
                'competitive': ['competitive', 'rivalry', 'contest', 'challenge', 'intense', 'determined'],
                'surprised': ['surprised', 'amazed', 'shocked', 'astonished', 'startled', 'bewildered']
            },
            
            // Activity and action concepts
            activities: {
                'archery': ['archery', 'bow', 'arrow', 'target', 'shooting', 'aim', 'bullseye', 'quiver', 'recurve', 'compound'],
                'sports': ['sports', 'athletic', 'competition', 'tournament', 'game', 'match', 'contest', 'championship'],
                'training': ['training', 'practice', 'drill', 'exercise', 'workout', 'preparation', 'coaching', 'instruction'],
                'competition': ['competition', 'contest', 'tournament', 'championship', 'match', 'event', 'qualifier'],
                'awards': ['awards', 'medal', 'trophy', 'prize', 'recognition', 'honor', 'achievement', 'victory'],
                'ceremony': ['ceremony', 'presentation', 'formal', 'official', 'ritual', 'commemoration'],
                'social': ['social', 'gathering', 'meeting', 'conversation', 'interaction', 'group', 'community'],
                'learning': ['learning', 'education', 'instruction', 'teaching', 'demonstration', 'clinic', 'workshop']
            },
            
            // People and demographics
            people: {
                'people': ['people', 'person', 'human', 'individual', 'man', 'men', 'woman', 'women', 'adult', 'adults', 'child', 'children', 'face', 'faces', 'crowd', 'group', 'boy', 'boys', 'girl', 'girls', 'lady', 'ladies', 'guy', 'guys', 'participant', 'participants', 'athlete', 'athletes'],
                'children': ['children', 'kids', 'youth', 'young', 'juvenile', 'minor', 'teenager', 'adolescent'],
                'adults': ['adults', 'grown-ups', 'mature', 'older', 'senior'],
                'athletes': ['athletes', 'competitors', 'players', 'sportspeople', 'participants'],
                'coaches': ['coaches', 'instructors', 'trainers', 'teachers', 'mentors', 'guides'],
                'family': ['family', 'relatives', 'parents', 'siblings', 'generations'],
                'friends': ['friends', 'companions', 'peers', 'buddies', 'teammates'],
                'professionals': ['professionals', 'experts', 'specialists', 'officials', 'staff']
            },
            
            // Location and setting concepts
            locations: {
                'outdoor': ['outdoor', 'outside', 'field', 'range', 'grounds', 'open-air', 'nature', 'fresh-air'],
                'indoor': ['indoor', 'inside', 'venue', 'hall', 'facility', 'building', 'enclosed'],
                'venue': ['venue', 'facility', 'location', 'site', 'place', 'center', 'complex'],
                'natural': ['natural', 'nature', 'wilderness', 'scenic', 'landscape', 'environment'],
                'urban': ['urban', 'city', 'metropolitan', 'downtown', 'municipal', 'civic'],
                'rural': ['rural', 'countryside', 'country', 'pastoral', 'agricultural'],
                'formal': ['formal', 'official', 'ceremonial', 'professional', 'structured']
            },
            
            // Equipment and objects
            equipment: {
                'bow': ['bow', 'recurve', 'compound', 'longbow', 'crossbow', 'archery-equipment'],
                'arrows': ['arrows', 'shaft', 'fletching', 'nock', 'point', 'projectile'],
                'target': ['target', 'bullseye', 'face', 'scoring', 'rings', 'center'],
                'gear': ['gear', 'equipment', 'apparatus', 'tools', 'accessories', 'supplies'],
                'uniform': ['uniform', 'attire', 'clothing', 'dress', 'outfit', 'apparel'],
                'safety': ['safety', 'protection', 'guard', 'shield', 'secure', 'precaution']
            },
            
            // Time and temporal concepts
            temporal: {
                'morning': ['morning', 'dawn', 'early', 'sunrise', 'am'],
                'afternoon': ['afternoon', 'midday', 'noon', 'pm'],
                'evening': ['evening', 'dusk', 'sunset', 'twilight'],
                'season': ['season', 'seasonal', 'spring', 'summer', 'fall', 'autumn', 'winter'],
                'recent': ['recent', 'new', 'latest', 'current', 'modern'],
                'vintage': ['vintage', 'old', 'classic', 'historical', 'retro', 'traditional']
            }
        };

        // Create reverse mapping for quick lookup
        this.termToCategories = {};
        Object.keys(this.semanticMappings).forEach(category => {
            Object.keys(this.semanticMappings[category]).forEach(concept => {
                this.semanticMappings[category][concept].forEach(term => {
                    if (!this.termToCategories[term]) {
                        this.termToCategories[term] = [];
                    }
                    this.termToCategories[term].push({ category, concept });
                });
            });
        });
    }

    /**
     * Expand search terms using semantic mappings
     * @param {string} searchTerm - Original search term
     * @returns {Array} Array of related terms
     */
    expandSearchTerm(searchTerm) {
        const normalizedTerm = searchTerm.toLowerCase().trim();
        const expandedTerms = [normalizedTerm];
        
        // Check if term exists in our mappings
        if (this.termToCategories[normalizedTerm]) {
            this.termToCategories[normalizedTerm].forEach(({ category, concept }) => {
                // Add all terms from the same concept
                const relatedTerms = this.semanticMappings[category][concept];
                expandedTerms.push(...relatedTerms);
            });
        }
        
        // Find concept matches (if user searches for concept name)
        Object.keys(this.semanticMappings).forEach(category => {
            if (this.semanticMappings[category][normalizedTerm]) {
                expandedTerms.push(...this.semanticMappings[category][normalizedTerm]);
            }
        });
        
        // Remove duplicates and return
        return [...new Set(expandedTerms)];
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
            case 'intelligentSearch':
                return await this.intelligentSearch(parameters);
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
     * Filter images by negative keywords
     * @param {Array} images - Array of image objects
     * @param {Array} negativeKeywords - Array of negative keywords to filter out
     * @returns {Array} Filtered images that don't match negative keywords
     */
    filterByNegativeKeywords(images, negativeKeywords) {
        if (!negativeKeywords || negativeKeywords.length === 0) {
            return images;
        }

        return images.filter(image => {
            // Build searchable text from all image fields
            const searchableText = [
                image.title,
                image.caption,
                image.description,
                image.albumName,
                ...(image.albumHierarchy || []),
                ...(image.keywords || [])
            ].filter(Boolean).join(' ').toLowerCase();

            // Check if any negative keyword matches
            for (const negativeKeyword of negativeKeywords) {
                if (this.wholeWordMatch(searchableText, negativeKeyword)) {
                    return false; // Exclude this image
                }
            }

            return true; // Include this image
        });
    }

    /**
     * Calculate relevance score for an image based on search criteria with semantic expansion
     * @param {Object} image - Image object
     * @param {Object} criteria - Search criteria
     * @returns {number} Relevance score
     */
    calculateRelevanceScore(image, criteria) {
        let score = 0;
        const { keywords = [], peopleType, activity, mood, location, albumTerm, negativeKeywords = [] } = criteria;

        // Score based on keyword matches with semantic expansion
        if (keywords.length > 0) {
            keywords.forEach(keyword => {
                // Expand search term semantically
                const expandedTerms = this.expandSearchTerm(keyword);
                
                expandedTerms.forEach((term, index) => {
                    // Higher weight for exact matches, lower for semantic matches
                    const semanticMultiplier = index === 0 ? 1.0 : 0.7; // Original term gets full weight
                    
                    // Exact keyword matches (weight: 10)
                    if (image.keywords && image.keywords.some(k => this.wholeWordMatch(k, term))) {
                        score += 10 * semanticMultiplier;
                    }
                    // Title matches (weight: 8)
                    if (image.title && this.wholeWordMatch(image.title, term)) {
                        score += 8 * semanticMultiplier;
                    }
                    // Caption matches (weight: 6)
                    if (image.caption && this.wholeWordMatch(image.caption, term)) {
                        score += 6 * semanticMultiplier;
                    }
                    // Description matches (weight: 4)
                    if (image.description && this.wholeWordMatch(image.description, term)) {
                        score += 4 * semanticMultiplier;
                    }
                    // Album hierarchy matches (weight: 3)
                    if (image.albumHierarchy && image.albumHierarchy.some(level => this.wholeWordMatch(level, term))) {
                        score += 3 * semanticMultiplier;
                    }
                    // Album name matches (weight: 2)
                    if (image.albumName && this.wholeWordMatch(image.albumName, term)) {
                        score += 2 * semanticMultiplier;
                    }
                });
            });
        }

        // Score based on other criteria with semantic expansion
        const searchText = `${image.description || ''} ${image.keywords?.join(' ') || ''}`.toLowerCase();
        
        if (peopleType) {
            const expandedPeopleTerms = this.expandSearchTerm(peopleType);
            if (expandedPeopleTerms.some(term => this.wholeWordMatch(searchText, term))) {
                score += 5;
            }
        }
        
        if (activity) {
            const expandedActivityTerms = this.expandSearchTerm(activity);
            if (expandedActivityTerms.some(term => this.wholeWordMatch(searchText, term))) {
                score += 5;
            }
        }
        
        if (mood) {
            const expandedMoodTerms = this.expandSearchTerm(mood);
            if (expandedMoodTerms.some(term => this.wholeWordMatch(searchText, term))) {
                score += 5;
            }
        }
        
        if (location) {
            const expandedLocationTerms = this.expandSearchTerm(location);
            if (expandedLocationTerms.some(term => this.wholeWordMatch(searchText, term))) {
                score += 5;
            }
        }
        
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
            maxResults = 50,
            negativeKeywords = [],
            expandedNegatives = []
        } = criteria;

        const dataManager = new DataManager();
        let images = await dataManager.getImages();
        
        // Apply negative keyword filtering first (most important)
        const negativesToFilter = expandedNegatives.length > 0 ? expandedNegatives : negativeKeywords;
        if (negativesToFilter.length > 0) {
            images = this.filterByNegativeKeywords(images, negativesToFilter);
        }
        
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
     * Intelligent semantic search that interprets natural language queries
     * @param {Object} params - Search parameters
     * @returns {Promise<Array>} Semantically ranked results
     */
    async intelligentSearch(params) {
        const { query, maxResults = 20, includeSemanticExpansion = true } = params;
        
        // Parse the natural language query to extract search components
        const parsedQuery = this.parseNaturalLanguageQuery(query);
        
        // Build search criteria from parsed query
        const searchCriteria = {
            keywords: parsedQuery.keywords,
            peopleType: parsedQuery.peopleType,
            activity: parsedQuery.activity,
            mood: parsedQuery.mood,
            location: parsedQuery.location,
            albumTerm: parsedQuery.albumTerm,
            negativeKeywords: parsedQuery.negativeKeywords,
            expandedNegatives: parsedQuery.expandedNegatives,
            maxResults: maxResults
        };

        // If semantic expansion is enabled, expand all search terms
        if (includeSemanticExpansion) {
            searchCriteria.keywords = this.expandSearchTermsArray(parsedQuery.keywords);
        }

        // Use the unified search with enhanced criteria
        const results = await this.searchImages(searchCriteria);
        
        // Apply additional semantic boosting based on query context
        return this.applySemanticBoosting(results, query, parsedQuery);
    }

    /**
     * Parse negative keywords from a query string
     * @param {string} query - Natural language query
     * @returns {Array} Array of negative keywords
     */
    parseNegativeKeywords(query) {
        const negativeKeywords = [];
        const normalizedQuery = query.toLowerCase();
        
        // Pattern 1: "no X" or "no X words"
        const noPattern = /\bno\s+([^\s,]+(?:\s+[^\s,]+)*?)(?:\s|,|$)/g;
        let match;
        while ((match = noPattern.exec(normalizedQuery)) !== null) {
            negativeKeywords.push(match[1].trim());
        }
        
        // Pattern 2: "without X" or "without X words"
        const withoutPattern = /\bwithout\s+([^\s,]+(?:\s+[^\s,]+)*?)(?:\s|,|$)/g;
        while ((match = withoutPattern.exec(normalizedQuery)) !== null) {
            negativeKeywords.push(match[1].trim());
        }
        
        // Pattern 3: "exclude X" or "excluding X"
        const excludePattern = /\b(?:exclude|excluding)\s+([^\s,]+(?:\s+[^\s,]+)*?)(?:\s|,|$)/g;
        while ((match = excludePattern.exec(normalizedQuery)) !== null) {
            negativeKeywords.push(match[1].trim());
        }
        
        // Pattern 4: "-X" (minus sign prefix)
        const minusPattern = /\s-([^\s,-]+)/g;
        while ((match = minusPattern.exec(normalizedQuery)) !== null) {
            negativeKeywords.push(match[1].trim());
        }
        
        // Pattern 5: "but not X" or "not X"
        const butNotPattern = /\b(?:but\s+)?not\s+([^\s,]+(?:\s+[^\s,]+)*?)(?:\s|,|$)/g;
        while ((match = butNotPattern.exec(normalizedQuery)) !== null) {
            negativeKeywords.push(match[1].trim());
        }
        
        return [...new Set(negativeKeywords)]; // Remove duplicates
    }
    
    /**
     * Remove negative keywords from query string to get clean positive terms
     * @param {string} query - Natural language query
     * @param {Array} negativeKeywords - Array of negative keywords to remove
     * @returns {string} Cleaned query without negative terms
     */
    removeNegativeKeywordsFromQuery(query, negativeKeywords) {
        let cleanQuery = query.toLowerCase();
        
        // Remove negative patterns
        cleanQuery = cleanQuery.replace(/\bno\s+([^\s,]+(?:\s+[^\s,]+)*?)(?:\s|,|$)/g, ' ');
        cleanQuery = cleanQuery.replace(/\bwithout\s+([^\s,]+(?:\s+[^\s,]+)*?)(?:\s|,|$)/g, ' ');
        cleanQuery = cleanQuery.replace(/\b(?:exclude|excluding)\s+([^\s,]+(?:\s+[^\s,]+)*?)(?:\s|,|$)/g, ' ');
        cleanQuery = cleanQuery.replace(/\s-([^\s,-]+)/g, ' ');
        cleanQuery = cleanQuery.replace(/\b(?:but\s+)?not\s+([^\s,]+(?:\s+[^\s,]+)*?)(?:\s|,|$)/g, ' ');
        
        // Clean up extra spaces, commas, and punctuation
        cleanQuery = cleanQuery.replace(/\s+/g, ' ').trim();
        cleanQuery = cleanQuery.replace(/,\s*$/, ''); // Remove trailing commas
        cleanQuery = cleanQuery.replace(/^\s*,\s*/, ''); // Remove leading commas
        cleanQuery = cleanQuery.replace(/\s*,\s*$/, ''); // Remove trailing commas with spaces
        
        return cleanQuery;
    }
    
    /**
     * Expand negative keywords using semantic mappings
     * @param {Array} negativeKeywords - Array of negative keywords
     * @returns {Array} Expanded negative keywords
     */
    expandNegativeKeywords(negativeKeywords) {
        const expandedNegatives = [];
        negativeKeywords.forEach(keyword => {
            const expanded = this.expandSearchTerm(keyword);
            expandedNegatives.push(...expanded);
        });
        return [...new Set(expandedNegatives)]; // Remove duplicates
    }

    /**
     * Parse natural language query into structured search components
     * @param {string} query - Natural language query
     * @returns {Object} Parsed query components
     */
    parseNaturalLanguageQuery(query) {
        // First, extract negative keywords
        const negativeKeywords = this.parseNegativeKeywords(query);
        const expandedNegatives = this.expandNegativeKeywords(negativeKeywords);
        
        // Remove negative keywords from query to get clean positive terms
        const cleanQuery = this.removeNegativeKeywordsFromQuery(query, negativeKeywords);
        const normalizedQuery = cleanQuery.toLowerCase();
        const words = normalizedQuery.split(/\s+/);
        
        const parsedQuery = {
            keywords: [],
            peopleType: null,
            activity: null,
            mood: null,
            location: null,
            albumTerm: null,
            negativeKeywords: negativeKeywords,
            expandedNegatives: expandedNegatives
        };

        // Extract people-related terms (exact matches and partial matches)
        const peopleTerms = ['children', 'kids', 'adults', 'athletes', 'coaches', 'family', 'friends', 'professionals'];
        const foundPeople = words.find(word => 
            peopleTerms.some(term => word === term || (word.length > 3 && term.includes(word)) || (term.length > 3 && word.includes(term)))
        );
        if (foundPeople) parsedQuery.peopleType = foundPeople;

        // Extract mood/emotion terms
        const moodTerms = ['happy', 'celebration', 'excited', 'proud', 'focused', 'relaxed', 'competitive', 'surprised', 'smiling', 'joyful', 'cheerful'];
        const foundMood = words.find(word => 
            moodTerms.some(term => word === term || (word.length > 3 && term.includes(word)) || (term.length > 3 && word.includes(term)))
        );
        if (foundMood) parsedQuery.mood = foundMood;

        // Extract activity terms
        const activityTerms = ['archery', 'sports', 'training', 'competition', 'awards', 'ceremony', 'social', 'learning', 'tournament', 'contest', 'match'];
        const foundActivity = words.find(word => 
            activityTerms.some(term => word === term || (word.length > 4 && term.includes(word)) || (term.length > 4 && word.includes(term)))
        );
        if (foundActivity) parsedQuery.activity = foundActivity;

        // Extract location terms
        const locationTerms = ['outdoor', 'indoor', 'venue', 'natural', 'urban', 'rural', 'formal', 'field', 'range', 'outside', 'inside'];
        const foundLocation = words.find(word => 
            locationTerms.some(term => word === term || (word.length > 3 && term.includes(word)) || (term.length > 3 && word.includes(term)))
        );
        if (foundLocation) parsedQuery.location = foundLocation;

        // Extract remaining words as general keywords (excluding common stop words)
        const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'are', 'is', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should'];
        const keywords = words.filter(word => 
            !stopWords.includes(word) && 
            word !== foundPeople && 
            word !== foundMood && 
            word !== foundActivity && 
            word !== foundLocation &&
            word.length > 2
        );
        
        parsedQuery.keywords = [...new Set(keywords)]; // Remove duplicates

        return parsedQuery;
    }

    /**
     * Expand an array of search terms using semantic mappings
     * @param {Array} keywords - Array of keywords to expand
     * @returns {Array} Expanded keywords array
     */
    expandSearchTermsArray(keywords) {
        const expandedKeywords = [];
        keywords.forEach(keyword => {
            const expanded = this.expandSearchTerm(keyword);
            expandedKeywords.push(...expanded);
        });
        return [...new Set(expandedKeywords)]; // Remove duplicates
    }

    /**
     * Apply semantic boosting to search results based on query context
     * @param {Array} results - Search results
     * @param {string} originalQuery - Original natural language query
     * @param {Object} parsedQuery - Parsed query components
     * @returns {Array} Boosted and re-ranked results
     */
    applySemanticBoosting(results, originalQuery, parsedQuery) {
        const normalizedQuery = originalQuery.toLowerCase();
        
        return results.map(result => {
            let boostScore = 0;
            
            // Boost for multi-concept matches (images that match multiple aspects of the query)
            const conceptMatches = [
                parsedQuery.peopleType,
                parsedQuery.mood,
                parsedQuery.activity,
                parsedQuery.location
            ].filter(concept => concept !== null).length;
            
            if (conceptMatches > 1) {
                boostScore += conceptMatches * 2;
            }
            
            // Boost for phrase matches in description
            const description = (result.description || '').toLowerCase();
            const keywords = (result.keywords || []).join(' ').toLowerCase();
            const fullText = `${description} ${keywords}`;
            
            // Check for phrase proximity (words appearing near each other)
            const queryWords = normalizedQuery.split(/\s+/).filter(word => word.length > 2);
            if (queryWords.length > 1) {
                for (let i = 0; i < queryWords.length - 1; i++) {
                    const phrase = `${queryWords[i]} ${queryWords[i + 1]}`;
                    if (fullText.includes(phrase)) {
                        boostScore += 3;
                    }
                }
            }
            
            // Return result with enhanced score
            return {
                ...result,
                semanticScore: (result.score || 0) + boostScore,
                originalScore: result.score || 0,
                boostScore: boostScore
            };
        })
        .sort((a, b) => b.semanticScore - a.semanticScore); // Re-sort by enhanced score
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
