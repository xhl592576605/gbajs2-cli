import { useEffect, useRef } from 'react';
import { useStdout } from 'ink';
import colors from 'ansi-colors';

const ANSI_CLEAR_SCREEN = '\u001b[2J';
const ANSI_CURSOR_HOME = '\u001b[H';
const ANSI_HIDE_CURSOR = '\u001b[?25l';
const ANSI_SHOW_CURSOR = '\u001b[?25h';
const ANSI_ALT_SCREEN_ON = '\u001b[?1049h';
const ANSI_ALT_SCREEN_OFF = '\u001b[?1049l';

const formatNumber = (value, digits = 1) => {
	if (typeof value !== 'number' || Number.isNaN(value)) {
		return '0.0';
	}
	return value.toFixed(digits);
};

export const buildStatusLines = ({
  fps,
  fpsTarget,
  memoryUsage,
  frameDuration,
  cpuUsage,
  skippedFrames,
  statusMessage,
  isPaused,
  autoFitInfo = '',
  audioBufferedMs = 0,
  audioReady = false
}) => {
	const firstLine = [
		colors.cyan(`FPS ${formatNumber(fps, 1)}/${formatNumber(fpsTarget || 59.73, 1)}`),
		colors.magenta(`Frame ${formatNumber(frameDuration, 2)}ms`),
		colors.yellow(`CPU ${formatNumber(cpuUsage, 1)}%`),
		colors.green(`MEM ${formatNumber(memoryUsage, 1)}MB`),
		colors.gray(`Skip ${skippedFrames}`)
	]
		.filter(Boolean)
		.join(' · ');

  const audioLine = audioReady
    ? colors.green(`Audio speaker ${Math.round(audioBufferedMs)}ms`)
    : colors.gray('Audio muted');
  const controls = isPaused ? colors.yellow('⏸ 暂停 · Shift+Enter 恢复') : colors.gray('Ctrl+C 退出 · Shift+Enter 暂停 · Z/X/A/S 为 A/B/L/R');
  const secondLine = [controls, audioLine, autoFitInfo].filter(Boolean).join(' | ');
	const messageLine = statusMessage ? colors.red(statusMessage) : '';

	return messageLine ? [firstLine, secondLine, messageLine] : [firstLine, secondLine];
};

const buildHeaderLine = ({ romName, scaleX, scaleY, density, theme }) => {
	const info = [`scale ${scaleX}×${scaleY}`, `density ${density}`, `theme ${theme}`].join(' · ');
	return `${colors.bold('🎮 ' + (romName || 'GBA.js2 CLI'))} ${colors.gray(`(${info})`)}`;
};

export const computeChangedLineIndexes = (prev = [], next = [], hinted = []) => {
	const marks = new Set(Array.isArray(hinted) ? hinted : []);
	const max = Math.max(prev.length, next.length);
	for (let i = 0; i < max; i += 1) {
		if (prev[i] !== next[i]) {
			marks.add(i);
		}
	}
	return Array.from(marks.values()).sort((a, b) => a - b);
};

const TerminalViewport = ({
	frame,
	frameChangedRows = null,
	isPaused,
	romName,
	fps,
	memoryUsage,
	statusMessage,
	frameDuration,
	fpsTarget,
	cpuUsage = 0,
	skippedFrames = 0,
	audioReady = false,
	audioBufferedMs = 0,
	scaleX,
	scaleY,
	density,
	terminalTheme,
	autoFitNotice = ''
}) => {
	const { stdout } = useStdout();
	const prevLinesRef = useRef([]);
	const directSupported = stdout && stdout.isTTY && typeof stdout.write === 'function';

	useEffect(() => {
		if (!directSupported) {
			return undefined;
		}
		stdout.write(ANSI_ALT_SCREEN_ON);
		stdout.write(ANSI_HIDE_CURSOR);
		stdout.write(ANSI_CLEAR_SCREEN + ANSI_CURSOR_HOME);
		return () => {
			stdout.write(ANSI_SHOW_CURSOR);
			stdout.write(ANSI_CLEAR_SCREEN + ANSI_CURSOR_HOME);
			stdout.write(ANSI_ALT_SCREEN_OFF);
		};
	}, [directSupported, stdout]);

	useEffect(() => {
		if (!directSupported || !stdout) {
			return undefined;
		}
		const handleResize = () => {
			prevLinesRef.current = [];
			stdout.write(ANSI_CLEAR_SCREEN + ANSI_CURSOR_HOME);
		};
		if (typeof stdout.on === 'function') {
			stdout.on('resize', handleResize);
			return () => {
				stdout.off?.('resize', handleResize);
			};
		}
		return undefined;
	}, [directSupported, stdout]);

	useEffect(() => {
		if (!directSupported || !stdout) {
			return;
		}

		const frameRows = frame?.rows || [];
		const headerLine = buildHeaderLine({ romName, scaleX, scaleY, density, theme: terminalTheme });
		const statusLines = buildStatusLines({
			fps,
			fpsTarget,
			memoryUsage,
			frameDuration,
			cpuUsage,
			skippedFrames,
			statusMessage,
			isPaused,
			autoFitInfo: autoFitNotice,
			audioBufferedMs,
			audioReady
		});

		const lines = [headerLine];
		const frameOffset = lines.length;

		if (frameRows.length > 0) {
			lines.push(...frameRows);
		} else {
			lines.push(colors.gray('等待帧数据...'));
		}

		lines.push('');
		lines.push(...statusLines);

		const hintedRows = Array.isArray(frameChangedRows)
			? frameChangedRows.map((index) => index + frameOffset)
			: [];
		const changedLineIndexes = computeChangedLineIndexes(prevLinesRef.current, lines, hintedRows);

		if (!prevLinesRef.current.length) {
			stdout.write(ANSI_CLEAR_SCREEN + ANSI_CURSOR_HOME);
		}

		changedLineIndexes.forEach((lineIndex) => {
			const rowNumber = lineIndex + 1;
			const content = lines[lineIndex] ?? '';
			stdout.write(`\u001b[${rowNumber};1H`);
			stdout.write('\u001b[2K');
			stdout.write(content);
		});

		stdout.write(`\u001b[${lines.length + 1};1H`);
		prevLinesRef.current = lines;
	}, [
		autoFitNotice,
		cpuUsage,
		density,
		fps,
		fpsTarget,
		frame,
		frameChangedRows,
		frameDuration,
		isPaused,
		memoryUsage,
		romName,
		audioBufferedMs,
		audioReady,
		scaleX,
		scaleY,
		skippedFrames,
		statusMessage,
		stdout,
		terminalTheme
	]);

	return null;
};

export default TerminalViewport;
