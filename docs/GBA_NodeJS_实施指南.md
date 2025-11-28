# GBA.js2 Node.js改造实施指南 (ES模块 + pnpm版)

## 开始前的准备

### 环境要求
- Node.js 14+ (推荐 16+)
- pnpm 8.0+
- 支持ANSI颜色的终端
- 跨平台兼容 (macOS/Linux/Windows)

### 安装pnpm
```bash
# 全局安装pnpm
npm install -g pnpm

# 或使用其他包管理器安装pnpm
yarn global add pnpm
# 或
brew install pnpm  # macOS
```

### 依赖说明 (ES模块版)
```json
{
  "type": "module",
  "dependencies": {
    "ink": "^3.2.0",           // React终端UI框架
    "react": "^17.0.0",        // React核心
    "node-speaker": "^0.5.0",  // 跨平台音频输出
    "cac": "^6.7.0",           // 命令行参数解析
    "ansi-colors": "^4.1.0"    // ANSI颜色支持
  },
  "packageManager": "pnpm@8.0.0"
}
```

## 实施步骤详解

### 第1步: 项目结构搭建
```bash
# 创建目录结构
mkdir -p src/{gba,workers,components,utils,game} bin resources

# 初始化package.json (ES模块)
pnpm init

# 配置package.json
cat > package.json << 'EOF'
{
  "name": "gbajs2-cli",
  "version": "1.0.0",
  "description": "Node.js终端GBA模拟器",
  "type": "module",
  "main": "index.js",
  "bin": {
    "gbajs2": "./bin/gbajs2"
  },
  "scripts": {
    "dev": "node index.js",
    "build": "echo 'No build step required'",
    "test": "echo 'Tests not implemented yet'",
    "lint": "eslint src/",
    "format": "prettier --write src/"
  },
  "packageManager": "pnpm@8.0.0"
}
EOF

# 安装核心依赖
pnpm add ink@^3.2.0 react@^17.0.0 node-speaker@^0.5.0 cac@^6.7.0 ansi-colors@^4.1.0

# 安装开发依赖
pnpm add -D eslint@^8.0.0 prettier@^2.0.0 jest@^28.0.0
```

### 运行 CLI 预览
```bash
# 使用 CLI 加载 ROM（示例 roms/demo.gba）
pnpm dev roms/demo.gba --scale 3 --no-audio

# 输出内容
# 1. 日志位置 / 预览帧字符画（█▄▀░）
# 2. 渲染 / 音频 Worker 初始化信息
# 3. 默认存档目录 ~/.gbajs2/saves/<rom-hash>.sav
```

渲染流程通过 `src/renderers/terminal/pixelMapper.js` → `src/renderers/terminal/renderWorker.js`，音频流程通过 `src/utils/audioAdapter.js` → `src/workers/audioWorker.js`。若平台不支持 `worker_threads` 或 `speaker`，CLI 会自动回退为主线程映射或静音模式。

### 第2步: 复制和改造GBA核心代码

#### 复制文件到ES模块结构
```bash
# 从原项目复制到 src/gba/
cp web/js/gba.js src/gba/
cp web/js/core.js src/gba/
cp web/js/mmu.js src/gba/
cp web/js/audio.js src/gba/
cp web/js/video.js src/gba/
cp web/js/keypad.js src/gba/
cp web/js/savedata.js src/gba/
cp web/js/io.js src/gba/
cp web/js/irq.js src/gba/
cp web/js/arm.js src/gba/
cp web/js/thumb.js src/gba/
cp web/js/util.js src/gba/
```

#### 关键改造点 (ES模块)

**1. video.js - 添加像素数据导出**
```javascript
// 在 GameBoyAdvanceVideo 类中添加
getPixelData() {
  if (this.renderPath && this.renderPath.pixelData) {
    return this.renderPath.pixelData; // 返回 RGBA 格式的像素数据
  }
  return null;
}

// 导出类 (如果需要)
export { GameBoyAdvanceVideo };
```

