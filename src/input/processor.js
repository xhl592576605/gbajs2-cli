/**
 * GBA Input Processor
 * Handles keyboard input and maps it to GBA buttons
 */

const readline = require('readline');
const { EventEmitter } = require('events');

class GBAInputProcessor extends EventEmitter {
  constructor() {
    super();

    // GBA button constants
    this.GBA_KEYS = {
      A: 0x0001,
      B: 0x0002,
      SELECT: 0x0004,
      START: 0x0008,
      RIGHT: 0x0010,
      LEFT: 0x0020,
      UP: 0x0040,
      DOWN: 0x0080,
      R: 0x0100,
      L: 0x0200
    };

    // Default keyboard mapping
    this.KEY_MAP = {
      // Arrow keys for D-pad
      'up': this.GBA_KEYS.UP,
      'down': this.GBA_KEYS.DOWN,
      'left': this.GBA_KEYS.LEFT,
      'right': this.GBA_KEYS.RIGHT,

      // Z and X for A and B
      'z': this.GBA_KEYS.A,
      'x': this.GBA_KEYS.B,
      'Z': this.GBA_KEYS.A,
      'X': this.GBA_KEYS.B,

      // Enter and Space for Start and Select
      'return': this.GBA_KEYS.START,
      'space': this.GBA_KEYS.SELECT,

      // Q and W for L and R
      'q': this.GBA_KEYS.L,
      'w': this.GBA_KEYS.R,
      'Q': this.GBA_KEYS.L,
      'W': this.GBA_KEYS.R,

      // Alternative mappings
      'a': this.GBA_KEYS.LEFT,
      'd': this.GBA_KEYS.RIGHT,
      'w': this.GBA_KEYS.UP,
      's': this.GBA_KEYS.DOWN,
      'j': this.GBA_KEYS.A,
      'k': this.GBA_KEYS.B,
      'shift': this.GBA_KEYS.SELECT,
      'escape': this.GBA_KEYS.START
    };

    this.currentKeys = 0;
    this.readline = null;
    this.enabled = false;
  }

  initialize() {
    if (this.enabled) {
      return true;
    }

    try {
      this.readline = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      // Set raw mode to capture individual key presses
      if (process.stdin.setRawMode) {
        process.stdin.setRawMode(true);
      }

      // Set stdin to emit key events
      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      // Listen for key events
      this.readline.input.on('data', (key) => {
        this.handleKeyPress(key);
      });

      this.enabled = true;
      console.log('Input system initialized successfully');
      console.log('Controls:');
      console.log('  D-Pad: Arrow keys or WASD');
      console.log('  A/B buttons: Z/X or J/K');
      console.log('  Start/Select: Enter/Space or Escape/Shift');
      console.log('  L/R buttons: Q/W');
      console.log('Press Ctrl+C to exit');

      return true;
    } catch (error) {
      console.warn('Failed to initialize input system:', error.message);
      return false;
    }
  }

  handleKeyPress(key) {
    if (key === '\u0003') {
      // Ctrl+C to exit
      this.emit('exit');
      return;
    }

    // Handle special keys
    if (key === '\u001b[A') {
      this.updateKey('up', true);
      return;
    }
    if (key === '\u001b[B') {
      this.updateKey('down', true);
      return;
    }
    if (key === '\u001b[C') {
      this.updateKey('right', true);
      return;
    }
    if (key === '\u001b[D') {
      this.updateKey('left', true);
      return;
    }

    // Handle regular keys
    if (key.length === 1) {
      // Key down
      this.updateKey(key, true);
    } else if (key.includes('\u0000')) {
      // Key up (Ctrl+key combinations)
      this.handleKeyUp(key);
    }
  }

  handleKeyUp(key) {
    // Extract the actual key from the sequence
    const actualKey = key.replace(/\u0000/g, '');
    this.updateKey(actualKey, false);
  }

  updateKey(key, pressed) {
    const gbaButton = this.KEY_MAP[key];
    if (gbaButton) {
      if (pressed) {
        this.currentKeys |= gbaButton;
      } else {
        this.currentKeys &= ~gbaButton;
      }

      this.emit('keychange', this.currentKeys);
    }
  }

  getCurrentKeys() {
    return this.currentKeys;
  }

  shutdown() {
    if (this.enabled) {
      if (this.readline) {
        this.readline.close();
      }

      if (process.stdin.setRawMode) {
        process.stdin.setRawMode(false);
      }

      process.stdin.pause();
      this.enabled = false;
      console.log('\nInput system shutdown');
    }
  }

  setKeyMapping(key, gbaButton) {
    this.KEY_MAP[key] = gbaButton;
  }

  getKeyMapping() {
    return { ...this.KEY_MAP };
  }
}

module.exports = { GBAInputProcessor };