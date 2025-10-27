#!/usr/bin/env node

/**
 * GBA.js CLI - Command Line Interface
 *
 * This is the CLI entry point for the GBA emulator.
 */

// Import dependencies
const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const { GameBoyAdvance } = require('../src/index');
const fs = require('fs');
const path = require('path');

// Import renderers
const { PNGRenderer } = require('../src/renderers/png');
const { ASCIIRenderer } = require('../src/renderers/ascii');

// Import audio system
const { GBAudioProcessor } = require('../src/audio/processor');

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 <rom-file> [options]')
  .demandCommand(1, 'You need to provide a ROM file')
  .option('renderer', {
    alias: 'r',
    type: 'string',
    default: 'ascii',
    describe: 'Renderer type: ascii, png, both',
    choices: ['ascii', 'png', 'both']
  })
  .option('output', {
    alias: 'o',
    type: 'string',
    describe: 'Output directory for PNG frames',
    default: './frames'
  })
  .option('fps', {
    alias: 'f',
    type: 'number',
    default: 60,
    describe: 'Frames per second'
  })
  .option('duration', {
    alias: 'd',
    type: 'number',
    default: 10,
    describe: 'Duration to run emulation (seconds)'
  })
  .option('color', {
    alias: 'c',
    type: 'boolean',
    default: false,
    describe: 'Enable color output for ASCII renderer'
  })
  .option('color-mode', {
    type: 'string',
    default: 'ansi256',
    describe: 'Color mode: ansi16, ansi256, rgb',
    choices: ['ansi16', 'ansi256', 'rgb']
  })
  .option('audio', {
    alias: 'a',
    type: 'boolean',
    default: true,
    describe: 'Enable audio output'
  })
  .help()
  .alias('help', 'h')
  .argv;

// Validate ROM file exists
const romFile = argv._[0];
if (!fs.existsSync(romFile)) {
  console.error(`Error: ROM file '${romFile}' not found`);
  process.exit(1);
}

console.log('GBA.js CLI - Starting Game Boy Advance Emulator');
console.log(`ROM file: ${romFile}`);
console.log(`Renderer: ${argv.renderer}`);
console.log(`FPS: ${argv.fps}`);
console.log(`Duration: ${argv.duration}s`);
console.log(`Audio: ${argv.audio ? 'enabled' : 'disabled'}`);

// Create an instance of the emulator
const gba = new GameBoyAdvance();
console.log('GBA emulator instance created successfully');

// Initialize audio system if enabled
let audioProcessor = null;
if (argv.audio) {
  audioProcessor = new GBAudioProcessor();
  if (audioProcessor.initialize()) {
    console.log('Audio system initialized successfully');
  } else {
    console.warn('Failed to initialize audio system');
    audioProcessor = null;
  }
}

// Load ROM file
const romBuffer = fs.readFileSync(romFile);
// Convert Buffer to ArrayBuffer
const romArrayBuffer = romBuffer.buffer.slice(
  romBuffer.byteOffset,
  romBuffer.byteOffset + romBuffer.byteLength
);

// Set up renderers based on arguments
let pngRenderer = null;
let asciiRenderer = null;

if (argv.renderer === 'png' || argv.renderer === 'both') {
  // Create output directory if it doesn't exist
  if (!fs.existsSync(argv.output)) {
    fs.mkdirSync(argv.output, { recursive: true });
  }
  pngRenderer = new PNGRenderer();
}

if (argv.renderer === 'ascii' || argv.renderer === 'both') {
  asciiRenderer = new ASCIIRenderer(240, 160, argv.color, argv.colorMode);
}

console.log('Renderers initialized successfully');

// Load ROM into emulator
if (!gba.setRom(romArrayBuffer)) {
  console.error('Failed to load ROM file');
  process.exit(1);
}

console.log('ROM loaded successfully');

// Set up canvas for video output
if (pngRenderer) {
  // For PNG renderer, we'll handle frames manually
  gba.video.setBacking(null);
} else if (asciiRenderer) {
  // For ASCII renderer, we'll handle frames manually
  gba.video.setBacking(null);
}

console.log('Starting emulation...');

// Run emulation for specified duration
const startTime = Date.now();
const durationMs = argv.duration * 1000;
let frameCount = 0;

// Set up frame callback
gba.video.vblankCallback = function () {
  frameCount++;

  // Get pixel data from video output
  if (gba.video.renderPath && gba.video.renderPath.palette) {
    // Add null check for buffer
    const pixelData = gba.video.renderPath.palette.buffer;
    if (!pixelData) {
      // console.warn("Warning: pixelData is undefined");
      return;
    }

    // Render with PNG renderer if enabled
    if (pngRenderer) {
      pngRenderer.render(pixelData, frameCount, argv.output);
    }

    // Render with ASCII renderer if enabled
    if (asciiRenderer) {
      const asciiOutput = asciiRenderer.render(pixelData);
      if (argv.renderer === 'ascii') {
        // Clear screen and output ASCII art
        process.stdout.write('\x1B[2J\x1B[H' + asciiOutput);
      } else if (argv.renderer === 'both') {
        console.log(`Frame ${frameCount} (ASCII):`);
        console.log(asciiOutput);
      }
    }
  }

  // Process audio samples if audio is enabled
  if (audioProcessor && gba.audio && gba.audio.left && gba.audio.right) {
    audioProcessor.processSamples(gba.audio.left, gba.audio.right);
  }
};

// Run emulation loop
const frameInterval = 1000 / argv.fps;
let lastFrameTime = Date.now();

function runEmulation() {
  const currentTime = Date.now();
  if (currentTime - startTime >= durationMs) {
    console.log(`Emulation completed. Processed ${frameCount} frames.`);
    process.exit(0);
  }

  // Run a frame
  gba.advanceFrame();

  // Schedule next frame
  const nextFrameTime = lastFrameTime + frameInterval;
  const delay = Math.max(0, nextFrameTime - Date.now());
  lastFrameTime = currentTime;

  setTimeout(runEmulation, delay);
}

// Start emulation
runEmulation();