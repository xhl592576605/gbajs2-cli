import test from 'node:test';
import assert from 'node:assert/strict';
import WindowRenderer from '../../src/renderers/gui/WindowRenderer.js';
import { GuiRendererUnavailable } from '../../src/renderers/gui/errors.js';

test('WindowRenderer 会在禁用 GUI 环境下抛出友好错误', async () => {
	const original = process.env.GBAJS2_DISABLE_GUI;
	process.env.GBAJS2_DISABLE_GUI = '1';
	const renderer = new WindowRenderer();
	await assert.rejects(() => renderer.initialize(), GuiRendererUnavailable);
	if (original === undefined) {
		delete process.env.GBAJS2_DISABLE_GUI;
	} else {
		process.env.GBAJS2_DISABLE_GUI = original;
	}
});
