// Test script to verify album information is preserved in job queue processing
// This confirms the fix for the "missing required album information" error

require('dotenv').config();
const JobQueue = require('./lib/jobQueue');

async function testAlbumInfoPreservation() {
    console.log('=== TESTING ALBUM INFO PRESERVATION IN JOB QUEUE ===');
    
    try {
        const jobQueue = new JobQueue();
        
        // Create test jobs with album information (simulating what server.js creates)
        const testJobs = [
            {
                id: 'test_job_1',
                type: 'image_analysis',
                data: { 
                    imageUrl: 'https://example.com/image1.jpg',
                    imageName: 'test_image_1.jpg'
                },
                albumKey: 'ABC123',
                albumName: 'Test Album',
                albumPath: '2025 > Test Event > Test Album',
                albumHierarchy: ['2025', 'Test Event', 'Test Album'],
                imageName: 'test_image_1.jpg'
            },
            {
                id: 'test_job_2', 
                type: 'image_analysis',
                data: {
                    imageUrl: 'https://example.com/image2.jpg',
                    imageName: 'test_image_2.jpg'
                },
                albumKey: 'XYZ789',
                albumName: 'Another Album',
                albumPath: '2025 > Different Event > Another Album',
                albumHierarchy: ['2025', 'Different Event', 'Another Album'],
                imageName: 'test_image_2.jpg'
            }
        ];
        
        console.log('\n1. Adding jobs to queue...');
        console.log('Input jobs have album info:', testJobs.map(job => ({
            id: job.id,
            albumName: job.albumName,
            albumPath: job.albumPath,
            albumHierarchy: job.albumHierarchy ? JSON.stringify(job.albumHierarchy) : 'null'
        })));
        
        // Add jobs to queue
        const batchResult = jobQueue.addBatch(testJobs, 'Album Info Test Batch');
        console.log(`\n✅ Added batch: ${batchResult.batchId} with ${batchResult.jobCount} jobs`);
        
        // Check what's actually in the queue
        console.log('\n2. Checking jobs in queue...');
        const queueDetails = jobQueue.getQueueDetails();
        const queuedJobs = queueDetails.jobs;
        
        let allJobsHaveAlbumInfo = true;
        
        queuedJobs.forEach(job => {
            const queueJob = jobQueue.jobs.find(j => j.id === job.id);
            console.log(`\nJob ${job.id}:`);
            console.log(`  - albumKey: ${queueJob.albumKey || 'MISSING'}`);
            console.log(`  - albumName: ${queueJob.albumName || 'MISSING'}`);
            console.log(`  - albumPath: ${queueJob.albumPath || 'MISSING'}`);
            console.log(`  - albumHierarchy: ${queueJob.albumHierarchy ? JSON.stringify(queueJob.albumHierarchy) : 'MISSING'}`);
            
            // Validate required fields
            if (!queueJob.albumKey || !queueJob.albumName || !queueJob.albumPath || !queueJob.albumHierarchy) {
                console.log(`  ❌ Missing album information!`);
                allJobsHaveAlbumInfo = false;
            } else {
                console.log(`  ✅ Has complete album information`);
            }
        });
        
        console.log('\n3. Test Results:');
        if (allJobsHaveAlbumInfo) {
            console.log('✅ SUCCESS: All jobs in queue have complete album information');
            console.log('✅ The "missing required album information" error should be fixed');
        } else {
            console.log('❌ FAILURE: Some jobs are missing album information');
            console.log('❌ The fix did not work as expected');
        }
        
        // Test the server validation logic
        console.log('\n4. Testing server validation logic...');
        queuedJobs.forEach(job => {
            const queueJob = jobQueue.jobs.find(j => j.id === job.id);
            
            // This is the same validation logic from server.js lines 744-757
            if (!queueJob.albumKey || !queueJob.albumName || !queueJob.albumPath || !queueJob.albumHierarchy) {
                const missingFields = [];
                if (!queueJob.albumKey) missingFields.push('albumKey');
                if (!queueJob.albumName) missingFields.push('albumName');
                if (!queueJob.albumPath) missingFields.push('albumPath');
                if (!queueJob.albumHierarchy) missingFields.push('albumHierarchy');
                
                console.log(`❌ Job ${queueJob.id} would fail validation: missing ${missingFields.join(', ')}`);
            } else {
                console.log(`✅ Job ${queueJob.id} would pass server validation`);
            }
        });
        
        console.log('\n=== TEST COMPLETE ===');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Full error:', error);
    }
}

// Run the test
if (require.main === module) {
    testAlbumInfoPreservation()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Script failed:', error);
            process.exit(1);
        });
}

module.exports = { testAlbumInfoPreservation };
