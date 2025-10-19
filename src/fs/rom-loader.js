/**
 * ROM Loader for Node.js
 * Handles GBA ROM file loading and validation
 */

const fs = require('fs-extra');
const path = require('path');

class ROMLoader {
    /**
     * Load and validate GBA ROM file
     * @param {string} filePath - Path to ROM file
     * @returns {Promise<Buffer>} ROM data buffer
     */
    static async loadROM(filePath) {
        if (!filePath) {
            throw new Error('ROM file path is required');
        }

        const resolvedPath = path.resolve(filePath);
        
        // Check file existence
        if (!await fs.pathExists(resolvedPath)) {
            throw new Error(`ROM file not found: ${resolvedPath}`);
        }

        // Check file extension
        const ext = path.extname(resolvedPath).toLowerCase();
        if (!['.gba', '.bin'].includes(ext)) {
            throw new Error(`Unsupported file extension: ${ext}. Use .gba or .bin`);
        }

        // Check file size
        const stats = await fs.stat(resolvedPath);
        if (stats.size === 0) {
            throw new Error('ROM file is empty');
        }
        if (stats.size > 32 * 1024 * 1024) {
            throw new Error('ROM file too large (max 32MB)');
        }

        // Read ROM data
        const romData = await fs.readFile(resolvedPath);

        // Validate ROM header
        this.validateROMHeader(romData);

        return romData;
    }

    /**
     * Validate GBA ROM header
     * @param {Buffer} romData - ROM data buffer
     * @throws {Error} If ROM header is invalid
     */
    static validateROMHeader(romData) {
        if (romData.length < 192) {
            throw new Error('ROM file too small to be valid GBA ROM');
        }

        // Check Nintendo logo (offset 0x04-0x9F)
        const nintendoLogo = Buffer.from([
            0x24, 0xFF, 0xAE, 0x51, 0x69, 0x9A, 0xA2, 0x21,
            0x3D, 0x84, 0x82, 0x0A, 0x84, 0xE4, 0x09, 0xAD,
            0x11, 0x24, 0x8B, 0x98, 0xC0, 0x81, 0x7F, 0x21,
            0xA3, 0x52, 0xBE, 0x19, 0x93, 0x09, 0xCE, 0x20,
            0x10, 0x46, 0x4A, 0x4A, 0xF8, 0x27, 0x31, 0xEC,
            0x58, 0xC7, 0xE8, 0x33, 0x82, 0xE3, 0xCE, 0xBF,
            0x85, 0xF4, 0xDF, 0x94, 0xCE, 0x4B, 0x09, 0xC1,
            0x94, 0x56, 0x8A, 0xC0, 0x13, 0x72, 0xA7, 0xFC,
            0x9F, 0x84, 0x4D, 0x73, 0xA3, 0xCA, 0x9A, 0x61,
            0x58, 0x97, 0xA3, 0x27, 0xFC, 0x03, 0x98, 0x76,
            0x23, 0x1D, 0xC7, 0x61, 0x03, 0x04, 0xAE, 0x56,
            0xBF, 0x38, 0x84, 0x00, 0x40, 0xA7, 0x0E, 0xFD,
            0xFF, 0x52, 0xFE, 0x03, 0x6F, 0x95, 0x30, 0xF1,
            0x97, 0xFB, 0xC0, 0x85, 0x60, 0xD6, 0x80, 0x25,
            0xA9, 0x63, 0xBE, 0x03, 0x01, 0x4E, 0x38, 0xE2,
            0xF9, 0xA2, 0x34, 0xFF, 0xBB, 0x3E, 0x03, 0x44,
            0x78, 0x00, 0x90, 0xCB, 0x88, 0x11, 0x3A, 0x94,
            0x65, 0xC0, 0x7C, 0x63, 0x87, 0xF0, 0x3C, 0xAF,
            0xD6, 0x25, 0xE4, 0x8B, 0x38, 0x0A, 0xAC, 0x72,
            0x21, 0xD4, 0xF8, 0x07
        ]);

        const logoOffset = 0x04;
        const romLogo = romData.slice(logoOffset, logoOffset + 156);
        
        if (!nintendoLogo.equals(romLogo)) {
            throw new Error('Invalid Nintendo logo in ROM header');
        }

        // Check ROM entry point (offset 0x00-0x03)
        const entryPoint = romData.readUInt32LE(0);
        if (entryPoint === 0) {
            throw new Error('Invalid ROM entry point');
        }
    }

    /**
     * Get ROM metadata
     * @param {Buffer} romData - ROM data buffer
     * @returns {Object} ROM metadata
     */
    static getROMMetadata(romData) {
        const title = romData.slice(0xA0, 0xAC).toString('ascii').replace(/\0/g, '').trim();
        const gameCode = romData.slice(0xAC, 0xB0).toString('ascii');
        const makerCode = romData.slice(0xB0, 0xB2).toString('ascii');
        const version = romData[0xBC];

        return {
            title,
            gameCode,
            makerCode,
            version,
            size: romData.length
        };
    }
}

module.exports = ROMLoader;