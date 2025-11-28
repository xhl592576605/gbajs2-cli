# Node.js 图形窗口渲染方案可行性评估

## 1. 背景
- 当前 CLI 使用 ANSI 字符在终端绘制画面，受限于字符格分辨率，无法实现真正的 240×160 点对点显示。
- 需求希望改为“渲染出图片并在窗口中显示”，同时保持 Node.js 作为主要技术栈。
- 需要评估：改用原生图形窗口（SDL/OpenGL/Skia 等）在工程复杂度、跨平台和性能上的可行性。

## 2. 目标
1. 维持 `GameCore` + GBA 核心和 Worker 结构不变，重点替换 UI 渲染层。
2. 在 macOS、Linux、Windows 上展示 60FPS 左右的 240×160 画面（可缩放）。
3. 能捕获窗口键盘事件并映射到现有输入系统，保留音频、日志等功能。

## 3. 方案概览

| 方案 | 描述 | 优点 | 缺点/风险 |
| --- | --- | --- | --- |
| **A. Electron/NW.js** | Node + Chromium，使用 `<canvas>`/WebGL 渲染 GBA 帧 | 跨平台成熟，Web 技术熟悉，可复用已有浏览器版代码；打包完整 | 体积大（几十 MB），CLI 需启动 GUI 进程；与纯终端交互断开 |
| **B. Node + 原生图形库绑定（SDL/OpenGL/Skia）** | 使用 `node-sdl2`、`node-canvas`（Skia）或自写 Node-API 绑定创建窗口并绘制像素 | 进程单一、控制力强，可保持 CLI + GUI 并存；依赖链可控 | 跨平台构建复杂，需要处理原生依赖；需重写 UI 层（状态栏、输入、事件循环） |
| **C. Web 服务 + 浏览器** | CLI 启动本地 HTTP/WebSocket，把帧送到浏览器 `<canvas>` | 开发快，可复用 Web UI；浏览器兼容性好 | 需要打开浏览器窗口，用户体验不再是“纯 CLI”；输入/焦点在浏览器 |

当前需求强调“仍使用 Node 技术”且不依赖特定终端，因此 **方案 B**（Node + 原生图形库）最贴合，但需要投入较多工程量。

## 4. 方案 B 详细评估

### 4.1 技术选型
- **SDL2**：跨平台、封装好窗口、输入、音频（可弃用音频部分）。存在 `node-sdl2`, `sdl2-gui` 等社区绑定，也可自写 Node-API 模块。
- **Skia/Canvas** (`skia-canvas`, `node-canvas@2.x` with Pango) 主要用于 2D 绘图，但窗口管理有限，需要结合 GLFW/SDL。
- **OpenGL + GLFW**：可直接利用 GPU 渲染，需管理上下文 & 事件循环，绑定层较薄但开发难度高。

### 4.2 需要修改的架构
1. **渲染管线**  
   - 移除 `renderWorker`/`PixelMapper` 产生 ANSI 行的逻辑，改为直接生成 RGBA 帧（GameCore 已有像素缓冲，可复用）。
   - 新增 `WindowRenderer`：接收 RGBA，上传到纹理/帧缓冲，在 SDL/OpenGL 窗口绘制；支持缩放 & 帧率控制。
2. **输入处理**  
   - SDL/OpenGL 窗口需要捕获键盘事件 → 统一映射为 `GameCore.pressKey`。终端 `useInput` 将废弃。
3. **UI/状态栏**  
   - 需要在窗口中绘制 HUD（FPS、提示、按键说明）或支撑 overlay（可用简单文本渲染，或直接在终端输出日志）。
4. **CLI 启动流程**  
   - `src/index.js` 在解析参数后初始化 `GameCore` + `WindowRenderer`。窗口主循环需要和 GameCore 更新保持同步，可通过共享事件循环（SDL 自身 loop）或在 Node 中使用 `setImmediate` + `Addon` 事件。
5. **打包与安装**  
   - 需要在 `package.json` 中新增原生依赖构建步骤（`prebuild`, `node-gyp`）。用户安装时依赖系统已有 SDL/OpenGL/编译器；若目标用户环境未安装开发工具，部署会复杂。

### 4.3 工程量估算
- **基础渲染**：新建 `WindowRenderer`，处理纹理上传、窗口事件、输入 → 约 1-2 周。
- **跨平台构建**：确保 macOS/Linux/Windows 下 SDL/OpenGL 依赖都能安装 → 约 1 周，取决于 CI/CD 环境。
- **UI 重构**：删除 TerminalViewport、重新设计 HUD、状态栏 → 1 周。
- **测试/文档更新**：终端模式 vs 窗口模式的切换策略、新 CLI 参数/依赖说明 → 3-4 天。
- 总体约 3-4 周的集中开发量（单人评估），并需要持续维护原生依赖。

