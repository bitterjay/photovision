// PhotoVision Batch Manager
// Manages multiple concurrent batch processing jobs

const JobQueue = require('./jobQueue');
const RateLimiter = require('./rateLimiter');

class BatchManager {
    constructor(config = {}) {
        // Configuration
        this.config = {
            maxConcurrentBatches: config.maxConcurrentBatches || 3,
            globalApiRateLimit: config.globalApiRateLimit || 10, // API calls per minute
            perBatchConcurrency: config.perBatchConcurrency || 1,
            ...config
        };
        
        // Initialize rate limiter
        // Convert per-minute rate to per-second for the rate limiter
        const tokensPerSecond = this.config.globalApiRateLimit / 60;
        this.rateLimiter = new RateLimiter({
            maxTokens: Math.max(10, Math.floor(this.config.globalApiRateLimit / 6)), // 10 second buffer
            refillRate: tokensPerSecond,
            maxConcurrent: this.config.maxConcurrentBatches
        });
        
        // Active batches map: batchId -> JobQueue instance
        this.activeBatches = new Map();
        
        // Batch metadata map: batchId -> metadata
        this.batchMetadata = new Map();
        
        console.log('[BatchManager] Initialized with config:', this.config);
    }
    
    /**
     * Create a new batch
     * @param {Array} jobs Array of jobs to process
     * @param {string} batchName Name of the batch
     * @param {Object} options Additional options
     * @returns {Object} Batch information
     */
    createBatch(jobs, batchName, options = {}) {
        // Check if we've reached max concurrent batches
        if (this.activeBatches.size >= this.config.maxConcurrentBatches) {
            throw new Error(`Maximum concurrent batches (${this.config.maxConcurrentBatches}) reached`);
        }
        
        // Create new JobQueue instance with rate limiter
        const jobQueue = new JobQueue(this.rateLimiter);
        
        // Add batch to queue
        const batchInfo = jobQueue.addBatch(jobs, batchName, options.duplicateStatistics);
        
        // Store the queue instance
        this.activeBatches.set(batchInfo.batchId, jobQueue);
        
        // Store metadata
        this.batchMetadata.set(batchInfo.batchId, {
            name: batchName,
            createdAt: new Date(),
            albumKey: options.albumKey,
            albumHierarchy: options.albumHierarchy,
            totalJobs: jobs.length,
            status: 'queued'
        });
        
        console.log(`[BatchManager] Created batch ${batchInfo.batchId} with ${jobs.length} jobs`);
        
        return batchInfo;
    }
    
    /**
     * Start processing a specific batch
     * @param {string} batchId Batch ID to start
     * @param {Object} processors Processing functions
     * @param {Function} onProgress Progress callback
     * @param {Function} onComplete Completion callback
     * @param {Function} onError Error callback
     */
    async startBatch(batchId, processors, onProgress, onComplete, onError) {
        const jobQueue = this.activeBatches.get(batchId);
        
        if (!jobQueue) {
            throw new Error(`Batch ${batchId} not found`);
        }
        
        // Update metadata status
        const metadata = this.batchMetadata.get(batchId);
        if (metadata) {
            metadata.status = 'processing';
            metadata.startedAt = new Date();
        }
        
        // Wrap callbacks to clean up on completion
        const wrappedOnComplete = (result) => {
            // Update metadata
            if (metadata) {
                metadata.status = 'completed';
                metadata.completedAt = new Date();
            }
            
            // Call original callback
            if (onComplete) {
                onComplete(result);
            }
            
            // Schedule cleanup after a delay (keep for UI updates)
            setTimeout(() => {
                this.removeBatch(batchId);
            }, 30000); // Keep for 30 seconds after completion
        };
        
        const wrappedOnError = (error) => {
            // Update metadata
            if (metadata) {
                metadata.status = 'failed';
                metadata.error = error.message;
            }
            
            // Call original callback
            if (onError) {
                onError(error);
            }
        };
        
        // Start processing
        await jobQueue.startProcessing(processors, onProgress, wrappedOnComplete, wrappedOnError);
    }
    
    /**
     * Get status of all active batches
     * @returns {Array} Array of batch statuses
     */
    getAllStatuses() {
        const statuses = [];
        
        for (const [batchId, jobQueue] of this.activeBatches) {
            const status = jobQueue.getStatus();
            const metadata = this.batchMetadata.get(batchId);
            
            statuses.push({
                ...status,
                batchId: batchId,
                name: metadata?.name || 'Unknown',
                albumKey: metadata?.albumKey,
                albumHierarchy: metadata?.albumHierarchy,
                createdAt: metadata?.createdAt,
                startedAt: metadata?.startedAt,
                completedAt: metadata?.completedAt,
                status: metadata?.status || 'unknown'
            });
        }
        
        // Sort by creation time (newest first)
        statuses.sort((a, b) => {
            const timeA = a.createdAt?.getTime() || 0;
            const timeB = b.createdAt?.getTime() || 0;
            return timeB - timeA;
        });
        
        return statuses;
    }
    
