// Test script for concurrent batch processing
const http = require('http');

// Helper function to make API requests
function makeRequest(path, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3001,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    reject(new Error(`Failed to parse response: ${body}`));
                }
            });
        });

        req.on('error', reject);
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

// Test concurrent batch processing
async function testConcurrentBatches() {
    console.log('=== Testing Concurrent Batch Processing ===\n');

    try {
        // Get available albums
        console.log('1. Fetching available albums...');
        const albumsResponse = await makeRequest('/api/smugmug/albums?page=1&per_page=5');
        
        if (!albumsResponse.success || !albumsResponse.data.albums || albumsResponse.data.albums.length < 2) {
            console.error('Not enough albums available for testing');
            return;
        }

        const albums = albumsResponse.data.albums.slice(0, 3); // Get first 3 albums
        console.log(`Found ${albums.length} albums for testing:`);
        albums.forEach(a => console.log(`  - ${a.Name} (${a.AlbumKey})`));

        // Start multiple batches
        console.log('\n2. Starting multiple batches concurrently...');
        const batchPromises = albums.map(async (album, index) => {
            const batchData = {
                albumKey: album.AlbumKey,
                maxImages: 5,
                batchName: `Test Batch ${index + 1}: ${album.Name}`,
                excludedImages: []
            };

            console.log(`   Starting batch for ${album.Name}...`);
            const response = await makeRequest('/api/batch/start', 'POST', batchData);
            
            if (response.success) {
                console.log(`   ✓ Batch started: ${response.data.batchId}`);
                return response.data.batchId;
            } else {
                console.error(`   ✗ Failed to start batch for ${album.Name}: ${response.error}`);
                return null;
            }
        });

        const batchIds = (await Promise.all(batchPromises)).filter(id => id !== null);
        console.log(`\nSuccessfully started ${batchIds.length} batches`);

        // Monitor batch progress
        console.log('\n3. Monitoring batch progress...');
        let allComplete = false;
        let iterations = 0;
        const maxIterations = 60; // Max 2 minutes of monitoring

        while (!allComplete && iterations < maxIterations) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
            
            const statusResponse = await makeRequest('/api/batch/status');
            
            if (statusResponse.success && statusResponse.data.batches) {
                const batches = statusResponse.data.batches;
                const stats = statusResponse.data.statistics;
                
                console.log(`\n[${new Date().toLocaleTimeString()}] Status Update:`);
                console.log(`  Active Batches: ${stats.activeBatches}/${stats.maxBatches}`);
                console.log(`  Total Progress: ${stats.totalProcessed}/${stats.totalJobs} (${stats.totalFailed} failed)`);
                console.log(`  Rate Limiter: ${stats.rateLimiter.activeRequests} active, ${Math.floor(stats.rateLimiter.tokens)} tokens`);
                
                batches.forEach(batch => {
                    const progress = batch.total > 0 ? Math.round((batch.processed / batch.total) * 100) : 0;
                    console.log(`  - ${batch.name}: ${progress}% (${batch.processed}/${batch.total})`);
                });
                
                allComplete = batches.every(b => b.isComplete);
            }
            
            iterations++;
        }

        if (allComplete) {
            console.log('\n✓ All batches completed successfully!');
        } else {
            console.log('\n⚠ Test timed out - some batches may still be running');
        }

        // Get final status
        console.log('\n4. Final Status:');
        const finalStatus = await makeRequest('/api/batch/status');
        if (finalStatus.success && finalStatus.data.statistics) {
            const stats = finalStatus.data.statistics;
            console.log(`  Total Jobs Processed: ${stats.totalProcessed}`);
            console.log(`  Total Failed: ${stats.totalFailed}`);
            console.log(`  Active Batches: ${stats.activeBatches}`);
        }

    } catch (error) {
        console.error('Test failed:', error);
    }
}

// Run the test
testConcurrentBatches();