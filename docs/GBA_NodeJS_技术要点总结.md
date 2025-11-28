# GBA.js2 Node.js改造技术要点总结 (ES模块版)

## 核心技术决策

### 1. 技术栈选择
- **UI框架**: ink v3 (React终端UI)
- **渲染**: 直接像素→字符映射 + Unicode块字符
- **音频**: node-speaker + 静音降级
- **并发**: 多Worker模式 (渲染Worker + 音频Worker)
- **输入**: ink useInput钩子
- **架构**: 复制原文件改造，无需浏览器兼容
- **模块系统**: ES模块 (type: "module")
- **包管理器**: pnpm

### 2. 关键算法
- **像素映射**: 240x160像素 → 可缩放字符矩阵
- **颜色转换**: RGB → ANSI 256色
- **字符选择**: 基于亮度的Unicode字符映射 (█▄▀░)
- **性能优化**: Worker线程避免阻塞主线程

### 3. 项目结构
```
src/
├── gba/           # 改造后的GBA核心 (ES模块)
├── renderers/     # RendererAdapter（terminal/gui）与像素映射工具
├── workers/       # 音频 Worker (ES模块)
├── components/    # ink React组件 (ES模块)
├── utils/         # 日志、存储等通用工具 (ES模块)
└── game/          # 游戏控制逻辑 (ES模块)

web/
├── index.html     # 遗留浏览器入口
├── console.html   # Web 调试控制台
├── debugger.html  # Web 调试页面
├── resources/     # Web 静态资源
└── js/            # 浏览器版旧核心脚本
```

## 核心代码片段 (ES模块)

### 像素映射器核心逻辑
```javascript
// src/renderers/terminal/pixelMapper.js
export class PixelMapper {
  analyzePixelBlock(pixels, x, y) {
    // 计算像素块平均颜色
    let r = 0, g = 0, b = 0, count = 0;
    for (let dy = 0; dy < this.scaleY; dy++) {
      for (let dx = 0; dx < this.scaleX; dx++) {
        const idx = ((y + dy) * 240 + (x + dx)) * 4;
        r += pixels[idx]; g += pixels[idx + 1]; b += pixels[idx + 2];
        count++;
      }
    }
    
    return {
      char: this.pixelToChar(r/count, g/count, b/count),
      fg: this.rgbToAnsiFg(r/count, g/count, b/count),
      bg: this.rgbToAnsiBg(r/count, g/count, b/count)
    };
  }
}

export default PixelMapper;
```

### Worker通信架构 (ES模块)
```javascript
// src/renderers/terminal/renderWorker.js
import { parentPort } from 'worker_threads';
import PixelMapper from './pixelMapper.js';

// 渲染Worker
parentPort.postMessage({
  type: 'frame',
  data: charMatrix,
  fps: calculatedFPS
});

// src/workers/audioWorker.js  
import { parentPort } from 'worker_threads';

// 动态导入node-speaker
const { default: Speaker } = await import('node-speaker');
this.speaker = new Speaker({
  channels: 2, bitDepth: 16, sampleRate: 44100
});
```

### ink组件结构 (ES模块)
```javascript
// src/components/App.js
import React, { useState, useEffect } from 'react';
import GameDisplay from './GameDisplay.js';
import StatusBar from './StatusBar.js';
import { useInput, useApp } from 'ink';
import GameCore from '../game/GameCore.js';

const App = ({ romPath, options }) => {
  useInput((input, key) => {
    const keyMap = { 'z': 'A', 'x': 'B', 'enter': 'START' };
    if (keyMap[input]) gameCore.pressKey(keyMap[input]);
  });
  
  return (
    <>
      <GameDisplay pixels={pixelData} />
      <StatusBar fps={fps} romName={romName} />
    </>
  );
};

export default App;
```

## ES模块迁移要点

### 1. package.json 配置
```json
{
  "type": "module",
  "main": "index.js",
  "exports": {
    ".": "./index.js",
    "./src/*": "./src/*"
  },
  "packageManager": "pnpm@8.0.0"
}
```

### 2. 导入导出转换
```javascript
// CommonJS → ES模块
const fs = require('fs');                    → import fs from 'fs';
const { EventEmitter } = require('events');  → import { EventEmitter } from 'events';
const PixelMapper = require('./pixelMapper'); → import PixelMapper from './pixelMapper.js';
module.exports = GameCore;                  → export default GameCore;
exports.util = util;                         → export { util };
```

### 3. __dirname 和 __filename 处理
```javascript
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
```

### 4. 动态导入使用
```javascript
// Worker中动态导入
const { default: Speaker } = await import('node-speaker');

// 条件导入
if (needAudio) {
  const { default: Speaker } = await import('node-speaker');
}
```

### 5. package.json 读取
```javascript
// 静态导入 (Node.js 17+)
import packageJson from './package.json' assert { type: 'json' };

// 动态导入 (推荐)
const packageJson = await import('./package.json', { assert: { type: 'json' } });
```

## pnpm 使用指南

