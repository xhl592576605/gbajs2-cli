/**
 * Node.js GBA Emulator Wrapper
 * Provides browser-compatible interface for Node.js environment
 */

const { isNode } = require('./environment');

// Browser implementations (will be undefined in Node.js)
let CanvasAdapter, NullAudioAdapter, NullInputAdapter;

if (isNode) {
    // Node.js implementations
    CanvasAdapter = require('./adapters/canvas');
    NullAudioAdapter = require('./adapters/audio');
    NullInputAdapter = require('./adapters/input');
} else {
    // Browser implementations (use native APIs)
    CanvasAdapter = class BrowserCanvasAdapter {
        constructor(width, height) {
            this.canvas = document.createElement('canvas');
            this.canvas.width = width;
            this.canvas.height = height;
            this.ctx = this.canvas.getContext('2d');
        }

        getContext(type) {
            return this.ctx;
        }

        get width() { return this.canvas.width; }
        set width(value) { this.canvas.width = value; }

        get height() { return this.canvas.height; }
        set height(value) { this.canvas.height = value; }

        async saveFrame(filePath, format, quality) {
            // Browser implementation would use different method
            console.warn('saveFrame not implemented for browser');
        }

        getImageData() {
            return this.ctx.getImageData(0, 0, this.width, this.height);
        }

        putImageData(imageData, dx, dy) {
            this.ctx.putImageData(imageData, dx, dy);
        }

        clear() {
            this.ctx.clearRect(0, 0, this.width, this.height);
        }

        createImage() {
            return new Image();
        }

        toDataURL(type, quality) {
            return this.canvas.toDataURL(type, quality);
        }
    };

    NullAudioAdapter = class BrowserAudioAdapter {
        constructor() {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
            this.masterEnable = true;
            this.masterVolume = 1.0;
        }

        init() {
            // Browser audio initialization
        }

        setMasterEnable(enabled) {
            this.masterEnable = enabled;
        }

        setMasterVolume(volume) {
            this.masterVolume = volume;
        }

        getContext() {
            return this.context;
        }

        reset() {
            this.masterEnable = true;
            this.masterVolume = 1.0;
        }
    };

    NullInputAdapter = class BrowserInputAdapter {
        constructor() {
            this.keys = {};
            this.eatInput = false;
            this.setupEventListeners();
        }

        setupEventListeners() {
            document.addEventListener('keydown', (e) => {
                if (!this.eatInput) {
                    this.keys[e.code] = true;
                }
            });

            document.addEventListener('keyup', (e) => {
                this.keys[e.code] = false;
            });
        }

        registerKey(key, pressed) {
            this.keys[key] = pressed;
        }

        getKeyState(key) {
            return this.keys[key] || false;
        }

        reset() {
            this.keys = {};
        }

        setEatInput(eat) {
            this.eatInput = eat;
        }

        update() {
            // Browser input update logic
        }
    };
}

/**
 * Factory function to create appropriate adapters based on environment
 */
class AdapterFactory {
    static createCanvas(width = 240, height = 160) {
        return new CanvasAdapter(width, height);
    }

    static createAudio() {
        return new NullAudioAdapter();
    }

    static createInput() {
        return new NullInputAdapter();
    }
}

/**
 * Node.js compatible GameBoyAdvance class
 * Wraps the original GBA class with environment-specific adapters
 */
class NodeGameBoyAdvance {
    constructor() {
        this.canvas = null;
        this.audio = null;
        this.input = null;
        this.isNode = isNode;
        
        this.initializeAdapters();
    }

    initializeAdapters() {
        this.canvas = AdapterFactory.createCanvas(240, 160);
        this.audio = AdapterFactory.createAudio();
        this.input = AdapterFactory.createInput();
    }

    /**
     * Set up the emulator with adapters
     */
    setup() {
        // This would integrate with the original GameBoyAdvance class
        // For now, we'll provide the adapter instances
        return {
            canvas: this.canvas,
            audio: this.audio,
            input: this.input
        };
    }

    /**
     * Get environment information
     */
    getEnvironment() {
        return {
            isNode: this.isNode,
            isBrowser: !this.isNode
        };
    }
}

module.exports = {
    NodeGameBoyAdvance,
    AdapterFactory,
    CanvasAdapter,
    NullAudioAdapter,
    NullInputAdapter
};