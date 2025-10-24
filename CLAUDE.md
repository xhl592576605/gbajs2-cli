<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# CLAUDE.md

此文件为 Claude Code (claude.ai/code) 在本代码库中工作时提供指导。

## 项目概述

这是 **gbajs2-cli**，一个基于原版 gbajs2 的 Node.js CLI 版本的 Game Boy Advance 模拟器。该项目将原本在浏览器中运行的 GBA 模拟器完全移植到 Node.js 原生环境，提供命令行界面和多种输出模式。

## 项目特色

- **完全 Node.js 原生**: 彻底移除浏览器依赖，使用 Node.js 原生模块和最佳实践
- **多种输出模式**: 支持 PNG 图片序列、终端字符画实时显示
- **跨平台音频**: 基于 speaker + lame 的原生音频输出
- **Canvas 渲染策略**: 使用 node-canvas 作为中间层，最大限度复用原有渲染逻辑
- **ANSI 彩色支持**: 支持 ansi16、ansi256、rgb 三种颜色模式

## 当前开发状态

### 项目架构
- **原始版本**: 纯浏览器版本，使用 HTML5 Canvas 和 Web Audio API
- **CLI 版本**: Node.js 环境版本，纯原生实现，无浏览器兼容层
- **当前分支**: `feature/node-env` - Node.js 环境适配分支

### 已完成的基础设施
- ✅ Node.js 项目结构设置
- ✅ 基础 CLI 入口点 (`bin/gbajs2.js`) - 仅包含基础 usage 信息
- ✅ 主模块入口 (`src/index.js`) - 仅包含初始化日志
- ✅ ESLint + Prettier 配置
- ✅ Jest 测试框架配置
- ✅ 目录结构规划（core、cli、audio、input、renderers）- 目录已创建但内容为空
- ✅ **完整技术文档体系** - 需求、设计、任务文档已梳理完成

### 待完成的核心任务
- 🔄 **核心模拟器移植** - 将 `js/` 目录下的浏览器版本模块适配到 Node.js 环境
- 🔄 **Canvas 渲染系统** - 基于 node-canvas 的渲染引擎，支持 PNG 和 ASCII 输出
- 🔄 **音频系统实现** - 基于 speaker + lame 的原生音频系统
- 🔄 **输入处理适配** - 键盘输入监听和 GBA 按键映射
- 🔄 **CLI 功能完善** - 完整的命令行参数解析和 ROM 加载
- 🔄 **ANSI 颜色转换** - RGB 到 ANSI 16/256/真彩色转换算法

### 当前实现状态
- **CLI 入口**: 基础框架已完成，需要实现实际功能
- **核心模块**: `src/` 目录结构已建立，但各子目录为空
- **原始代码**: `js/` 目录包含完整的浏览器版本代码，需要适配
- **测试环境**: Jest 已配置，但暂无测试用例
- **文档系统**: 4个核心文档（README、requirements、design、tasks）已完成梳理

## 技术方案总结

### 音频系统
- **推荐方案**: speaker + lame
- **备选方案**: web-audio-api（兼容性）、audio-play（轻量级）
- **特点**: 跨平台、低延迟、稳定可靠

### 视频系统
- **渲染策略**: node-canvas 作为中间层
- **输出模式**: PNG 文件序列、终端字符画
- **颜色支持**: ANSI 16/256/真彩色三种模式
- **RGB 转换**: `16 + (36 * Math.round(r/51)) + (6 * Math.round(g/51)) + Math.round(b/51)`

### Node.js 原生化
- **彻底移除**: window、document、Canvas、Web Audio API、DOM Events
- **使用原生**: fs 模块、EventEmitter、Buffer、原生音频库
- **设计原则**: 纯 Node.js 实现，不追求 Web 兼容性

## 架构

模拟器采用模块化架构，各组件职责分明：

### 核心组件
- **ARMCore** (`js/core.js`, `js/arm.js`, `js/thumb.js`): ARM7TDMI CPU 模拟，支持 ARM 和 Thumb 指令集
- **GameBoyAdvanceMMU** (`js/mmu.js`): 内存管理单元，处理 GBA 内存映射
- **GameBoyAdvance** (`js/gba.js`): 主模拟器类，协调所有组件

### 硬件模拟
- **GameBoyAdvanceVideo** (`js/video.js`, `js/video/*`): 图形渲染和显示
- **GameBoyAdvanceAudio** (`js/audio.js`): 通过 Web Audio API 处理声音
- **GameBoyAdvanceKeypad** (`js/keypad.js`): 游戏控制输入处理
- **GameBoyAdvanceIO** (`js/io.js`): 硬件 I/O 操作
- **GameBoyAdvanceIRQ** (`js/irq.js`): 中断处理
- **GameBoyAdvanceSIO** (`js/sio.js`): 串行 I/O 通信
- **GameBoyAdvanceGPIO** (`js/gpio.js`): 通用 I/O
- **GameBoyAdvanceSavedata** (`js/savedata.js`): 存档状态管理

### 内存布局
- **BIOS ROM**: 0x00000000-0x00003FFF (16KB)
- **WRAM**: 0x02000000-0x0203FFFF (256KB)
- **IWRAM**: 0x03000000-0x03007FFF (32KB)
- **IO 寄存器**: 0x04000000-0x040003FF
- **调色板 RAM**: 0x05000000-0x050003FF
- **VRAM**: 0x06000000-0x06017FFF
- **OAM**: 0x07000000-0x070003FF
- **ROM**: 0x08000000-0x0FFFFFFF (根据游戏变化)

