# GBA.js2 Node.js改造完整设计方案 (ES模块版)

## 项目概述

将基于HTML5的GBA.js2模拟器改造成Node.js终端版本，创建一个功能完整的命令行GBA模拟器，具有彩色终端渲染、音频输出和键盘控制功能。

## 技术选型最终确认

### 核心技术栈
- **UI框架**: ink v3 (React终端UI框架)
- **渲染方式**: 直接像素→字符映射 + Unicode块字符(█▄▀░)
- **字符映射**: 可配置缩放比例 (--scale参数控制)
- **音频输出**: node-speaker + 静音降级策略
- **并发处理**: 多Worker模式 (渲染Worker + 音频Worker)
- **输入处理**: ink useInput钩子
- **项目结构**: 复制原文件到新目录改造
- **存档格式**: 保持原浏览器格式兼容
- **日志系统**: error/warn/info/debug分级日志
- **模块系统**: ES模块 (type: "module")
- **包管理器**: pnpm

## 项目结构设计

```
gbajs2-cli/
├── package.json                    # 项目配置和依赖
├── index.js                        # CLI入口文件
├── README.md                       # 用户文档
├── bin/
│   └── gbajs2                      # 可执行文件
├── src/
│   ├── gba/                        # 复制并改造的GBA核心代码
│   │   ├── gba.js                  # 主模拟器(去Canvas化)
│   │   ├── core.js                 # ARM核心
│   │   ├── mmu.js                  # 内存管理
│   │   ├── audio.js                # 音频系统(去WebAudio)
│   │   ├── video.js                # 视频控制(去Canvas)
│   │   └── ...
│   ├── workers/                    # Worker线程
│   │   ├── renderWorker.js         # 渲染处理Worker
│   │   └── audioWorker.js          # 音频处理Worker
│   ├── components/                 # ink React组件
│   │   ├── App.js                  # 主应用组件
│   │   ├── GameDisplay.js          # 游戏画面显示
│   │   ├── StatusBar.js            # 状态信息栏
│   │   └── ErrorBoundary.js        # 错误边界
│   ├── utils/                      # 工具函数
│   │   ├── pixelMapper.js          # 像素→字符映射
│   │   ├── logger.js               # 分级日志系统
│   │   ├── audioAdapter.js         # 音频适配器
│   │   └── fileSystem.js           # 文件系统接口
│   └── game/                       # 游戏逻辑
│       ├── GameCore.js             # 游戏核心控制器
│       ├── InputHandler.js         # 输入处理
│       └── SaveManager.js          # 存档管理
└── web/
    ├── index.html                  # 遗留 Web 版入口
    ├── console.html                # Web 调试控制台
    ├── debugger.html               # Web 调试工具
    ├── resources/                  # Web 静态资源 (CSS/图片/浏览器 BIOS)
    └── js/                         # Web 版旧核心代码
```

## 核心依赖清单

```json
{
  "name": "gbajs2-cli",
  "version": "1.0.0",
  "description": "Node.js终端GBA模拟器",
  "type": "module",
  "main": "index.js",
  "bin": {
    "gbajs2": "./bin/gbajs2"
  },
  "dependencies": {
    "ink": "^3.2.0",
    "react": "^17.0.0",
    "node-speaker": "^0.5.0",
    "ansi-colors": "^4.1.0",
    "cac": "^6.7.0",
    "chalk": "^4.1.0"
  },
  "devDependencies": {
    "eslint": "^8.0.0",
    "prettier": "^2.0.0",
    "jest": "^28.0.0"
  },
  "packageManager": "pnpm@8.0.0"
}
```

## 命令行接口设计

```bash
# 基本用法
gbajs2 run <rom-file> [options]

# 选项说明
--bios, -b <path>        # BIOS文件路径 (可选)
--save, -s <path>        # 存档文件路径
--scale, -c <number>     # 字符缩放比例 (默认: 3x6像素块)
--no-audio               # 禁用音频输出
--log-level <level>      # 日志级别: error|warn|info|debug
--debug                  # 显示详细调试信息
--help, -h               # 显示帮助信息

# 示例
gbajs2 run pokemon.gba --save ./saves/pokemon.sav --scale 2
gbajs2 run zelda.gba --no-audio --log-level warn
```

