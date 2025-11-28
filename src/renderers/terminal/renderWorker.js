import { parentPort } from 'worker_threads';
import { performance } from 'perf_hooks';
import PixelMapper from './pixelMapper.js';

let mapper = new PixelMapper();
let config = {
  width: 240,
  height: 160,
  scaleX: 2,
  scaleY: 2,
  terminalTheme: 'dark'
};
let lastFrameRows = null;

const reconfigureMapper = (payload = {}) => {
  config = {
    width: payload.width || config.width,
    height: payload.height || config.height,
    scaleX: Math.max(1, Number(payload.scaleX) || config.scaleX),
    scaleY: Math.max(1, Number(payload.scaleY) || config.scaleY),
    terminalTheme:
      payload.terminalTheme === 'light'
        ? 'light'
        : payload.terminalTheme === 'dark'
          ? 'dark'
          : config.terminalTheme
  };
  mapper = new PixelMapper({
    scaleX: config.scaleX,
    scaleY: config.scaleY,
    terminalTheme: config.terminalTheme
  });
  lastFrameRows = null;
};

const handleInit = (payload = {}) => {
  reconfigureMapper(payload);
  parentPort.postMessage({
    type: 'render-ready',
    payload: {
      scaleX: mapper.scaleX,
      scaleY: mapper.scaleY,
      terminalTheme: mapper.terminalTheme
    }
  });
};

const diffRows = (rows) => {
  if (!Array.isArray(lastFrameRows)) {
    lastFrameRows = rows.slice();
    return {
      changedRows: rows.map((_, index) => index),
      unchanged: false
    };
  }
  const changed = [];
  const max = Math.max(rows.length, lastFrameRows.length);
  for (let i = 0; i < max; i += 1) {
    if (rows[i] !== lastFrameRows[i]) {
      changed.push(i);
    }
  }
  const unchanged = changed.length === 0;
  lastFrameRows = rows.slice();
  return { changedRows: changed, unchanged };
};

const handleFrame = (payload = {}) => {
  const { pixels, width = config.width, height = config.height, bufferId = null } = payload;
  const start = performance.now();
  const frame = mapper.mapFrame(pixels, width, height);
  const duration = performance.now() - start;
  const { changedRows, unchanged } = diffRows(frame.rows);

  const message = {
    type: 'frame-result',
    payload: {
      frame: unchanged ? null : frame,
      duration,
      timestamp: Date.now(),
      changedRows,
      unchanged,
      bufferId
    }
  };

  if (pixels?.buffer) {
    message.payload.returnBuffer = pixels.buffer;
  }

  const transferList = [];
  if (pixels?.buffer) {
    transferList.push(pixels.buffer);
  }

  parentPort.postMessage(message, transferList);
};

if (!parentPort) {
  throw new Error('Render worker must be executed inside worker_threads');
}

parentPort.on('message', (event) => {
  const { type, payload } = event || {};
  try {
    if (type === 'init') {
      handleInit(payload);
    } else if (type === 'frame') {
      handleFrame(payload);
    } else if (type === 'config') {
      reconfigureMapper(payload);
      parentPort.postMessage({
        type: 'render-ready',
        payload: {
      scaleX: mapper.scaleX,
      scaleY: mapper.scaleY,
      terminalTheme: mapper.terminalTheme
    }
  });
    }
  } catch (error) {
    parentPort.postMessage({
      type: 'render-error',
      payload: { message: error.message }
    });
  }
});
