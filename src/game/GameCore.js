import path from 'path';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { Worker } from 'worker_threads';
import GameBoyAdvance from '../gba/gba.js';
import logger from '../utils/logger.js';
import FileSystem from '../utils/fileSystem.js';
import { createRenderer } from '../renderers/index.js';
import PixelMapper from '../renderers/terminal/pixelMapper.js';
import FrameScheduler from './frameScheduler.js';
import AudioRingBuffer from '../utils/audioRingBuffer.js';

const GBA_WIDTH = 240;
const GBA_HEIGHT = 160;
const DEFAULT_STATUS_INTERVAL = 1000;
const DEFAULT_FPS = 59.73;

const audioWorkerUrl = new URL('../workers/audioWorker.js', import.meta.url);

export class GameCore extends EventEmitter {
	constructor(options = {}) {
		super();
		this.options = {
			scale: 3,
			scaleX: null,
			scaleY: null,
			terminalTheme: 'dark',
			audio: true,
			statusInterval: DEFAULT_STATUS_INTERVAL,
			audioFrameSize: null,
			audioSampleRate: null,
			fpsLimit: DEFAULT_FPS,
			rendererTarget: options.rendererTarget || 'terminal',
			rendererOptions: options.rendererOptions || {},
			onRendererReady: options.onRendererReady,
			...options
		};

		const baseScale = Math.max(1, Number(this.options.scale) || 2);
		this.scaleX = Math.max(1, Number(this.options.scaleX) || baseScale);
		this.scaleY = Math.max(1, Number(this.options.scaleY) || this.scaleX);
		this.density = 'balanced';
		this.terminalTheme = this.options.terminalTheme === 'light' ? 'light' : 'dark';
		this.enableAudio = this.options.audio !== false;
		this.fpsLimit = Math.min(60, Math.max(30, Number(this.options.fpsLimit) || DEFAULT_FPS));
		this.rendererTarget = String(this.options.rendererTarget || 'terminal').toLowerCase();
		this.rendererOptions = { ...this.options.rendererOptions };
		this.onRendererReady = typeof this.options.onRendererReady === 'function' ? this.options.onRendererReady : null;

		this.fileSystem = new FileSystem({
			biosPath: this.options.biosPath,
			saveDir: this.options.saveDir
		});

		this.logger = logger.child('GameCore');
		this.gba = null;
		this.renderer = null;
		this.audioWorker = null;
		this.previewPixelMapper = null;

		this.romSource = null;
		this.romIdentifier = null;
		this.romName = '';
		this.savePath = null;

		this.isRunning = false;
		this.isPaused = false;
		this.scheduler = null;
		this.statusTimer = null;

		this.frameCounter = 0;
		this.currentFps = 0;
		this.lastFpsMark = performance.now();
		this.lastFrameSurface = null;
		this.lastFrameDuration = 0;
		this.lastFrameTimestamp = Date.now();
		this.renderLatency = 0;
		this.skippedFrames = 0;
		this.cpuUsageSample = process.cpuUsage();
		this.lastCpuTimestamp = Date.now();
		this.cpuPercentage = 0;

		this.audioReady = false;
		this.audioSourceRate = 32768;
		this.audioTargetRate = Number(this.options.audioSampleRate) || null;
		this.audioFrameSize =
			Number(this.options.audioFrameSize) && Number(this.options.audioFrameSize) > 0
				? Number(this.options.audioFrameSize)
				: null;
		this.audioBufferedMs = 0;
		this.audioNeedsRefill = true;
		this.audioRingWriter = null;
		this.audioSharedBuffer = null;
		this.audioMetaBuffer = null;
		this.audioQueueDurationMs = 180;
		this.audioChunkDurationMs = Math.max(32, Math.round((1000 / this.fpsLimit) * 2));
		this.audioRefillBurst = 4;
	}

