/**
 * GBA Class Loader
 * Loads all GBA classes in correct order for Node.js
 */

// Create browser-compatible globals
if (typeof window === 'undefined') {
    global.window = {
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        setInterval: setInterval,
        clearInterval: clearInterval,
        URL: require('url').URL,
        document: {
            createElement: (tag) => {
                if (tag === 'canvas') {
                    const { createCanvas } = require('canvas');
                    return createCanvas(240, 160);
                }
                return null;
            }
        }
    };
    global.document = global.window.document;
    global.navigator = { userAgent: 'Node.js' };
}

// Load all dependencies in order
const dependencies = [
    '../js/util.js',
    '../js/mmu.js', // Contains MemoryView
    '../js/core.js',
    '../js/arm.js',
    '../js/thumb.js',
    '../js/io.js',
    '../js/audio.js',
    '../js/video.js',
    '../js/irq.js',
    '../js/keypad.js',
    '../js/sio.js',
    '../js/savedata.js',
    '../js/gba.js'
];

// Load each file
dependencies.forEach(file => {
    try {
        require(file);
        console.log(`✅ Loaded: ${file}`);
    } catch (error) {
        console.warn(`⚠️  Failed to load ${file}:`, error.message);
    }
});

module.exports = global.GameBoyAdvance;