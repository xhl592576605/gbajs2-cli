/**
 * Node.js Canvas Adapter
 * Provides HTML5 Canvas API compatibility for Node.js environment
 */

const { createCanvas, Image } = require('canvas');
const fs = require('fs-extra');
const path = require('path');

class CanvasAdapter {
    constructor(width = 240, height = 160) {
        this.width = width;
        this.height = height;
        this.canvas = createCanvas(width, height);
        this.ctx = this.canvas.getContext('2d');
        this.imageData = null;
    }

    /**
     * Get the 2D rendering context
     * @returns {CanvasRenderingContext2D} Canvas 2D context
     */
    getContext(type) {
        if (type === '2d') {
            return this.ctx;
        }
        throw new Error(`Context type '${type}' not supported`);
    }

    /**
     * Get image data (for GBA compatibility)
     * @returns {ImageData} Image data
     */
    getImageData() {
        return this.ctx.getImageData(0, 0, this.width, this.height);
    }

    /**
     * Put image data (for GBA compatibility)
     * @param {ImageData} imageData - Image data
     * @param {number} dx - X coordinate
     * @param {number} dy - Y coordinate
     */
    putImageData(imageData, dx, dy) {
        this.ctx.putImageData(imageData, dx, dy);
    }

    /**
     * Clear canvas
     */
    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height);
    }

    /**
     * Create image (for GBA compatibility)
     * @returns {Image} Image object
     */
    createImage() {
        return new Image();
    }

    /**
     * Convert to data URL (for GBA compatibility)
     * @param {string} type - MIME type
     * @param {number} quality - Quality (0-1)
     * @returns {string} Data URL
     */
    toDataURL(type, quality) {
        return this.canvas.toDataURL(type, quality);
    }

    /**
     * Get canvas width
     * @returns {number} Canvas width
     */
    get width() {
        return this._width;
    }

    set width(value) {
        this._width = value;
        if (this.canvas) {
            this.canvas.width = value;
        }
    }

    /**
     * Get canvas height
     * @returns {number} Canvas height
     */
    get height() {
        return this._height;
    }

    set height(value) {
        this._height = value;
        if (this.canvas) {
            this.canvas.height = value;
        }
    }

    /**
     * Save current frame to file
     * @param {string} filePath - Output file path
     * @param {string} format - 'png' or 'jpeg'
     * @param {number} quality - Quality for JPEG (0-100)
     * @returns {Promise<void>}
     */
    async saveFrame(filePath, format = 'png', quality = 95) {
        const buffer = format === 'png' 
            ? this.canvas.toBuffer('image/png')
            : this.canvas.toBuffer('image/jpeg', { quality: quality / 100 });
        
        await fs.ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, buffer);
    }

    /**
     * Get pixel data as buffer
     * @returns {Buffer} RGBA pixel data
     */
    getImageData() {
        return this.ctx.getImageData(0, 0, this.width, this.height);
    }

    /**
     * Put pixel data onto canvas
     * @param {ImageData} imageData - Image data to draw
     * @param {number} dx - Destination x
     * @param {number} dy - Destination y
     */
    putImageData(imageData, dx, dy) {
        this.ctx.putImageData(imageData, dx, dy);
    }

    /**
     * Clear the canvas
     */
    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height);
    }

    /**
     * Create an Image object (browser compatible)
     * @returns {Image} Canvas Image instance
     */
    createImage() {
        return new Image();
    }

    /**
     * Convert canvas to data URL (browser compatible)
     * @param {string} type - MIME type
     * @param {number} quality - Quality for lossy formats
     * @returns {string} Data URL
     */
    toDataURL(type = 'image/png', quality = 0.92) {
        return this.canvas.toDataURL(type, quality);
    }
}

module.exports = CanvasAdapter;