	async initialize(romSource) {
		if (!romSource) {
			throw new Error('必须提供 ROM 源以初始化模拟器');
		}
		this.romSource = romSource;

		try {
			await this.ensureGbaInstance();
			this.audioSourceRate = this.gba?.audio?.sampleRate || this.audioSourceRate;
			if (!this.audioTargetRate) {
				this.audioTargetRate = this.audioSourceRate;
			}
			if (!this.audioFrameSize) {
				this.audioFrameSize = Math.max(
					256,
					Math.floor(this.audioSourceRate / this.fpsLimit)
				);
			}
			await this.loadBiosSafe();
			await this.loadRomData(romSource);
			await this.setupRenderer();
			await this.setupAudioWorker();
			this.setupStatusUpdater();
			this.emit('initialized', { romName: this.romName });
		} catch (error) {
			this.emit('error', error);
			throw error;
		}
	}

	async ensureGbaInstance() {
		if (this.gba) {
			return;
		}
		this.gba = new GameBoyAdvance({
			queueFrame: (fn) => setImmediate(fn)
		});
		this.gba.setLogger((level, message) => {
			const levelMap = {
				[this.gba.LOG_ERROR]: 'error',
				[this.gba.LOG_WARN]: 'warn',
				[this.gba.LOG_STUB]: 'debug',
				[this.gba.LOG_INFO]: 'info',
				[this.gba.LOG_DEBUG]: 'debug'
			};
			const method = levelMap[level] || 'debug';
			if (typeof this.logger[method] === 'function') {
				this.logger[method](typeof message === 'string' ? message : JSON.stringify(message));
			}
		});
	}

	async loadBiosSafe() {
		try {
			const biosData = await this.fileSystem.loadBios(this.options.biosPath);
			if (biosData) {
				if (biosData.length !== 0x4000) {
					this.logger.warn(`BIOS 大小为 ${biosData.length} 字节，推荐使用 16384 字节原版 BIOS 以避免白屏`);
				}
				this.gba.setBios(biosData, true);
			}
		} catch (error) {
			this.logger.warn('无法加载 BIOS，将使用高仿实现', error);
		}
	}

	async loadRomData(source) {
		const romData = await this.fileSystem.loadRom(source);
		this.romIdentifier = typeof source === 'string' ? path.resolve(source) : romData;
		this.romName = this.deriveRomName(source);

		const success = this.gba.setRom(romData);
		if (!success) {
			throw new Error('ROM 加载失败，请确认文件是否有效');
		}

		await this.prepareSavePath();
		this.logger.info(`ROM 加载完成: ${this.romName}`);
	}

	deriveRomName(source) {
		if (typeof source === 'string') {
			const base = path.basename(source);
			const ext = path.extname(base);
			return base.replace(ext, '') || base;
		}
		if (source && source.name) {
			return source.name;
		}
		return 'ROM';
	}

	async prepareSavePath() {
		try {
			this.savePath = this.fileSystem.getSavePath(this.romIdentifier);
			await this.fileSystem.ensureDir(path.dirname(this.savePath));
			this.gba.setSavePath(this.savePath);
			const existing = await this.fileSystem.readSave(this.romIdentifier);
			if (existing) {
				this.gba.setSavedata(existing);
				this.logger.info('已加载历史存档');
			}
		} catch (error) {
			this.logger.warn('存档目录创建或加载失败', error);
		}
	}

	async setupRenderer() {
		if (this.renderer) {
			return;
		}
		const renderer = createRenderer({
			target: this.rendererTarget,
			options: {
				width: GBA_WIDTH,
				height: GBA_HEIGHT,
				scaleX: this.scaleX,
				scaleY: this.scaleY,
				terminalTheme: this.terminalTheme,
				...this.rendererOptions
			}
		});
		renderer.on('frame', (payload) => this.handleRendererFrame(payload));
		renderer.on('metrics', ({ latency }) => {
			if (typeof latency === 'number' && Number.isFinite(latency)) {
				this.renderLatency = latency;
			}
		});
		renderer.on('warning', (warning) => {
			const message = warning?.message || warning?.code || warning;
			this.logger.warn(`渲染器警告: ${message}`);
		});
		let rendererReady = false;
		try {
			await renderer.initialize();
			this.logger.info('渲染器初始化完成');
			rendererReady = true;
		} catch (error) {
			if (this.rendererTarget === 'gui') {
				throw error;
			}
			this.logger.warn('渲染器初始化失败，使用主线程像素映射', error);
		}
		this.renderer = renderer;
		if (rendererReady && this.onRendererReady) {
			try {
				this.onRendererReady(renderer);
			} catch (error) {
				this.logger.warn('onRendererReady 回调执行失败', error);
			}
		}
	}

