/**
 * Null Audio Adapter for Node.js
 * Replaces Web Audio API with null implementation
 */

class NullAudioAdapter {
    constructor() {
        this.context = null;
        this.masterEnable = true;
        this.masterVolume = 1.0;
    }

    /**
     * Initialize audio (no-op in Node.js)
     */
    init() {
        // No-op for Node.js
    }

    /**
     * Enable/disable audio (no-op)
     * @param {boolean} enabled - Enable audio
     */
    setMasterEnable(enabled) {
        this.masterEnable = enabled;
    }

    /**
     * Set master volume (no-op)
     * @param {number} volume - Volume level (0-1)
     */
    setMasterVolume(volume) {
        this.masterVolume = volume;
    }

    /**
     * Get audio context (returns null in Node.js)
     * @returns {null}
     */
    getContext() {
        return null;
    }

    /**
     * Reset audio state
     */
    reset() {
        this.masterEnable = true;
        this.masterVolume = 1.0;
    }
}

module.exports = NullAudioAdapter;