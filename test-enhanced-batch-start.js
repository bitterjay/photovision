// Test enhanced batch start endpoint with duplicate detection
// This test verifies the new duplicate handling functionality

const http = require('http');
const querystring = require('querystring');

const PORT = 3000;

function makeRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'Content-Type': 'application/json'
    };
    
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: method,
      headers: { ...defaultHeaders, ...headers }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const jsonBody = JSON.parse(body);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: jsonBody
          });
        } catch (error) {
          reject(new Error(`Invalid JSON response: ${body}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testEnhancedBatchStart() {
  console.log('🧪 Testing Enhanced Batch Start Endpoint with Duplicate Detection\n');

  try {
    // Test 1: Basic batch start with duplicate detection parameters
    console.log('Test 1: Basic batch start with duplicate detection');
    const basicResponse = await makeRequest('POST', '/api/batch/start', {
      albumKey: '3PCPNB',
      duplicateHandling: 'skip',
      forceReprocessing: false,
      maxImages: 10
    });

    console.log('Status:', basicResponse.statusCode);
    console.log('Response:', JSON.stringify(basicResponse.body, null, 2));

    if (basicResponse.statusCode === 200) {
      console.log('✅ Basic batch start with duplicate detection: PASSED');
      console.log(`📊 Statistics:`, basicResponse.body.data.statistics);
    } else {
      console.log('❌ Basic batch start with duplicate detection: FAILED');
      console.log('Error:', basicResponse.body.error);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 2: Batch start with force reprocessing
    console.log('Test 2: Batch start with force reprocessing');
    const forceResponse = await makeRequest('POST', '/api/batch/start', {
      albumKey: '3PCPNB',
      duplicateHandling: 'update',
      forceReprocessing: true,
      maxImages: 5
    });

    console.log('Status:', forceResponse.statusCode);
    console.log('Response:', JSON.stringify(forceResponse.body, null, 2));

    if (forceResponse.statusCode === 200) {
      console.log('✅ Force reprocessing batch start: PASSED');
      console.log(`📊 Statistics:`, forceResponse.body.data.statistics);
    } else {
      console.log('❌ Force reprocessing batch start: FAILED');
      console.log('Error:', forceResponse.body.error);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 3: Invalid duplicate handling option
    console.log('Test 3: Invalid duplicate handling option');
    const invalidResponse = await makeRequest('POST', '/api/batch/start', {
      albumKey: '3PCPNB',
      duplicateHandling: 'invalid_option',
      forceReprocessing: false
    });

    console.log('Status:', invalidResponse.statusCode);
    console.log('Response:', JSON.stringify(invalidResponse.body, null, 2));

    if (invalidResponse.statusCode === 400) {
      console.log('✅ Invalid duplicate handling option validation: PASSED');
    } else {
      console.log('❌ Invalid duplicate handling option validation: FAILED');
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 4: Batch start with replace duplicate handling
    console.log('Test 4: Batch start with replace duplicate handling');
    const replaceResponse = await makeRequest('POST', '/api/batch/start', {
      albumKey: '3PCPNB',
      duplicateHandling: 'replace',
      forceReprocessing: false,
      maxImages: 3
    });

    console.log('Status:', replaceResponse.statusCode);
    console.log('Response:', JSON.stringify(replaceResponse.body, null, 2));

    if (replaceResponse.statusCode === 200) {
      console.log('✅ Replace duplicate handling batch start: PASSED');
      console.log(`📊 Statistics:`, replaceResponse.body.data.statistics);
    } else {
      console.log('❌ Replace duplicate handling batch start: FAILED');
      console.log('Error:', replaceResponse.body.error);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 5: Check batch status to verify duplicate-aware progress
    console.log('Test 5: Check batch status for duplicate-aware progress');
    
    // Wait a moment for batch to start
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const statusResponse = await makeRequest('GET', '/api/batch/status');

    console.log('Status:', statusResponse.statusCode);
    console.log('Response:', JSON.stringify(statusResponse.body, null, 2));

    if (statusResponse.statusCode === 200) {
      console.log('✅ Batch status check: PASSED');
      console.log(`📊 Batch Progress:`, statusResponse.body.data);
    } else {
      console.log('❌ Batch status check: FAILED');
      console.log('Error:', statusResponse.body.error);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 6: Test with default parameters
    console.log('Test 6: Default duplicate handling parameters');
    const defaultResponse = await makeRequest('POST', '/api/batch/start', {
      albumKey: '3PCPNB'
      // No duplicateHandling or forceReprocessing - should use defaults
    });

    console.log('Status:', defaultResponse.statusCode);
    console.log('Response:', JSON.stringify(defaultResponse.body, null, 2));

    if (defaultResponse.statusCode === 200) {
      console.log('✅ Default parameters batch start: PASSED');
      console.log(`📊 Statistics:`, defaultResponse.body.data.statistics);
      console.log(`🔧 Default duplicate handling: ${defaultResponse.body.data.statistics.duplicateHandling}`);
      console.log(`🔧 Default force reprocessing: ${defaultResponse.body.data.statistics.forceReprocessing}`);
    } else {
      console.log('❌ Default parameters batch start: FAILED');
      console.log('Error:', defaultResponse.body.error);
    }

    console.log('\n🎉 Enhanced Batch Start Endpoint Tests Completed!\n');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    process.exit(1);
  }
}

// Run the test
testEnhancedBatchStart();
