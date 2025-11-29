import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import terminalImage from 'terminal-image';
import PixelMapper from '../terminal/pixelMapper.js';

/**
 * TerminalImageRenderer - 使用 terminal-image 库进行高保真图像渲染
 *
 * 特性:
 * - 窗口变化响应: 监听尺寸变化并动态调整
 * - 性能优化: Buffer pool、帧跳过策略、防抖
 * - 能力探测: 检测终端支持并自动回退
 */
class TerminalImageRenderer extends EventEmitter {
	constructor(options = {}) {
		super();
		this.width = Number(options.width) || 240;
		this.height = Number(options.height) || 160;
		this.scaleX = Math.max(1, Math.round(Number(options.scaleX) || 2));
		this.scaleY = Math.max(1, Math.round(Number(options.scaleY) || this.scaleX));
		this.terminalTheme = options.terminalTheme === 'light' ? 'light' : 'dark';

		// 能力探测标志
		this.isSupported = false;
		this.fallbackMode = false;

		// 回退渲染器：使用字符映射
		this.pixelMapper = new PixelMapper({
			scaleX: this.scaleX,
			scaleY: this.scaleY,
			terminalTheme: this.terminalTheme
		});

		// 性能相关
		this.renderInFlight = false;
		this.pendingFrame = null;
		this.bufferPool = [];
		this.nextBufferId = 1;
		this.renderSentAt = 0;
		this.lastFrame = null;
		this.skippedCount = 0;

		// 窗口变化防抖
		this.resizeDebounceTimer = null;
		this.resizeDebounceDelay = 300; // 300ms

		// 性能预算 (ms)
		this.frameBudget = 16.7; // ~60 FPS
	}

	async initialize() {
		try {
			// terminal-image 库会自动探测终端能力：
			// - 如果支持图片协议（iTerm2, Kitty等），使用真实图片
			// - 如果不支持，自动回退到 ANSI 颜色块模拟图片
			// 所以我们不需要自己做能力探测

			this.isSupported = true;
			this.emit('ready', {
				mode: 'terminal-image',
				supported: true,
				message: 'Terminal-Image 渲染器已就绪（自动适配终端能力）'
			});
		} catch (error) {
			// 即使初始化失败，也设置为支持，让 renderFrame 时再决定是否回退
			this.isSupported = true;
			this.emit('warning', {
				code: 'terminal-image-init-warning',
				message: `初始化警告: ${error.message}`
			});
			this.emit('ready', {
				mode: 'terminal-image',
				supported: true,
				message: 'Terminal-Image 渲染器已启动'
			});
		}
	}

	submitFrame(frameBuffer) {
		const source =
			frameBuffer instanceof Uint8ClampedArray
				? frameBuffer
				: new Uint8ClampedArray(frameBuffer.buffer.slice(0));

		// 如果不支持或处于回退模式，使用字符渲染
		if (!this.isSupported || this.fallbackMode) {
			this.emitFallbackFrame(source, this.lastError?.message);
			return { fallback: true };
		}

		const pixels = this.acquirePixelBuffer(source.length);
		pixels.set(source);

		// 如果正在渲染，将新帧存入 pending
		if (this.renderInFlight) {
			if (this.pendingFrame) {
				this.releaseBuffer(this.pendingFrame.pixels.buffer);
			}
			this.pendingFrame = {
				pixels,
				width: this.width,
				height: this.height,
				bufferId: (this.nextBufferId += 1)
			};
			return { skipped: 1 };
		}

		this.renderFrame({ pixels, width: this.width, height: this.height, bufferId: (this.nextBufferId += 1) });
		return { skipped: 0 };
	}

	async renderFrame({ pixels, width, height, bufferId }) {
		this.renderInFlight = true;
		this.renderSentAt = performance.now();

		try {
			// 将 RGBA 数据编码为 PNG
			// terminal-image 需要 PNG/JPEG 格式的 Buffer，不能直接接收 RGBA
			const { PNG } = await import('pngjs');
			const png = new PNG({
				width: width,
				height: height,
				filterType: -1 // 无过滤，最快
			});

			// 复制 RGBA 数据到 PNG
			png.data = Buffer.from(pixels.buffer);

			// 编码为 PNG Buffer
			const pngBuffer = PNG.sync.write(png);

			// 使用 terminal-image 生成 ANSI 字符串
			// terminal-image 会自动：
			// 1. 检测终端能力
			// 2. 如果支持图片协议（如 iTerm2），使用真实图片
			// 3. 如果不支持，回退到 ANSI 颜色块模拟
			const imageString = await terminalImage.buffer(pngBuffer, {
				width: Math.floor(width * (this.scaleX / 2)),  // 终端字符宽度
				height: Math.floor(height * (this.scaleY / 4)), // 终端字符高度
				preserveAspectRatio: false
			});

			const now = performance.now();
			const duration = now - this.renderSentAt;

			// 检查性能，如果超出预算增加跳帧计数
			if (duration > this.frameBudget) {
				this.skippedCount++;
			}

			// 将图像字符串分割为行数组
			const imageRows = imageString.split('\n');

			// 释放缓冲区
			this.releaseBuffer(pixels.buffer);

			// 缓存当前帧
			this.lastFrame = { rows: imageRows, bufferId, pixels: null };

			this.renderInFlight = false;
			const latency = duration;

			this.emit('frame', {
				frame: { rows: imageRows },
				duration,
				timestamp: Date.now(),
				changedRows: null, // terminal-image 全量渲染
				unchanged: false,
				latency,
				fallback: false
			});

			this.emit('metrics', { latency, skippedFrames: this.skippedCount });

			// 处理 pending 帧
			this.flushPendingFrame();
		} catch (error) {
			this.renderInFlight = false;
			this.releaseBuffer(pixels.buffer);
			this.emit('warning', {
				code: 'terminal-image-render-error',
				message: `渲染错误: ${error.message}`
			});
			// 渲染失败时尝试回退到字符渲染
			this.fallbackMode = true;
			this.lastError = error;
			// 重新获取像素数据进行字符渲染
			const fallbackPixels = this.acquirePixelBuffer(pixels.byteLength);
			fallbackPixels.set(new Uint8ClampedArray(pixels.buffer));
			this.emitFallbackFrame(fallbackPixels, error.message);
			this.releaseBuffer(fallbackPixels.buffer);
		}
	}

