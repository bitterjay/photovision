// Test script for API key management functionality
// Tests encryption, storage, and retrieval of Claude API keys

const CryptoUtils = require('./lib/cryptoUtils');
const DataManager = require('./lib/dataManager');

async function testApiKeyManagement() {
    console.log('🔐 Testing API Key Management System\n');
    
    const cryptoUtils = new CryptoUtils();
    const dataManager = new DataManager();
    
    try {
        // Test 1: Encryption/Decryption
        console.log('1️⃣ Testing encryption and decryption...');
        const testKey = 'sk-ant-test-key-12345678901234567890';
        const encrypted = await cryptoUtils.encrypt(testKey);
        console.log('✅ Encrypted:', JSON.stringify(encrypted));
        
        const decrypted = await cryptoUtils.decrypt(encrypted);
        console.log('✅ Decrypted:', decrypted);
        console.log('✅ Match:', testKey === decrypted ? 'YES' : 'NO');
        console.log();
        
        // Test 2: API Key Format Validation
        console.log('2️⃣ Testing API key format validation...');
        const validKey = 'sk-ant-api03-valid-key-here-1234567890abcdefghijk';
        const invalidKey = 'invalid-api-key';
        
        console.log(`Valid key test: ${cryptoUtils.validateClaudeApiKeyFormat(validKey) ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Invalid key test: ${!cryptoUtils.validateClaudeApiKeyFormat(invalidKey) ? '✅ PASS' : '❌ FAIL'}`);
        console.log();
        
        // Test 3: API Key Masking
        console.log('3️⃣ Testing API key masking...');
        const maskedKey = cryptoUtils.maskApiKey(validKey);
        console.log(`Original: ${validKey}`);
        console.log(`Masked:   ${maskedKey}`);
        console.log();
        
        // Test 4: Get Current Status
        console.log('4️⃣ Getting current API key status...');
        const status = await dataManager.getClaudeApiKeyStatus();
        console.log('Status:', JSON.stringify(status, null, 2));
        console.log();
        
        // Test 5: Environment Variable Check
        console.log('5️⃣ Checking environment variable...');
        if (process.env.ANTHROPIC_API_KEY) {
            console.log(`✅ Found ANTHROPIC_API_KEY in environment`);
            console.log(`   Masked: ${cryptoUtils.maskApiKey(process.env.ANTHROPIC_API_KEY)}`);
        } else {
            console.log('❌ No ANTHROPIC_API_KEY in environment');
        }
        console.log();
        
        // Test 6: Save and Retrieve Test Key (if no real key exists)
        if (!status.configured) {
            console.log('6️⃣ Testing save and retrieve (no existing key)...');
            const testApiKey = 'sk-ant-test-' + Date.now() + '-abcdefghijklmnopqrstuvwxyz';
            
            try {
                await dataManager.saveClaudeApiKey(testApiKey);
                console.log('✅ Test key saved');
                
                const retrievedKey = await dataManager.getClaudeApiKey();
                console.log(`✅ Retrieved: ${retrievedKey === testApiKey ? 'Match!' : 'No match!'}`);
                
                // Clean up test key
                await dataManager.removeClaudeApiKey();
                console.log('✅ Test key removed');
            } catch (error) {
                console.log('❌ Save/retrieve test failed:', error.message);
            }
        } else {
            console.log('6️⃣ Skipping save test (key already configured)');
        }
        
        console.log('\n✅ All tests completed!');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error);
        console.error(error.stack);
    }
}

// Run the tests
testApiKeyManagement().catch(console.error);