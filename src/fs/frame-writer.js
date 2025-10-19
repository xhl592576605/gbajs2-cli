/**
 * Frame Writer for Node.js
 * Handles saving captured frames to files
 */

const fs = require('fs-extra');
const path = require('path');

class FrameWriter {
    /**
     * @param {string} outputDir - Output directory path
     * @param {Object} options - Configuration options
     */
    constructor(outputDir, options = {}) {
        this.outputDir = path.resolve(outputDir);
        this.format = options.format || 'png';
        this.quality = options.quality || 95;
        this.frameCount = 0;
        this.startTime = Date.now();
        this.metadata = {
            frames: [],
            startTime: new Date().toISOString(),
            format: this.format,
            quality: this.quality
        };
    }

    /**
     * Initialize output directory
     * @returns {Promise<void>}
     */
    async initialize() {
        await fs.ensureDir(this.outputDir);
        
        // Create metadata file
        this.metadataPath = path.join(this.outputDir, 'metadata.json');
        await fs.writeJSON(this.metadataPath, this.metadata, { spaces: 2 });
    }

    /**
     * Save a frame to file
     * @param {Canvas|Object} canvas - Canvas instance or canvas-like object
     * @param {number} frameNumber - Frame number
     * @returns {Promise<string>} File path of saved frame
     */
    async saveFrame(canvas, frameNumber) {
        const filename = `frame_${String(frameNumber).padStart(6, '0')}.${this.format}`;
        const filePath = path.join(this.outputDir, filename);

        // Handle different canvas types
        let buffer;
        if (canvas.saveFrame) {
            // CanvasAdapter
            await canvas.saveFrame(filePath, this.format, this.quality);
        } else if (canvas.toBuffer) {
            // node-canvas
            if (this.format === 'png') {
                buffer = canvas.toBuffer('image/png');
            } else if (this.format === 'jpeg') {
                buffer = canvas.toBuffer('image/jpeg', { quality: this.quality / 100 });
            }
            await fs.writeFile(filePath, buffer);
        } else {
            throw new Error('Unsupported canvas type');
        }

        // Update metadata
        const stats = await fs.stat(filePath);
        this.metadata.frames.push({
            number: frameNumber,
            filename,
            size: stats.size,
            timestamp: Date.now() - this.startTime
        });

        this.frameCount++;

        // Update metadata file periodically
        if (this.frameCount % 10 === 0) {
            await this.updateMetadata();
        }

        return filePath;
    }

    /**
     * Update metadata file
     * @returns {Promise<void>}
     */
    async updateMetadata() {
        this.metadata.endTime = new Date().toISOString();
        this.metadata.totalFrames = this.frameCount;
        this.metadata.duration = Date.now() - this.startTime;
        this.metadata.averageFrameSize = this.metadata.frames.reduce((sum, f) => sum + f.size, 0) / this.frameCount;

        await fs.writeJSON(this.metadataPath, this.metadata, { spaces: 2 });
    }

    /**
     * Get progress information
     * @returns {Object} Progress info
     */
    getProgress() {
        return {
            frameCount: this.frameCount,
            elapsedTime: Date.now() - this.startTime,
            outputDir: this.outputDir
        };
    }

    /**
     * Clean up resources
     * @returns {Promise<void>}
     */
    async cleanup() {
        await this.updateMetadata();
    }
}

module.exports = FrameWriter;