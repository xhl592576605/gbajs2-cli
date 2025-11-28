import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import GameCore from '../game/GameCore.js';
import ErrorBoundary from './ErrorBoundary.js';
import TerminalViewport from './TerminalViewport.js';
import logger from '../utils/logger.js';
import { computeScaleDimensions, fitScaleToTerminal } from '../renderers/terminal/scaling.js';

const h = React.createElement;

const BUTTON_MAP = {
	z: 'A',
	x: 'B',
	a: 'L',
	s: 'R',
	p: 'START',
	o: 'SELECT'
};

const resolveArrowKey = (key) => {
	if (key.upArrow) {
		return 'UP';
	}
	if (key.downArrow) {
		return 'DOWN';
	}
	if (key.leftArrow) {
		return 'LEFT';
	}
	if (key.rightArrow) {
		return 'RIGHT';
	}
	return null;
};

const getTerminalDimensions = () => ({
	columns: process.stdout?.columns || 80,
	rows: process.stdout?.rows || 24
});

const buildScaleState = ({ desiredScale, autoFit }) => {
	const dimensions = getTerminalDimensions();
	if (desiredScale) {
		const metrics = computeScaleDimensions({ scale: desiredScale });
		return {
			...metrics,
			source: 'user',
			fits: true,
			notice: '用户指定缩放'
		};
	}
	if (!autoFit) {
		const metrics = computeScaleDimensions({ scale: 1 });
		return {
			...metrics,
			source: 'fixed',
			fits: false,
			notice: '已禁用 auto-fit · scale=1'
		};
	}
	const fit = fitScaleToTerminal({
		columns: dimensions.columns,
		rows: dimensions.rows,
		reserveRows: 4
	});
	return {
		...fit,
		notice: fit.fits ? `auto-fit ${dimensions.columns}×${dimensions.rows}` : '终端窗口过小'
	};
};