**2. audio.js - 添加音频数据导出**
```javascript
// 在 GameBoyAdvanceAudio 类中添加
getSampleData() {
  if (this.bufferIndex > 0) {
    return new Float32Array(this.outputBuffer.slice(0, this.bufferIndex));
  }
  return null;
}

// 导出
export { GameBoyAdvanceAudio };
```

**3. savedata.js - 文件系统改造 (ES模块)**
```javascript
// ES模块文件系统导入
import fs from 'fs';
import path from 'path';

// 修改文件加载方法
loadSaveFile(filePath) {
  try {
    const data = fs.readFileSync(filePath);
    return new Uint8Array(data);
  } catch (error) {
    console.warn('存档文件读取失败:', error.message);
    return null;
  }
}

// 导出
export { GameBoyAdvanceSavedata };
```

**4. gba.js - 主模拟器改造**
```javascript
// 导入依赖
import { GameBoyAdvanceCore } from './core.js';
import { GameBoyAdvanceMMU } from './mmu.js';
import { GameBoyAdvanceAudio } from './audio.js';
import { GameBoyAdvanceVideo } from './video.js';

// 导出主类
export class GameBoyAdvance {
  constructor() {
    // 构造函数逻辑
  }
  
  async loadRom(romData) {
    // ROM加载逻辑
  }
  
  advanceFrame() {
    // 帧推进逻辑
  }
}

export default GameBoyAdvance;
```

### 第3步: 实现核心工具类 (ES模块)

#### pixelMapper.js - 像素映射核心
```javascript
// src/renderers/terminal/pixelMapper.js
export class PixelMapper {
  constructor(scaleX = 3, scaleY = 6) {
    this.scaleX = scaleX;
    this.scaleY = scaleY;
  }

  // 核心映射算法
  analyzePixelBlock(pixels, x, y) {
    let r = 0, g = 0, b = 0, count = 0;
    
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
}

export default PixelMapper;
```

#### logger.js - 分级日志系统 (ES模块)
```javascript
// src/utils/logger.js
import colors from 'ansi-colors';

export class Logger {
  constructor(level = 'info') {
    this.levels = { error: 0, warn: 1, info: 2, debug: 3 };
    this.currentLevel = this.levels[level] || 2;
  }

  error(message, ...args) {
    if (this.currentLevel >= 0) {
      console.error(colors.red(`[ERROR] ${message}`), ...args);
    }
  }
  
  warn(message, ...args) {
    if (this.currentLevel >= 1) {
      console.warn(colors.yellow(`[WARN] ${message}`), ...args);
    }
  }
  
  info(message, ...args) {
    if (this.currentLevel >= 2) {
      console.info(colors.blue(`[INFO] ${message}`), ...args);
    }
  }
  
  debug(message, ...args) {
    if (this.currentLevel >= 3) {
      console.debug(colors.gray(`[DEBUG] ${message}`), ...args);
    }
  }
}

// 创建全局实例
const logger = new Logger();

export default logger;
```

### 第4步: Worker线程实现 (ES模块)

#### renderWorker.js - 渲染处理
```javascript
// src/renderers/terminal/renderWorker.js
import { parentPort } from 'worker_threads';
import PixelMapper from './pixelMapper.js';

class RenderWorker {
  constructor() {
    this.mapper = new PixelMapper();
  }

  processFrame(pixelData) {
    const charMatrix = [];
    
    for (let y = 0; y < 160; y += this.mapper.scaleY) {
      const row = [];
      for (let x = 0; x < 240; x += this.mapper.scaleX) {
        const pixel = this.mapper.analyzePixelBlock(pixelData, x, y);
        row.push(pixel);
      }
      charMatrix.push(row);
    }
    
    parentPort.postMessage({
      type: 'frame',
      data: charMatrix,
      timestamp: Date.now()
    });
  }
}

const worker = new RenderWorker();

parentPort.on('message', (data) => {
  if (data.type === 'render') {
    worker.processFrame(data.pixelData);
  }
});
```

