import { Buffer } from 'buffer';
import { EventEmitter } from 'events';
import { createRequire } from 'module';
import { performance } from 'perf_hooks';
import HudOverlay from './HudOverlay.js';
import { GuiRendererUnavailable } from './errors.js';

const require = createRequire(import.meta.url);

let cachedSdl = null;

const resolveSdl = () => {
	if (process.env.GBAJS2_DISABLE_GUI === '1') {
		throw new GuiRendererUnavailable('已通过环境变量禁用 GUI 渲染 (GBAJS2_DISABLE_GUI=1)');
	}
	if (cachedSdl) {
		return cachedSdl;
	}
	try {
		cachedSdl = require('@kmamal/sdl');
		return cachedSdl;
	} catch (error) {
		throw new GuiRendererUnavailable('未找到 @kmamal/sdl 依赖，请参考 GUI 文档安装', error);
	}
};

const DEFAULT_WIDTH = 240;
const DEFAULT_HEIGHT = 160;
const DEFAULT_SCALE = 3;

class WindowRenderer extends EventEmitter {
	constructor(options = {}) {
		super();
		this.target = 'gui';
		this.width = Number(options.width) || DEFAULT_WIDTH;
		this.height = Number(options.height) || DEFAULT_HEIGHT;
		this.scale = Math.max(1, Math.round(options.scale || options.scaleX || options.scaleY || DEFAULT_SCALE));
		this.autoFit = options.autoFit !== false;
		this.lockAspectRatio = options.lockAspectRatio !== false;
		this.borderless = Boolean(options.borderless);
		this.resizable = options.resizable !== false;
		this.title = options.title || 'gbajs2 GUI';
		this.window = null;
		this.viewport = {
			x: 0,
			y: 0,
			width: this.width * this.scale,
			height: this.height * this.scale
		};
		this.viewportScale = this.scale;
		this.destroyed = false;
		this.surfaceBuffer = null;
		this.minimized = false;
		this.pendingPresent = false;
		this.hud = new HudOverlay();
		this.hudState = {
			romName: '',
			fps: 0,
			scale: this.scale,
			paused: false,
			notice: ''
		};
		this.stride = this.width * 4;
		this.pendingResize = null;
		this.destroyRequested = false;
	}

	async initialize() {
		if (this.destroyed) {
			throw new Error('WindowRenderer 已销毁');
		}
		const sdl = resolveSdl();
		let windowHandle;
		try {
			windowHandle = sdl.video.createWindow({
				title: this.title,
				width: this.width * this.scale,
				height: this.height * this.scale,
				resizable: this.resizable,
				borderless: this.borderless,
				accelerated: true,
				vsync: true,
				visible: true
			});
		} catch (error) {
			throw new GuiRendererUnavailable('无法创建 SDL 窗口，请确认当前系统支持图形界面', error);
		}
		this.window = windowHandle;
		this.snapWindowSize(this.scale);
		const pixelWidth = this.window.pixelWidth || this.width * this.scale;
		const pixelHeight = this.window.pixelHeight || this.height * this.scale;
		this.updateViewport(pixelWidth, pixelHeight);
		this.attachWindowEvents();
		this.emit('ready', { pixelWidth, pixelHeight, scale: this.viewportScale });
	}

	attachWindowEvents() {
		if (!this.window) {
			return;
		}
		this.window.on('resize', (event) => {
			if (this.pendingResize) {
				const matches =
					Math.abs(event.pixelWidth - this.pendingResize.width) <= 2 &&
					Math.abs(event.pixelHeight - this.pendingResize.height) <= 2;
				if (matches) {
					this.pendingResize = null;
				}
			}
			if (this.lockAspectRatio && !this.pendingResize) {
				const snappedScale = this.deriveScaleFromSize(event.pixelWidth, event.pixelHeight);
				const targetWidth = this.width * snappedScale;
				const targetHeight = this.height * snappedScale;
				if (
					Math.abs(targetWidth - event.pixelWidth) > 2 ||
					Math.abs(targetHeight - event.pixelHeight) > 2
				) {
					this.snapWindowSize(snappedScale);
					return;
				}
			}
			this.updateViewport(event.pixelWidth, event.pixelHeight);
			this.emit('resize', {
				pixelWidth: event.pixelWidth,
				pixelHeight: event.pixelHeight,
				scale: this.viewportScale
			});
		});
		this.window.on('focus', () => {
			this.minimized = false;
			this.pendingPresent = true;
			this.emit('focus');
		});
		this.window.on('blur', () => {
			this.emit('blur');
		});
		this.window.on('minimize', () => {
			this.minimized = true;
			this.emit('blur');
		});
		this.window.on('restore', (event) => {
			this.minimized = false;
			this.pendingPresent = true;
			const nextWidth = event?.pixelWidth || this.window?.pixelWidth || this.viewport.width;
			const nextHeight = event?.pixelHeight || this.window?.pixelHeight || this.viewport.height;
			this.updateViewport(nextWidth, nextHeight);
			this.emit('focus');
		});
		this.window.on('beforeClose', () => {
			if (!this.destroyRequested) {
				this.destroyRequested = true;
				this.emit('beforeClose');
			}
		});
		this.window.on('close', () => {
			this.window = null;
			this.emit('close');
		});
		this.window.on('keyDown', (event) => {
			this.emit('keyDown', event);
		});
		this.window.on('keyUp', (event) => {
			this.emit('keyUp', event);
		});
	}

