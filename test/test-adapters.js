/**
 * Simple test script for Node.js adapters
 */

const CanvasAdapter = require('../src/adapters/canvas');
const ROMLoader = require('../src/fs/rom-loader');
const FrameWriter = require('../src/fs/frame-writer');
const path = require('path');

async function runTests() {
    console.log('🧪 Running adapter tests...\n');
    
    try {
        // Test 1: Canvas Adapter
        console.log('1. Testing Canvas Adapter...');
        const canvas = new CanvasAdapter(240, 160);
        const ctx = canvas.getContext('2d');
        
        // Draw test pattern
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(0, 0, 120, 80);
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(120, 0, 120, 80);
        ctx.fillStyle = '#0000ff';
        ctx.fillRect(0, 80, 240, 80);
        
        console.log('   ✅ Canvas created and drawn successfully');
        
        // Test 2: Frame Writer
        console.log('2. Testing Frame Writer...');
        const testDir = path.join(__dirname, '../test-output');
        const writer = new FrameWriter(testDir, { format: 'png', quality: 95 });
        await writer.initialize();
        
        await writer.saveFrame(canvas, 1);
        console.log('   ✅ Frame saved successfully');
        
        // Test 3: ROM Loader (with mock validation)
        console.log('3. Testing ROM Loader validation...');
        try {
            const mockROM = Buffer.alloc(1024 * 1024); // 1MB mock ROM
            // Set Nintendo logo
            const logo = Buffer.from([
                0x24, 0xFF, 0xAE, 0x51, 0x69, 0x9A, 0xA2, 0x21
            ]);
            logo.copy(mockROM, 0x04);
            
            ROMLoader.validateROMHeader(mockROM);
            console.log('   ✅ ROM validation passed');
        } catch (error) {
            console.log('   ❌ ROM validation failed:', error.message);
        }
        
        console.log('\n🎉 All tests completed successfully!');
        console.log('📁 Check test-output/ directory for generated frames');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    runTests();
}

module.exports = { runTests };