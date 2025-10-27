/**
 * GBA.js CLI - Main Entry Point
 * 
 * This is the main entry point for the Node.js version of the GBA emulator.
 */

// Import core modules
const { GameBoyAdvance } = require('./core/gba');
const { ARMCore } = require('./core/core');
const { GameBoyAdvanceMMU } = require('./core/mmu');

console.log('GBA.js CLI - Game Boy Advance Emulator for Node.js');

// Export the main module
module.exports = { GameBoyAdvance };
