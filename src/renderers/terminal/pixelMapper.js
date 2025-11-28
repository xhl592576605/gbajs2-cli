import logger from '../../utils/logger.js';

const ANSI_RESET = '\u001b[0m';
const BALANCED_DENSITY = 'balanced';

const clampColor = (value) => Math.max(0, Math.min(255, value));

const applyThemeCurve = (value, theme) => {
	if (theme === 'light') {
		return clampColor(value * 0.85);
	}
	return clampColor(value * 1.1 + 5);
};

const applyThemeToColor = ({ r, g, b }, theme) => ({
	r: applyThemeCurve(r, theme),
	g: applyThemeCurve(g, theme),
	b: applyThemeCurve(b, theme)
});

const pushAnsi = (segments, nextFg, nextBg, state) => {
	const codes = [];
	if (nextFg !== state.fg) {
		if (Number.isInteger(nextFg)) {
			codes.push(`38;5;${nextFg}`);
		} else {
			codes.push('39');
		}
		state.fg = nextFg ?? null;
	}
	if (nextBg !== state.bg) {
		if (Number.isInteger(nextBg)) {
			codes.push(`48;5;${nextBg}`);
		} else {
			codes.push('49');
		}
		state.bg = nextBg ?? null;
	}
	if (codes.length > 0) {
		segments.push(`\u001b[${codes.join(';')}m`);
	}
};

const buildFrameSurface = ({ rows, width, height, scaleX, scaleY, theme, columns }) => ({
	rows,
	columns,
	rowCount: rows.length,
	width,
	height,
	scaleX,
	scaleY,
	density: BALANCED_DENSITY,
	theme
});

export class PixelMapper {
	constructor(options = {}) {
		const { scaleX = 2, scaleY = null, terminalTheme = 'dark', density } = options;
		if (density && density !== BALANCED_DENSITY) {
			throw new Error('仅支持 balanced 渲染密度');
		}
		const rawScaleX = Math.max(1, Number(scaleX) || 1);
		const rawScaleY = Math.max(1, Number(scaleY ?? scaleX) || 1);
		this.rawScaleX = rawScaleX;
		this.rawScaleY = rawScaleY;
		this.scaleX = Math.max(1, Math.ceil(rawScaleX));
		this.scaleY = Math.max(1, Math.ceil(rawScaleY));
		this.terminalTheme = terminalTheme === 'light' ? 'light' : 'dark';
		this.density = BALANCED_DENSITY;
	}

	mapFrame(pixels, width = 240, height = 160) {
		if (!pixels || pixels.length < width * height * 4) {
			logger.warn('像素数据缺失或尺寸异常，返回空白帧');
			return this.createEmptySurface(width, height);
		}
		return this.mapBalancedFrame(pixels, width, height);
	}

	mapBalancedFrame(pixels, width, height) {
		const charHeight = this.scaleY * 2;
		const rowsCount = Math.ceil(height / charHeight);
		const columns = Math.ceil(width / this.scaleX);
		const rows = new Array(rowsCount);

		for (let blockY = 0; blockY < rowsCount; blockY += 1) {
			const segments = [];
			const ansiState = { fg: null, bg: null };
			for (let blockX = 0; blockX < columns; blockX += 1) {
				const topColor = this.sampleAverage(
					pixels,
					blockX,
					blockY * charHeight,
					width,
					height,
					this.scaleX,
					this.scaleY
				);
				const bottomColor = this.sampleAverage(
					pixels,
					blockX,
					blockY * charHeight + this.scaleY,
					width,
					height,
					this.scaleX,
					this.scaleY
				);
				const adjustedTop = applyThemeToColor(topColor, this.terminalTheme);
				const adjustedBottom = bottomColor.count > 0 ? applyThemeToColor(bottomColor, this.terminalTheme) : adjustedTop;
				const fg = PixelMapper.rgbToAnsi256(adjustedTop.r, adjustedTop.g, adjustedTop.b);
				const bg = PixelMapper.rgbToAnsi256(adjustedBottom.r, adjustedBottom.g, adjustedBottom.b);
				pushAnsi(segments, fg, bg, ansiState);
				segments.push('▀');
			}
			if (ansiState.fg !== null || ansiState.bg !== null) {
				segments.push(ANSI_RESET);
			}
			rows[blockY] = segments.join('');
		}

		return buildFrameSurface({
			rows,
			width,
			height,
			scaleX: this.scaleX,
			scaleY: this.scaleY,
			theme: this.terminalTheme,
			columns
		});
	}

	sampleAverage(pixels, blockX, startY, width, height, spanX, spanY) {
		let r = 0;
		let g = 0;
		let b = 0;
		let count = 0;
		const startX = blockX * this.scaleX;
		for (let y = 0; y < spanY && startY + y < height; y += 1) {
			for (let x = 0; x < spanX && startX + x < width; x += 1) {
				const index = ((startY + y) * width + (startX + x)) * 4;
				r += pixels[index];
				g += pixels[index + 1];
				b += pixels[index + 2];
				count += 1;
			}
		}
		if (count === 0) {
			return { r: 0, g: 0, b: 0, count: 0 };
		}
		return {
			r: Math.round(r / count),
			g: Math.round(g / count),
			b: Math.round(b / count),
			count
		};
	}

	createEmptySurface(width, height) {
		const columns = Math.ceil(width / this.scaleX);
		const rowsCount = Math.ceil(height / (this.scaleY * 2));
		const rows = Array.from({ length: rowsCount }, () => ' '.repeat(columns) + ANSI_RESET);
		return buildFrameSurface({
			rows,
			width,
			height,
			scaleX: this.scaleX,
			scaleY: this.scaleY,
			theme: this.terminalTheme,
			columns
		});
	}

	static rgbToAnsi256(r, g, b) {
		const red = Math.round((r / 255) * 5);
		const green = Math.round((g / 255) * 5);
		const blue = Math.round((b / 255) * 5);
		return 16 + 36 * red + 6 * green + blue;
	}
}

export default PixelMapper;
