// Test script to verify that chat/conversational search API returns album hierarchy data
// This tests the /api/chat endpoint to ensure it includes album information

require('dotenv').config();

async function testChatSearchWithAlbumHierarchy() {
    console.log('=== CHAT SEARCH ALBUM HIERARCHY TEST ===');
    
    try {
        const testMessage = "Find archery photos";
        
        console.log(`\n1. Testing chat search with query: "${testMessage}"`);
        
        // Make request to chat API
        const response = await fetch('http://localhost:3000/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: testMessage
            })
        });
        
        if (!response.ok) {
            throw new Error(`Chat API request failed: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        
        console.log('\n2. Chat API Response:');
        console.log(`   Success: ${result.success}`);
        console.log(`   Message: ${result.message}`);
        console.log(`   Response: ${result.data.response}`);
        console.log(`   Result Count: ${result.data.resultCount}`);
        
        // Check if results include album hierarchy data
        if (result.data.results && result.data.results.length > 0) {
            console.log('\n3. Checking album hierarchy data in results:');
            
            const sampleResult = result.data.results[0];
            
            console.log('   Sample result fields:');
            console.log(`   - filename: ${sampleResult.filename || 'Missing'}`);
            console.log(`   - albumKey: ${sampleResult.albumKey || 'Missing'}`);
            console.log(`   - albumName: ${sampleResult.albumName || 'Missing'}`);
            console.log(`   - albumPath: ${sampleResult.albumPath || 'Missing'}`);
            console.log(`   - albumHierarchy: ${sampleResult.albumHierarchy ? JSON.stringify(sampleResult.albumHierarchy) : 'Missing'}`);
            
            // Check if all album hierarchy fields are present
            const hasAlbumKey = !!sampleResult.albumKey;
            const hasAlbumName = !!sampleResult.albumName;
            const hasAlbumPath = !!sampleResult.albumPath;
            const hasAlbumHierarchy = !!sampleResult.albumHierarchy;
            
            console.log('\n4. Album hierarchy data status:');
            console.log(`   Album Key: ${hasAlbumKey ? '✅' : '❌'}`);
            console.log(`   Album Name: ${hasAlbumName ? '✅' : '❌'}`);
            console.log(`   Album Path: ${hasAlbumPath ? '✅' : '❌'}`);
            console.log(`   Album Hierarchy: ${hasAlbumHierarchy ? '✅' : '❌'}`);
            
            if (hasAlbumKey && hasAlbumName && hasAlbumPath && hasAlbumHierarchy) {
                console.log('\n✅ SUCCESS: Chat search results include complete album hierarchy data!');
                console.log('   The conversational search API now properly returns album context.');
            } else {
                console.log('\n❌ ISSUE: Some album hierarchy fields are missing from chat search results.');
            }
            
        } else {
            console.log('\n⚠️  No search results returned to test album hierarchy data.');
            console.log('   This might be because there are no images matching the search term.');
        }
        
        console.log('\n=== CHAT SEARCH TEST COMPLETE ===');
        
    } catch (error) {
        console.error('❌ Chat search test failed:', error.message);
        console.error('Full error:', error);
    }
}

// Run the test
if (require.main === module) {
    testChatSearchWithAlbumHierarchy()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Script failed:', error);
            process.exit(1);
        });
}

module.exports = { testChatSearchWithAlbumHierarchy };
