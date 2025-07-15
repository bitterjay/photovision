// Test script to verify the new chat feedback and keyword generation features
const fs = require('fs');
const path = require('path');
const https = require('https');
const { FormData } = require('formdata-node');

async function testImageUpload() {
    try {
        // Use the existing test image
        const testImagePath = path.join(__dirname, 'test-files', 'adult-man.jpg');
        
        if (!fs.existsSync(testImagePath)) {
            console.error('Test image not found at:', testImagePath);
            return;
        }

        // Read the test image
        const imageBuffer = fs.readFileSync(testImagePath);
        
        // Create form data
        const formData = new FormData();
        formData.append('image', new Blob([imageBuffer], { type: 'image/jpeg' }), 'adult-man.jpg');
        
        // Make the request
        const response = await fetch('http://localhost:3000/api/analyze', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        console.log('=== Test Results ===');
        console.log('Response Status:', response.status);
        console.log('Success:', result.success);
        
        if (result.success) {
            console.log('\n=== Image Analysis Data ===');
            console.log('Filename:', result.data.filename);
            console.log('MIME Type:', result.data.mimeType);
            console.log('File Size:', result.data.size, 'bytes');
            console.log('AI Model:', result.data.metadata.model);
            console.log('Timestamp:', result.data.metadata.timestamp);
            
            console.log('\n=== Analysis Results ===');
            console.log('Description:', result.data.analysis.description);
            console.log('Keywords:', result.data.analysis.keywords);
            
            console.log('\n=== Keywords Check ===');
            if (result.data.analysis.keywords && result.data.analysis.keywords.length > 0) {
                console.log('✅ Keywords generated successfully!');
                console.log('Keyword count:', result.data.analysis.keywords.length);
                result.data.analysis.keywords.forEach((keyword, index) => {
                    console.log(`  ${index + 1}. ${keyword}`);
                });
            } else {
                console.log('❌ No keywords generated');
            }
        } else {
            console.error('Error:', result.error);
        }
        
    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

// Run the test
testImageUpload();
