/**
 * GBA Save Manager
 * Handles game save data in Node.js environment
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class GBASaveManager {
  constructor(savePath = './saves') {
    this.savePath = savePath;
    this.saves = new Map();
    this.autosaveInterval = null;
    this.autosaveEnabled = true;
    this.autosaveIntervalMs = 30000; // 30 seconds
  }

  initialize() {
    try {
      // Create save directory if it doesn't exist
      if (!fs.existsSync(this.savePath)) {
        fs.mkdirSync(this.savePath, { recursive: true });
      }

      console.log(`Save manager initialized with path: ${this.savePath}`);
      return true;
    } catch (error) {
      console.error('Failed to initialize save manager:', error.message);
      return false;
    }
  }

  // Generate a unique save name based on ROM data
  generateSaveName(romData, romTitle) {
    // Create hash of ROM data for unique identification
    const hash = crypto.createHash('md5').update(romData).digest('hex').substring(0, 8);
    const title = romTitle || 'unknown';
    const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
    return `${safeTitle}_${hash}`;
  }

  // Load save data for a specific ROM
  loadSaveData(romData, romTitle) {
    const saveName = this.generateSaveName(romData, romTitle);
    const saveFile = path.join(this.savePath, `${saveName}.sav`);

    if (fs.existsSync(saveFile)) {
      try {
        const saveData = fs.readFileSync(saveFile);
        this.saves.set(saveName, saveData);
        console.log(`Loaded save data: ${saveName}`);
        return saveData;
      } catch (error) {
        console.warn(`Failed to load save data for ${saveName}:`, error.message);
      }
    }

    return null;
  }

  // Save game data for a specific ROM
  saveGameData(romData, romTitle, saveData) {
    const saveName = this.generateSaveName(romData, romTitle);
    const saveFile = path.join(this.savePath, `${saveName}.sav`);

    try {
      fs.writeFileSync(saveFile, saveData);
      this.saves.set(saveName, saveData);
      console.log(`Saved game data: ${saveName}`);
      return true;
    } catch (error) {
      console.error(`Failed to save game data for ${saveName}:`, error.message);
      return false;
    }
  }

  // Check if save data exists for a ROM
  hasSaveData(romData, romTitle) {
    const saveName = this.generateSaveName(romData, romTitle);
    const saveFile = path.join(this.savePath, `${saveName}.sav`);
    return fs.existsSync(saveFile);
  }

  // Delete save data for a ROM
  deleteSaveData(romData, romTitle) {
    const saveName = this.generateSaveName(romData, romTitle);
    const saveFile = path.join(this.savePath, `${saveName}.sav`);

    try {
      if (fs.existsSync(saveFile)) {
        fs.unlinkSync(saveFile);
        this.saves.delete(saveName);
        console.log(`Deleted save data: ${saveName}`);
        return true;
      }
    } catch (error) {
      console.error(`Failed to delete save data for ${saveName}:`, error.message);
    }

    return false;
  }

  // List all save files
  listSaveFiles() {
    try {
      const files = fs.readdirSync(this.savePath)
        .filter(file => file.endsWith('.sav'))
        .map(file => {
          const filePath = path.join(this.savePath, file);
          const stats = fs.statSync(filePath);
          return {
            name: file.replace('.sav', ''),
            file: file,
            size: stats.size,
            modified: stats.mtime
          };
        })
        .sort((a, b) => b.modified - a.modified);

      return files;
    } catch (error) {
      console.error('Failed to list save files:', error.message);
      return [];
    }
  }

  // Export save data to a different location
  exportSaveData(romData, romTitle, exportPath) {
    const saveName = this.generateSaveName(romData, romTitle);
    const saveFile = path.join(this.savePath, `${saveName}.sav`);

    try {
      if (fs.existsSync(saveFile)) {
        fs.copyFileSync(saveFile, exportPath);
        console.log(`Exported save data to: ${exportPath}`);
        return true;
      }
    } catch (error) {
      console.error(`Failed to export save data:`, error.message);
    }

    return false;
  }

  // Import save data from a file
  importSaveData(romData, romTitle, importPath) {
    try {
      if (fs.existsSync(importPath)) {
        const saveData = fs.readFileSync(importPath);
        return this.saveGameData(romData, romTitle, saveData);
      }
    } catch (error) {
      console.error(`Failed to import save data:`, error.message);
    }

    return false;
  }

  // Enable autosave with specific interval
  enableAutosave(intervalSeconds = 30) {
    this.autosaveEnabled = true;
    this.autosaveIntervalMs = intervalSeconds * 1000;

    if (this.autosaveInterval) {
      clearInterval(this.autosaveInterval);
      this.autosaveInterval = null;
    }

    this.autosaveInterval = setInterval(() => {
      this.performAutosave();
    }, this.autosaveIntervalMs);
    console.log(`Autosave enabled: ${intervalSeconds}s interval`);
  }

  // Disable autosave
  disableAutosave() {
    this.autosaveEnabled = false;

    if (this.autosaveInterval) {
      clearInterval(this.autosaveInterval);
      this.autosaveInterval = null;
    }

    console.log('Autosave disabled');
  }

  // Enable/disable autosave (legacy method)
  setAutosave(enabled, intervalMs = 30000) {
    if (enabled) {
      this.enableAutosave(intervalMs / 1000);
    } else {
      this.disableAutosave();
    }
  }

  // Perform autosave for all loaded saves
  performAutosave() {
    console.log('Performing autosave...');
    let savedCount = 0;

    for (const [saveName, saveData] of this.saves) {
      const saveFile = path.join(this.savePath, `${saveName}.sav`);
      try {
        fs.writeFileSync(saveFile, saveData);
        savedCount++;
      } catch (error) {
        console.warn(`Autosave failed for ${saveName}:`, error.message);
      }
    }

    if (savedCount > 0) {
      console.log(`Autosave completed: ${savedCount} files saved`);
    }
  }

  // Get save file size
  getSaveSize(romData, romTitle) {
    const saveName = this.generateSaveName(romData, romTitle);
    const saveFile = path.join(this.savePath, `${saveName}.sav`);

    try {
      if (fs.existsSync(saveFile)) {
        const stats = fs.statSync(saveFile);
        return stats.size;
      }
    } catch (error) {
      console.warn(`Failed to get save size for ${saveName}:`, error.message);
    }

    return 0;
  }

  // Cleanup old save files
  cleanupOldSaves(daysOld = 30) {
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    try {
      const files = fs.readdirSync(this.savePath);
      for (const file of files) {
        if (file.endsWith('.sav')) {
          const filePath = path.join(this.savePath, file);
          const stats = fs.statSync(filePath);

          if (stats.mtime.getTime() < cutoffTime) {
            fs.unlinkSync(filePath);
            deletedCount++;
            console.log(`Deleted old save file: ${file}`);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old saves:', error.message);
    }

    return deletedCount;
  }

  // Shutdown save manager
  shutdown() {
    if (this.autosaveInterval) {
      clearInterval(this.autosaveInterval);
      this.autosaveInterval = null;
    }

    // Perform final save
    this.performAutosave();
    console.log('Save manager shutdown complete');
  }
}

module.exports = { GBASaveManager };