	async setupAudioWorker() {
		if (this.audioWorker || !this.gba) {
			return;
		}
		try {
			this.audioNeedsRefill = true;
			this.audioBufferedMs = 0;
			this.ensureAudioSharedBuffers();
			this.audioWorker = new Worker(audioWorkerUrl, { type: 'module' });
			this.audioWorker.on('message', (message) => this.handleAudioWorkerMessage(message));
			this.audioWorker.on('error', (error) => {
				this.logger.warn('音频 Worker 异常，进入静音模式', error);
				this.destroyAudioWorker();
			});
			this.audioWorker.on('exit', (code) => {
				if (code !== 0) {
					this.logger.warn(`音频 Worker 非正常退出: ${code}`);
					this.destroyAudioWorker();
				}
			});
			this.audioWorker.postMessage({
				type: 'init',
				payload: {
					muted: !this.enableAudio,
					sampleRate: this.audioTargetRate,
					sourceSampleRate: this.audioSourceRate,
					channels: 2,
					queueDurationMs: this.audioQueueDurationMs,
					chunkDurationMs: this.audioChunkDurationMs,
					ring:
						this.audioSharedBuffer && this.audioMetaBuffer
							? {
								sharedBuffer: this.audioSharedBuffer,
								metaBuffer: this.audioMetaBuffer,
								channels: this.audioRingWriter?.channels || 2,
								capacityFrames: this.audioRingWriter?.capacityFrames || 0
							}
							: null
				}
			});
			this.logger.info('音频 Worker 初始化完成');
		} catch (error) {
			this.logger.warn('无法创建音频 Worker，禁用音频功能', error);
			this.destroyAudioWorker();
		}
	}

	handleRendererFrame(payload = {}) {
		if (!payload.frame) {
			return;
		}
		this.lastFrameSurface = payload.frame;
		this.lastFrameDuration = payload.duration || 0;
		this.lastFrameTimestamp = payload.timestamp || Date.now();
		if (typeof payload.latency === 'number') {
			this.renderLatency = payload.latency;
		}
		this.emit('frame', {
			frame: this.lastFrameSurface,
			fps: this.currentFps,
			duration: this.lastFrameDuration,
			timestamp: this.lastFrameTimestamp,
			romName: this.romName,
			changedRows: payload.changedRows
		});
	}

	handleAudioWorkerMessage(message) {
		if (!message) {
			return;
		}
		const { type, payload } = message;
		if (type === 'audio-status') {
			const prevReadyState = this.audioReady;
			const active = payload?.active ?? payload?.ready ?? false;
			this.audioReady = Boolean(active) && !payload?.muted;
			if (typeof payload?.bufferedMs === 'number' && Number.isFinite(payload.bufferedMs)) {
				this.audioBufferedMs = payload.bufferedMs;
			}
			if (
				typeof payload?.targetBufferMs === 'number' &&
				Number.isFinite(payload.targetBufferMs) &&
				payload.targetBufferMs > 0
			) {
				this.audioQueueDurationMs = payload.targetBufferMs;
			}
			if (Object.prototype.hasOwnProperty.call(payload || {}, 'ready')) {
				this.audioNeedsRefill = Boolean(payload.ready && this.audioReady);
			} else {
				this.audioNeedsRefill = this.audioReady;
			}
			if (!prevReadyState && this.audioReady) {
				this.logger.info('音频输出恢复');
			} else if (prevReadyState && !this.audioReady) {
				this.logger.warn('音频输出不可用，已进入静音模式');
			}
		} else if (type === 'audio-error') {
			this.logger.warn(`音频 Worker 报错: ${payload?.message || '未知错误'}`);
			this.destroyAudioWorker();
		}
	}

	updateRenderOptions({ scaleX, scaleY }) {
		if (Number.isFinite(scaleX) && scaleX >= 1) {
			this.scaleX = Math.round(scaleX);
		}
		if (Number.isFinite(scaleY) && scaleY >= 1) {
			this.scaleY = Math.round(scaleY);
		}
		if (this.renderer) {
			this.renderer.updateOptions({
				scaleX: this.scaleX,
				scaleY: this.scaleY,
				terminalTheme: this.terminalTheme
			});
		}
	}

