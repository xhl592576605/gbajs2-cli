# gbajs2-cli

Node.js 终端 GBA 模拟器 / Node.js Terminal GBA Emulator

基于 [gbajs](https://github.com/endrift/gbajs) 核心重构，支持在终端（Terminal）或独立窗口（GUI）中运行 Game Boy Advance 游戏。

## 特性 / Features

- **双渲染模式**：
  - 🖥️ **Terminal Mode**：使用 ANSI 字符画在终端内渲染，支持自动缩放和主题适配（基于 `ink`）。
  - 🖼️ **GUI Mode**：使用 SDL2 弹出独立窗口渲染，支持 60FPS 流畅画面（基于 `@kmamal/sdl`）。
- **音频支持**：集成 `speaker` 模块，支持实时音频输出。
- **完整交互**：支持键盘输入、暂停、存档（文件系统持久化）。
- **调试工具**：内置日志系统，支持按日期查看和清理日志。

## 安装 / Installation

需要 Node.js >= 14 和 pnpm。

```bash
git clone https://github.com/your-repo/gbajs2-cli.git
cd gbajs2-cli
pnpm install

# 如果需要使用 GUI 模式，需批准 SDL 构建脚本
pnpm approve-builds
```

## 使用 / Usage

### 启动游戏

```bash
# 默认终端模式
pnpm start -- <path-to-rom>

# GUI 模式
pnpm start -- --renderer=gui <path-to-rom>

# 或者使用全局命令（如果已 link）
gbajs2 <path-to-rom>
```

### 命令行参数

| 参数 | 简写 | 描述 | 默认值 |
|---|---|---|---|
| `--renderer` | | 渲染模式 (`terminal` / `gui`) | `terminal` |
| `--scale` | `-c` | 画面缩放比例 (仅终端模式有效，留空自动适配) | `auto` |
| `--no-audio` | | 禁用音频 | `false` |
| `--bios` | | 指定 BIOS 文件路径 | 内置 HLE |
| `--fps-limit` | | 帧率限制 | `59.73` |
| `--log-level` | | 日志级别 (`info`, `debug`, `warn`, `error`) | `info` |
| `--sampling` | | 采样模式 (`balanced` / `nearest`) | `balanced` |
| `--density` | | 渲染密度 (`balanced` / `braille`) | `balanced` |

### 常用命令

```bash
# 查看帮助
gbajs2 --help

# 查看日志
gbajs2 logs

# 清理 7 天前的日志
gbajs2 logs --cleanup 7
```

## 按键操作 / Controls

| GBA 按键 | 键盘按键 |
|---|---|
| ⬆️ ⬇️ ⬅️ ➡️ | 方向键 / Arrow Keys |
| A | `Z` |
| B | `X` |
| L | `A` |
| R | `S` |
| Start | `P` |
| Select | `O` |
| **系统功能** | **快捷键** |
| 暂停/恢复 | `Shift + Enter` |
| 退出 | `Esc` 或 `Ctrl + C` |

## 开发 / Development

```bash
# 启动开发模式
pnpm dev <path-to-rom>

# 代码检查
pnpm lint
pnpm format

# 运行测试
pnpm test
```

## License

BSD-2-Clause
