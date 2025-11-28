import { FONT_WIDTH, FONT_HEIGHT, resolveGlyph } from './font5x7.js';

const HUD_PADDING = 6;
const HUD_LINE_SPACING = 3;
const HUD_CHAR_SPACING = 1;
const HUD_BACKGROUND_ALPHA = 0.65;
const HUD_BACKGROUND_COLOR = { r: 6, g: 6, b: 6 };
const HUD_TEXT_COLOR = { r: 255, g: 255, b: 255 };
const HUD_PAUSE_COLOR = { r: 255, g: 196, b: 0 };

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const sanitizeText = (value = '') =>
	String(value)
		.toUpperCase()
		.replace(/\s+/g, ' ')
		.replace(/[^A-Z0-9\.\-_/\[\]\(\): ]/g, '?')
		.slice(0, 40);

class HudOverlay {
	constructor(options = {}) {
		this.padding = options.padding ?? HUD_PADDING;
		this.charSpacing = options.charSpacing ?? HUD_CHAR_SPACING;
		this.lineSpacing = options.lineSpacing ?? HUD_LINE_SPACING;
		this.scale = Math.max(1, Math.round(options.scale ?? 1));
		this.enabled = options.enabled !== false;
	}

	measure(lines = []) {
		const charWidth = (FONT_WIDTH + this.charSpacing) * this.scale;
		const charHeight = FONT_HEIGHT * this.scale;
		const maxChars = Math.max(1, ...lines.map((line) => line.length));
		const textWidth = maxChars * charWidth - this.charSpacing * this.scale;
		const textHeight = lines.length * charHeight + (lines.length - 1) * this.lineSpacing * this.scale;
		return { textWidth, textHeight, charWidth, charHeight };
	}

	blendPixel(buffer, width, height, x, y, color, alpha = 1) {
		if (alpha <= 0) {
			return;
		}
		const ix = clamp(Math.floor(x), 0, width - 1);
		const iy = clamp(Math.floor(y), 0, height - 1);
		const index = (iy * width + ix) * 4;
		const existingAlpha = clamp(alpha, 0, 1);
		const invAlpha = 1 - existingAlpha;
		buffer[index] = Math.round(buffer[index] * invAlpha + color.r * existingAlpha);
		buffer[index + 1] = Math.round(buffer[index + 1] * invAlpha + color.g * existingAlpha);
		buffer[index + 2] = Math.round(buffer[index + 2] * invAlpha + color.b * existingAlpha);
	}

	fillRect(buffer, width, height, rect, color, alpha) {
		const startX = clamp(rect.x, 0, width - 1);
		const startY = clamp(rect.y, 0, height - 1);
		const endX = clamp(rect.x + rect.width, startX + 1, width);
		const endY = clamp(rect.y + rect.height, startY + 1, height);
		for (let y = startY; y < endY; y += 1) {
			for (let x = startX; x < endX; x += 1) {
				this.blendPixel(buffer, width, height, x, y, color, alpha);
			}
		}
	}

	drawGlyph(buffer, width, height, glyph, originX, originY, color) {
		for (let row = 0; row < FONT_HEIGHT; row += 1) {
			const mask = glyph[row];
			for (let col = 0; col < FONT_WIDTH; col += 1) {
				const bit = (mask >> (FONT_WIDTH - col - 1)) & 1;
				if (!bit) {
					continue;
				}
				for (let sy = 0; sy < this.scale; sy += 1) {
					for (let sx = 0; sx < this.scale; sx += 1) {
						this.blendPixel(buffer, width, height, originX + col * this.scale + sx, originY + row * this.scale + sy, color, 1);
					}
				}
			}
		}
	}

	drawText(buffer, width, height, lines, origin, color) {
		const { charWidth, charHeight } = this.measure(lines);
		let cursorY = origin.y;
		for (let i = 0; i < lines.length; i += 1) {
			const line = lines[i];
			let cursorX = origin.x;
			for (let j = 0; j < line.length; j += 1) {
				const glyph = resolveGlyph(line[j]);
				this.drawGlyph(buffer, width, height, glyph, cursorX, cursorY, color);
				cursorX += charWidth;
			}
			cursorY += charHeight + this.lineSpacing * this.scale;
		}
	}

	composeLines(state = {}) {
		const lines = [];
		const fpsText = Number.isFinite(state.fps) ? state.fps.toFixed(1).padStart(5, ' ') : '  --.-';
		lines.push(`FPS ${fpsText}`);
		if (state.paused) {
			lines.push('PAUSED');
		}
		const notice = sanitizeText(state.notice || '');
		if (notice) {
			lines.push(notice);
		}
		return lines;
	}

	apply(buffer, width, height, state = {}) {
		if (!this.enabled) {
			return;
		}
		const lines = this.composeLines(state);
		if (!lines.length) {
			return;
		}
		const metrics = this.measure(lines);
		const maxWidth = Math.max(1, width - this.padding * 2);
		const maxHeight = Math.max(1, height - this.padding * 2);
		const rect = {
			x: this.padding,
			y: this.padding,
			width: Math.max(1, Math.min(maxWidth, metrics.textWidth + this.padding * 2)),
			height: Math.max(1, Math.min(maxHeight, metrics.textHeight + this.padding * 2))
		};
		this.fillRect(buffer, width, height, rect, HUD_BACKGROUND_COLOR, HUD_BACKGROUND_ALPHA);
		const textOrigin = { x: rect.x + this.padding, y: rect.y + this.padding };
		const color = state.paused ? HUD_PAUSE_COLOR : HUD_TEXT_COLOR;
		this.drawText(buffer, width, height, lines, textOrigin, color);
	}
}

export default HudOverlay;
