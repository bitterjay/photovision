// Test Album Hierarchy Search Functionality
// Verifies that album hierarchy data is properly searchable

const SearchFunctions = require('./lib/searchFunctions');

async function testAlbumHierarchySearch() {
    console.log('=== Testing Album Hierarchy Search ===\n');
    
    const searchFunctions = new SearchFunctions();
    
    try {
        // Test 1: Search by album name using searchByAlbum
        console.log('Test 1: Direct album search for "Arizona Cup"');
        const arizonaCupResults = await searchFunctions.searchByAlbum({ albumTerm: 'Arizona Cup' });
        console.log(`Found ${arizonaCupResults.length} images from Arizona Cup`);
        arizonaCupResults.forEach(img => {
            console.log(`- ${img.filename} from album: ${img.albumName}`);
            console.log(`  Hierarchy: ${img.albumHierarchy?.join(' > ')}`);
        });
        console.log();

        // Test 2: Search by year using searchByAlbum
        console.log('Test 2: Direct album search for "2025"');
        const yearResults = await searchFunctions.searchByAlbum({ albumTerm: '2025' });
        console.log(`Found ${yearResults.length} images from 2025`);
        yearResults.forEach(img => {
            console.log(`- ${img.filename} from album: ${img.albumName}`);
            console.log(`  Hierarchy: ${img.albumHierarchy?.join(' > ')}`);
        });
        console.log();

        // Test 3: Search by keywords including album hierarchy
        console.log('Test 3: Keyword search for "Arizona Cup" (should include album hierarchy)');
        const keywordResults = await searchFunctions.searchByKeywords({ 
            keywords: ['Arizona Cup'] 
        });
        console.log(`Found ${keywordResults.length} images with keyword search`);
        keywordResults.forEach(img => {
            console.log(`- ${img.filename} from album: ${img.albumName}`);
            console.log(`  Hierarchy: ${img.albumHierarchy?.join(' > ')}`);
        });
        console.log();

        // Test 4: Search by keywords for "Gator Cup"
        console.log('Test 4: Keyword search for "Gator Cup"');
        const gatorResults = await searchFunctions.searchByKeywords({ 
            keywords: ['Gator Cup'] 
        });
        console.log(`Found ${gatorResults.length} images from Gator Cup`);
        gatorResults.forEach(img => {
            console.log(`- ${img.filename} from album: ${img.albumName}`);
            console.log(`  Hierarchy: ${img.albumHierarchy?.join(' > ')}`);
        });
        console.log();

        // Test 5: Check data structure
        console.log('Test 5: Verify album hierarchy data structure');
        const allImages = await searchFunctions.getAllImages();
        console.log(`Total images in database: ${allImages.length}`);
        
        allImages.forEach((img, index) => {
            console.log(`Image ${index + 1}: ${img.filename}`);
            console.log(`  Album: ${img.albumName}`);
            console.log(`  Path: ${img.albumPath}`);
            console.log(`  Hierarchy: ${img.albumHierarchy ? img.albumHierarchy.join(' > ') : 'None'}`);
            console.log();
        });

        console.log('=== Album Hierarchy Search Tests Complete ===');

    } catch (error) {
        console.error('Error during album hierarchy search tests:', error);
    }
}

// Run the test
testAlbumHierarchySearch();
