// PhotoVision Job Queue System
// Handles batch processing of SmugMug images with Claude AI analysis

class JobQueue {
    constructor() {
        this.jobs = [];
        this.processing = false;
        this.currentJob = null;
        this.processedCount = 0;
        this.failedCount = 0;
        this.failedJobs = [];
        this.batchId = null;
        this.startTime = null;
        this.completionCallback = null;
        this.progressCallback = null;
        this.errorCallback = null;
        
        // Processing configuration
        this.config = {
            concurrency: 1, // Process one at a time to respect API limits
            retryAttempts: 3,
            retryDelay: 2000, // 2 seconds
            processingDelay: 1000, // 1 second between jobs to respect rate limits
            maxBatchSize: 100 // Maximum jobs in a single batch
        };
    }

    /**
     * Add jobs to the queue
     * @param {Array} jobs Array of job objects with {id, type, data, albumKey?, imageName?}
     * @param {String} batchName Optional name for the batch
     * @returns {String} Batch ID
     */
    addBatch(jobs, batchName = null) {
        if (!Array.isArray(jobs) || jobs.length === 0) {
            throw new Error('Jobs must be a non-empty array');
        }

        if (jobs.length > this.config.maxBatchSize) {
            throw new Error(`Batch size cannot exceed ${this.config.maxBatchSize} jobs`);
        }

        // Generate batch ID
        this.batchId = this.generateBatchId();
        this.startTime = new Date();

        // Prepare jobs with metadata
        const preparedJobs = jobs.map((job, index) => ({
            id: job.id || `job_${this.batchId}_${index}`,
            batchId: this.batchId,
            type: job.type || 'image_analysis',
            data: job.data,
            albumKey: job.albumKey || null,
            albumName: job.albumName || null,        // PRESERVE album name
            albumPath: job.albumPath || null,        // PRESERVE album path
            albumHierarchy: job.albumHierarchy || null, // PRESERVE album hierarchy
            imageName: job.imageName || `image_${index}`,
            status: 'queued',
            attempts: 0,
            error: null,
            result: null,
            startTime: null,
            endTime: null,
            duration: null
        }));

        // Add jobs to queue
        this.jobs.push(...preparedJobs);

        console.log(`[JobQueue] Added batch ${this.batchId} with ${jobs.length} jobs`);
        console.log(`[JobQueue] Queue now has ${this.jobs.length} total jobs`);

        return {
            batchId: this.batchId,
            batchName: batchName,
            jobCount: jobs.length,
            totalQueued: this.jobs.length
        };
    }

    /**
     * Start processing the queue
     * @param {Object} processors Object containing processing functions
     * @param {Function} onProgress Progress callback
     * @param {Function} onComplete Completion callback
     * @param {Function} onError Error callback
     */
    async startProcessing(processors, onProgress = null, onComplete = null, onError = null) {
        if (this.processing) {
            throw new Error('Queue is already processing');
        }

        if (this.jobs.length === 0) {
            throw new Error('No jobs in queue to process');
        }

        if (!processors || typeof processors.image_analysis !== 'function') {
            throw new Error('Image analysis processor function is required');
        }

        this.processing = true;
        this.processedCount = 0;
        this.failedCount = 0;
        this.failedJobs = [];
        this.progressCallback = onProgress;
        this.completionCallback = onComplete;
        this.errorCallback = onError;

        console.log(`[JobQueue] Starting processing of ${this.jobs.length} jobs`);

        try {
            await this.processJobs(processors);
        } catch (error) {
            console.error('[JobQueue] Processing error:', error);
            this.processing = false;
            if (this.errorCallback) {
                this.errorCallback(error);
            }
        }
    }

    /**
     * Process jobs sequentially
     */
    async processJobs(processors) {
        for (let i = 0; i < this.jobs.length; i++) {
            const job = this.jobs[i];
            
            if (job.status === 'completed' || job.status === 'failed') {
                continue; // Skip already processed jobs
            }

            if (!this.processing) {
                console.log('[JobQueue] Processing stopped by user');
                break;
            }

            this.currentJob = job;
            await this.processJob(job, processors);
            
            // Progress callback
            if (this.progressCallback) {
                this.progressCallback({
                    current: this.processedCount + this.failedCount,
                    total: this.jobs.length,
                    processed: this.processedCount,
                    failed: this.failedCount,
                    currentJob: job,
                    batchId: this.batchId,
                    progress: Math.round(((this.processedCount + this.failedCount) / this.jobs.length) * 100)
                });
            }

            // Delay between jobs to respect rate limits
            if (i < this.jobs.length - 1 && this.processing) {
                await this.delay(this.config.processingDelay);
            }
        }

        this.processing = false;
        this.currentJob = null;

        // Completion callback
        if (this.completionCallback) {
            this.completionCallback({
                batchId: this.batchId,
                total: this.jobs.length,
                processed: this.processedCount,
                failed: this.failedCount,
                failedJobs: this.failedJobs,
                duration: Date.now() - this.startTime.getTime()
            });
        }

        console.log(`[JobQueue] Batch ${this.batchId} completed: ${this.processedCount} processed, ${this.failedCount} failed`);
    }