#### audioWorker.js - 音频处理
```javascript
// src/workers/audioWorker.js
import { parentPort } from 'worker_threads';

class AudioWorker {
  constructor() {
    this.initAudio();
  }

  async initAudio() {
    try {
      // 动态导入node-speaker
      const { default: Speaker } = await import('node-speaker');
      this.speaker = new Speaker({
        channels: 2, bitDepth: 16, sampleRate: 44100
      });
      console.info('音频系统初始化成功');
    } catch (error) {
      console.warn('音频初始化失败，静音模式运行');
      this.speaker = null;
    }
  }

  processAudio(sampleData) {
    if (!this.speaker) return;
    
    const buffer = Buffer.allocUnsafe(sampleData.length * 2);
    for (let i = 0; i < sampleData.length; i++) {
      buffer.writeInt16LE(sampleData[i] * 32767, i * 2);
    }
    this.speaker.write(buffer);
  }
}

const audioWorker = new AudioWorker();

parentPort.on('message', (data) => {
  if (data.type === 'audio') {
    audioWorker.processAudio(data.samples);
  }
});
```

### 第5步: ink UI组件开发 (ES模块)

#### App.js - 主应用组件
```javascript
// src/components/App.js
import React, { useState, useEffect, useRef } from 'react';
import GameDisplay from './GameDisplay.js';
import StatusBar from './StatusBar.js';
import { useInput, useApp } from 'ink';
import GameCore from '../game/GameCore.js';

const App = ({ romPath, options }) => {
  const [pixelData, setPixelData] = useState([]);
  const [fps, setFps] = useState(0);
  const [romName, setRomName] = useState('');
  const { exit } = useApp();
  
  const gameCoreRef = useRef(null);

  useInput((input, key) => {
    const keyMap = {
      'z': 'A', 'x': 'B', 'enter': 'START',
      'upArrow': 'UP', 'downArrow': 'DOWN'
    };

    if (key.ctrl && input === 'c') {
      exit();
      return;
    }

    if (keyMap[input] && gameCoreRef.current) {
      gameCoreRef.current.pressKey(keyMap[input]);
    }
  });

  useEffect(() => {
    const initializeGame = async () => {
      try {
        const gameCore = new GameCore(options);
        gameCoreRef.current = gameCore;
        
        await gameCore.initialize(romPath);
        
        gameCore.on('frame', (data) => {
          setPixelData(data.pixels);
          setFps(data.fps);
        });
        
        gameCore.start();
      } catch (error) {
        console.error('游戏初始化失败:', error.message);
        exit();
      }
    };

    initializeGame();
  }, [romPath, options, exit]);

  return (
    <>
      <GameDisplay pixels={pixelData} scale={options.scale} />
      <StatusBar fps={fps} romName={romName} />
    </>
  );
};

export default App;
```

### 第6步: 游戏核心控制 (ES模块)

