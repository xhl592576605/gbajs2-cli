import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import AudioAdapter from '../src/utils/audioAdapter.js';

class MockSpeaker extends EventEmitter {
  constructor({ drainOnce = false } = {}) {
    super();
    this.buffers = [];
    this.drainOnce = drainOnce;
  }

  write(buffer) {
    this.buffers.push(buffer);
    if (this.drainOnce) {
      this.drainOnce = false;
      setImmediate(() => this.emit('drain'));
      return false;
    }
    return true;
  }

  end() {
    this.emit('close');
  }
}

test('AudioAdapter initializes speaker and writes PCM data', async () => {
  const mockSpeaker = new MockSpeaker();
  const adapter = new AudioAdapter({
    speakerFactory: () => mockSpeaker
  });

  await adapter.init();
  const samples = new Float32Array([1, -1, 0.5, -0.5]);
  await adapter.write(samples);

  assert.equal(mockSpeaker.buffers.length, 1);
  assert.ok(mockSpeaker.buffers[0].length >= samples.length * 2);
});

test('AudioAdapter handles mute mode and backpressure', async () => {
  const mockSpeaker = new MockSpeaker({ drainOnce: true });
  const adapter = new AudioAdapter({
    speakerFactory: () => mockSpeaker
  });

  await adapter.init();
  const samples = new Float32Array([0, 0, 0, 0]);
  await adapter.write(samples);
  adapter.disable('test');
  await adapter.write(samples); // 不应抛错

  assert.ok(adapter.muted);
});
