import test from 'node:test';
import assert from 'node:assert/strict';
import PixelMapper from '../src/renderers/terminal/pixelMapper.js';

const createGradientPixels = (width, height, makePixel) => {
	const pixels = new Uint8ClampedArray(width * height * 4);
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const index = (y * width + x) * 4;
			const { r, g, b } = makePixel(x, y);
			pixels[index] = r;
			pixels[index + 1] = g;
			pixels[index + 2] = b;
			pixels[index + 3] = 255;
		}
	}
	return pixels;
};

test('PixelMapper balanced mode returns FrameSurface rows', () => {
	const mapper = new PixelMapper({ scaleX: 2, scaleY: 1 });
	const width = 4;
	const height = 4;
	const pixels = createGradientPixels(width, height, (x, y) => ({
		r: y < 2 ? 20 : 230,
		g: y < 2 ? 20 : 230,
		b: y < 2 ? 20 : 230
	}));

	const surface = mapper.mapFrame(pixels, width, height);
	assert.equal(surface.rowCount, 2);
	assert.equal(surface.columns, 2);
	assert.equal(surface.density, 'balanced');
	assert.ok(surface.rows[0].includes('▀'));
});

test('PixelMapper rejects unsupported density configuration', () => {
	assert.throws(() => new PixelMapper({ density: 'block' }), /仅支持 balanced/);
});

test('PixelMapper returns blank surface when buffer missing', () => {
	const mapper = new PixelMapper({ scaleX: 2, scaleY: 2 });
	const surface = mapper.mapFrame(null, 4, 4);
	assert.equal(surface.rows.length, 1);
	const sanitized = surface.rows[0].replace(/\u001b\[0m/g, '');
	assert.equal(sanitized.trim().length, 0);
});

test('PixelMapper applies terminal theme adjustments', () => {
	const width = 2;
	const height = 2;
	const pixels = createGradientPixels(width, height, () => ({ r: 200, g: 200, b: 200 }));
	const lightMapper = new PixelMapper({ scaleX: 1, scaleY: 1, terminalTheme: 'light' });
	const darkMapper = new PixelMapper({ scaleX: 1, scaleY: 1, terminalTheme: 'dark' });

	const lightSurface = lightMapper.mapFrame(pixels, width, height);
	const darkSurface = darkMapper.mapFrame(pixels, width, height);

	assert.notEqual(lightSurface.rows[0], darkSurface.rows[0]);
	assert.equal(lightSurface.theme, 'light');
	assert.equal(darkSurface.theme, 'dark');
});
