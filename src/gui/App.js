import path from 'path';
import GameCore from '../game/GameCore.js';
import logger from '../utils/logger.js';

const BUTTON_MAP = {
	z: 'A',
	x: 'B',
	a: 'L',
	s: 'R',
	p: 'START',
	o: 'SELECT',
	up: 'UP',
	down: 'DOWN',
	left: 'LEFT',
	right: 'RIGHT'
};

const defaultHudState = () => ({
	romName: '',
	fps: 0,
	paused: false,
	notice: '',
	scale: 1
});

class GuiRuntime {
	constructor({ romPath, options }) {
		this.romPath = romPath;
		this.options = options;
		this.renderer = null;
		this.gameCore = null;
		this.pressedButtons = new Set();
		this.manualPause = false;
		this.stopping = false;
		this.autoExitTimer = null;
		this.hudState = defaultHudState();
		this.exitResolved = false;
		this.exitPromise = new Promise((resolve, reject) => {
			this.resolveExit = resolve;
			this.rejectExit = reject;
		});
		this.sigintHandler = () => {
			console.log('\n收到 Ctrl+C，正在退出...');
			this.requestExit('sigint');
		};
		process.on('SIGINT', this.sigintHandler);
	}

	async start() {
		const rendererOptions = {
			scale: Math.max(1, Math.round(this.options.guiScale || this.options.scale || 3)),
			autoFit: this.options.guiAutoFit !== false,
			borderless: false,
			resizable: true,
			title: this.buildWindowTitle()
		};
		this.gameCore = new GameCore({
			...this.options,
			rendererTarget: 'gui',
			rendererOptions,
			onRendererReady: (renderer) => this.handleRendererReady(renderer)
		});
		this.bindCoreEvents();
		await this.gameCore.initialize(this.romPath);
		this.gameCore.start();
		return this.exitPromise;
	}

	buildWindowTitle() {
		const romLabel = this.romPath ? path.basename(this.romPath) : 'gbajs2';
		return `gbajs2 · ${romLabel}`;
	}

	bindCoreEvents() {
		this.gameCore.on('status', (status) => this.handleStatus(status));
		this.gameCore.on('initialized', ({ romName }) => this.handleInitialized(romName));
		this.gameCore.on('paused', () => this.handlePause(true));
		this.gameCore.on('resumed', () => this.handlePause(false));
		this.gameCore.on('error', (error) => this.handleCoreError(error));
		this.gameCore.on('stopped', () => this.handleCoreStopped());
	}

	handleRendererReady(renderer) {
		this.renderer = renderer;
		renderer.on('ready', (payload) => {
			console.log(`🪟 GUI 窗口已创建 (${payload.pixelWidth}×${payload.pixelHeight})`);
			this.updateHud({ notice: '窗口就绪' });
		});
		renderer.on('resize', (event) => {
			this.updateHud({ scale: event.scale, notice: '' });
		});
		renderer.on('keyDown', (event) => this.handleKeyDown(event));
		renderer.on('keyUp', (event) => this.handleKeyUp(event));
		renderer.on('focus', () => this.handleFocus());
		renderer.on('blur', () => this.handleBlur());
		renderer.on('close', () => this.requestExit('window-close'));
		renderer.on('beforeClose', () => this.requestExit('window-close'));
		renderer.on('warning', (warning) => {
			logger.warn(`GUI 渲染警告: ${warning?.message || warning?.code || warning}`);
		});
		this.renderer.updateHudState(this.hudState);
	}

	handleStatus(status = {}) {
		this.updateHud({
			romName: status.romName || this.hudState.romName,
			fps: status.fps,
			paused: status.isPaused
		});
		if (status.renderLatency) {
			logger.debug(`渲染延迟 ${status.renderLatency.toFixed(2)}ms`);
		}
	}

	handleInitialized(romName) {
		if (romName) {
			this.updateHud({ romName, notice: '' });
		}
		console.log(`✅ 成功加载 ROM: ${romName || path.basename(this.romPath)}`);
		if (this.options.autoExitAfterInit) {
			const delay = Number(this.options.autoExitDelay) || 1000;
			this.autoExitTimer = setTimeout(() => {
				this.requestExit('auto-exit');
			}, delay);
		}
	}

	handlePause(paused) {
		this.manualPause = paused;
		this.updateHud({ paused, notice: paused ? 'PAUSED' : '' });
	}

handleFocus() {
	 this.gameCore.resume();
	 this.updateHud({ notice: '' });
}

handleBlur() {
	 this.releaseAllButtons();
	 this.updateHud({ notice: '窗口失焦' });
}

	handleKeyDown(event) {
		const key = (event?.key || '').toLowerCase();
		if (!key) {
			return;
		}
		if (event?.ctrl && key === 'c') {
			this.requestExit('ctrl-c');
			return;
		}
		if (key === 'escape') {
			this.requestExit('escape');
			return;
		}
		if (key === 'return' && event?.shift) {
			if (this.manualPause) {
				this.gameCore.resume();
			} else {
				this.gameCore.pause();
			}
			return;
		}
		const button = BUTTON_MAP[key];
		if (!button) {
			return;
		}
		if (event?.repeat) {
			return;
		}
		if (this.pressedButtons.has(button)) {
			return;
		}
		this.pressedButtons.add(button);
		this.gameCore.pressKey(button);
	}

	handleKeyUp(event) {
		const key = (event?.key || '').toLowerCase();
		if (!key) {
			return;
		}
		const button = BUTTON_MAP[key];
		if (!button) {
			return;
		}
		if (!this.pressedButtons.has(button)) {
			return;
		}
		this.pressedButtons.delete(button);
		this.gameCore.releaseKey(button);
	}

	releaseAllButtons() {
		this.pressedButtons.forEach((button) => {
			this.gameCore.releaseKey(button);
		});
		this.pressedButtons.clear();
	}

	updateHud(patch = {}) {
		this.hudState = {
			...this.hudState,
			...patch
		};
		if (this.renderer?.updateHudState) {
			this.renderer.updateHudState(this.hudState);
		}
	}

	handleCoreError(error) {
	console.error('GUI 运行出错:', error?.message || error);
	if (!this.exitResolved && this.rejectExit) {
		this.exitResolved = true;
		this.rejectExit(error);
	}
	this.requestExit('core-error');
}

handleCoreStopped() {
	this.cleanup();
	if (!this.exitResolved && this.resolveExit) {
		this.exitResolved = true;
		this.resolveExit();
	}
}

	async requestExit(reason) {
		if (this.stopping) {
			return;
		}
		this.stopping = true;
		logger.info(`GUI 运行结束 (${reason})`);
		clearTimeout(this.autoExitTimer);
		this.releaseAllButtons();
		await this.gameCore?.shutdown();
		this.renderer?.destroy?.();
	}

	cleanup() {
		process.off('SIGINT', this.sigintHandler);
	}
}

const runGuiApp = async ({ romPath, options }) => {
	if (!romPath) {
		throw new Error('缺少 ROM 路径，无法启动 GUI 模式');
	}
	const runtime = new GuiRuntime({ romPath, options });
	return runtime.start();
};

export default runGuiApp;