	updateOptions(options = {}) {
		let needsRebuild = false;

		if (Number.isFinite(options.scaleX) && options.scaleX >= 1) {
			const newScaleX = Math.round(options.scaleX);
			if (newScaleX !== this.scaleX) {
				this.scaleX = newScaleX;
				needsRebuild = true;
			}
		}

		if (Number.isFinite(options.scaleY) && options.scaleY >= 1) {
			const newScaleY = Math.round(options.scaleY);
			if (newScaleY !== this.scaleY) {
				this.scaleY = newScaleY;
				needsRebuild = true;
			}
		}

		if (options.terminalTheme) {
			const newTheme = options.terminalTheme === 'light' ? 'light' : 'dark';
			if (newTheme !== this.terminalTheme) {
				this.terminalTheme = newTheme;
				needsRebuild = true;
			}
		}

		// 窗口尺寸变化
		if (Number.isFinite(options.width) && options.width > 0) {
			const newWidth = Math.round(options.width);
			if (newWidth !== this.width) {
				this.width = newWidth;
				needsRebuild = true;
			}
		}

		if (Number.isFinite(options.height) && options.height > 0) {
			const newHeight = Math.round(options.height);
			if (newHeight !== this.height) {
				this.height = newHeight;
				needsRebuild = true;
			}
		}

		// 如果配置发生变化，使用防抖清空缓存
		if (needsRebuild) {
			// 同步更新 pixelMapper 配置
			this.pixelMapper = new PixelMapper({
				scaleX: this.scaleX,
				scaleY: this.scaleY,
				terminalTheme: this.terminalTheme
			});

			this.debounceResize(() => {
				this.lastFrame = null;
				this.emit('config-updated', {
					scaleX: this.scaleX,
					scaleY: this.scaleY,
					width: this.width,
					height: this.height,
					terminalTheme: this.terminalTheme
				});
			});
		}
	}

	debounceResize(callback) {
		if (this.resizeDebounceTimer) {
			clearTimeout(this.resizeDebounceTimer);
		}

		this.resizeDebounceTimer = setTimeout(() => {
			this.resizeDebounceTimer = null;
			callback();
		}, this.resizeDebounceDelay);
	}

	destroy() {
		if (this.resizeDebounceTimer) {
			clearTimeout(this.resizeDebounceTimer);
			this.resizeDebounceTimer = null;
		}

		this.renderInFlight = false;
		this.pendingFrame = null;
		this.bufferPool = [];
		this.lastFrame = null;
	}

	emitFallbackFrame(pixels, errorMessage) {
		// 回退模式: 使用字符映射渲染
		if (pixels && pixels.length > 0) {
			// 使用 PixelMapper 生成字符帧
			const frame = this.pixelMapper.mapFrame(pixels, this.width, this.height);
			this.emit('frame', {
				frame,
				duration: 0,
				timestamp: Date.now(),
				changedRows: null,
				unchanged: false,
				latency: 0,
				fallback: true
			});
		} else {
			// 如果没有像素数据，显示错误信息
			const message = errorMessage ? `⚠️ Terminal-Image 错误: ${errorMessage}` : '⚠️ Terminal-Image 不可用';
			const hint = '已自动回退到字符渲染模式';
			this.emit('frame', {
				frame: { rows: [message, hint] },
				duration: 0,
				timestamp: Date.now(),
				changedRows: null,
				unchanged: false,
				latency: 0,
				fallback: true
			});
		}
	}

	flushPendingFrame() {
		if (!this.pendingFrame || this.renderInFlight) {
			return;
		}
		const frame = this.pendingFrame;
		this.pendingFrame = null;
		this.renderFrame(frame);
	}

	acquirePixelBuffer(size) {
		const index = this.bufferPool.findIndex((buffer) => buffer.byteLength === size);
		if (index >= 0) {
			const buffer = this.bufferPool.splice(index, 1)[0];
			return new Uint8ClampedArray(buffer);
		}
		return new Uint8ClampedArray(size);
	}

	releaseBuffer(buffer) {
		if (buffer?.byteLength) {
			this.bufferPool.push(buffer);
			if (this.bufferPool.length > 4) {
				this.bufferPool.shift();
			}
		}
	}
}

export default TerminalImageRenderer;