### 基础命令
```bash
# 安装pnpm
npm install -g pnpm

# 项目初始化
pnpm init

# 安装依赖
pnpm install

# 添加依赖
pnpm add ink react node-speaker

# 添加开发依赖
pnpm add -D eslint prettier jest

# 运行脚本
pnpm dev
pnpm build
pnpm test

# 全局安装
pnpm add -g gbajs2-cli
```

### pnpm 优势
- **节省磁盘空间**: 使用硬链接和符号链接
- **安装速度快**: 并行安装，依赖解析优化
- **严格的依赖管理**: 避免幽灵依赖问题
- **支持 monorepo**: 天然支持多包项目管理

### pnpm 配置
```json
{
  "packageManager": "pnpm@8.0.0",
  "pnpm": {
    "overrides": {
      "react": "^17.0.0"
    },
    "patchedDependencies": {
      "node-speaker@0.5.0": "patches/node-speaker.patch"
    }
  }
}
```

## 改造要点

### GBA核心改造 (ES模块)
1. **移除Canvas依赖**: js/video.js 添加像素数据导出
2. **移除Web Audio**: js/audio.js 添加音频数据导出  
3. **文件系统替换**: FileReader → Node.js fs模块 (ES导入)
4. **事件系统替换**: 浏览器事件 → EventEmitter (ES导入)

### 性能优化
1. **多线程**: 渲染和音频在独立Worker中处理 (ES模块Worker)
2. **内存管理**: 及时释放缓冲区，使用Transferable对象
3. **智能缩放**: 可配置字符块大小平衡质量和性能
4. **降级策略**: 音频失败静音运行，终端不支持颜色时单色显示

### 用户体验
1. **真实速度**: 59.73Hz GBA原生帧率
2. **完整音频**: 16kHz采样率立体声
3. **实时交互**: 键盘输入即时响应
4. **状态显示**: FPS、内存使用、ROM信息

## 命令行接口

```bash
gbajs2 run <rom> [options]
--scale <number>     # 字符缩放比例 (默认3)
--no-audio          # 禁用音频
--log-level <level> # 日志级别
--save <path>       # 存档路径
```

## 预期效果

```
┌─────────────────────────────────────────────┐
│████▒▒████▒▒████▒▒████▒▒████▒▒████▒▒████▒▒│
│▒▒████▒▒████▒▒████▒▒████▒▒████▒▒████▒▒████│
│████▒▒████▒▒████▒▒████▒▒████▒▒████▒▒████▒▒│
└─────────────────────────────────────────────┘
┌─ ROM: game.gba ── FPS: 59.7 ── 内存: 45MB ─┐
```

## 技术亮点

1. **创新渲染**: Unicode字符 + ANSI颜色实现终端游戏画面
2. **多线程架构**: Worker确保流畅的60FPS体验  
3. **跨平台音频**: node-speaker兼容主流操作系统
4. **React终端UI**: ink提供现代化组件开发体验
5. **完整兼容**: 保持与浏览器版本的存档兼容性
6. **现代JavaScript**: ES模块提供更好的代码组织和Tree Shaking
7. **高效包管理**: pnpm提供更快的依赖安装和更节省的空间

## ES模块最佳实践

### 1. 文件命名
- 使用 `.js` 扩展名，在导入时明确指定
- 避免使用 `.mjs` 除非有特殊需求

### 2. 导入策略
```javascript
// 推荐：具名导入 + 默认导入分离
import React, { useState, useEffect } from 'react';
import GameCore from '../game/GameCore.js';

// 避免：混合导入
import * as utils from '../utils/index.js';
```

### 3. 循环依赖处理
```javascript
// 使用依赖注入或事件系统避免循环依赖
// 不要在模块顶层相互导入
```

### 4. 动态导入时机
```javascript
// 在需要时才动态导入
if (options.audio) {
  const { default: Speaker } = await import('node-speaker');
}
```

## pnpm 工作流

### 开发环境设置
```bash
# 克隆项目
git clone <repo>
cd gbajs2-cli

# 安装pnpm (如果需要)
npm install -g pnpm

# 安装依赖
pnpm install

# 开发模式
pnpm dev
```

### 依赖管理
```bash
# 查看依赖树
pnpm list

# 查看过期依赖
pnpm outdated

# 更新依赖
pnpm update

# 删除依赖
pnpm remove package-name
```

### 发布流程
```bash
# 构建项目
pnpm build

# 运行测试
pnpm test

# 发布到npm
pnpm publish

# 全局安装测试
pnpm add -g .
gbajs2 --version
```

## 实施时间表 (ES模块版)

- **第1周**: 基础架构 + GBA核心改造 + ES模块迁移
- **第2周**: 渲染系统 + ink UI组件 + ES优化  
- **第3周**: 音频系统 + 输入处理 + pnpm配置
- **第4周**: 测试优化 + 文档 + pnpm发布

## 总结

ES模块 + pnpm的组合提供了：

1. **现代化**: 使用最新的JavaScript模块系统
2. **性能**: 更好的Tree Shaking和代码分析
3. **效率**: pnpm的快速安装和节省空间
4. **标准**: 遵循Node.js生态的最佳实践
5. **未来兼容**: 为TypeScript和其他工具链做好准备

这个方案将创建一个技术先进、体验独特的终端GBA模拟器，同时具备现代Node.js项目的所有优势！