	ensureAudioSharedBuffers() {
		if (this.audioRingWriter && this.audioSharedBuffer && this.audioMetaBuffer) {
			return;
		}
		const minDuration = Math.max(this.audioQueueDurationMs, this.audioChunkDurationMs * 4);
		const capacityFrames = Math.max(
			this.audioFrameSize ? this.audioFrameSize * 8 : 0,
			Math.ceil((this.audioTargetRate * minDuration) / 1000)
		);
		const ringConfig = AudioRingBuffer.create({ capacityFrames, channels: 2 });
		this.audioRingWriter = ringConfig.ring;
		this.audioSharedBuffer = ringConfig.sharedBuffer;
		this.audioMetaBuffer = ringConfig.metaBuffer;
		this.logger.info(
			`音频环形缓冲创建: ${capacityFrames} 帧 (~${Math.round((capacityFrames / this.audioTargetRate) * 1000)}ms)`
		);
	}

	setupStatusUpdater() {
		if (this.statusTimer) {
			clearInterval(this.statusTimer);
		}
		this.statusTimer = setInterval(() => {
			if (!this.gba) {
				return;
			}
			const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
			this.updateCpuUsage();
			this.emit('status', {
				romName: this.romName,
				fps: this.currentFps,
				memoryUsage,
				isPaused: this.isPaused,
				audioReady: this.audioReady,
				audioBufferedMs: this.audioBufferedMs,
				fpsTarget: this.fpsLimit,
				skippedFrames: this.skippedFrames,
				renderLatency: this.renderLatency,
				cpuUsage: this.cpuPercentage,
				scaleX: this.scaleX,
				scaleY: this.scaleY,
				density: this.density
			});
			this.skippedFrames = 0;
		}, this.options.statusInterval || DEFAULT_STATUS_INTERVAL);
		if (typeof this.statusTimer.unref === 'function') {
			this.statusTimer.unref();
		}
	}

	start() {
		if (!this.gba) {
			throw new Error('GameCore 尚未初始化');
		}
		if (this.isRunning) {
			this.isPaused = false;
			return;
		}
		this.isRunning = true;
		this.isPaused = false;
		if (!this.scheduler) {
			this.scheduler = new FrameScheduler({
				fpsLimit: this.fpsLimit,
				onTick: () => {
					if (!this.isPaused) {
						this.advanceFrame();
						this.dispatchAudioSamples();
					}
				}
			});
		} else {
			this.scheduler.setLimit(this.fpsLimit);
		}
		this.scheduler.start();
		this.emit('started');
	}

	pause() {
		if (!this.isRunning || this.isPaused) {
			return;
		}
		this.isPaused = true;
		this.gba.pause();
		this.emit('paused');
	}

	resume() {
		if (!this.isRunning) {
			this.start();
			return;
		}
		this.isPaused = false;
		this.emit('resumed');
	}

	togglePause() {
		if (this.isPaused) {
			this.resume();
		} else {
			this.pause();
		}
	}

	async stop() {
		this.isRunning = false;
		this.isPaused = false;
		if (this.scheduler) {
			this.scheduler.stop();
		}
		if (this.statusTimer) {
			clearInterval(this.statusTimer);
			this.statusTimer = null;
		}
		if (this.gba) {
			this.gba.pause();
		}
		this.destroyRenderWorker();
		this.destroyAudioWorker();
		this.emit('stopped');
	}

	async shutdown() {
		await this.stop();
	}

	advanceFrame() {
		if (!this.gba) {
			return;
		}
		this.gba.advanceFrame();
		const frameBuffer =
			typeof this.gba.getFrameBuffer === 'function'
				? this.gba.getFrameBuffer()
				: this.gba.video.getFrameBuffer();
		if (frameBuffer) {
			this.sendFrameToRenderer(frameBuffer);
		}
		this.updateFps();
	}

	updateFps() {
		this.frameCounter += 1;
		const now = performance.now();
		const elapsed = now - this.lastFpsMark;
		if (elapsed >= 1000) {
			this.currentFps = (this.frameCounter * 1000) / elapsed;
			this.frameCounter = 0;
			this.lastFpsMark = now;
		}
	}

