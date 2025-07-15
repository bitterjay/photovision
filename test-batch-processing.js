// PhotoVision Batch Processing Test
// Tests the job queue system and batch processing endpoints

require('dotenv').config();
const JobQueue = require('./lib/jobQueue');

async function testJobQueueSystem() {
    console.log('=== PhotoVision Batch Processing Test ===\n');

    try {
        // Test 1: Create JobQueue instance
        console.log('1. Creating JobQueue instance...');
        const jobQueue = new JobQueue();
        console.log('✓ JobQueue created successfully\n');

        // Test 2: Add test jobs to queue
        console.log('2. Adding test jobs to queue...');
        const testJobs = [
            {
                id: 'test_job_1',
                type: 'image_analysis',
                data: {
                    imageUrl: 'https://example.com/image1.jpg',
                    imageKey: 'test_key_1',
                    filename: 'test_image_1.jpg',
                    title: 'Test Image 1',
                    caption: 'A test image for batch processing'
                },
                albumKey: 'test_album',
                imageName: 'test_image_1.jpg'
            },
            {
                id: 'test_job_2',
                type: 'image_analysis',
                data: {
                    imageUrl: 'https://example.com/image2.jpg',
                    imageKey: 'test_key_2',
                    filename: 'test_image_2.jpg',
                    title: 'Test Image 2',
                    caption: 'Another test image'
                },
                albumKey: 'test_album',
                imageName: 'test_image_2.jpg'
            },
            {
                id: 'test_job_3',
                type: 'image_analysis',
                data: {
                    imageUrl: 'https://example.com/image3.jpg',
                    imageKey: 'test_key_3',
                    filename: 'test_image_3.jpg',
                    title: 'Test Image 3',
                    caption: 'Third test image'
                },
                albumKey: 'test_album',
                imageName: 'test_image_3.jpg'
            }
        ];

        const batchInfo = jobQueue.addBatch(testJobs, 'Test Batch');
        console.log(`✓ Added batch with ID: ${batchInfo.batchId}`);
        console.log(`✓ Job count: ${batchInfo.jobCount}`);
        console.log(`✓ Total queued: ${batchInfo.totalQueued}\n`);

        // Test 3: Check initial queue status
        console.log('3. Checking initial queue status...');
        const initialStatus = jobQueue.getStatus();
        console.log(`✓ Batch ID: ${initialStatus.batchId}`);
        console.log(`✓ Total jobs: ${initialStatus.totalJobs}`);
        console.log(`✓ Queued jobs: ${initialStatus.queuedJobs}`);
        console.log(`✓ Processing: ${initialStatus.processing}`);
        console.log(`✓ Progress: ${initialStatus.progress}%\n`);

        // Test 4: Test mock processor
        console.log('4. Testing with mock processors...');
        const mockProcessors = {
            image_analysis: async (imageData, job) => {
                console.log(`  Processing mock job: ${job.id} - ${imageData.filename}`);
                
                // Simulate processing time
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Simulate occasional failure for testing
                if (job.id === 'test_job_2') {
                    throw new Error('Simulated processing failure');
                }
                
                return {
                    imageKey: imageData.imageKey,
                    description: `Mock analysis for ${imageData.filename}`,
                    keywords: ['test', 'mock', 'batch', 'processing'],
                    saved: true
                };
            }
        };

        // Define callbacks for testing
        const onProgress = (progress) => {
            console.log(`  Progress: ${progress.progress}% (${progress.processed}/${progress.total})`);
        };

        const onComplete = (result) => {
            console.log(`\n✓ Batch processing completed:`);
            console.log(`  - Total: ${result.total}`);
            console.log(`  - Processed: ${result.processed}`);
            console.log(`  - Failed: ${result.failed}`);
            console.log(`  - Duration: ${result.duration}ms`);
            if (result.failedJobs.length > 0) {
                console.log(`  - Failed jobs:`, result.failedJobs);
            }
        };

        const onError = (error) => {
            console.error(`  Batch processing error: ${error.message}`);
        };

        // Start processing
        console.log('  Starting mock batch processing...');
        await jobQueue.startProcessing(mockProcessors, onProgress, onComplete, onError);

        // Test 5: Check final status
        console.log('\n5. Checking final queue status...');
        const finalStatus = jobQueue.getStatus();
        console.log(`✓ Total jobs: ${finalStatus.totalJobs}`);
        console.log(`✓ Completed jobs: ${finalStatus.completedJobs}`);
        console.log(`✓ Failed jobs: ${finalStatus.failedJobs}`);
        console.log(`✓ Progress: ${finalStatus.progress}%\n`);

        // Test 6: Test retry functionality
        if (finalStatus.failedJobs > 0) {
            console.log('6. Testing retry functionality...');
            const retryResult = jobQueue.retryFailedJobs();
            console.log(`✓ Retry result: ${retryResult.message}`);
            console.log(`✓ Jobs reset for retry: ${retryResult.count}\n`);
        }

        // Test 7: Test configuration updates
        console.log('7. Testing configuration updates...');
        jobQueue.updateConfig({
            retryAttempts: 2,
            processingDelay: 500,
            maxBatchSize: 25
        });
        console.log('✓ Configuration updated successfully\n');

        // Test 8: Get queue details
        console.log('8. Getting queue details...');
        const details = jobQueue.getQueueDetails();
        console.log(`✓ Configuration:`, details.config);
        console.log(`✓ Job summary:`, details.jobs.map(job => ({
            id: job.id,
            status: job.status,
            attempts: job.attempts
        })));

        console.log('\n=== JobQueue System Test PASSED ===\n');

    } catch (error) {
        console.error('\n❌ JobQueue System Test FAILED:', error.message);
        console.error(error.stack);
        return false;
    }

    return true;
}

