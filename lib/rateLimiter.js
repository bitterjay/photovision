// PhotoVision Global Rate Limiter
// Manages API rate limiting across multiple batch processes

class RateLimiter {
    constructor(config = {}) {
        // Configuration with defaults
        this.config = {
            maxTokens: config.maxTokens || 10,          // Maximum tokens in bucket
            refillRate: config.refillRate || 2,         // Tokens per second
            maxConcurrent: config.maxConcurrent || 3,   // Max concurrent API calls
            ...config
        };
        
        // Token bucket implementation
        this.tokens = this.config.maxTokens;
        this.lastRefill = Date.now();
        
        // Track concurrent requests
        this.activeRequests = 0;
        
        // Queue for waiting requests
        this.waitingQueue = [];
        
        // Start token refill timer
        this.startRefillTimer();
        
        console.log('[RateLimiter] Initialized with config:', this.config);
    }
    
    /**
     * Start the token refill timer
     */
    startRefillTimer() {
        setInterval(() => {
            this.refillTokens();
        }, 1000); // Refill every second
    }
    
    /**
     * Refill tokens based on elapsed time
     */
    refillTokens() {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000; // Convert to seconds
        const tokensToAdd = elapsed * this.config.refillRate;
        
        this.tokens = Math.min(this.config.maxTokens, this.tokens + tokensToAdd);
        this.lastRefill = now;
        
        // Process waiting queue if we have tokens
        this.processWaitingQueue();
    }
    
    /**
     * Request permission to make an API call
     * @returns {Promise<boolean>} Resolves when permission is granted
     */
    async requestPermission() {
        return new Promise((resolve) => {
            // Check if we can proceed immediately
            if (this.canProceed()) {
                this.consumeToken();
                resolve(true);
            } else {
                // Add to waiting queue
                this.waitingQueue.push(resolve);
                console.log(`[RateLimiter] Request queued. Queue size: ${this.waitingQueue.length}`);
            }
        });
    }
    
    /**
     * Check if a request can proceed
     * @returns {boolean}
     */
    canProceed() {
        // Refill tokens first
        this.refillTokens();
        
        // Check both token availability and concurrent limit
        return this.tokens >= 1 && this.activeRequests < this.config.maxConcurrent;
    }
    
    /**
     * Consume a token and increment active requests
     */
    consumeToken() {
        this.tokens -= 1;
        this.activeRequests += 1;
        console.log(`[RateLimiter] Token consumed. Remaining: ${Math.floor(this.tokens)}, Active: ${this.activeRequests}`);
    }
    
    /**
     * Release an active request slot
     */
    releaseRequest() {
        this.activeRequests = Math.max(0, this.activeRequests - 1);
        console.log(`[RateLimiter] Request released. Active: ${this.activeRequests}`);
        
        // Process waiting queue
        this.processWaitingQueue();
    }
    
    /**
     * Process waiting requests in the queue
     */
    processWaitingQueue() {
        while (this.waitingQueue.length > 0 && this.canProceed()) {
            const resolve = this.waitingQueue.shift();
            this.consumeToken();
            resolve(true);
            console.log(`[RateLimiter] Processed queued request. Queue size: ${this.waitingQueue.length}`);
        }
    }
    
    /**
     * Get current limiter status
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            tokens: Math.floor(this.tokens),
            maxTokens: this.config.maxTokens,
            activeRequests: this.activeRequests,
            maxConcurrent: this.config.maxConcurrent,
            queueLength: this.waitingQueue.length,
            refillRate: this.config.refillRate
        };
    }
    
    /**
     * Update configuration
     * @param {Object} newConfig New configuration values
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        
        // Adjust current tokens if max changed
        if (this.tokens > this.config.maxTokens) {
            this.tokens = this.config.maxTokens;
        }
        
        console.log('[RateLimiter] Configuration updated:', this.config);
    }
    
    /**
     * Wrapper for rate-limited async operations
     * @param {Function} operation Async function to execute
     * @returns {Promise} Result of the operation
     */
    async execute(operation) {
        try {
            // Wait for permission
            await this.requestPermission();
            
            // Execute the operation
            const result = await operation();
            
            return result;
        } finally {
            // Always release the request slot
            this.releaseRequest();
        }
    }
    
    /**
     * Clear all waiting requests (used when canceling batches)
     */
    clearQueue() {
        const queueSize = this.waitingQueue.length;
        this.waitingQueue = [];
        console.log(`[RateLimiter] Cleared ${queueSize} waiting requests`);
    }
}

module.exports = RateLimiter;