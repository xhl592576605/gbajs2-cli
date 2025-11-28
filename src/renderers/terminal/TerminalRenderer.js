import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { Worker } from 'worker_threads';
import PixelMapper from './pixelMapper.js';

const renderWorkerUrl = new URL('./renderWorker.js', import.meta.url);

class TerminalRenderer extends EventEmitter {
	constructor(options = {}) {
		super();
		this.width = Number(options.width) || 240;
		this.height = Number(options.height) || 160;
		this.scaleX = Math.max(1, Math.round(Number(options.scaleX) || 2));
		this.scaleY = Math.max(1, Math.round(Number(options.scaleY) || this.scaleX));
		this.terminalTheme = options.terminalTheme === 'light' ? 'light' : 'dark';
		this.renderWorker = null;
		this.renderInFlight = false;
		this.pendingFrame = null;
		this.bufferPool = [];
		this.nextBufferId = 1;
		this.renderSentAt = 0;
		this.pixelMapper = new PixelMapper({
			scaleX: this.scaleX,
			scaleY: this.scaleY,
			terminalTheme: this.terminalTheme
		});
	}

	async initialize() {
		if (this.renderWorker) {
			return;
		}
		try {
			this.renderWorker = new Worker(renderWorkerUrl, { type: 'module' });
			this.renderWorker.on('message', (message) => this.handleWorkerMessage(message));
			this.renderWorker.on('error', (error) => this.handleWorkerFailure(error));
			this.renderWorker.on('exit', (code) => {
				if (code !== 0) {
					this.handleWorkerFailure(new Error(`渲染 Worker 非正常退出: ${code}`));
				}
			});
			this.renderWorker.postMessage({
				type: 'init',
				payload: this.buildWorkerConfig()
			});
		} catch (error) {
			this.handleWorkerFailure(error);
		}
	}

	submitFrame(frameBuffer) {
		const source =
			frameBuffer instanceof Uint8ClampedArray
				? frameBuffer
				: new Uint8ClampedArray(frameBuffer.buffer.slice(0));
		if (!this.renderWorker) {
			this.emitFallbackFrame(source);
			return { fallback: true };
		}
		const pixels = this.acquirePixelBuffer(source.length);
		pixels.set(source);
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
		this.dispatchToWorker({ pixels, width: this.width, height: this.height, bufferId: (this.nextBufferId += 1) });
		return { skipped: 0 };
	}

	updateOptions(options = {}) {
		if (Number.isFinite(options.scaleX) && options.scaleX >= 1) {
			this.scaleX = Math.round(options.scaleX);
		}
		if (Number.isFinite(options.scaleY) && options.scaleY >= 1) {
			this.scaleY = Math.round(options.scaleY);
		}
		if (options.terminalTheme) {
			this.terminalTheme = options.terminalTheme === 'light' ? 'light' : 'dark';
		}
		this.pixelMapper = new PixelMapper({
			scaleX: this.scaleX,
			scaleY: this.scaleY,
			terminalTheme: this.terminalTheme
		});
		if (this.renderWorker) {
			this.renderWorker.postMessage({
				type: 'config',
				payload: this.buildWorkerConfig()
			});
		}
	}

	destroy() {
		if (this.renderWorker) {
			this.renderWorker.terminate();
		}
		this.renderWorker = null;
		this.renderInFlight = false;
		this.pendingFrame = null;
		this.bufferPool = [];
	}

	handleWorkerMessage(message = {}) {
		const { type, payload } = message;
		if (type === 'frame-result') {
			this.handleFrameResult(payload);
		} else if (type === 'render-ready') {
			this.emit('ready', payload);
		} else if (type === 'render-warning') {
			this.emit('warning', payload);
		} else if (type === 'render-error') {
			this.handleWorkerFailure(new Error(payload?.message || '渲染 Worker 报错'));
		}
	}

	handleFrameResult(payload = {}) {
		if (payload.returnBuffer) {
			this.releaseBuffer(payload.returnBuffer);
		}
		this.renderInFlight = false;
		const latency = performance.now() - this.renderSentAt;
		const framePayload = {
			...payload,
			latency,
			fallback: false
		};
		if (!payload.unchanged && payload.frame) {
			this.emit('frame', framePayload);
		}
		this.emit('metrics', { latency });
		this.flushPendingFrame();
	}

	handleWorkerFailure(error) {
		if (error) {
			this.emit('warning', { code: 'render-worker', message: error.message });
		}
		if (this.renderWorker) {
			try {
				this.renderWorker.terminate();
			} catch (terminateError) {
				this.emit('warning', { code: 'render-worker-terminate', message: terminateError.message });
			}
		}
		this.renderWorker = null;
		this.renderInFlight = false;
		if (this.pendingFrame) {
			this.releaseBuffer(this.pendingFrame.pixels.buffer);
			this.pendingFrame = null;
		}
	}

	emitFallbackFrame(pixels) {
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
	}

	dispatchToWorker({ pixels, width, height, bufferId }) {
		this.renderInFlight = true;
		this.renderSentAt = performance.now();
		this.renderWorker.postMessage(
			{
				type: 'frame',
				payload: { pixels, width, height, bufferId }
			},
			[pixels.buffer]
		);
	}

	flushPendingFrame() {
		if (!this.pendingFrame || this.renderInFlight || !this.renderWorker) {
			return;
		}
		const frame = this.pendingFrame;
		this.pendingFrame = null;
		this.dispatchToWorker(frame);
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

	buildWorkerConfig() {
		return {
			scaleX: this.scaleX,
			scaleY: this.scaleY,
			width: this.width,
			height: this.height,
			terminalTheme: this.terminalTheme
		};
	}
}

export default TerminalRenderer;