    /**
     * Process a single job with retry logic
     */
    async processJob(job, processors) {
        const maxAttempts = this.config.retryAttempts;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                job.attempts = attempt;
                job.status = 'processing';
                job.startTime = new Date();

                console.log(`[JobQueue] Processing job ${job.id} (attempt ${attempt}/${maxAttempts}): ${job.imageName}`);

                // Get the appropriate processor
                const processor = processors[job.type];
                if (!processor) {
                    throw new Error(`No processor found for job type: ${job.type}`);
                }

                // Process the job
                const result = await processor(job.data, job);
                
                // Job succeeded
                job.status = 'completed';
                job.result = result;
                job.endTime = new Date();
                job.duration = job.endTime.getTime() - job.startTime.getTime();
                job.error = null;
                
                this.processedCount++;
                console.log(`[JobQueue] Job ${job.id} completed successfully`);
                break;

            } catch (error) {
                console.error(`[JobQueue] Job ${job.id} attempt ${attempt} failed:`, error.message);
                
                job.error = {
                    message: error.message,
                    attempt: attempt,
                    timestamp: new Date().toISOString()
                };

                if (attempt >= maxAttempts) {
                    // All attempts failed
                    job.status = 'failed';
                    job.endTime = new Date();
                    job.duration = job.endTime.getTime() - job.startTime.getTime();
                    
                    this.failedCount++;
                    this.failedJobs.push({
                        id: job.id,
                        imageName: job.imageName,
                        error: job.error,
                        attempts: job.attempts
                    });
                    
                    console.log(`[JobQueue] Job ${job.id} failed after ${maxAttempts} attempts`);
                } else {
                    // Retry after delay
                    await this.delay(this.config.retryDelay);
                }
            }
        }
    }

    /**
     * Pause processing
     */
    pause() {
        if (this.processing) {
            this.processing = false;
            console.log('[JobQueue] Processing paused');
            return true;
        }
        return false;
    }

    /**
     * Resume processing
     */
    async resume(processors) {
        if (!this.processing && this.jobs.length > 0) {
            console.log('[JobQueue] Resuming processing');
            await this.startProcessing(processors, this.progressCallback, this.completionCallback, this.errorCallback);
            return true;
        }
        return false;
    }

    /**
     * Cancel all processing and clear queue
     */
    cancel() {
        this.processing = false;
        this.currentJob = null;
        console.log(`[JobQueue] Cancelled processing. Clearing ${this.jobs.length} jobs`);
        this.jobs = [];
        this.processedCount = 0;
        this.failedCount = 0;
        this.failedJobs = [];
    }

    /**
     * Retry failed jobs
     */
    retryFailedJobs() {
        const failedJobs = this.jobs.filter(job => job.status === 'failed');
        
        if (failedJobs.length === 0) {
            return { message: 'No failed jobs to retry', count: 0 };
        }

        // Reset failed jobs to queued status
        failedJobs.forEach(job => {
            job.status = 'queued';
            job.attempts = 0;
            job.error = null;
            job.result = null;
            job.startTime = null;
            job.endTime = null;
            job.duration = null;
        });

        // Reset counters
        this.failedCount = 0;
        this.failedJobs = [];

        console.log(`[JobQueue] Reset ${failedJobs.length} failed jobs for retry`);
        
        return { 
            message: `${failedJobs.length} failed jobs reset for retry`,
            count: failedJobs.length 
        };
    }

    /**
     * Get current queue status
     */
    getStatus() {
        const totalJobs = this.jobs.length;
        const queuedJobs = this.jobs.filter(job => job.status === 'queued').length;
        const processingJobs = this.jobs.filter(job => job.status === 'processing').length;
        const completedJobs = this.jobs.filter(job => job.status === 'completed').length;
        const failedJobs = this.jobs.filter(job => job.status === 'failed').length;

        return {
            batchId: this.batchId,
            processing: this.processing,
            currentJob: this.currentJob,
            totalJobs,
            queuedJobs,
            processingJobs,
            completedJobs,
            failedJobs,
            processedCount: this.processedCount,
            failedCount: this.failedCount,
            progress: totalJobs > 0 ? Math.round((completedJobs + failedJobs) / totalJobs * 100) : 0,
            startTime: this.startTime,
            estimatedCompletion: this.getEstimatedCompletion(),
            failedJobDetails: this.failedJobs
        };
    }

    /**
     * Get queue details for debugging
     */
    getQueueDetails() {
        return {
            config: this.config,
            jobs: this.jobs.map(job => ({
                id: job.id,
                imageName: job.imageName,
                status: job.status,
                attempts: job.attempts,
                duration: job.duration,
                error: job.error ? job.error.message : null
            }))
        };
    }

    /**
     * Estimate completion time
     */
    getEstimatedCompletion() {
        if (!this.processing || !this.startTime || this.processedCount === 0) {
            return null;
        }

        const elapsed = Date.now() - this.startTime.getTime();
        const avgTimePerJob = elapsed / (this.processedCount + this.failedCount);
        const remainingJobs = this.jobs.filter(job => job.status === 'queued').length;
        const estimatedRemainingTime = remainingJobs * avgTimePerJob;

        return new Date(Date.now() + estimatedRemainingTime);
    }

    /**
     * Generate unique batch ID
     */
    generateBatchId() {
        return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Delay utility
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Update processing configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('[JobQueue] Configuration updated:', this.config);
    }
}

module.exports = JobQueue;