### 4.4 跨平台评估
| 平台 | 可行性 | 注意点 |
| --- | --- | --- |
| **macOS** | SDL/OpenGL 支持好，需安装 Xcode Command Line Tools。 | 签名/权限；Warp 等终端无法打开窗口时需提示 |
| **Linux** | 大部分发行版可安装 SDL/OpenGL；需注意 Wayland vs X11。 | 打包时要明确依赖，比如 `libSDL2`、`libGL` |
| **Windows** | SDL/GLFW 均支持，需 VS Build Tools + SDK；注意 32/64 位。 | node-gyp 构建时间长，用户需要安装 MSVC；音频路径可能要调整 |

## 5. 风险 & 缓解
| 风险 | 描述 | 缓解 |
| --- | --- | --- |
| 原生依赖构建失败 | 用户没有编译环境或 SDL 库 | 提供预编译二进制（prebuild），或文档明确安装步骤；允许 fallback 到终端渲染 |
| 输入/焦点处理复杂 | CLI 需要与窗口同步键盘事件 | 抽象输入层，保留终端模式作为备份 |
| 开发/维护成本高 | UI 层几乎重写 | 分阶段迭代：先保持终端模式，新增可选 `--gtk/--sdl` 渲染；成熟后再考虑移除旧路径 |

## 6. 建议
1. 如果短期内只想改善终端画质，可继续在现有字形/TrueColor/auto-fit 上优化，接受“非点对点”的限制。
2. 若确定要提供图形窗口体验，建议：
   - 先以 **可选渲染后端** 的形式引入 SDL/GLFW（CLI 参数 `--renderer=terminal|sdl`），确保回退路径存在。
   - 选定一个跨平台绑定（如 `node-sdl` + 简单纹理绘制）进行 POC，验证构建和输入链可用。
   - 在文档和安装脚本中清晰列出额外依赖，并提供预编译二进制或最小化构建步骤。
3. 长期可考虑 Electron/浏览器方案，以减少原生依赖，但需权衡体积和工具链。

## 7. 结论
- **纯终端渲染无法实现真正的 240×160 点对点显示**，除非终端列/行满足要求或使用图像协议。
- **切换到原生窗口渲染可实现目标，但需要显著的架构改造和跨平台原生依赖处理**。如果团队能投入 3-4 周的开发/测试资源，并接受引入 SDL/OpenGL 等依赖，这是可行的路径；否则应在现有终端方案上迭代、或考虑 Electron/浏览器方式作为折中。

## 8. 实施摘要（2025 Q1）
- CLI 新增 `--renderer=gui` 参数，默认仍为 `terminal`。在 GUI 模式下会尝试加载 `@kmamal/sdl` 并创建 240×160 的窗口，窗口失焦会自动暂停并释放按键。
- 渲染器实现基于 `WindowRenderer` + `@kmamal/sdl`，直接消费 GameCore 的 RGBA 帧，并使用位图 HUD 显示 ROM 名称 / FPS / 暂停提示。
- 输入映射与终端模式一致：`z/x/a/s` = A/B/L/R，方向键控制方向，`p/o` 对应 Start/Select，`Shift+Enter` 暂停/恢复，`Esc` 或 `Ctrl+C` 退出。
- 如果无法加载 SDL（缺少依赖、无显示服务器等）会抛出 `GuiRendererUnavailable` 并自动回落到终端渲染，终端提示会指向本文档协助安装。

### 8.1 依赖安装与构建
1. 确保系统具备 Node.js 18+、pnpm 8+以及基础构建链（macOS 需 Xcode CLT，Linux 需 `build-essential` 与 OpenGL 运行库，Windows 需 VS Build Tools）。
2. 安装依赖：
   ```bash
   pnpm install
   pnpm approve-builds        # 允许 @kmamal/sdl 下载预编译模块
   ```
   pnpm 会自动在 `node_modules/@kmamal/sdl/dist` 下载适配平台的 `.node` 二进制；若下载失败，可手动执行 `node node_modules/@kmamal/sdl/scripts/install.mjs`。
3. 运行示例：`pnpm start -- --renderer=gui ~/roms/pokemon.gba`。若看到 `🖥️ 渲染器: GUI (SDL2)` 与弹出的 SDL 窗口即表示成功。

### 8.2 手动验证矩阵
| 平台 | 渲染模式 | 结果 | 备注 |
| --- | --- | --- | --- |
| macOS 14.5 (Apple Silicon) | `--renderer=gui` | ✅ | SDL 窗口正常显示、暂停/恢复、按键输入、自动降级未触发 |
| macOS 14.5 (Apple Silicon) | 默认终端 | ✅ | 现有 Ink 渲染器基线通过 |
| Ubuntu 22.04 (Wayland) | `--renderer=gui` | ⏳ | 需安装 `libgl1`, `libx11-6`, `libasound2` 后验证 |
| Windows 11 (WSL + Windows Terminal) | `--renderer=gui` | ⏳ | 需在宿主 Windows 上安装 SDL 运行库与 VS Build Tools；WSL 环境内默认无法弹窗 |

> ⏳ 表示尚未在该平台完成实机验证，建议在上述依赖安装完毕后执行 `gbajs2 --renderer=gui demo.gba` 进行冒烟测试。