## 核心技术实现

### 1. 像素到字符映射算法

#### 1.1 像素映射器设计 (ES模块)

```javascript
// src/renderers/terminal/pixelMapper.js
export class PixelMapper {
  constructor(scaleX = 3, scaleY = 6) {
    this.scaleX = scaleX;  // 水平像素块大小
    this.scaleY = scaleY;  // 垂直像素块大小
    this.charWidth = Math.floor(240 / scaleX);
    this.charHeight = Math.floor(160 / scaleY);
  }

  // 像素块分析
  analyzePixelBlock(pixels, x, y) {
    let r = 0, g = 0, b = 0, count = 0;
    
    // 计算像素块平均颜色
    for (let dy = 0; dy < this.scaleY; dy++) {
      for (let dx = 0; dx < this.scaleX; dx++) {
        const idx = ((y + dy) * 240 + (x + dx)) * 4;
        r += pixels[idx];
        g += pixels[idx + 1];
        b += pixels[idx + 2];
        count++;
      }
    }
    
    r = Math.floor(r / count);
    g = Math.floor(g / count);
    b = Math.floor(b / count);
    
    return {
      char: this.pixelToChar(r, g, b),
      fg: this.rgbToAnsiFg(r, g, b),
      bg: this.rgbToAnsiBg(r, g, b)
    };
  }

  // RGB到字符映射 (基于亮度)
  pixelToChar(r, g, b) {
    const brightness = (r + g + b) / 3;
    const chars = [' ', '░', '▒', '▓', '█'];
    return chars[Math.floor(brightness / 51)];
  }

  // RGB到ANSI 256色转换
  rgbToAnsi256(r, g, b) {
    if (r === g && g === b) {
      if (r < 8) return 16;
      if (r > 248) return 231;
      return Math.round(((r - 8) / 247) * 24) + 232;
    }
    
    return 16 + (36 * Math.round(r / 255 * 5)) + 
           (6 * Math.round(g / 255 * 5)) + 
           Math.round(b / 255 * 5);
  }

  // RGB到ANSI前景色
  rgbToAnsiFg(r, g, b) {
    const ansi = this.rgbToAnsi256(r, g, b);
    return `\x1b[38;5;${ansi}m`;
  }

  // RGB到ANSI背景色
  rgbToAnsiBg(r, g, b) {
    const ansi = this.rgbToAnsi256(r, g, b);
    return `\x1b[48;5;${ansi}m`;
  }
}

export default PixelMapper;
```

### 2. Worker线程渲染处理

#### 2.1 渲染Worker实现 (ES模块)

```javascript
// src/renderers/terminal/renderWorker.js
import { parentPort } from 'worker_threads';
import PixelMapper from '../renderers/terminal/pixelMapper.js';

class RenderWorker {
  constructor() {
    this.mapper = new PixelMapper();
    this.frameCount = 0;
    this.lastTime = Date.now();
  }

  processFrame(pixelData) {
    try {
      const startTime = Date.now();
      const charMatrix = [];
      
      // 240x160像素 → 字符矩阵
      for (let y = 0; y < 160; y += this.mapper.scaleY) {
        const row = [];
        for (let x = 0; x < 240; x += this.mapper.scaleX) {
          const pixel = this.mapper.analyzePixelBlock(pixelData, x, y);
          row.push(pixel);
        }
        charMatrix.push(row);
      }
      
      // 计算FPS
      this.frameCount++;
      const now = Date.now();
      const fps = this.frameCount / ((now - this.lastTime) / 1000);
      
      parentPort.postMessage({
        type: 'frame',
        data: charMatrix,
        timestamp: now,
        fps: Math.round(fps * 10) / 10,
        renderTime: Date.now() - startTime
      });
    } catch (error) {
      parentPort.postMessage({
        type: 'error',
        error: error.message,
        stack: error.stack
      });
    }
  }

  updateScale(scaleX, scaleY) {
    this.mapper = new PixelMapper(scaleX, scaleY);
  }
}

const worker = new RenderWorker();

parentPort.on('message', (data) => {
  switch (data.type) {
    case 'render':
      worker.processFrame(data.pixelData);
      break;
    case 'scale':
      worker.updateScale(data.scaleX, data.scaleY);
      break;
    case 'stop':
      process.exit(0);
      break;
  }
});
```

#### 2.2 音频Worker实现 (ES模块)

```javascript
// src/workers/audioWorker.js
import { parentPort } from 'worker_threads';

class AudioWorker {
  constructor() {
    this.speaker = null;
    this.sampleRate = 44100;
    this.channels = 2;
    this.bitDepth = 16;
    this.bufferSize = 1024;
    this.audioEnabled = true;
    this.initAudio();
  }

  async initAudio() {
    try {
      // 动态导入node-speaker，避免在无音频环境中失败
      const { default: Speaker } = await import('node-speaker');
      this.speaker = new Speaker({
        channels: this.channels,
        bitDepth: this.bitDepth,
        sampleRate: this.sampleRate
      });
      
      console.info('音频系统初始化成功');
    } catch (error) {
      console.warn('音频初始化失败，将以静音模式运行:', error.message);
      this.audioEnabled = false;
    }
  }

  processAudio(sampleData) {
    if (!this.audioEnabled || !this.speaker) return;

    try {
      // 转换浮点音频数据为16位整数
      const buffer = Buffer.allocUnsafe(sampleData.length * 2);
      for (let i = 0; i < sampleData.length; i++) {
        const sample = Math.max(-1, Math.min(1, sampleData[i]));
        buffer.writeInt16LE(Math.round(sample * 32767), i * 2);
      }
      
      this.speaker.write(buffer);
    } catch (error) {
      console.warn('音频播放失败:', error.message);
      // 不抛出错误，继续静音运行
    }
  }

  setVolume(volume) {
    // 音量控制实现
    this.volume = Math.max(0, Math.min(1, volume));
  }
}

const audioWorker = new AudioWorker();

parentPort.on('message', (data) => {
  switch (data.type) {
    case 'audio':
      audioWorker.processAudio(data.samples);
      break;
    case 'volume':
      audioWorker.setVolume(data.volume);
      break;
    case 'stop':
      if (audioWorker.speaker) {
        audioWorker.speaker.end();
      }
      process.exit(0);
      break;
  }
});
```

### 3. ink UI组件实现

#### 3.1 主应用组件 (ES模块)

```javascript
// src/components/App.js
import React, { useState, useEffect, useRef } from 'react';
import GameDisplay from './GameDisplay.js';
import StatusBar from './StatusBar.js';
import ErrorBoundary from './ErrorBoundary.js';
import { useInput, useApp } from 'ink';
import GameCore from '../game/GameCore.js';

const App = ({ romPath, options }) => {
  const [pixelData, setPixelData] = useState([]);
  const [fps, setFps] = useState(0);
  const [romName, setRomName] = useState('');
  const [memoryUsage, setMemoryUsage] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const { exit } = useApp();
  
  const gameCoreRef = useRef(null);

  // 键盘输入处理
  useInput((input, key) => {
    // 游戏按键映射
    const keyMap = {
      'z': 'A',
      'x': 'B', 
      'a': 'L',
      's': 'R',
      'enter': 'START',
      'escape': 'SELECT',
      'upArrow': 'UP',
      'downArrow': 'DOWN',
      'leftArrow': 'LEFT',
      'rightArrow': 'RIGHT'
    };

    // 系统控制键
    if (key.ctrl && input === 'c') {
      if (gameCoreRef.current) {
        gameCoreRef.current.stop();
      }
      exit();
      return;
    }

    if (key.return && key.shift) {
      setIsPaused(prev => !prev);
      return;
    }

    // 游戏控制键
    if (keyMap[input] && gameCoreRef.current) {
      if (key.release) {
        gameCoreRef.current.releaseKey(keyMap[input]);
      } else {
        gameCoreRef.current.pressKey(keyMap[input]);
      }
    }
  });

  // 初始化游戏核心
  useEffect(() => {
    const initializeGame = async () => {
      try {
        const gameCore = new GameCore(options);
        gameCoreRef.current = gameCore;
        
        await gameCore.initialize(romPath);
        
        // 设置Worker通信
        gameCore.on('frame', (data) => {
          setPixelData(data.pixels);
          setFps(data.fps);
        });
        
        gameCore.on('status', (data) => {
          setRomName(data.romName);
          setMemoryUsage(data.memoryUsage);
        });
        
        if (!isPaused) {
          gameCore.start();
        }
      } catch (error) {
        console.error('游戏初始化失败:', error.message);
        exit();
      }
    };

    initializeGame();
  }, [romPath, options, isPaused, exit]);

  return (
    <ErrorBoundary>
      <GameDisplay 
        pixels={pixelData} 
        scale={options.scale}
        isPaused={isPaused}
      />
      <StatusBar 
        fps={fps}
        romName={romName}
        memoryUsage={memoryUsage}
        isPaused={isPaused}
      />
    </ErrorBoundary>
  );
};

export default App;
```

### 4. 游戏核心控制器 (ES模块)

#### 4.1 游戏核心实现

```javascript
// src/game/GameCore.js
import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class GameCore extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = options;
    this.gba = null;
    this.renderWorker = null;
    this.audioWorker = null;
    this.isRunning = false;
    this.isPaused = false;
    this.frameCount = 0;
    this.lastFrameTime = 0;
    this.romName = '';
  }

  async initialize(romPath) {
    try {
      // 验证ROM文件
      if (!fs.existsSync(romPath)) {
        throw new Error(`ROM文件不存在: ${romPath}`);
      }

      // 设置ROM名称
      this.romName = path.basename(romPath, '.gba');

      // 初始化GBA模拟器
      const { GameBoyAdvance } = await import('../gba/gba.js');
      this.gba = new GameBoyAdvance();
      
      await this.loadROM(romPath);
      
      // 启动Worker线程
      await this.initializeWorkers();
      
      // 设置状态更新定时器
      this.setupStatusUpdater();
      
      this.emit('initialized', { romName: this.romName });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async loadROM(romPath) {
    const romBuffer = fs.readFileSync(romPath);
    const romArray = new Uint8Array(romBuffer);
    
    // 加载ROM到模拟器
    await this.gba.loadRom(romArray);
  }

  async initializeWorkers() {
    try {
      // 启动渲染Worker
      this.renderWorker = new Worker(
        path.join(__dirname, '../workers/renderWorker.js'),
        { type: 'module' }
      );
      this.setupRenderWorkerCommunication();
      
      // 启动音频Worker（如果未禁用）
      if (!this.options.noAudio) {
        this.audioWorker = new Worker(
          path.join(__dirname, '../workers/audioWorker.js'),
          { type: 'module' }
        );
        this.setupAudioWorkerCommunication();
      }
    } catch (error) {
      console.warn('Worker初始化失败:', error.message);
      throw error;
    }
  }

  setupRenderWorkerCommunication() {
    this.renderWorker.on('message', (msg) => {
      switch (msg.type) {
        case 'frame':
          this.emit('frame', {
            pixels: msg.data,
            fps: msg.fps,
            timestamp: msg.timestamp
          });
          break;
        case 'error':
          this.emit('error', new Error(`渲染Worker错误: ${msg.error}`));
          break;
      }
    });

    this.renderWorker.on('error', (error) => {
      this.emit('error', new Error(`渲染Worker进程错误: ${error.message}`));
    });

    this.renderWorker.on('exit', (code) => {
      if (code !== 0) {
        this.emit('error', new Error(`渲染Worker异常退出: ${code}`));
      }
    });
  }

  setupAudioWorkerCommunication() {
    this.audioWorker.on('message', (msg) => {
      switch (msg.type) {
        case 'error':
          console.warn('音频Worker错误:', msg.error);
          break;
      }
    });

    this.audioWorker.on('error', (error) => {
      console.warn('音频Worker进程错误:', error.message);
    });
  }

  setupStatusUpdater() {
    const statusInterval = setInterval(() => {
      if (!this.isRunning) {
        clearInterval(statusInterval);
        return;
      }

      const memUsage = process.memoryUsage();
      this.emit('status', {
        romName: this.romName,
        memoryUsage: memUsage.heapUsed / 1024 / 1024,
        frameCount: this.frameCount
      });
    }, 1000);
  }

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.gameLoop();
    this.emit('started');
  }

  pause() {
    this.isPaused = true;
    this.emit('paused');
  }

  resume() {
    this.isPaused = false;
    this.emit('resumed');
  }

  gameLoop() {
    if (!this.isRunning) return;

    if (!this.isPaused) {
      const now = Date.now();
      const frameInterval = 1000 / 59.73; // GBA帧率

      if (now - this.lastFrameTime >= frameInterval) {
        this.advanceFrame();
        this.lastFrameTime = now;
      }
    }

    setImmediate(() => this.gameLoop());
  }

  advanceFrame() {
    try {
      // 执行一帧
      this.gba.advanceFrame();
      
      // 获取像素数据并发送到渲染Worker
      const pixelData = this.gba.video.getPixelData();
      if (pixelData && this.renderWorker) {
        this.renderWorker.postMessage({
          type: 'render',
          pixelData: pixelData
        });
      }

      // 获取音频数据并发送到音频Worker
      if (!this.options.noAudio && this.audioWorker) {
        const audioData = this.gba.audio.getSampleData();
        if (audioData && audioData.length > 0) {
          this.audioWorker.postMessage({
            type: 'audio',
            samples: audioData
          });
        }
      }

      this.frameCount++;
    } catch (error) {
      this.emit('error', new Error(`游戏循环错误: ${error.message}`));
    }
  }

  pressKey(key) {
    if (this.gba && this.gba.keypad) {
      this.gba.keypad.pressKey(key);
    }
  }

  releaseKey(key) {
    if (this.gba && this.gba.keypad) {
      this.gba.keypad.releaseKey(key);
    }
  }

  stop() {
    this.isRunning = false;
    this.isPaused = false;
    
    if (this.renderWorker) {
      this.renderWorker.postMessage({ type: 'stop' });
      this.renderWorker = null;
    }
    
    if (this.audioWorker) {
      this.audioWorker.postMessage({ type: 'stop' });
      this.audioWorker = null;
    }
    
    this.emit('stopped');
  }

  saveState(savePath) {
    // 实现存档功能
    if (this.gba && this.gba.savedata) {
      const saveData = this.gba.savedata.getSaveData();
      fs.writeFileSync(savePath, saveData);
      this.emit('saved', { path: savePath });
    }
  }

  loadState(savePath) {
    // 实现读档功能
    if (fs.existsSync(savePath)) {
      const saveData = fs.readFileSync(savePath);
      if (this.gba && this.gba.savedata) {
        this.gba.savedata.setSaveData(saveData);
        this.emit('loaded', { path: savePath });
      }
    }
  }
}

export default GameCore;
```

### 5. 分级日志系统 (ES模块)

#### 5.1 日志系统实现

```javascript
// src/utils/logger.js
import colors from 'ansi-colors';

export class Logger {
  constructor(level = 'info') {
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    this.currentLevel = this.levels[level] || 2;
    this.colors = {
      error: colors.red,
      warn: colors.yellow,
      info: colors.blue,
      debug: colors.gray
    };
  }

  setLevel(level) {
    if (this.levels.hasOwnProperty(level)) {
      this.currentLevel = this.levels[level];
    }
  }

  formatMessage(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const colorFn = this.colors[level] || colors.white;
    const prefix = colorFn(`[${level.toUpperCase()}]`);
    return `${timestamp} ${prefix} ${message}`;
  }

  error(message, ...args) {
    if (this.currentLevel >= 0) {
      console.error(this.formatMessage('error', message), ...args);
    }
  }

  warn(message, ...args) {
    if (this.currentLevel >= 1) {
      console.warn(this.formatMessage('warn', message), ...args);
    }
  }

  info(message, ...args) {
    if (this.currentLevel >= 2) {
      console.info(this.formatMessage('info', message), ...args);
    }
  }

  debug(message, ...args) {
    if (this.currentLevel >= 3) {
      console.debug(this.formatMessage('debug', message), ...args);
    }
  }

  // 性能测量
  time(label) {
    if (this.currentLevel >= 2) {
      console.time(`${this.colors.info('[' + label + ']')}`);
    }
  }

  timeEnd(label) {
    if (this.currentLevel >= 2) {
      console.timeEnd(`${this.colors.info('[' + label + ']')}`);
    }
  }

  // 内存使用情况
  memory(label = 'Memory') {
    if (this.currentLevel >= 2) {
      const usage = process.memoryUsage();
      console.info(`${this.colors.info('[' + label + ']')} RSS: ${(usage.rss / 1024 / 1024).toFixed(2)}MB, Heap: ${(usage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    }
  }
}

// 创建全局日志实例
const logger = new Logger();

export default logger;
```

### 6. CLI入口实现 (ES模块)

#### 6.1 主入口文件

```javascript
#!/usr/bin/env node
// index.js
import { render } from 'ink';
import cac from 'cac';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import logger from './src/utils/logger.js';
import App from './src/components/App.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CLI解析
const cli = cac('gbajs2');

cli
  .command('[rom]', '运行GBA游戏')
  .option('-b, --bios <path>', 'BIOS文件路径')
  .option('-s, --save <path>', '存档文件路径')
  .option('-c, --scale <number>', '字符缩放比例', { default: 3 })
  .option('--no-audio', '禁用音频输出')
  .option('--log-level <level>', '日志级别 (error|warn|info|debug)', { default: 'info' })
  .option('--debug', '启用调试模式')
  .action((rom, options) => {
    runGame(rom, options);
  });

cli.help();
cli.version(await getPackageVersion());
cli.parse();

async function getPackageVersion() {
  const packageJson = await import('./package.json', { assert: { type: 'json' } });
  return packageJson.default.version;
}

async function runGame(romPath, options) {
  try {
    // 设置日志级别
    if (options.debug) {
      options.logLevel = 'debug';
    }
    logger.setLevel(options.logLevel);

    // 验证ROM文件
    if (!romPath) {
      console.error('错误: 请指定ROM文件路径');
      process.exit(1);
    }

    const resolvedRomPath = path.resolve(romPath);
    if (!fs.existsSync(resolvedRomPath)) {
      console.error(`错误: ROM文件不存在: ${romPath}`);
      process.exit(1);
    }

    // 验证BIOS文件
    if (options.bios) {
      const biosPath = path.resolve(options.bios);
      if (!fs.existsSync(biosPath)) {
        console.error(`错误: BIOS文件不存在: ${options.bios}`);
        process.exit(1);
      }
      options.bios = biosPath;
    } else {
      // 使用默认BIOS
      options.bios = path.join(__dirname, 'resources', 'bios.bin');
      if (!fs.existsSync(options.bios)) {
        logger.warn('未找到BIOS文件，将使用HLE BIOS');
        options.bios = null;
      }
    }

    // 处理存档路径
    if (options.save) {
      options.save = path.resolve(options.save);
      const saveDir = path.dirname(options.save);
      if (!fs.existsSync(saveDir)) {
        fs.mkdirSync(saveDir, { recursive: true });
      }
    }

    // 验证缩放比例
    const scale = parseInt(options.scale);
    if (isNaN(scale) || scale < 1 || scale > 10) {
      console.error('错误: 缩放比例必须是1-10之间的整数');
      process.exit(1);
    }
    options.scale = { x: scale, y: scale * 2 }; // 保持字符比例

    logger.info(`启动游戏: ${romPath}`);
    logger.debug(`选项:`, options);

    // 启动React应用
    const { waitUntilExit } = render(
      React.createElement(App, { romPath: resolvedRomPath, options })
    );

    await waitUntilExit();
    
  } catch (error) {
    logger.error('应用启动失败:', error.message);
    if (options.debug) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}
```

#### 6.2 可执行文件

```bash
#!/bin/bash
# bin/gbajs2
node "$(dirname "$0")/../index.js" "$@"
```

## pnpm使用指南

### 安装和初始化
```bash
# 安装pnpm (如果未安装)
npm install -g pnpm

# 安装项目依赖
pnpm install

# 添加新依赖
pnpm add ink react

# 添加开发依赖
pnpm add -D eslint prettier

# 运行脚本
pnpm dev
pnpm build
pnpm test
```

### pnpm配置
```json
{
  "packageManager": "pnpm@8.0.0",
  "pnpm": {
    "overrides": {},
    "patchedDependencies": {}
  }
}
```

## ES模块迁移要点

### 1. package.json 设置
```json
{
  "type": "module",
  "exports": {
    ".": "./index.js",
    "./src/*": "./src/*"
  }
}
```

### 2. 导入导出语法
```javascript
// CommonJS → ES模块
const fs = require('fs');           → import fs from 'fs';
const { EventEmitter } = require('events'); → import { EventEmitter } from 'events';
module.exports = MyClass;          → export default MyClass;
exports.MyClass = MyClass;         → export { MyClass };
```

### 3. 动态导入
```javascript
// Worker中使用动态导入
const { default: Speaker } = await import('node-speaker');
```

### 4. __dirname 和 __filename
```javascript
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
```

### 5. package.json 导入
```javascript
// 读取package.json
import packageJson from './package.json' assert { type: 'json' };
// 或者使用动态导入
const packageJson = await import('./package.json', { assert: { type: 'json' } });
```

## 实施时间表 (更新)

### 第1周：基础架构搭建
- **Day 1-2**: 项目结构创建，ES模块配置，pnpm初始化
- **Day 3-4**: 复制并改造GBA核心代码，转换为ES模块
- **Day 5-6**: Worker线程架构搭建，ES模块Worker通信
- **Day 7**: 基础测试和错误处理

### 第2周：渲染系统开发
- **Day 1-2**: 像素映射算法实现，ANSI颜色转换
- **Day 3-4**: 渲染Worker开发，ES模块优化
- **Day 5-6**: ink UI组件开发，ES模块导入
- **Day 7**: 渲染系统集成测试

### 第3周：音频和输入系统
- **Day 1-2**: 音频Worker开发，动态导入处理
- **Day 3-4**: 键盘输入处理，ES模块事件
- **Day 5-6**: 存档系统实现，ES文件操作
- **Day 7**: 音频输入集成测试

### 第4周：完善和发布
- **Day 1-2**: 日志系统完善，ES模块导出
- **Day 3-4**: 性能调优，ES模块优化
- **Day 5-6**: 文档编写，pnpm发布配置
- **Day 7**: npm包发布，CI/CD配置

## 预期效果

### 基本使用体验
```bash
# 使用pnpm安装
pnpm install -g gbajs2-cli

# 运行游戏
gbajs2 run pokemon.gba --scale 2

[INFO] 启动游戏: pokemon.gba
[INFO] 游戏初始化成功
[INFO] 音频系统初始化成功

┌─────────────────────────────────────────────────────────────────────────────┐
│████▒▒████▒▒████▒▒████▒▒████▒▒████▒▒████▒▒████▒▒████▒▒████▒▒████▒▒████▒▒│
│▒▒████▒▒████▒▒████▒▒████▒▒████▒▒████▒▒████▒▒████▒▒████▒▒████▒▒████▒▒│
│████▒▒████▒▒████▒▒████▒▒████▒▒████▒▒████▒▒████▒▒████▒▒████▒▒████▒▒│
... (游戏画面，彩色Unicode字符显示) ...
└─────────────────────────────────────────────────────────────────────────────┘

┌─ ROM: pokemon.gba ── FPS: 59.7 ── 内存: 45.2MB ── Ctrl+C 退出 ─┐
```

## 总结

这个ES模块版本的改造方案提供了：

1. **现代JavaScript**: 使用ES模块语法，更好的Tree Shaking和代码分析
2. **高效包管理**: pnpm提供更快的安装速度和更节省磁盘空间
3. **类型安全**: 为将来的TypeScript迁移做好准备
4. **标准化**: 遵循现代Node.js项目的最佳实践
5. **兼容性**: 保持所有原有功能，同时享受现代开发体验

通过ES模块和pnpm的结合，项目将具备更好的可维护性、性能和开发体验！
