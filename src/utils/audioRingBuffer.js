export class AudioRingBuffer {
  constructor({ sharedBuffer, metaBuffer, channels = 2, capacityFrames }) {
    if (!sharedBuffer || !metaBuffer) {
      throw new Error('AudioRingBuffer requires SharedArrayBuffer handles');
    }
    this.data = new Float32Array(sharedBuffer);
    this.meta = new Int32Array(metaBuffer);
    this.channels = Math.max(1, channels);
    this.capacityFrames = capacityFrames || Math.floor(this.data.length / this.channels);
    if (!Number.isFinite(this.capacityFrames) || this.capacityFrames <= 0) {
      throw new Error('AudioRingBuffer capacity must be positive');
    }
    if (this.data.length !== this.capacityFrames * this.channels) {
      throw new Error('Shared buffer length mismatch');
    }
  }

  static create({ capacityFrames, channels = 2 }) {
    const frames = Math.max(1, Math.floor(capacityFrames));
    const data = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * frames * channels);
    const meta = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 3);
    return {
      ring: new AudioRingBuffer({ sharedBuffer: data, metaBuffer: meta, channels, capacityFrames: frames }),
      sharedBuffer: data,
      metaBuffer: meta,
      channels,
      capacityFrames: frames
    };
  }

  reset() {
    Atomics.store(this.meta, 0, 0); // write index
    Atomics.store(this.meta, 1, 0); // read index
    Atomics.store(this.meta, 2, 0); // frames available
  }

  getBufferedFrames() {
    return Math.max(0, Atomics.load(this.meta, 2));
  }

  write(samples) {
    if (!samples?.length) {
      return 0;
    }
    const frames = Math.floor(samples.length / this.channels);
    if (!frames) {
      return 0;
    }
    let writeIndex = Atomics.load(this.meta, 0);
    let readIndex = Atomics.load(this.meta, 1);
    let available = Atomics.load(this.meta, 2);
    const capacity = this.capacityFrames;

    let framesToWrite = frames;
    let srcOffset = 0;
    if (framesToWrite > capacity) {
      srcOffset = (framesToWrite - capacity) * this.channels;
      framesToWrite = capacity;
    }

    if (available + framesToWrite > capacity) {
      const drop = available + framesToWrite - capacity;
      readIndex = (readIndex + drop) % capacity;
      available = Math.max(0, available - drop);
    }

    let remaining = framesToWrite;
    while (remaining > 0) {
      const contiguous = Math.min(remaining, capacity - writeIndex);
      const take = contiguous * this.channels;
      this.data.set(samples.subarray(srcOffset, srcOffset + take), writeIndex * this.channels);
      writeIndex = (writeIndex + contiguous) % capacity;
      srcOffset += take;
      remaining -= contiguous;
    }

    available = Math.min(capacity, available + framesToWrite);
    Atomics.store(this.meta, 0, writeIndex);
    Atomics.store(this.meta, 1, readIndex);
    Atomics.store(this.meta, 2, available);
    return framesToWrite;
  }

  read(requestedFrames) {
    const available = this.getBufferedFrames();
    if (!available) {
      return null;
    }
    const framesToRead = Math.min(available, Math.max(1, requestedFrames));
    let readIndex = Atomics.load(this.meta, 1);
    const result = new Float32Array(framesToRead * this.channels);
    let remaining = framesToRead;
    let dest = 0;
    while (remaining > 0) {
      const contiguous = Math.min(remaining, this.capacityFrames - readIndex);
      const take = contiguous * this.channels;
      const sourceOffset = readIndex * this.channels;
      result.set(this.data.subarray(sourceOffset, sourceOffset + take), dest);
      readIndex = (readIndex + contiguous) % this.capacityFrames;
      dest += take;
      remaining -= contiguous;
    }
    Atomics.store(this.meta, 1, readIndex);
    Atomics.sub(this.meta, 2, framesToRead);
    return result;
  }
}

export default AudioRingBuffer;
