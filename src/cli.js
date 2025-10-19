#!/usr/bin/env node

/**
 * CLI Interface for Node.js GBA Emulator
 * Main entry point for headless emulation
 */

const { Command } = require('commander');
const chalk = require('chalk').default || require('chalk');
const path = require('path');
const fs = require('fs-extra');

const ROMLoader = require('./fs/rom-loader');
const FrameWriter = require('./fs/frame-writer');
const CompleteGBAEmulator = require('./complete-emulator');

const program = new Command();

program
    .name('gba-emulator')
    .description('Node.js headless GBA emulator with video output')
    .version('1.0.0')
    .argument('<rom>', 'Path to GBA ROM file (.gba or .bin)')
    .option('-o, --output <dir>', 'Output directory for frames', './frames')
    .option('-f, --fps <number>', 'Frame rate (1-60)', '60')
    .option('-d, --duration <seconds>', 'Duration in seconds', '10')
    .option('--format <format>', 'Output format (png|jpeg)', 'png')
    .option('--quality <number>', 'JPEG quality (1-100)', '95')
    .option('-c, --config <file>', 'Configuration file path')
    .option('--no-progress', 'Disable progress output')
    .option('--verbose', 'Enable verbose logging');

/**
 * Main CLI execution function
 */
async function main() {
    const options = program.opts();
    const romPath = program.args[0];

    try {
        console.log('🎮 GBA Node.js Emulator Starting...');
        
        // Validate inputs
        validateInputs(options);
        
        // Load configuration
        const config = await loadConfiguration(options);
        
        // Load ROM
        console.log(`📁 Loading ROM: ${romPath}`);
        const romData = await ROMLoader.loadROM(romPath);
        const romMetadata = ROMLoader.getROMMetadata(romData);
        
        console.log(`✅ ROM loaded: ${romMetadata.title || 'Unknown'}`);
        console.log(`   Size: ${(romData.length / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   Code: ${romMetadata.gameCode}`);
        
        // Initialize frame writer
        const frameWriter = new FrameWriter(config.output, {
            format: config.format,
            quality: config.quality
        });
        
        await frameWriter.initialize();
        console.log(chalk.yellow(`📸 Output directory: ${config.output}`));
        
        // Initialize complete GBA emulator
        const emulator = new CompleteGBAEmulator();
        await emulator.initialize(romData);

        // Start emulation
        console.log(chalk.blue('🚀 Starting emulation...'));
        await runEmulation(emulator, frameWriter, config);
        
        // Cleanup
        await frameWriter.cleanup();
        console.log('✅ Emulation completed successfully!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (options.verbose) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

/**
 * Validate input parameters
 * @param {Object} options - CLI options
 */
function validateInputs(options) {
    const fps = parseInt(options.fps);
    if (isNaN(fps) || fps < 1 || fps > 60) {
        throw new Error('FPS must be between 1 and 60');
    }
    
    const duration = parseFloat(options.duration);
    if (isNaN(duration) || duration <= 0) {
        throw new Error('Duration must be positive number');
    }
    
    const quality = parseInt(options.quality);
    if (isNaN(quality) || quality < 1 || quality > 100) {
        throw new Error('Quality must be between 1 and 100');
    }
    
    if (!['png', 'jpeg'].includes(options.format)) {
        throw new Error('Format must be png or jpeg');
    }
}

/**
 * Load configuration from file if specified
 * @param {Object} options - CLI options
 * @returns {Object} Merged configuration
 */
async function loadConfiguration(options) {
    let config = {
        output: options.output,
        fps: parseInt(options.fps),
        duration: parseFloat(options.duration),
        format: options.format,
        quality: parseInt(options.quality),
        showProgress: options.progress,
        verbose: options.verbose
    };
    
    if (options.config) {
        const configPath = path.resolve(options.config);
        if (await fs.pathExists(configPath)) {
            const fileConfig = await fs.readJSON(configPath);
            config = { ...fileConfig, ...config }; // CLI args override file config
        } else {
            console.warn(chalk.yellow(`⚠️  Config file not found: ${configPath}`));
        }
    }
    
    return config;
}

/**
 * Run the emulation loop
 * @param {CompleteGBAEmulator} emulator - Complete GBA emulator instance
 * @param {FrameWriter} frameWriter - Frame writer
 * @param {Object} config - Configuration
 */
async function runEmulation(emulator, frameWriter, config) {
    const totalFrames = Math.floor(config.fps * config.duration);

    console.log(`🎬 Capturing ${totalFrames} frames at ${config.fps} FPS`);
    console.log(`⏱️  Duration: ${config.duration} seconds`);

    // Run complete GBA emulation with frame callback
    await emulator.runFrames(totalFrames, async (canvas, frameNumber) => {
        await frameWriter.saveFrame(canvas, frameNumber);

        // Progress reporting
        if (config.showProgress) {
            const progress = Math.floor((frameNumber / totalFrames) * 100);
            if (progress % 10 === 0) {
                console.log(`📈 Progress: ${progress}% (${frameNumber}/${totalFrames} frames)`);
            }
        }
    });
}


// Handle CLI execution
if (require.main === module) {
    program.parse();
    main();
}

module.exports = { main, program };