const App = ({ romPath, options = {} }) => {
	const { exit } = useApp();
	const gameCoreRef = useRef(null);
	const pressedKeysRef = useRef(new Set());
	const autoExitTimerRef = useRef(null);
	const lastFrameUpdateRef = useRef(0);

	const [fps, setFps] = useState(0);
	const [romName, setRomName] = useState('');
	const [memoryUsage, setMemoryUsage] = useState(0);
	const [isPaused, setIsPaused] = useState(false);
	const [statusMessage, setStatusMessage] = useState('正在初始化模拟器...');
	const [frameDuration, setFrameDuration] = useState(0);
	const [fpsTarget, setFpsTarget] = useState(options.fpsLimit || 59.73);
	const [cpuUsage, setCpuUsage] = useState(0);
	const [skippedFrames, setSkippedFrames] = useState(0);
	const [renderLatency, setRenderLatency] = useState(0);
	const [audioBufferedMs, setAudioBufferedMs] = useState(0);
	const [audioReady, setAudioReady] = useState(false);
	const [frameState, setFrameState] = useState({ surface: null, changedRows: null });
	const [scaleState, setScaleState] = useState(() =>
		buildScaleState({
			desiredScale: Number(options.scale) || null,
			autoFit: options.autoFit !== false
		})
	);
	const initialScaleRef = useRef(scaleState);

	const serializedOptions = useMemo(() => JSON.stringify(options || {}), [options]);
	const runtimeOptions = useMemo(() => {
		const parsed = JSON.parse(serializedOptions);
		return {
			scale: parsed.scale,
			terminalTheme: parsed.terminalTheme || 'dark',
			audio: parsed.audio !== false,
			autoFit: parsed.autoFit !== false,
			fpsLimit: parsed.fpsLimit || 59.73,
			...parsed
		};
	}, [serializedOptions]);

	const desiredScale = Number(runtimeOptions.scale) || null;

	useEffect(() => {
		setScaleState(
			buildScaleState({
				desiredScale,
				autoFit: runtimeOptions.autoFit
			})
		);
	}, [desiredScale, runtimeOptions.autoFit]);

	useEffect(() => {
		const core = gameCoreRef.current;
		if (!core || typeof core.updateRenderOptions !== 'function') {
			return;
		}
	core.updateRenderOptions({
		scaleX: scaleState.scaleX,
		scaleY: scaleState.scaleY
	});
}, [scaleState.scaleX, scaleState.scaleY]);

	useEffect(() => {
		if (!runtimeOptions.autoFit || desiredScale) {
			return;
		}
	const handleResize = () => {
		setScaleState((prev) => {
			const next = buildScaleState({
				desiredScale,
				autoFit: runtimeOptions.autoFit
			});
				if (
					prev.scale === next.scale &&
					prev.columns === next.columns &&
					prev.rows === next.rows &&
					prev.density === next.density
				) {
					return prev;
				}
				return next;
			});
		};
		if (typeof process.stdout?.on === 'function') {
			process.stdout.on('resize', handleResize);
			return () => {
				process.stdout?.off?.('resize', handleResize);
			};
		}
		return undefined;
	}, [desiredScale, runtimeOptions.autoFit]);

	useEffect(() => {
		let mounted = true;
		if (!romPath) {
			setStatusMessage('缺少 ROM 路径，无法启动模拟器');
			return () => {
				mounted = false;
			};
		}

		const initialScale = initialScaleRef.current || scaleState;
	const core = new GameCore({
		...runtimeOptions,
		scale: initialScale.scale,
		scaleX: initialScale.scaleX,
		scaleY: initialScale.scaleY
	});
		gameCoreRef.current = core;

		const off = (event, handler) => {
			if (typeof core.off === 'function') {
				core.off(event, handler);
			} else {
				core.removeListener(event, handler);
			}
		};

		const handleFrame = (payload = {}) => {
			if (!mounted) {
				return;
			}
			const now = payload.timestamp || Date.now();
			if (now - lastFrameUpdateRef.current < 33) {
				return;
			}
			lastFrameUpdateRef.current = now;
			setFrameState((prev) => ({
				surface: payload.frame || prev.surface,
				changedRows: payload.changedRows || null
			}));
			setFps(payload.fps || 0);
			setFrameDuration(payload.duration || 0);
		};

		const handleStatus = (payload = {}) => {
			if (!mounted) {
				return;
			}
			setRomName((prev) => payload.romName || prev);
			setMemoryUsage(typeof payload.memoryUsage === 'number' ? payload.memoryUsage : 0);
			setIsPaused(!!payload.isPaused);
			setCpuUsage(typeof payload.cpuUsage === 'number' ? payload.cpuUsage : 0);
			setSkippedFrames(typeof payload.skippedFrames === 'number' ? payload.skippedFrames : 0);
			setFpsTarget(typeof payload.fpsTarget === 'number' ? payload.fpsTarget : runtimeOptions.fpsLimit);
			setRenderLatency(typeof payload.renderLatency === 'number' ? payload.renderLatency : 0);
			setAudioBufferedMs((prev) =>
				typeof payload.audioBufferedMs === 'number' ? payload.audioBufferedMs : prev
			);
			setAudioReady((prev) =>
				typeof payload.audioReady === 'boolean' ? payload.audioReady : prev
			);
			setStatusMessage('');
		};

		const handlePaused = () => {
			if (mounted) {
				setIsPaused(true);
			}
		};

		const handleResumed = () => {
			if (mounted) {
				setIsPaused(false);
			}
		};

		const handleError = (error) => {
			const message = error?.message || String(error);
			logger.error('GameCore 发生错误', message);
			if (mounted) {
				setStatusMessage(message);
			}
		};

		const attachListeners = () => {
			core.on('frame', handleFrame);
			core.on('status', handleStatus);
			core.on('paused', handlePaused);
			core.on('resumed', handleResumed);
			core.on('error', handleError);
			core.on('stopped', () => {
				if (mounted) {
					setStatusMessage('模拟器已停止');
				}
			});
		};

		const detachListeners = () => {
			off('frame', handleFrame);
			off('status', handleStatus);
			off('paused', handlePaused);
			off('resumed', handleResumed);
			off('error', handleError);
		};

		const bootstrap = async () => {
			try {
				await core.initialize(romPath);
				if (!mounted) {
					return;
				}
				setStatusMessage('');
				attachListeners();
				core.start();
				if (runtimeOptions.autoExitAfterInit) {
					logger.info(`自动退出测试模式，${runtimeOptions.autoExitDelay || 1000}ms 后结束`);
					autoExitTimerRef.current = setTimeout(() => {
						logger.info('自动退出计时器触发，准备关闭模拟器');
						core.stop();
						exit();
					}, runtimeOptions.autoExitDelay || 1000);
				}
			} catch (error) {
				handleError(error);
				exit(error instanceof Error ? error : undefined);
			}
		};

		bootstrap();

		return () => {
			mounted = false;
			detachListeners();
			core.stop();
			gameCoreRef.current = null;
			if (autoExitTimerRef.current) {
				clearTimeout(autoExitTimerRef.current);
				autoExitTimerRef.current = null;
			}
		};
	}, [romPath, runtimeOptions, exit]);

	const tapKey = (key) => {
		const core = gameCoreRef.current;
		if (!core || !key) {
			return;
		}
		const pressedKeys = pressedKeysRef.current;
		if (pressedKeys.has(key)) {
			return;
		}
		pressedKeys.add(key);
		core.pressKey(key);
		setTimeout(() => {
			core.releaseKey(key);
			pressedKeys.delete(key);
		}, 30);
	};

	useInput((input, key) => {
		const core = gameCoreRef.current;
		if (key.ctrl && input === 'c') {
			core?.stop();
			exit();
			return;
		}

		if (!core) {
			return;
		}

		if (key.return && key.shift) {
			core.togglePause();
			return;
		}

		let mapped = null;
		const normalized = typeof input === 'string' ? input.toLowerCase() : '';
		if (BUTTON_MAP[normalized]) {
			mapped = BUTTON_MAP[normalized];
		} else {
			mapped = resolveArrowKey(key);
		}

		if (!mapped) {
			if (key.escape) {
				mapped = 'SELECT';
			} else if (key.return) {
				mapped = 'START';
			}
		}

		if (mapped) {
			tapKey(mapped);
		}
	});

	if (!romPath) {
		return h(
			ErrorBoundary,
			null,
			h(
				Box,
				{ flexDirection: 'column' },
				h(Text, { color: 'red' }, '缺少 ROM 文件，无法启动 GBA 模拟器')
			)
		);
	}

	return h(
		ErrorBoundary,
		null,
		h(TerminalViewport, {
			frame: frameState.surface,
			frameChangedRows: frameState.changedRows,
			isPaused,
			romName,
			fps,
			memoryUsage,
			statusMessage,
			frameDuration: renderLatency || frameDuration,
			fpsTarget,
			cpuUsage,
			skippedFrames,
			audioReady,
			audioBufferedMs,
			scaleX: scaleState.scaleX,
			scaleY: scaleState.scaleY,
			density: scaleState.density,
			terminalTheme: runtimeOptions.terminalTheme,
			autoFitNotice: scaleState.notice
		})
	);
};

export default App;
