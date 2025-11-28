import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';

const renderWorkerUrl = new URL('../src/renderers/terminal/renderWorker.js', import.meta.url);

test('render worker processes frame data', async () => {
  const worker = new Worker(renderWorkerUrl, { type: 'module' });

  const pixels = new Uint8ClampedArray(16);
  pixels.fill(200);

  const frame = await new Promise((resolve, reject) => {
    const handler = (message) => {
      if (message.type === 'frame-result') {
        worker.off('message', handler);
        resolve(message.payload);
      }
    };
    worker.on('message', handler);
    worker.once('error', reject);
    worker.postMessage({
      type: 'init',
      payload: { scaleX: 2, scaleY: 2, width: 2, height: 2, terminalTheme: 'dark' }
    });
    worker.postMessage(
      {
        type: 'frame',
        payload: { pixels, width: 2, height: 2 }
      },
      [pixels.buffer]
    );
  });

  assert.ok(Array.isArray(frame.frame.rows));
  assert.ok(frame.frame.rows.length >= 1);
  assert.ok(Array.isArray(frame.changedRows));
  assert.ok(frame.changedRows.length >= 1);
  await worker.terminate();
});
