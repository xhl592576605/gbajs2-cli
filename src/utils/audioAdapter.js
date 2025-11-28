import { EventEmitter } from 'events';
import logger from './logger.js';

export class AudioAdapter extends EventEmitter {
	constructor(options = {}) {
		super();
		const {
			sampleRate,
			channels = 2,
			bitDepth = 16,
			muted = false,
			speakerFactory = null,
			sourceSampleRate = 32768
		} = options;

		this.sampleRate = sampleRate || sourceSampleRate || 32768;
		this.channels = channels;
		this.bitDepth = bitDepth;
		this.muted = muted;
		this.loaded = false;
		this.speaker = null;
		this.speakerFactory = speakerFactory;
		this.terminating = false;
		this.sourceSampleRate = sourceSampleRate || this.sampleRate;
	}

  async init() {
    if (this.muted) {
      logger.warn('音频已处于静音模式，跳过初始化');
      return;
    }
    if (this.loaded) {
      return;
    }
    try {
      this.speaker = await this.createSpeaker();
      this.loaded = true;
      this.speaker.on('close', () => {
        logger.warn('音频输出已关闭，切换静音模式');
        this.disable('Speaker closed');
      });
      this.speaker.on('error', (error) => {
        logger.error('音频输出错误，切换静音模式', error);
        this.disable(error.message);
      });
      logger.info('音频适配器初始化成功');
    } catch (error) {
      this.disable(error.message);
    }
  }

  async createSpeaker() {
    if (this.speakerFactory) {
      return this.speakerFactory({
        sampleRate: this.sampleRate,
        channels: this.channels,
        bitDepth: this.bitDepth
      });
    }
    const speakerModule = await import('speaker');
    const Speaker = speakerModule.default || speakerModule.Speaker || speakerModule;
	return new Speaker({
		channels: this.channels,
		bitDepth: this.bitDepth,
		sampleRate: this.sampleRate,
		signed: true,
		float: false,
		endianness: 'LE'
	});
}

  async write(samples, sourceRate = this.sourceSampleRate) {
    if (!samples || samples.length === 0) {
      return;
    }
    if (this.muted || !this.loaded || !this.speaker) {
      return;
    }
    const working =
      sourceRate && sourceRate !== this.sampleRate
        ? AudioAdapter.resampleInterleaved(samples, sourceRate, this.sampleRate, this.channels)
        : samples;
    const buffer = AudioAdapter.float32ToPCM(working);
    await new Promise((resolve, reject) => {
      const handleError = (error) => {
        this.speaker?.off('error', handleError);
        reject(error);
      };
      this.speaker?.once('error', handleError);
      const cleanup = () => {
        this.speaker?.off('error', handleError);
        resolve();
      };
      const canWrite = this.speaker.write(buffer);
      if (canWrite) {
        cleanup();
      } else {
        this.speaker.once('drain', cleanup);
      }
    }).catch((error) => {
      this.disable(error.message);
    });
  }

  disable(reason) {
    if (reason) {
      logger.warn(`音频适配器禁用: ${reason}`);
    }
    this.muted = true;
    this.loaded = false;
    if (this.speaker && typeof this.speaker.end === 'function' && !this.terminating) {
      this.terminating = true;
      this.speaker.end();
    }
    this.terminating = false;
    this.speaker = null;
    this.emit('muted');
  }

  static float32ToPCM(floatArray) {
    const buffer = Buffer.alloc(floatArray.length * 2);
    for (let i = 0; i < floatArray.length; i += 1) {
      const clamped = Math.max(-1, Math.min(1, floatArray[i]));
      const intSample = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      buffer.writeInt16LE(intSample, i * 2);
    }
    return buffer;
  }

  static resampleInterleaved(input, sourceRate, targetRate, channels = 2) {
    if (!sourceRate || !targetRate || sourceRate === targetRate) {
      return input;
    }
    const inputFrames = Math.floor(input.length / channels);
    if (inputFrames <= 1) {
      return input;
    }
    const ratio = sourceRate / targetRate;
    const outputFrames = Math.max(1, Math.round(inputFrames / ratio));
    const output = new Float32Array(outputFrames * channels);
    for (let i = 0; i < outputFrames; i += 1) {
      const sourcePosition = i * ratio;
      const leftIndex = Math.floor(sourcePosition);
      const frac = sourcePosition - leftIndex;
      const rightIndex = Math.min(leftIndex + 1, inputFrames - 1);
      for (let ch = 0; ch < channels; ch += 1) {
        const leftSample = input[leftIndex * channels + ch];
        const rightSample = input[rightIndex * channels + ch];
        output[i * channels + ch] = leftSample + (rightSample - leftSample) * frac;
      }
    }
    return output;
  }
}

export default AudioAdapter;
