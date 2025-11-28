gbajs2 -- Community Fork
======

gbajs2 is a Game Boy Advance emulator written in Javascript from scratch using HTML5 technologies like Canvas and Web Audio. 
It is freely licensed and works in any modern browser without plugins.

Use it online! <https://andychase.me/gbajs2>

See the [issues page](https://github.com/andychase/gbajs2/issues) for feature suggestions and ways you can help contribute!

Mailing list for general discussion or if you want to just be kept in the loop: https://groups.google.com/forum/#!forum/gbajs2

## Feature List

* Playable compatibility, see [compatibility](https://github.com/andychase/gbajs2/wiki/Compatibility-List)
* Acceptable performance on modern browsers
* Pure javascript, allowing easy API access
* Realtime clock gamepad support (Pokemon Ruby)
* Save games

## CLI 模式（gbajs2-cli）

仓库同时提供一个 Node.js CLI 版本，默认在终端内使用 Ink 渲染字符画面，也可以通过 GUI 模式打开 SDL 窗口：

```bash
# 终端渲染（默认）
pnpm start -- <path-to-rom>

# GUI 窗口渲染（实验特性）
pnpm start -- --renderer=gui <path-to-rom>
```

### GUI 窗口模式

- 依赖 `@kmamal/sdl` 预编译模块。首次 `pnpm install` 后执行 `pnpm approve-builds` 允许下载预编译的 `.node`，必要时可手动运行 `node node_modules/@kmamal/sdl/scripts/install.mjs`。
- SDL 初始化失败（缺少依赖、无显示服务器等）时 CLI 会输出 `GuiRendererUnavailable` 的提示，并自动降级回终端渲染。
- 键位映射：`z/x/a/s` = A/B/L/R，方向键控制方向，`p/o` 对应 Start/Select，`Shift+Enter` 暂停/恢复，`Esc` 或 `Ctrl+C` 立即退出。
- HUD 会显示 ROM 名称、实时 FPS 以及暂停状态，窗口失焦时会自动暂停并释放按键。
- 窗口默认按整数倍自动适配（可拖拽/最大化），当窗口尺寸正好是 240×160 的整数倍时会消除黑边；最小化后重新恢复会继续渲染。

如需手动验证 GUI 模式，可在 macOS/Linux/Windows 上运行 `gbajs2 --renderer=gui <rom>`，确认 SDL 窗口能以整数倍缩放显示 240×160 画面。

## License
Original work by Endrift. Repo: (Archived / No longer maintained) https://github.com/endrift/gbajs

Copyright © 2012 – 2013, Jeffrey Pfau
Copyright © 2020, Andrew Chase

All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.
