/**
 * Real GBA Emulator Integration
 * Complete GBA emulation with actual game rendering
 */

const path = require('path');
const fs = require('fs-extra');
const { createCanvas } = require('canvas');

// Create comprehensive browser environment for GBA
function setupBrowserEnvironment() {
    if (typeof global.window === 'undefined') {
        global.window = {};
    }

    // Essential DOM APIs
    global.window.setTimeout = setTimeout;
    global.window.clearTimeout = clearTimeout;
    global.window.setInterval = setInterval;
    global.window.clearInterval = clearInterval;
    global.window.URL = require('url').URL;

    // Canvas support
    global.window.HTMLCanvasElement = class HTMLCanvasElement {
        constructor(width = 240, height = 160) {
            this.width = width;
            this.height = height;
            this._context = null;
        }

        getContext(type) {
            if (type === '2d') {
                if (!this._context) {
                    this._context = new NodeCanvas2DContext(this.width, this.height);
                }
                return this._context;
            }
            return null;
        }
    };

    // Document
    global.document = {
        createElement: (tagName) => {
            if (tagName.toLowerCase() === 'canvas') {
                return new global.window.HTMLCanvasElement(240, 160);
            }
            return null;
        }
    };

    // AudioContext stub
    global.AudioContext = class AudioContext {
        constructor() {
            this.sampleRate = 44100;
            this.currentTime = 0;
        }
        createBuffer() { return {}; }
        createBufferSource() { return {}; }
        createGain() { return {}; }
        destination = {};
    };

    // Additional required globals
    global.navigator = { userAgent: 'Node.js GBA Emulator' };
    global.screen = { width: 240, height: 160 };
}

// Node.js Canvas 2D Context wrapper
class NodeCanvas2DContext {
    constructor(width, height) {
        this.canvas = { width, height };
        this._canvas = createCanvas(width, height);
        this._ctx = this._canvas.getContext('2d');
    }

    // Forward all methods to actual canvas context
    clearRect(x, y, width, height) {
        return this._ctx.clearRect(x, y, width, height);
    }

    fillRect(x, y, width, height) {
        return this._ctx.fillRect(x, y, width, height);
    }

    drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh) {
        return this._ctx.drawImage(image._canvas || image, sx, sy, sw, sh, dx, dy, dw, dh);
    }

    getImageData(x, y, width, height) {
        return this._ctx.getImageData(x, y, width, height);
    }

    putImageData(imageData, x, y) {
        return this._ctx.putImageData(imageData, x, y);
    }

    createImageData(width, height) {
        return this._ctx.createImageData(width, height);
    }

    // Properties
    fillStyle = '#000000';
    strokeStyle = '#000000';
    lineWidth = 1;
    font = '10px sans-serif';
    textAlign = 'start';
    textBaseline = 'alphabetic';
}

// Load GBA classes in correct order
function loadGBAClasses() {
    setupBrowserEnvironment();

    // Load all GBA modules
    const modules = [
        '../js/util.js',
        '../js/mmu.js',
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

    modules.forEach(module => {
        try {
            require(module);
        } catch (error) {
            console.warn(`Warning loading ${module}:`, error.message);
        }
    });

    return global.GameBoyAdvance;
}

class RealGBAEmulator {
    constructor() {
        this.gba = null;
        this.canvas = null;
        this.isRunning = false;
        this.frameCount = 0;
    }

    async initialize(romData) {
        console.log('🔄 Setting up real GBA emulator...');

        // Load GBA classes
        const GameBoyAdvance = loadGBAClasses();
        if (!GameBoyAdvance) {
            throw new Error('Failed to load GBA classes');
        }

        // Create canvas for rendering
        this.canvas = createCanvas(240, 160);
        const ctx = this.canvas.getContext('2d');

        // Initialize GBA
        this.gba = new GameBoyAdvance();

        // Create a proper canvas for GBA
        const gbaCanvas = {
            width: 240,
            height: 160,
            getContext: (type) => type === '2d' ? ctx : null
        };

        // Set up the canvas
        this.gba.setCanvas(gbaCanvas);

        // Load BIOS
        const biosPath = path.join(__dirname, '../resources/bios.bin');
        if (await fs.pathExists(biosPath)) {
            const biosData = await fs.readFile(biosPath);
            this.gba.setBios(biosData);
            console.log('✅ BIOS loaded');
        } else {
            console.warn('⚠️  BIOS not found, continuing without BIOS');
        }

        // Load ROM
        this.gba.setRom(romData);
        console.log('✅ ROM loaded into real GBA emulator');

        // Reset system
        this.gba.reset();
        console.log('✅ Real GBA emulator initialized');
    }

    async runFrames(targetFrames, onFrame) {
        if (!this.gba) {
            throw new Error('Emulator not initialized');
        }

        console.log(`🎮 Running real GBA emulation for ${targetFrames} frames...`);

        this.isRunning = true;
        this.frameCount = 0;
        const startTime = Date.now();

        // GBA runs at ~59.73 FPS
        const frameTime = 1000 / 59.73;

        for (let frame = 1; frame <= targetFrames && this.isRunning; frame++) {
            const frameStart = Date.now();

            // Run one frame of actual GBA emulation
            this.gba.runStable();

            // Check if frame was rendered
            if (this.gba.video && this.gba.video.vblank) {
                this.frameCount++;

                // Save the frame
                if (onFrame) {
                    await onFrame(this.canvas, this.frameCount);
                }

                // Progress
                if (this.frameCount % 10 === 0) {
                    console.log(`📊 Real frame ${this.frameCount}/${targetFrames}`);
                }
            }

            // Frame timing
            const elapsed = Date.now() - frameStart;
            if (elapsed < frameTime) {
                await new Promise(resolve => setTimeout(resolve, frameTime - elapsed));
            }
        }

        const totalTime = Date.now() - startTime;
        console.log(`✅ Real emulation completed: ${this.frameCount} frames in ${(totalTime/1000).toFixed(2)}s`);
    }

    stop() {
        this.isRunning = false;
    }

    getFrameCount() {
        return this.frameCount;
    }
}

module.exports = RealGBAEmulator;