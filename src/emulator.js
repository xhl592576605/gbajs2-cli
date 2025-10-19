/**
 * Real GBA Emulator Integration
 * Integrates the original GameBoyAdvance class with Node.js adapters
 */

const path = require('path');
const fs = require('fs-extra');

// Create browser-compatible globals
if (typeof window === 'undefined') {
    global.window = {
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        URL: require('url').URL,
        document: {
            createElement: (tag) => {
                if (tag === 'canvas') {
                    const Canvas = require('canvas');
                    return new Canvas(240, 160);
                }
                return null;
            }
        }
    };
    global.document = global.window.document;
}

// Import original GBA classes
const GameBoyAdvance = require('./gba-loader');
const CanvasAdapter = require('./adapters/canvas');
const NullAudioAdapter = require('./adapters/audio');
const NullInputAdapter = require('./adapters/input');

class GBANodeEmulator {
    constructor() {
        this.gba = null;
        this.canvasAdapter = null;
        this.isRunning = false;
        this.frameCount = 0;
        this.startTime = 0;
    }

    /**
     * Initialize the emulator with ROM data
     * @param {Buffer} romData - The ROM data buffer
     */
    async initialize(romData) {
        console.log('🔄 Initializing GBA emulator...');

        // Create adapters
        this.canvasAdapter = new CanvasAdapter(240, 160);
        const audioAdapter = new NullAudioAdapter();
        const inputAdapter = new NullInputAdapter();

        // Initialize GBA
        this.gba = new GameBoyAdvance();

        // Override the video's target canvas with our adapter
        this.gba.video.targetCanvas = this.canvasAdapter;

        // Override audio and input
        this.gba.audio = audioAdapter;
        this.gba.keypad = inputAdapter;

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
        console.log('✅ ROM loaded into emulator');

        // Reset the system
        this.gba.reset();
        console.log('✅ Emulator initialized');
    }

    /**
     * Run emulation for a specified number of frames
     * @param {number} targetFrames - Number of frames to generate
     * @param {Function} onFrame - Callback for each frame
     */
    async runFrames(targetFrames, onFrame) {
        if (!this.gba) {
            throw new Error('Emulator not initialized');
        }

        console.log(`🎮 Running emulation for ${targetFrames} frames...`);

        this.isRunning = true;
        this.frameCount = 0;
        this.startTime = Date.now();

        const frameInterval = 1000 / 60; // 60 FPS target

        while (this.frameCount < targetFrames && this.isRunning) {
            const frameStart = Date.now();

            // Run one frame of emulation
            this.gba.runStable();

            // Check if a frame was rendered
            if (this.gba.video.vblank) {
                this.frameCount++;

                // Callback with frame data
                if (onFrame) {
                    await onFrame(this.canvasAdapter, this.frameCount);
                }

                // Log progress
                if (this.frameCount % 60 === 0) {
                    const elapsed = Date.now() - this.startTime;
                    console.log(`📊 Frame ${this.frameCount}/${targetFrames} - ${(elapsed/1000).toFixed(2)}s elapsed`);
                }
            }

            // Frame timing
            const frameTime = Date.now() - frameStart;
            if (frameTime < frameInterval) {
                await new Promise(resolve => setTimeout(resolve, frameInterval - frameTime));
            }
        }

        const totalTime = Date.now() - this.startTime;
        console.log(`✅ Emulation completed: ${this.frameCount} frames in ${(totalTime/1000).toFixed(2)}s`);
    }

    /**
     * Stop emulation
     */
    stop() {
        this.isRunning = false;
    }

    /**
     * Get current frame count
     */
    getFrameCount() {
        return this.frameCount;
    }

    /**
     * Get emulation statistics
     */
    getStats() {
        if (!this.startTime) return null;

        const elapsed = Date.now() - this.startTime;
        return {
            frames: this.frameCount,
            elapsed: elapsed,
            fps: this.frameCount / (elapsed / 1000)
        };
    }

    /**
     * Save current state
     */
    saveState() {
        if (!this.gba) return null;
        return this.gba.saveState();
    }

    /**
     * Load saved state
     */
    loadState(state) {
        if (!this.gba) return;
        this.gba.loadState(state);
    }
}

module.exports = GBANodeEmulator;