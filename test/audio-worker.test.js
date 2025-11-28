import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import AudioRingBuffer from '../src/utils/audioRingBuffer.js';

const audioWorkerUrl = new URL('../src/workers/audioWorker.js', import.meta.url);

const createRingPayload = (frames = 2048) => {
  const { ring, sharedBuffer, metaBuffer, channels, capacityFrames } = AudioRingBuffer.create({
    capacityFrames: frames,
    channels: 2
  });
  return { ring, payload: { sharedBuffer, metaBuffer, channels, capacityFrames } };
};

const waitForStatus = (worker, predicate) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      worker.off('message', handler);
      reject(new Error('audio-status timeout'));
    }, 1000);
    const handler = (message) => {
      if (message.type === 'audio-status' && (!predicate || predicate(message.payload))) {
        clearTimeout(timeout);
        worker.off('message', handler);
        resolve(message.payload);
      }
    };
    worker.on('message', handler);
  });

test('audio worker reports mute status when speaker unavailable', async () => {
  const { payload } = createRingPayload();
  const worker = new Worker(audioWorkerUrl, { type: 'module' });
  worker.postMessage({ type: 'init', payload: { muted: true, ring: payload } });
  const status = await waitForStatus(worker, (p) => p.muted === true);
  assert.equal(status.ready, false);
  await worker.terminate();
});

test('audio worker consumes ring buffer and reports buffered duration', async () => {
  const { ring, payload } = createRingPayload(4096);
  const worker = new Worker(audioWorkerUrl, { type: 'module' });
  worker.postMessage({
    type: 'init',
    payload: {
      sampleRate: 16000,
      queueDurationMs: 80,
      chunkDurationMs: 20,
      ring: payload
    }
  });

  const initial = await waitForStatus(worker, (p) => p.ready === true);
  assert.ok(initial.bufferedMs >= 0);

  for (let i = 0; i < 12; i += 1) {
    const block = new Float32Array(320);
    ring.write(block);
  }

  const filled = await waitForStatus(
    worker,
    (p) => p.ready === false && Number.isFinite(p.bufferedMs) && p.bufferedMs > 40
  );
  assert.ok(filled.bufferedMs > 40);

  await worker.terminate();
});