#### GameCore.js - 游戏控制器
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
  }

  async initialize(romPath) {
    try {
      // 动态导入GBA核心
      const { default: GameBoyAdvance } = await import('../gba/gba.js');
      this.gba = new GameBoyAdvance();
      
      await this.loadROM(romPath);
      await this.initializeWorkers();
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async loadROM(romPath) {
    const romBuffer = fs.readFileSync(romPath);
    const romArray = new Uint8Array(romBuffer);
    await this.gba.loadRom(romArray);
  }

  async initializeWorkers() {
    try {
      // 启动渲染Worker (ES模块)
      this.renderWorker = new Worker(
        path.join(__dirname, '../workers/renderWorker.js'),
        { type: 'module' }
      );
      
      this.setupRenderWorkerCommunication();
      
      // 启动音频Worker (ES模块)
      if (!this.options.noAudio) {
        this.audioWorker = new Worker(
          path.join(__dirname, '../workers/audioWorker.js'),
          { type: 'module' }
        );
        this.setupAudioWorkerCommunication();
      }
    } catch (error) {
      console.warn('Worker初始化失败:', error.message);
    }
  }

  setupRenderWorkerCommunication() {
    this.renderWorker.on('message', (msg) => {
      if (msg.type === 'frame') {
        this.emit('frame', {
          pixels: msg.data,
          fps: msg.fps,
          timestamp: msg.timestamp
        });
      }
    });
  }

  gameLoop() {
    if (!this.isRunning) return;

    const frameInterval = 1000 / 59.73; // GBA帧率
    if (Date.now() - this.lastFrameTime >= frameInterval) {
      this.advanceFrame();
    }

    setImmediate(() => this.gameLoop());
  }
}

export default GameCore;
```

### 第7步: CLI入口实现 (ES模块)

#### index.js - 主入口
```javascript
#!/usr/bin/env node
import { render } from 'ink';
import cac from 'cac';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 动态导入组件
const { default: App } = await import('./src/components/App.js');

const cli = cac('gbajs2');

cli
  .command('[rom]', '运行GBA游戏')
  .option('-c, --scale <number>', '字符缩放比例', { default: 3 })
  .option('--no-audio', '禁用音频输出')
  .option('--log-level <level>', '日志级别', { default: 'info' })
  .action((rom, options) => {
    runGame(rom, options);
  });

cli.parse();

async function runGame(romPath, options) {
  try {
    const resolvedRomPath = path.resolve(romPath);
    
    if (!fs.existsSync(resolvedRomPath)) {
      console.error(`错误: ROM文件不存在: ${romPath}`);
      process.exit(1);
    }

    const { waitUntilExit } = render(
      React.createElement(App, { romPath: resolvedRomPath, options })
    );

    await waitUntilExit();
  } catch (error) {
    console.error('应用启动失败:', error.message);
    process.exit(1);
  }
}
```

#### 可执行文件
```bash
#!/bin/bash
# bin/gbajs2
node "$(dirname "$0")/../index.js" "$@"
```

```bash
# 设置执行权限
chmod +x bin/gbajs2
```

## 测试和调试 (ES模块版)

### 单元测试要点
1. **像素映射算法测试**
   ```javascript
   // test/pixelMapper.test.js
   import { test } from 'node:test';
   import assert from 'node:assert';
   import { PixelMapper } from '../src/renderers/terminal/pixelMapper.js';
   
   test('像素映射算法', () => {
     const mapper = new PixelMapper(3, 6);
     const testData = new Uint8ClampedArray(240 * 160 * 4);
     const result = mapper.analyzePixelBlock(testData, 0, 0);
     assert(result.char, '应该返回有效字符');
   });
   ```

2. **Worker通信测试**
   ```javascript
   // test/worker.test.js
   import { test } from 'node:test';
   import { Worker } from 'worker_threads';
   
   test('渲染Worker通信', async () => {
     const worker = new Worker('./src/renderers/terminal/renderWorker.js', { type: 'module' });
     worker.postMessage({ type: 'render', pixelData: testData });
     // 测试消息处理
   });
   ```

### 集成测试流程
```bash
# 使用pnpm运行测试
pnpm test

# 基础功能测试
pnpm dev run test.gba --log-level debug

# 性能测试
pnpm dev run test.gba --scale 2 --no-audio
```

## pnpm 工作流详解

### 依赖管理最佳实践
```bash
# 查看项目结构
pnpm list --depth=0

# 检查过期的依赖
pnpm outdated

# 更新特定依赖
pnpm update ink

# 更新所有依赖
pnpm update

# 删除依赖
pnpm remove ansi-colors

# 查看依赖树
pnpm list --json
```

### 脚本配置
```json
{
  "scripts": {
    "dev": "node --watch index.js",
    "start": "node index.js",
    "build": "echo 'ES模块无需构建'",
    "test": "node --test test/**/*.test.js",
    "lint": "eslint src/ --ext .js",
    "format": "prettier --write src/**/*.js",
    "clean": "rm -rf node_modules && pnpm install",
    "prepublishOnly": "pnpm test && pnpm lint"
  }
}
```

### 开发工作流
```bash
# 1. 克隆和设置
git clone <repository>
cd gbajs2-cli
pnpm install

# 2. 开发模式
pnpm dev run pokemon.gba

# 3. 代码检查
pnpm lint
pnpm format

# 4. 测试
pnpm test

# 5. 发布准备
pnpm prepublishOnly
pnpm publish
```

## 常见问题和解决方案 (ES模块版)

### ES模块相关问题

**问题**: "Cannot use import statement outside a module"
```bash
# 解决方案: 确保package.json中有 "type": "module"
echo '"type": "module"' >> package.json

# 或者在文件中使用.mjs扩展名
```

**问题**: 动态导入失败
```javascript
// 错误方式
const Speaker = require('node-speaker');

// 正确方式
const { default: Speaker } = await import('node-speaker');
```

**问题**: __dirname 未定义
```javascript
// 解决方案: 手动计算
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
```

### pnpm相关问题

**问题**: 安装node-speaker失败
```bash
# 解决方案1: 使用系统包管理器安装依赖
# Ubuntu/Debian
sudo apt-get install libasound2-dev

# macOS  
brew install portaudio

# 解决方案2: 使用覆盖或补丁
pnpm add node-speaker
pnpm patch node-speaker
# 编辑生成的补丁文件
```

**问题**: Worker模块无法加载
```javascript
// 确保Worker以ES模块方式启动
const worker = new Worker('./worker.js', { type: 'module' });

// 或者在package.json中配置
{
  "type": "module",
  "exports": {
    "./workers/*": "./workers/*.js"
  }
}
```

## 性能优化 (ES模块版)

### 模块加载优化
```javascript
// 使用动态导入减少启动时间
const loadOptionalDependency = async () => {
  if (process.env.AUDIO_ENABLED !== 'false') {
    const { default: Speaker } = await import('node-speaker');
    return new Speaker();
  }
  return null;
};
```

### Tree Shaking 优化
```javascript
// 使用具名导出避免打包无用代码
export { PixelMapper, ColorConverter };
export default PixelMapper; // 默认导出

// 导入时只导入需要的部分
import { PixelMapper } from './pixelMapper.js';
// 而不是 import * from './pixelMapper.js'
```

## 部署和发布 (pnpm)

### npm包发布准备
```json
{
  "name": "gbajs2-cli",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "bin": {
    "gbajs2": "./bin/gbajs2"
  },
  "files": [
    "src/",
    "bin/",
    "web/",
    "index.js",
    "package.json"
  ],
  "engines": {
    "node": ">=14.0.0",
    "pnpm": ">=8.0.0"
  }
}
```

### 发布流程
```bash
# 1. 更新版本号
pnpm version patch

# 2. 运行完整测试
pnpm test
pnpm lint

# 3. 构建和准备
pnpm prepublishOnly

# 4. 发布到npm
pnpm publish

# 5. 测试安装
pnpm add -g gbajs2-cli
gbajs2 --help
```

### pnpm workspace (monorepo)
```json
// pnpm-workspace.yaml
packages:
  - 'packages/*'
```

```bash
# 在monorepo中
pnpm --filter gbajs2-cli dev
pnpm --filter gbajs2-cli publish
```

## 维护和扩展

### 添加新功能 (ES模块)
1. **新按键映射**: 在App.js的useInput中添加
2. **新的显示模式**: 在GameDisplay.js中扩展
3. **音频效果**: 在audioWorker.js中添加处理
4. **调试功能**: 在StatusBar.js中添加信息显示

### 性能监控
```javascript
// 添加性能监控代码
const monitor = {
  fps: 0,
  memory: 0,
  renderTime: 0,
  
  update(stats) {
    this.fps = stats.fps;
    this.memory = process.memoryUsage().heapUsed / 1024 / 1024;
    this.renderTime = stats.renderTime;
  }
};
```

### 错误追踪 (ES模块)
```javascript
// 添加全局错误处理
process.on('uncaughtException', (error) => {
  logger.error('未捕获异常:', error.message);
  logger.debug(error.stack);
});

process.on('unhandledRejection', (reason) => {
  logger.error('未处理的Promise拒绝:', reason);
});
```

## 总结

这个ES模块 + pnpm版的实施指南提供了：

1. **现代化开发**: 使用ES模块和pnpm的最新特性
2. **最佳实践**: 遵循现代Node.js项目标准
3. **完整流程**: 从初始化到发布的详细步骤
4. **问题解决**: 常见ES模块和pnpm问题的解决方案
5. **性能优化**: 利用ES模块和pnpm的优势

按照这个指南，可以系统性地完成GBA.js2的Node.js改造，创建一个技术先进、性能优秀的终端GBA模拟器！