	updateViewport(pixelWidth, pixelHeight) {
		const availableWidth = Math.max(1, Math.floor(pixelWidth));
		const availableHeight = Math.max(1, Math.floor(pixelHeight));
		let nextScale = this.autoFit
			? Math.max(1, Math.min(Math.floor(availableWidth / this.width), Math.floor(availableHeight / this.height)) || 1)
			: this.scale;
		if (!this.autoFit) {
			const maxScale = Math.max(1, Math.min(Math.floor(availableWidth / this.width), Math.floor(availableHeight / this.height)) || 1);
			nextScale = Math.min(nextScale, maxScale);
		}
		const targetWidth = this.width * nextScale;
		const targetHeight = this.height * nextScale;
		const offsetX = Math.max(0, Math.floor((availableWidth - targetWidth) / 2));
		const offsetY = Math.max(0, Math.floor((availableHeight - targetHeight) / 2));
		this.viewport = {
			x: offsetX,
			y: offsetY,
			width: Math.min(targetWidth, availableWidth),
			height: Math.min(targetHeight, availableHeight)
		};
		this.viewportScale = nextScale;
		this.hudState = {
			...this.hudState,
			scale: this.viewportScale
		};
	}

	submitFrame(frameBuffer) {
		if (!frameBuffer) {
			return { skipped: 0 };
		}
		if (!this.window) {
			return { skipped: 0, fallback: true };
		}
		if (this.minimized) {
			return { skipped: 0, minimized: true };
		}
		const renderStart = performance.now();
		const source = this.createPixelView(frameBuffer);
		this.ensureSurfaceBuffer(source.length);
		this.surfaceBuffer.set(source);
		if (this.hudState) {
			this.hud.apply(this.surfaceBuffer, this.width, this.height, this.hudState);
		}
		try {
			this.window.render(this.width, this.height, this.stride, 'rgba32', this.surfaceBuffer, {
				scaling: 'nearest',
				dstRect: this.viewport
			});
			this.pendingPresent = false;
			const latency = performance.now() - renderStart;
			this.emit('metrics', { latency });
		} catch (error) {
			this.emit('warning', { code: 'render', message: error.message });
		}
		return { skipped: 0 };
	}

	createPixelView(pixels) {
		if (pixels instanceof Uint8ClampedArray) {
			return pixels;
		}
		if (ArrayBuffer.isView(pixels)) {
			return new Uint8ClampedArray(pixels.buffer.slice(pixels.byteOffset, pixels.byteOffset + pixels.byteLength));
		}
		if (pixels instanceof ArrayBuffer) {
			return new Uint8ClampedArray(pixels);
		}
		return Uint8ClampedArray.from(pixels);
	}

	ensureSurfaceBuffer(size) {
		if (!this.surfaceBuffer || this.surfaceBuffer.length !== size) {
			this.surfaceBuffer = Buffer.alloc(size);
		}
	}

	updateOptions(options = {}) {
		if (Number.isFinite(options.scale) && options.scale >= 1) {
			this.scale = Math.round(options.scale);
		}
		if (typeof options.autoFit === 'boolean') {
			this.autoFit = options.autoFit;
		}
		if (options.title && typeof options.title === 'string') {
			this.title = options.title;
			this.window?.setTitle?.(this.title);
		}
		if (this.window) {
			this.updateViewport(this.window.pixelWidth, this.window.pixelHeight);
		}
	}

	updateHudState(patch = {}) {
		this.hudState = {
			...this.hudState,
			...patch,
			scale: patch.scale ?? this.viewportScale
		};
		if (this.window && this.hudState.romName) {
			const fpsText = Number.isFinite(this.hudState.fps) ? `${this.hudState.fps.toFixed(1)}FPS` : '';
			const suffix = fpsText ? ` · ${fpsText}` : '';
			this.window.setTitle(`${this.title} · ${this.hudState.romName}${suffix}`);
		}
	}

	destroy() {
		this.destroyed = true;
		if (this.window) {
			try {
				if (!this.destroyRequested) {
					this.destroyRequested = true;
					this.window.destroy();
				}
			} catch {
				// ignore
			}
		}
		this.window = null;
	}

	deriveScaleFromSize(width, height) {
		const scaleByWidth = width / this.width;
		const scaleByHeight = height / this.height;
		const candidate = Math.max(1, Math.round(Math.min(scaleByWidth, scaleByHeight)));
		return candidate;
	}

	snapWindowSize(scale) {
		if (!this.window) {
			return;
		}
		const snapped = Math.max(1, Math.round(scale));
		const targetWidth = this.width * snapped;
		const targetHeight = this.height * snapped;
		if (
			Math.abs((this.window.pixelWidth || 0) - targetWidth) <= 1 &&
			Math.abs((this.window.pixelHeight || 0) - targetHeight) <= 1
		) {
			this.updateViewport(targetWidth, targetHeight);
			return;
		}
		this.pendingResize = { width: targetWidth, height: targetHeight };
		try {
			this.window.setSizeInPixels(targetWidth, targetHeight);
		} catch (error) {
			this.pendingResize = null;
			this.emit('warning', { code: 'window-resize', message: error.message });
		}
	}
}

export default WindowRenderer;