	sendFrameToRenderer(frameBuffer) {
		if (!this.renderer) {
			return;
		}
		const result = this.renderer.submitFrame(frameBuffer);
		if (result?.skipped) {
			this.skippedFrames += result.skipped;
		}
	}

	// 渲染缓冲和回退逻辑由 RendererAdapter 负责

	dispatchAudioSamples() {
		if (!this.enableAudio || !this.gba || !this.audioRingWriter) {
			return;
		}
		const frameSize = this.audioFrameSize || this.options.audioFrameSize || 1024;
		const burst = this.audioNeedsRefill ? this.audioRefillBurst : 1;
		for (let i = 0; i < burst; i += 1) {
			const pull =
				typeof this.gba.pullAudioSamples === 'function'
					? this.gba.pullAudioSamples(frameSize)
					: this.gba.audio.pullSamples(frameSize);
			const samples = pull || new Float32Array(0);
			if (!samples.length) {
				break;
			}
			this.audioRingWriter.write(samples);
			if (!this.audioNeedsRefill) {
				break;
			}
		}
	}

	async saveState() {
		if (!this.savePath || !this.gba || !this.gba.mmu?.save) {
			return null;
		}
		const saved = this.gba.mmu.save;
		await this.fileSystem.saveBinary(this.savePath, new Uint8Array(saved.buffer));
		return this.savePath;
	}

	pressKey(key) {
		try {
			this.gba?.keypad?.pressKey(key);
			logger.keypress(key, 'press');
		} catch (error) {
			this.logger.warn(`按键 ${key} 处理失败`, error);
		}
	}

	releaseKey(key) {
		try {
			this.gba?.keypad?.releaseKey(key);
			logger.keypress(key, 'release');
		} catch (error) {
			this.logger.warn(`按键 ${key} 释放失败`, error);
		}
	}

	updateCpuUsage() {
		const now = Date.now();
		const usage = process.cpuUsage(this.cpuUsageSample);
		this.cpuUsageSample = process.cpuUsage();
		const elapsed = Math.max(1, now - this.lastCpuTimestamp);
		this.lastCpuTimestamp = now;
		const totalMs = (usage.user + usage.system) / 1000;
		this.cpuPercentage = Math.min(100, (totalMs / elapsed) * 100);
	}

	async renderPreviewFrame() {
		const pixels = this.createPreviewPixels();
		if (!this.previewPixelMapper) {
			this.previewPixelMapper = new PixelMapper({
				scaleX: this.scaleX,
				scaleY: this.scaleY,
				terminalTheme: this.terminalTheme
			});
		}
		return this.previewPixelMapper.mapFrame(pixels, GBA_WIDTH, GBA_HEIGHT);
	}

	createPreviewPixels() {
		const pixels = new Uint8ClampedArray(GBA_WIDTH * GBA_HEIGHT * 4);
		for (let y = 0; y < GBA_HEIGHT; y += 1) {
			for (let x = 0; x < GBA_WIDTH; x += 1) {
				const index = (y * GBA_WIDTH + x) * 4;
				const gradient = Math.floor((x / GBA_WIDTH) * 255);
				pixels[index] = gradient;
				pixels[index + 1] = 255 - gradient;
				pixels[index + 2] = Math.floor((y / GBA_HEIGHT) * 255);
				pixels[index + 3] = 255;
			}
		}
		return pixels;
	}

	destroyRenderWorker() {
		this.destroyRenderer();
	}

	destroyRenderer() {
		if (this.renderer) {
			try {
				this.renderer.removeAllListeners?.();
				this.renderer.destroy();
			} catch (error) {
				this.logger.warn('销毁渲染器失败', error);
			}
		}
		this.renderer = null;
	}

	destroyAudioWorker() {
		if (this.audioWorker) {
			try {
				this.audioWorker.postMessage({ type: 'mute' });
			} catch {
				// no-op
			}
			this.audioWorker.terminate();
		}
		this.audioWorker = null;
		this.audioReady = false;
		this.audioNeedsRefill = false;
		this.audioBufferedMs = 0;
		this.audioRingWriter?.reset();
		this.enableAudio = false;
	}
}

export default GameCore;
