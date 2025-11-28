import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStatusLines, computeChangedLineIndexes } from '../src/components/TerminalViewport.js';

test('computeChangedLineIndexes merges hints with real differences', () => {
	const prev = ['a', 'b', 'c'];
	const next = ['a', 'B', 'c', 'd'];
	const changed = computeChangedLineIndexes(prev, next, [5]);
	assert.deepEqual(changed, [1, 3, 5]);
});

test('buildStatusLines emits telemetry text and warnings', () => {
	const lines = buildStatusLines({
		fps: 59,
		fpsTarget: 60,
		memoryUsage: 42,
		frameDuration: 5,
		cpuUsage: 20,
		skippedFrames: 2,
		statusMessage: 'TEST',
		isPaused: true,
		autoFitInfo: 'auto-fit'
	});
	assert.equal(lines.length, 3);
	assert.ok(lines[2].includes('TEST'));
});