## 开发命令

### CLI 版本开发
- **安装依赖**: `npm install` 或 `pnpm install`
- **运行测试**: `npm test`
- **代码检查**: `npm run lint`
- **格式化代码**: `npm run format`
- **运行 CLI**: `node bin/gbajs2.js <rom-file>` 或 `npx gbajs2 <rom-file>`

### 原始浏览器版本（参考）
- **启动开发服务器**: 使用任意静态文件服务器（如 `python -m http.server 8000` 或 `npx serve`）
- **打开模拟器**: 访问 `http://localhost:8000/index.html`
- **格式化代码**: 使用 Prettier，配置为 4 空格缩进、单引号、无尾随逗号

### 测试
- **单元测试**: `npm test` 运行 Jest 测试
- **集成测试**: 在 `test/` 目录下创建测试用例
- **功能测试**: 使用 CLI 加载测试 ROM 文件

### 代码风格
- **格式化**: Prettier 配置为 4 空格缩进、单引号
- **架构**: ES6 类，模块化设计，清晰的组件边界
- **命名**: 类名使用 PascalCase，方法/变量使用 camelCase
- **导入**: 优先使用解构导入 `import { foo } from 'bar'`

## 📚 文档结构

项目采用分层文档结构，从需求到实现形成完整体系：

### 核心文档
- **[docs/README.md](./docs/README.md)**: 文档导航和使用指南
- **[docs/requirements.md](./docs/requirements.md)**: 项目需求定义和验收标准
- **[docs/design.md](./docs/design.md)**: 系统架构和核心技术设计
- **[docs/tasks.md](./docs/tasks.md)**: 完整开发任务清单和技术方案

### 文档使用指南
- **新成员**: 需求文档 → 设计文档 → 任务清单
- **开发过程**: 设计文档 + 任务清单
- **项目管理**: 任务清单（进度跟踪、风险评估）

## 🎯 开发里程碑

基于8周开发周期的6个里程碑：

1. **基础架构搭建** (第1-2周): 核心模拟器模块适配
2. **音频系统实现** (第3周): speaker + lame 音频输出
3. **视频系统-PNG输出** (第4周): Canvas 渲染和 PNG 导出
4. **视频系统-字符画显示** (第5周): ASCII 转换和终端显示
5. **输入系统实现** (第6周): 键盘监听和按键映射
6. **系统集成与优化** (第7-8周): 集成测试和性能优化

## 🛠️ 开发命令

### CLI 版本开发
- **安装依赖**: `npm install` 或 `pnpm install`
- **运行测试**: `npm test`
- **代码检查**: `npm run lint`
- **格式化代码**: `npm run format`
- **运行 CLI**: `node bin/gbajs2.js <rom-file>` 或 `npx gbajs2 <rom-file>`

### CLI 使用示例
```bash
# ASCII 模式（默认）
gbajs2 game.gba

# PNG 模式
gbajs2 game.gba --renderer png --output ./frames

# 同时输出（彩色字符画）
gbajs2 game.gba --renderer both --color --color-mode ansi256

# 高帧率测试
gbajs2 game.gba --fps 60 --renderer both
```

### 关键文件
#### CLI 版本
- `bin/gbajs2.js`: CLI 入口点
- `src/index.js`: 主模块入口
- `src/core/`: 核心模拟器组件
- `src/cli/`: 命令行接口组件
- `src/audio/`: 音频系统（speaker + lame）
- `src/input/`: 输入处理（键盘监听 + 按键映射）
- `src/renderers/`: 渲染器（Canvas + PNG + ASCII）

#### 原始版本（参考）
- `index.html`: 主模拟器界面
- `js/gba.js`: 主模拟器协调器
- `js/core.js`: ARM CPU 核心
- `js/mmu.js`: 内存管理
- `resources/bios.bin`: 必需的 GBA BIOS (16KB)

### 环境兼容性
- **Node.js 版本**: 需要 Node.js 16+
- **CLI 版本**: 纯 Node.js 环境，无需浏览器
- **系统依赖**: node-canvas 需要 cairo、pango 等系统库
- **测试平台**: 已在 macOS、Linux、Windows 上测试

## 📋 开发注意事项

### Node.js 原生化原则
- **彻底移除所有浏览器依赖**: 不使用任何 Web API 兼容层
- **使用 Node.js 原生模块**: fs、path、events、buffer 等
- **性能优先**: 针对服务器端环境优化，不考虑浏览器兼容性

### 代码规范
- **格式化**: Prettier 配置为 4 空格缩进、单引号
- **架构**: ES6 类，模块化设计，清晰的组件边界
- **命名**: 类名使用 PascalCase，方法/变量使用 camelCase
- **导入**: 优先使用解构导入 `import { foo } from 'bar'`

### 技术选型理由
- **音频**: speaker + lame（维护活跃、跨平台、性能优秀）
- **渲染**: node-canvas（最小化代码修改、保持渲染逻辑）
- **颜色**: ANSI 256色（推荐方案，平衡兼容性和效果）

### 测试文件
- gba 测试文件在 `resources/PokemonEmerald.gba`