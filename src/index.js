#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import cac from 'cac';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { PassThrough } from 'stream';
import logger, { log } from './utils/logger.js';
import App from './components/App.js';
import runGuiApp from './gui/App.js';
import { computeScaleDimensions, describeScale, fitScaleToTerminal } from './renderers/terminal/scaling.js';
import installAudioWarningFilter from './utils/audioWarningFilter.js';
import { GuiRendererUnavailable } from './renderers/gui/errors.js';

installAudioWarningFilter();

const createMockStdin = () => {
  const mock = new PassThrough();
  mock.isTTY = true;
  mock.setRawMode = () => {};
  return mock;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cli = cac('gbajs2');

const parsePositiveInt = (value, fallback) => {
  const normalized = Number(value);
  if (Number.isFinite(normalized) && normalized >= 1) {
    return Math.floor(normalized);
  }
  return fallback;
};

const normalizeThemeInput = (value) => {
  const theme = String(value || '').toLowerCase();
  if (theme === 'light' || theme === 'dark') {
    return theme;
  }
  return 'auto';
};

const inferThemeFromEnv = () => {
  const envTheme = String(process.env.TERM_BACKGROUND || process.env.TERM_THEME || '').toLowerCase();
  if (envTheme.includes('light')) {
    return 'light';
  }
  if (envTheme.includes('dark')) {
    return 'dark';
  }
  const termProgram = String(process.env.TERM_PROGRAM || '').toLowerCase();
  if (termProgram.includes('apple')) {
    return 'light';
  }
  if (termProgram.includes('iterm') || termProgram.includes('hyper') || termProgram.includes('wezterm') || termProgram.includes('vscode')) {
    return 'dark';
  }
  if (process.env.WT_SESSION) {
    return 'dark';
  }
  return null;
};

const resolveTerminalTheme = (input) => {
  const normalized = normalizeThemeInput(input);
  if (normalized === 'light' || normalized === 'dark') {
    return { theme: normalized, source: 'user' };
  }
  const inferred = inferThemeFromEnv();
  if (inferred) {
    return { theme: inferred, source: 'env' };
  }
  return { theme: 'dark', source: 'fallback' };
};

// 主命令 - 运行GBA游戏
cli
  .command('[rom]', '运行GBA游戏')
  .option('-c, --scale <number>', '统一字符缩放比例（留空时启用 auto-fit）')
  .option('--auto-fit', '自动根据终端尺寸计算缩放', { default: true })
  .option('--terminal-theme <theme>', '终端主题 light|dark|auto', { default: 'auto' })
  .option('--fps-limit <number>', '目标帧率 (30-60)', { default: 59.73 })
  .option('--renderer <mode>', '渲染器 terminal|gui', { default: 'terminal' })
  .option('--no-audio', '禁用音频输出')
  .option('--bios <path>', '指定 GBA BIOS 文件路径 (16KB 原版)')
  .option('--log-level <level>', '日志级别 (error, warn, info, debug, trace)', { default: 'info' })
  .action(async (rom, options) => {
    try {
      logger.setLevel(options.logLevel);
      log.info('GBA.js2 CLI 启动');
      log.info(`Node.js 版本: ${process.version}`);
      log.info(`工作目录: ${process.cwd()}`);
      log.info(`日志目录: ${logger.logDir}`);

      if (!rom) {
        console.error('错误: 请指定ROM文件路径');
        log.error('未指定ROM文件路径');
        process.exit(1);
      }

      const romPath = path.resolve(rom);
      if (!fs.existsSync(romPath)) {
        console.error(`错误: ROM文件不存在: ${rom}`);
        log.error(`ROM文件不存在: ${romPath}`);
        process.exit(1);
      }

      const romStats = fs.statSync(romPath);
      log.romLoad(romPath, romStats.size);

      const defaultBiosPath = path.resolve(__dirname, 'resources', 'bios.bin');
      const biosPath = options.bios ? path.resolve(options.bios) : defaultBiosPath;
      if (!fs.existsSync(biosPath)) {
        console.warn('⚠️ 未找到 BIOS 文件，将使用内置 HLE，可能导致部分游戏白屏');
        log.warn(`BIOS 文件不存在: ${biosPath}`);
      } else {
        const biosSize = fs.statSync(biosPath).size;
        if (biosSize !== 0x4000) {
          console.warn(`⚠️ 当前 BIOS 大小为 ${biosSize} 字节，建议使用 16384 字节的原版 BIOS 以确保兼容性`);
          log.warn(`BIOS 大小异常: ${biosSize} 字节 (期望 16384)`);
        }
      }

      const shouldAutoExit = process.env.GBAJS2_AUTO_EXIT === '1';
      const autoExitDelay = Number(process.env.GBAJS2_AUTO_EXIT_DELAY) || undefined;

      const rendererTarget = String(options.renderer || 'terminal').toLowerCase();
      let useGuiMode = rendererTarget === 'gui';
      if (rendererTarget !== 'terminal' && rendererTarget !== 'gui') {
        console.warn(`⚠️ 未知渲染器 ${rendererTarget} ，将使用 terminal 模式`);
        useGuiMode = false;
      }

      const autoFitRequested = options.autoFit !== false;
      const terminalAutoFit = autoFitRequested;
      const manualScale = options.scale ? parsePositiveInt(options.scale, 1) : null;
      const fpsLimit = Math.min(60, Math.max(30, Number(options.fpsLimit) || 59.73));
      const terminalColumns = process.stdout?.columns || 80;
      const terminalRows = process.stdout?.rows || 24;
      const scaleMetrics = manualScale
        ? computeScaleDimensions({ scale: manualScale })
        : terminalAutoFit
          ? fitScaleToTerminal({ columns: terminalColumns, rows: terminalRows, reserveRows: 4 })
          : computeScaleDimensions({ scale: 1 });
      const { theme: terminalTheme, source: themeSource } = resolveTerminalTheme(options.terminalTheme);
      const scaleSummary = describeScale({
        ...scaleMetrics,
        source: manualScale ? 'user' : terminalAutoFit ? 'auto' : 'fixed'
      });

      const runtimeOptions = {
        scale: manualScale,
        terminalTheme,
        audio: options.audio !== false,
        logLevel: options.logLevel,
        biosPath,
        autoExitAfterInit: shouldAutoExit,
        autoExitDelay,
        autoFit: terminalAutoFit,
        fpsLimit
      };

      console.log(`🎮 ROM: ${path.basename(romPath)}`);
      console.log(`📝 日志文件: ${logger.getCurrentLogFile()}`);
      console.log(runtimeOptions.audio ? '🔊 音频已启用' : '🔇 音频已禁用 (--no-audio)');
      console.log(`🎯 FPS 限制: ${fpsLimit}`);
      if (runtimeOptions.autoExitAfterInit) {
        console.log(`⏱️ 自动退出测试模式已启用，将在 ${runtimeOptions.autoExitDelay || 1000}ms 后退出`);
      }

      if (useGuiMode) {
        const guiScale = manualScale || 3;
        const guiAutoFit = autoFitRequested;
        console.log('🖥️ 渲染器: GUI (SDL2)');
        console.log(`🧮 GUI 窗口缩放: ${guiScale}x`);
        try {
          console.log('🚀 正在启动 GUI 渲染器...');
          await runGuiApp({
            romPath,
            options: {
              ...runtimeOptions,
              rendererTarget: 'gui',
              guiScale,
              guiAutoFit
            }
          });
          return;
        } catch (error) {
          if (error instanceof GuiRendererUnavailable) {
            console.error('⚠️ GUI 渲染不可用:', error.message);
            console.error('👉 请参考 docs/GUI渲染可行性评估.md 安装依赖，系统已自动回退终端模式。');
            useGuiMode = false;
          } else {
            throw error;
          }
        }
      }

      const stdoutSupportsDirectMode =
        Boolean(process.stdout?.isTTY) && typeof process.stdout?.write === 'function';
      if (!stdoutSupportsDirectMode) {
        console.error('错误: 当前标准输出不是交互式终端，无法启用 direct mode 渲染。');
        console.error('请直接在支持 ANSI 的终端内运行 gbajs2（不要通过管道或重定向）');
        process.exit(1);
      }

      console.log('🖥️ 渲染器: Terminal (Ink)');
      console.log(`🧮 缩放策略: ${scaleSummary}`);
      console.log(`🎨 终端主题: ${terminalTheme}${themeSource === 'user' ? '' : ` (${themeSource})`}`);

      const supportsRawMode = Boolean(process.stdin?.isTTY && typeof process.stdin.setRawMode === 'function');
      const stdinStream = supportsRawMode ? process.stdin : createMockStdin();
      if (!supportsRawMode) {
        console.log('⚠️ 当前环境不支持原始输入模式，将禁用键盘事件');
      }

      console.log('🚀 正在启动终端渲染界面...');

      const ink = render(React.createElement(App, { romPath, options: runtimeOptions }), {
        stdin: stdinStream,
        stdout: process.stdout,
        stderr: process.stderr,
        exitOnCtrlC: false,
        patchConsole: false
      });
      await ink.waitUntilExit();
      if (!supportsRawMode && typeof stdinStream.end === 'function') {
        stdinStream.end();
      }
      log.info('Ink 渲染流程结束');
    } catch (error) {
      console.error('启动失败:', error.message);
      log.error('启动失败:', error.message);
      log.debug(error.stack);
      process.exit(1);
    }
  });

// 日志查看命令
cli
  .command('logs', '查看日志文件')
  .option('-d, --date <date>', '指定日期 (YYYY-MM-DD)', new Date().toISOString().split('T')[0])
  .option('-n, --lines <number>', '显示行数', { default: 50 })
  .option('-l, --list', '列出所有日志文件')
  .option('--cleanup <days>', '清理N天前的日志文件')
  .action(async (options) => {
    try {
      const logDir = logger.logDir;

      if (options.cleanup) {
        console.log(`正在清理 ${options.cleanup} 天前的日志文件...`);
        await logger.cleanupOldLogs(parseInt(options.cleanup));
        console.log('✅ 清理完成');
        return;
      }

      if (options.list) {
        const files = await logger.getLogFiles();
        if (files.length === 0) {
          console.log('暂无日志文件');
          return;
        }

        console.log('📁 日志文件列表:');
        files.forEach(file => {
          const filePath = path.join(logDir, file);
          const stats = fs.statSync(filePath);
          console.log(`  ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
        });
        return;
      }

      // 读取指定日期的日志
      const date = options.date || new Date().toISOString().split('T')[0];
      const lines = await logger.readLog(date, parseInt(options.lines));

      if (lines.length === 0) {
        console.log(`${date} 无日志记录`);
        return;
      }

      console.log(`📝 显示 ${date} 的日志 (最近 ${lines.length} 行):`);
      console.log('');

      lines.forEach(line => {
        // 根据日志级别添加颜色
        if (line.includes('[ERROR]')) {
          console.log(`\x1b[31m${line}\x1b[0m`); // 红色
        } else if (line.includes('[WARN]')) {
          console.log(`\x1b[33m${line}\x1b[0m`); // 黄色
        } else if (line.includes('[INFO]')) {
          console.log(`\x1b[36m${line}\x1b[0m`); // 青色
        } else if (line.includes('[DEBUG]')) {
          console.log(`\x1b[90m${line}\x1b[0m`); // 灰色
        } else if (line.includes('[TRACE]')) {
          console.log(`\x1b[35m${line}\x1b[0m`); // 洋红色
        } else {
          console.log(line);
        }
      });

    } catch (error) {
      console.error('查看日志失败:', error.message);
      log.error('查看日志失败:', error.message);
    }
  });

// 版本信息
cli.version('1.0.0');

cli.help();
cli.parse();
