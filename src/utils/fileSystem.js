import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_BIOS_PATH = path.resolve(__dirname, '..', 'resources', 'bios.bin');
const DEFAULT_SAVE_DIR = path.join(os.homedir(), '.gbajs2', 'saves');

export class FileSystem {
  constructor(options = {}) {
    const { biosPath = DEFAULT_BIOS_PATH, saveDir = DEFAULT_SAVE_DIR } = options;
    this.biosPath = biosPath;
    this.saveDir = saveDir;
  }

  async loadRom(source) {
    return this.loadBinary(source);
  }

  async loadBios(customPath) {
    const target = customPath || this.biosPath;
    return this.loadBinary(target);
  }

  async loadBinary(source) {
    if (!source) {
      throw new Error('未提供文件源');
    }

    if (source instanceof Uint8Array) {
      return new Uint8Array(source);
    }

    if (Buffer.isBuffer(source)) {
      return new Uint8Array(source);
    }

    if (typeof source === 'string') {
      const resolved = path.resolve(source);
      const data = await fs.promises.readFile(resolved);
      return new Uint8Array(data);
    }

    throw new Error('不支持的文件源类型');
  }

  async ensureDir(dirPath) {
    await fs.promises.mkdir(dirPath, { recursive: true });
  }

  getSavePath(romIdentifier) {
    const hash = this.getIdentifierHash(romIdentifier);
    return path.join(this.saveDir, `${hash}.sav`);
  }

  async writeSave(romIdentifier, data) {
    const target = this.getSavePath(romIdentifier);
    await this.saveBinary(target, data);
    logger.info(`存档已写入: ${target}`);
    return target;
  }

  async readSave(romIdentifier) {
    const target = this.getSavePath(romIdentifier);
    try {
      const data = await fs.promises.readFile(target);
      return new Uint8Array(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async saveBinary(filePath, data) {
    const dir = path.dirname(filePath);
    await this.ensureDir(dir);
    const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    await fs.promises.writeFile(tempPath, buffer);
    await fs.promises.rename(tempPath, filePath);
  }

  getIdentifierHash(identifier) {
    if (identifier instanceof Uint8Array || Buffer.isBuffer(identifier)) {
      return crypto.createHash('sha1').update(identifier).digest('hex');
    }

    if (typeof identifier === 'string') {
      return crypto.createHash('sha1').update(identifier).digest('hex');
    }

    throw new Error('无法计算存档标识');
  }
}

export default FileSystem;