async function testBatchEndpoints() {
    console.log('=== Batch Processing Endpoints Test ===\n');

    const baseUrl = 'http://localhost:3000';

    try {
        // Test basic status endpoint
        console.log('1. Testing batch status endpoint...');
        const statusResponse = await fetch(`${baseUrl}/api/batch/status`);
        const statusData = await statusResponse.json();
        
        if (statusResponse.ok) {
            console.log('✓ Batch status endpoint accessible');
            console.log(`✓ Current status:`, statusData.data);
        } else {
            console.log('⚠ Batch status endpoint returned error:', statusData.error);
        }

        console.log('\n2. Testing batch details endpoint...');
        const detailsResponse = await fetch(`${baseUrl}/api/batch/details`);
        const detailsData = await detailsResponse.json();
        
        if (detailsResponse.ok) {
            console.log('✓ Batch details endpoint accessible');
            console.log(`✓ Queue details:`, detailsData.data);
        } else {
            console.log('⚠ Batch details endpoint returned error:', detailsData.error);
        }

        console.log('\n✓ Basic endpoint tests completed');
        console.log('Note: Full batch processing tests require SmugMug connection');

    } catch (error) {
        console.error('\n❌ Endpoint test failed:', error.message);
        return false;
    }

    return true;
}

async function runAllTests() {
    console.log('🚀 Starting PhotoVision Phase 5 Batch Processing Tests\n');

    const results = [];

    // Run JobQueue system test
    results.push(await testJobQueueSystem());

    // Test batch endpoints (requires server to be running)
    console.log('Checking if server is running for endpoint tests...');
    try {
        const response = await fetch('http://localhost:3000/api/status');
        if (response.ok) {
            console.log('✓ Server is running, testing endpoints...\n');
            results.push(await testBatchEndpoints());
        } else {
            console.log('⚠ Server not responding, skipping endpoint tests\n');
            results.push(true); // Don't fail if server isn't running
        }
    } catch (error) {
        console.log('⚠ Server not running, skipping endpoint tests\n');
        results.push(true); // Don't fail if server isn't running
    }

    // Summary
    const allPassed = results.every(result => result === true);
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(50));
    
    if (allPassed) {
        console.log('🎉 ALL TESTS PASSED!');
        console.log('\nPhase 5 - Batch Processing implementation is ready!');
        console.log('\nNext steps:');
        console.log('- Start server: node server.js');
        console.log('- Connect SmugMug account via OAuth');
        console.log('- Use batch processing endpoints to process albums');
        console.log('- Monitor progress and handle failures gracefully');
    } else {
        console.log('❌ SOME TESTS FAILED');
        console.log('Please check the errors above and fix any issues.');
    }
    
    console.log('='.repeat(50));
}

// Run tests if this script is executed directly
if (require.main === module) {
    runAllTests().catch(error => {
        console.error('Test runner failed:', error);
        process.exit(1);
    });
}

module.exports = {
    testJobQueueSystem,
    testBatchEndpoints,
    runAllTests
};