    /**
     * Get status of a specific batch
     * @param {string} batchId Batch ID
     * @returns {Object} Batch status
     */
    getBatchStatus(batchId) {
        const jobQueue = this.activeBatches.get(batchId);
        
        if (!jobQueue) {
            return null;
        }
        
        const status = jobQueue.getStatus();
        const metadata = this.batchMetadata.get(batchId);
        
        return {
            ...status,
            batchId: batchId,
            name: metadata?.name || 'Unknown',
            albumKey: metadata?.albumKey,
            albumHierarchy: metadata?.albumHierarchy,
            createdAt: metadata?.createdAt,
            startedAt: metadata?.startedAt,
            completedAt: metadata?.completedAt,
            status: metadata?.status || 'unknown'
        };
    }
    
    /**
     * Pause a specific batch
     * @param {string} batchId Batch ID to pause
     * @returns {boolean} Success status
     */
    pauseBatch(batchId) {
        const jobQueue = this.activeBatches.get(batchId);
        
        if (!jobQueue) {
            throw new Error(`Batch ${batchId} not found`);
        }
        
        const result = jobQueue.pause();
        
        // Update metadata
        const metadata = this.batchMetadata.get(batchId);
        if (metadata && result) {
            metadata.status = 'paused';
        }
        
        return result;
    }
    
    /**
     * Resume a specific batch
     * @param {string} batchId Batch ID to resume
     * @param {Object} processors Processing functions
     * @returns {boolean} Success status
     */
    async resumeBatch(batchId, processors) {
        const jobQueue = this.activeBatches.get(batchId);
        
        if (!jobQueue) {
            throw new Error(`Batch ${batchId} not found`);
        }
        
        const result = await jobQueue.resume(processors);
        
        // Update metadata
        const metadata = this.batchMetadata.get(batchId);
        if (metadata && result) {
            metadata.status = 'processing';
        }
        
        return result;
    }
    
    /**
     * Cancel a specific batch
     * @param {string} batchId Batch ID to cancel
     */
    cancelBatch(batchId) {
        const jobQueue = this.activeBatches.get(batchId);
        
        if (!jobQueue) {
            throw new Error(`Batch ${batchId} not found`);
        }
        
        jobQueue.cancel();
        
        // Remove from active batches
        this.removeBatch(batchId);
    }
    
    /**
     * Cancel all active batches
     */
    cancelAllBatches() {
        console.log(`[BatchManager] Canceling all ${this.activeBatches.size} active batches`);
        
        for (const [batchId, jobQueue] of this.activeBatches) {
            jobQueue.cancel();
        }
        
        // Clear all batches
        this.activeBatches.clear();
        this.batchMetadata.clear();
        
        // Clear rate limiter queue
        this.rateLimiter.clearQueue();
    }
    
    /**
     * Retry failed jobs in a batch
     * @param {string} batchId Batch ID
     * @returns {Object} Retry result
     */
    retryFailedJobs(batchId) {
        const jobQueue = this.activeBatches.get(batchId);
        
        if (!jobQueue) {
            throw new Error(`Batch ${batchId} not found`);
        }
        
        return jobQueue.retryFailedJobs();
    }
    
    /**
     * Get detailed information about a batch
     * @param {string} batchId Batch ID
     * @returns {Object} Batch details
     */
    getBatchDetails(batchId) {
        const jobQueue = this.activeBatches.get(batchId);
        
        if (!jobQueue) {
            return null;
        }
        
        return jobQueue.getQueueDetails();
    }
    
    /**
     * Remove a batch from active batches
     * @param {string} batchId Batch ID to remove
     */
    removeBatch(batchId) {
        this.activeBatches.delete(batchId);
        this.batchMetadata.delete(batchId);
        console.log(`[BatchManager] Removed batch ${batchId}`);
    }
    
    /**
     * Get rate limiter status
     * @returns {Object} Rate limiter status
     */
    getRateLimiterStatus() {
        return this.rateLimiter.getStatus();
    }
    
    /**
     * Update configuration
     * @param {Object} newConfig New configuration values
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        
        // Update rate limiter if needed
        if (newConfig.globalApiRateLimit) {
            const tokensPerSecond = newConfig.globalApiRateLimit / 60;
            this.rateLimiter.updateConfig({
                maxTokens: Math.max(10, Math.floor(newConfig.globalApiRateLimit / 6)),
                refillRate: tokensPerSecond
            });
        }
        
        if (newConfig.maxConcurrentBatches) {
            this.rateLimiter.updateConfig({
                maxConcurrent: newConfig.maxConcurrentBatches
            });
        }
        
        console.log('[BatchManager] Configuration updated:', this.config);
    }
    
    /**
     * Get manager statistics
     * @returns {Object} Statistics
     */
    getStatistics() {
        let totalJobs = 0;
        let totalProcessed = 0;
        let totalFailed = 0;
        
        for (const jobQueue of this.activeBatches.values()) {
            const status = jobQueue.getStatus();
            totalJobs += status.totalJobs;
            totalProcessed += status.processedCount;
            totalFailed += status.failedCount;
        }
        
        return {
            activeBatches: this.activeBatches.size,
            maxBatches: this.config.maxConcurrentBatches,
            totalJobs,
            totalProcessed,
            totalFailed,
            rateLimiter: this.getRateLimiterStatus()
        };
    }
}

module.exports = BatchManager;