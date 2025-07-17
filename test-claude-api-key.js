// Test script to verify Claude API key configuration
// This helps diagnose API key issues

require('dotenv').config();
const ClaudeClient = require('./lib/claudeClient');

async function testClaudeAPIKey() {
  console.log('Testing Claude API Key...\n');
  
  // Check if API key is configured
  const apiKey = process.env.ANTHROPIC_API_KEY;
  console.log('API Key configured:', apiKey ? '✓ Yes' : '✗ No');
  console.log('API Key length:', apiKey ? apiKey.length : 'N/A');
  console.log('API Key prefix:', apiKey ? apiKey.substring(0, 20) + '...' : 'N/A');
  console.log('');
  
  if (!apiKey) {
    console.log('❌ ERROR: ANTHROPIC_API_KEY not found in environment variables');
    console.log('');
    console.log('To fix this:');
    console.log('1. Create a .env file in the project root');
    console.log('2. Add: ANTHROPIC_API_KEY=your_api_key_here');
    console.log('3. Get a new API key from: https://console.anthropic.com/');
    return;
  }
  
  if (apiKey === 'your_anthropic_api_key_here') {
    console.log('❌ ERROR: API key is still set to placeholder value');
    console.log('');
    console.log('To fix this:');
    console.log('1. Update your .env file');
    console.log('2. Replace "your_anthropic_api_key_here" with your actual API key');
    console.log('3. Get a new API key from: https://console.anthropic.com/');
    return;
  }
  
  // Test API connection
  console.log('Testing API connection...');
  const claudeClient = new ClaudeClient(apiKey);
  
  try {
    const testResult = await claudeClient.testConnection();
    console.log('✅ SUCCESS: Claude API connection working!');
    console.log('Model:', testResult.model);
    console.log('Response Time:', testResult.responseTime + 'ms');
  } catch (error) {
    console.log('❌ ERROR: Claude API connection failed');
    console.log('Error message:', error.message);
    console.log('');
    console.log('Common solutions:');
    console.log('1. Check if your API key is valid and not expired');
    console.log('2. Verify your API key has the correct permissions');
    console.log('3. Check if you have sufficient credits in your Anthropic account');
    console.log('4. Get a new API key from: https://console.anthropic.com/');
    console.log('5. Make sure your account is in good standing');
  }
}

testClaudeAPIKey().catch(console.error);
