import { parentPort } from 'worker_threads';
import AudioAdapter from '../utils/audioAdapter.js';
import AudioRingBuffer from '../utils/audioRingBuffer.js';
import installAudioWarningFilter from '../utils/audioWarningFilter.js';

installAudioWarningFilter();

const DEFAULT_SAMPLE_RATE = 32768;
const DEFAULT_QUEUE_MS = 180;
const DEFAULT_CHUNK_MS = 48;
const STATUS_INTERVAL_MS = 20;
const PUMP_INTERVAL_MS = 8;

let adapter = null;
let ringBuffer = null;
let sourceSampleRate = DEFAULT_SAMPLE_RATE;
let outputSampleRate = DEFAULT_SAMPLE_RATE;
let channels = 2;
let queueDurationMs = DEFAULT_QUEUE_MS;
let chunkDurationMs = DEFAULT_CHUNK_MS;
let lowWaterMs = 80;
let writeChunkFrames = 1024;
let statusTimer = null;
let pumpTimer = null;
let lastStatusReady = null;
let lastBufferedMs = -1;
let pumpInFlight = false;

const ensureAdapter = async (options = {}) => {
  if (adapter) {
    return adapter;
  }
  adapter = new AudioAdapter(options);
  await adapter.init();
  adapter.on('muted', () => {
    updateStatus(true);
  });
  return adapter;
};

const configureRuntime = (payload = {}) => {
  if (Number.isFinite(payload.sourceSampleRate) && payload.sourceSampleRate > 0) {
    sourceSampleRate = payload.sourceSampleRate;
  }
  if (Number.isFinite(payload.sampleRate) && payload.sampleRate > 0) {
    outputSampleRate = payload.sampleRate;
  } else {
    outputSampleRate = sourceSampleRate;
  }
  if (Number.isFinite(payload.channels) && payload.channels >= 1) {
    channels = Math.max(1, Math.floor(payload.channels));
  }
  if (Number.isFinite(payload.chunkDurationMs) && payload.chunkDurationMs > 0) {
    chunkDurationMs = Math.max(16, payload.chunkDurationMs);
  }
  if (Number.isFinite(payload.queueDurationMs) && payload.queueDurationMs > 0) {
    queueDurationMs = Math.max(chunkDurationMs + 16, payload.queueDurationMs);
  }
  writeChunkFrames = Math.max(256, Math.round((outputSampleRate * chunkDurationMs) / 2000));
  lowWaterMs = Math.max(40, Math.min(queueDurationMs - 20, queueDurationMs / 2));
};

const bindRingBuffer = (ringPayload = {}) => {
  if (!ringPayload.sharedBuffer || !ringPayload.metaBuffer) {
    throw new Error('Audio worker requires shared ring buffer');
  }
  ringBuffer = new AudioRingBuffer({
    sharedBuffer: ringPayload.sharedBuffer,
    metaBuffer: ringPayload.metaBuffer,
    channels: ringPayload.channels || channels,
    capacityFrames: ringPayload.capacityFrames || Math.round((outputSampleRate * queueDurationMs) / 1000)
  });
  channels = ringBuffer.channels;
};

const framesToMs = (frames) => (frames / outputSampleRate) * 1000;

const estimateBufferedMs = () => {
  if (!ringBuffer) {
    return 0;
  }
  return framesToMs(ringBuffer.getBufferedFrames());
};

const postStatus = ({ ready, active, bufferedMs }) => {
  parentPort.postMessage({
    type: 'audio-status',
    payload: {
      ready,
      active,
      muted: adapter ? adapter.muted : true,
      bufferedMs,
      targetBufferMs: queueDurationMs,
      lowWaterMs
    }
  });
};

const updateStatus = (force = false) => {
  const bufferedMs = estimateBufferedMs();
  const active = Boolean(adapter && !adapter.muted);
  const ready = active && bufferedMs < lowWaterMs;
  if (
    force ||
    ready !== lastStatusReady ||
    (lastBufferedMs < 0 && bufferedMs >= 0) ||
    Math.abs(bufferedMs - lastBufferedMs) > 10
  ) {
    lastStatusReady = ready;
    lastBufferedMs = bufferedMs;
    postStatus({ ready, active, bufferedMs });
  }
};

const startStatusTimer = () => {
  if (statusTimer) {
    return;
  }
  statusTimer = setInterval(() => updateStatus(false), STATUS_INTERVAL_MS);
  if (typeof statusTimer.unref === 'function') {
    statusTimer.unref();
  }
};

const pumpOnce = async () => {
  if (!adapter || adapter.muted || !ringBuffer || pumpInFlight) {
    return;
  }
  const chunk = ringBuffer.read(writeChunkFrames);
  if (!chunk || !chunk.length) {
    return;
  }
  pumpInFlight = true;
  try {
    await adapter.write(chunk, outputSampleRate);
  } finally {
    pumpInFlight = false;
  }
};

const startPumpLoop = () => {
  if (pumpTimer) {
    return;
  }
  pumpTimer = setInterval(() => {
    pumpOnce().catch((error) => {
      parentPort.postMessage({
        type: 'audio-error',
        payload: { message: error.message }
      });
    });
  }, PUMP_INTERVAL_MS);
  if (typeof pumpTimer.unref === 'function') {
    pumpTimer.unref();
  }
};

const handleInit = async (payload = {}) => {
  configureRuntime(payload);
  bindRingBuffer(payload.ring);
  await ensureAdapter(payload);
  startStatusTimer();
  startPumpLoop();
  updateStatus(true);
};

const handleAudio = async (payload = {}) => {
  if (!ringBuffer) {
    return;
  }
  const { samples } = payload;
  if (!samples || !samples.length) {
    return;
  }
  const data = samples instanceof Float32Array ? samples : new Float32Array(samples);
  ringBuffer.write(data);
  updateStatus(false);
};

const handleMute = () => {
  if (adapter) {
    adapter.disable('Muted by main thread');
  }
  updateStatus(true);
};

if (!parentPort) {
  throw new Error('Audio worker must be executed inside worker_threads');
}

parentPort.on('message', async (event) => {
  const { type, payload } = event || {};
  try {
    if (type === 'init') {
      await handleInit(payload);
    } else if (type === 'audio') {
      await handleAudio(payload);
    } else if (type === 'mute') {
      handleMute();
    }
  } catch (error) {
    parentPort.postMessage({
      type: 'audio-error',
      payload: { message: error.message }
    });
    if (adapter) {
      adapter.disable(error.message);
    }
  }
});
