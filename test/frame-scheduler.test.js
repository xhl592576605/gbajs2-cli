import test from 'node:test';
import assert from 'node:assert/strict';
import FrameScheduler from '../src/game/frameScheduler.js';

test('FrameScheduler enforces FPS interval and stops cleanly', async () => {
	let ticks = 0;
	let scheduled = null;
	let currentTime = 0;

	const scheduler = new FrameScheduler({
		fpsLimit: 50,
		onTick: () => {
			ticks += 1;
		},
		now: () => currentTime,
		setTimeoutFn: (fn, delay) => {
			scheduled = { fn, delay };
			return 1;
		},
		clearTimeoutFn: () => {
			scheduled = null;
		}
	});

	const interval = 1000 / 50;
	scheduler.start();
	assert.ok(scheduled);

	currentTime += interval;
	scheduled.fn();
	assert.equal(ticks, 1);
	assert.ok(scheduled);

	currentTime += interval;
	scheduled.fn();
	assert.equal(ticks, 2);

	scheduler.stop();
	assert.equal(scheduled, null);
});
