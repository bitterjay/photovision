// Test script for image resizing functionality
// Tests the new dimension-based resizing in Claude client

require('dotenv').config();
const ClaudeClient = require('./lib/claudeClient');
const sharp = require('sharp');

async function testImageResize() {
    console.log('=== Testing Image Resize Functionality ===\n');
    
    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_anthropic_api_key_here') {
        console.error('❌ ANTHROPIC_API_KEY not configured');
        return;
    }
    
    const claudeClient = new ClaudeClient(process.env.ANTHROPIC_API_KEY);
    
    // Test 1: Create a large test image to simulate the issue
    console.log('1. Creating large test image (3000x2000 landscape)...');
    
    try {
        const largeImageBuffer = await sharp({
            create: {
                width: 3000,
                height: 2000,
                channels: 3,
                background: { r: 100, g: 150, b: 200 }
            }
        })
        .jpeg({ quality: 90 })
        .toBuffer();
        
        console.log(`   Original image: ${largeImageBuffer.length} bytes`);
        
        // Test 2: Analyze the large image (should trigger resizing)
        console.log('\n2. Analyzing large image (should trigger dimension resizing)...');
        
        const result = await claudeClient.analyzeImage(
            largeImageBuffer, 
            'image/jpeg', 
            'Describe this test image briefly.'
        );
        
        if (result.success) {
            console.log('✅ Image analysis successful after resizing');
            console.log(`   Description: ${result.description.substring(0, 100)}...`);
            console.log(`   Keywords: ${result.keywords.join(', ')}`);
        } else {
            console.error('❌ Image analysis failed:', result.error);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
    
    // Test 3: Create a portrait image to test portrait resizing
    console.log('\n3. Creating large portrait image (1500x4000)...');
    
    try {
        const portraitImageBuffer = await sharp({
            create: {
                width: 1500,
                height: 4000,
                channels: 3,
                background: { r: 200, g: 100, b: 150 }
            }
        })
        .jpeg({ quality: 90 })
        .toBuffer();
        
        console.log(`   Original portrait: ${portraitImageBuffer.length} bytes`);
        
        // Test portrait resizing
        console.log('\n4. Analyzing portrait image (should trigger height-based resizing)...');
        
        const portraitResult = await claudeClient.analyzeImage(
            portraitImageBuffer, 
            'image/jpeg', 
            'Describe this portrait test image briefly.'
        );
        
        if (portraitResult.success) {
            console.log('✅ Portrait image analysis successful after resizing');
            console.log(`   Description: ${portraitResult.description.substring(0, 100)}...`);
        } else {
            console.error('❌ Portrait image analysis failed:', portraitResult.error);
        }
        
    } catch (error) {
        console.error('❌ Portrait test failed:', error.message);
    }
    
    // Test 4: Test with normal-sized image (should not trigger resizing)
    console.log('\n5. Testing normal-sized image (800x600 - should not resize)...');
    
    try {
        const normalImageBuffer = await sharp({
            create: {
                width: 800,
                height: 600,
                channels: 3,
                background: { r: 50, g: 200, b: 100 }
            }
        })
        .jpeg({ quality: 90 })
        .toBuffer();
        
        console.log(`   Normal image: ${normalImageBuffer.length} bytes`);
        
        const normalResult = await claudeClient.analyzeImage(
            normalImageBuffer, 
            'image/jpeg', 
            'Describe this normal-sized test image briefly.'
        );
        
        if (normalResult.success) {
            console.log('✅ Normal image analysis successful (no resizing needed)');
            console.log(`   Description: ${normalResult.description.substring(0, 100)}...`);
        } else {
            console.error('❌ Normal image analysis failed:', normalResult.error);
        }
        
    } catch (error) {
        console.error('❌ Normal image test failed:', error.message);
    }
    
    console.log('\n=== Image Resize Test Complete ===');
}

// Run the test
testImageResize().catch(console.error);
