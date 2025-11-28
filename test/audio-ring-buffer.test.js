import test from 'node:test';
import assert from 'node:assert/strict';
import AudioRingBuffer from '../src/utils/audioRingBuffer.js';

test('AudioRingBuffer writes and reads with wraparound', () => {
  const { ring } = AudioRingBuffer.create({ capacityFrames: 4, channels: 2 });
  const first = new Float32Array([
    0.1, 0.2,
    0.3, 0.4,
    0.5, 0.6
  ]);
  const written = ring.write(first);
  assert.equal(written, 3);
  const read = ring.read(2);
  assert.equal(read.length, 4);
  assert.deepEqual(Array.from(read).map((v) => Number(v.toFixed(3))), [0.1, 0.2, 0.3, 0.4]);
  const second = new Float32Array([
    0.7, 0.8,
    0.9, 1.0,
    1.1, 1.2,
    1.3, 1.4
  ]);
  ring.write(second);
  const tail = ring.read(4);
  assert.deepEqual(Array.from(tail).map((v) => Number(v.toFixed(3))), [
    0.7,
    0.8,
    0.9,
    1.0,
    1.1,
    1.2,
    1.3,
    1.4
  ]);
});

test('AudioRingBuffer drops oldest frames when over capacity', () => {
  const { ring } = AudioRingBuffer.create({ capacityFrames: 3, channels: 1 });
  ring.write(new Float32Array([0, 1, 2, 3]));
  assert.equal(ring.getBufferedFrames(), 3);
  ring.write(new Float32Array([4, 5, 6]));
  assert.equal(ring.getBufferedFrames(), 3);
  const read = ring.read(3);
  assert.deepEqual(Array.from(read), [4, 5, 6]);
});
