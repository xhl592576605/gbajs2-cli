/**
 * Null Input Adapter for Node.js
 * Replaces keyboard/gamepad input with null implementation
 */

class NullInputAdapter {
    constructor() {
        this.keys = {};
        this.eatInput = false;
    }

    /**
     * Register key event (no-op)
     * @param {string} key - Key identifier
     * @param {boolean} pressed - Key state
     */
    registerKey(key, pressed) {
        this.keys[key] = pressed;
    }

    /**
     * Get current key state
     * @param {string} key - Key identifier
     * @returns {boolean} Key state
     */
    getKeyState(key) {
        return this.keys[key] || false;
    }

    /**
     * Reset all keys
     */
    reset() {
        this.keys = {};
    }

    /**
     * Set input eating (no-op)
     * @param {boolean} eat - Whether to eat input
     */
    setEatInput(eat) {
        this.eatInput = eat;
    }

    /**
     * Update input state (no-op)
     */
    update() {
        // No-op for Node.js
    }
}

module.exports = NullInputAdapter;