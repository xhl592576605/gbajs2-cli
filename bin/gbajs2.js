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

// Import input system
const { GBAInputProcessor } = require('../src/input/processor');

// Import save manager
const { GBASaveManager } = require('../src/save/manager');

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
  .option('input', {
    alias: 'i',
    type: 'boolean',
    default: true,
    describe: 'Enable keyboard input'
  })
  .option('save-path', {
    type: 'string',
    describe: 'Save game data directory',
    default: './saves'
  })
  .option('headless', {
    type: 'boolean',
    default: false,
    describe: 'Run in headless mode (no output)'
  })
  .option('scale', {
    type: 'number',
    default: 1,
    describe: 'Scale factor for PNG output (e.g., 2 for 2x size)'
  })
  .option('quality', {
    type: 'number',
    default: 0.9,
    describe: 'Image quality for JPEG output (0.0-1.0)'
  })
  .option('format', {
    type: 'string',
    default: 'png',
    describe: 'Output image format for PNG renderer',
    choices: ['png', 'jpeg', 'jpg']
  })
  .option('smoothing', {
    type: 'boolean',
    default: true,
    describe: 'Enable image smoothing for scaled output'
  })
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    default: false,
    describe: 'Enable verbose output'
  })
  .option('debug', {
    alias: 'D',
    type: 'boolean',
    default: false,
    describe: 'Enable debug mode'
  })
  .option('stats', {
    type: 'boolean',
    default: false,
    describe: 'Show performance statistics'
  })
  .option('autosave', {
    type: 'boolean',
    default: true,
    describe: 'Enable automatic save system'
  })
  .option('autosave-interval', {
    type: 'number',
    default: 30,
    describe: 'Autosave interval in seconds'
  })
  .option('cleanup-days', {
    type: 'number',
    default: 30,
    describe: 'Days to keep old save files'
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
console.log(`Input: ${argv.input ? 'enabled' : 'disabled'}`);
console.log(`Save path: ${argv.savePath}`);
console.log(`Headless: ${argv.headless ? 'yes' : 'no'}`);
console.log(`Verbose: ${argv.verbose ? 'enabled' : 'disabled'}`);
console.log(`Debug: ${argv.debug ? 'enabled' : 'disabled'}`);
console.log(`Stats: ${argv.stats ? 'enabled' : 'disabled'}`);
console.log(`Autosave: ${argv.autosave ? 'enabled' : 'disabled'} (${argv.autosaveInterval}s)`);
if (argv.renderer === 'png' || argv.renderer === 'both') {
  console.log(`Scale: ${argv.scale}x`);
  console.log(`Format: ${argv.format.toUpperCase()}`);
  console.log(`Quality: ${argv.quality}`);
  console.log(`Smoothing: ${argv.smoothing ? 'enabled' : 'disabled'}`);
}

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

// Initialize input system if enabled
let inputProcessor = null;
if (argv.input && !argv.headless) {
  inputProcessor = new GBAInputProcessor();
  if (inputProcessor.initialize()) {
    console.log('Input system initialized successfully');

    // Set up key change handler
    inputProcessor.on('keychange', (keys) => {
      // Update GBA keypad state
      if (gba.keypad) {
        gba.keypad.registerKeypadState(keys);
      }
    });

    // Set up exit handler
    inputProcessor.on('exit', () => {
      console.log('\nShutting down emulator...');
      inputProcessor.shutdown();
      if (audioProcessor) {
        audioProcessor.shutdown();
      }
      if (saveManager) {
        saveManager.shutdown();
      }
      process.exit(0);
    });
  } else {
    console.warn('Failed to initialize input system');
    inputProcessor = null;
  }
}

// Initialize save manager
let saveManager = null;
try {
  saveManager = new GBASaveManager(argv.savePath);
  if (saveManager.initialize()) {
    console.log('Save manager initialized successfully');

    // Configure autosave settings
    if (argv.autosave) {
      saveManager.enableAutosave(argv.autosaveInterval);
      console.log(`Autosave enabled: ${argv.autosaveInterval}s interval`);
    } else {
      saveManager.disableAutosave();
      console.log('Autosave disabled');
    }

    // Set up process exit handlers for save cleanup
    process.on('SIGINT', () => {
      console.log('\nCaught interrupt signal');
      if (saveManager) {
        saveManager.shutdown();
      }
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\nCaught terminate signal');
      if (saveManager) {
        saveManager.shutdown();
      }
      process.exit(0);
    });
  } else {
    console.warn('Failed to initialize save manager');
    saveManager = null;
  }
} catch (error) {
  console.warn('Save manager initialization error:', error.message);
  saveManager = null;
}

// Load BIOS file
const biosFile = path.join(path.dirname(romFile), 'bios.bin');
let biosArrayBuffer = null;
if (fs.existsSync(biosFile)) {
  const biosBuffer = fs.readFileSync(biosFile);
  // Convert Buffer to ArrayBuffer
  biosArrayBuffer = biosBuffer.buffer.slice(
    biosBuffer.byteOffset,
    biosBuffer.byteOffset + biosBuffer.byteLength
  );
} else {
  console.warn('Warning: BIOS file not found. Using null BIOS.');
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

  // Create PNG renderer with options
  const pngOptions = {
    scale: argv.scale,
    quality: argv.quality,
    format: argv.format,
    enableSmoothing: argv.smoothing
  };
  pngRenderer = new PNGRenderer(240, 160, argv.output, pngOptions);
}

if (argv.renderer === 'ascii' || argv.renderer === 'both') {
  asciiRenderer = new ASCIIRenderer(240, 160, argv.color, argv.colorMode);
}

console.log('Renderers initialized successfully');

// Load BIOS into emulator
if (biosArrayBuffer) {
  gba.setBios(biosArrayBuffer, true);
  console.log('BIOS loaded successfully');
} else {
  console.warn('No BIOS loaded');
}

// Load ROM into emulator
if (!gba.setRom(romArrayBuffer)) {
  console.error('Failed to load ROM file');
  process.exit(1);
}

console.log('ROM loaded successfully');

// Load save data if available
if (saveManager && gba.rom) {
  const saveData = saveManager.loadSaveData(romBuffer, gba.rom.title);
  if (saveData) {
    gba.setSavedata(saveData);
    console.log('Save data loaded successfully');
  } else {
    console.log('No existing save data found');
  }

  // Override save methods to use our save manager
  gba.storeSavedata = () => {
    if (saveManager && gba.mmu.save) {
      const saveBuffer = gba.mmu.save.buffer;
      if (saveBuffer && saveBuffer.byteLength > 0) {
        const success = saveManager.saveGameData(romBuffer, gba.rom.title, saveBuffer);
        if (success) {
          console.log('Game saved successfully');
        }
      }
    }
  };

  gba.retrieveSavedata = () => {
    if (saveManager) {
      const saveData = saveManager.loadSaveData(romBuffer, gba.rom.title);
      if (saveData) {
        gba.setSavedata(saveData);
        return true;
      }
    }
    return false;
  };
}

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
    // Show completion message
    console.log(`Emulation completed. Processed ${frameCount} frames.`);

    // Show statistics if enabled
    if (argv.stats) {
      const totalTime = (currentTime - startTime) / 1000;
      const fps = frameCount / totalTime;
      console.log(`Performance: ${fps.toFixed(2)} FPS average, ${totalTime.toFixed(2)}s total`);

      if (audioProcessor) {
        const audioStats = audioProcessor.getPerformanceStats();
        console.log('Audio Statistics:');
        console.log(`  Processed samples: ${audioStats.processedSamples}`);
        console.log(`  Dropped samples: ${audioStats.droppedSamples}`);
        console.log(`  Drop rate: ${(audioStats.dropRate * 100).toFixed(2)}%`);
        console.log(`  Buffer utilization: ${(audioStats.bufferUtilization * 100).toFixed(1)}%`);
        console.log(`  Average latency: ${audioStats.averageLatency.toFixed(2)}ms`);
      }

      if (saveManager) {
        const saveFiles = saveManager.listSaveFiles();
        console.log(`Save files: ${saveFiles.length}`);
        if (saveFiles.length > 0) {
          const totalSize = saveFiles.reduce((sum, file) => sum + file.size, 0);
          console.log(`Total save size: ${(totalSize / 1024).toFixed(2)}KB`);
        }
      }
    }

    // Cleanup old save files if enabled
    if (saveManager && argv.autosave && argv.cleanupDays > 0) {
      const deletedCount = saveManager.cleanupOldSaves(argv.cleanupDays);
      if (deletedCount > 0) {
        console.log(`Cleaned up ${deletedCount} old save files`);
      }
    }

    // Shutdown systems
    if (inputProcessor) {
      inputProcessor.shutdown();
    }
    if (audioProcessor) {
      audioProcessor.shutdown();
    }
    if (saveManager) {
      saveManager.shutdown();
    }

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