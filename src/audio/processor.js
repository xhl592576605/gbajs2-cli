const { NodeAudioPlayer } = require('./node-audio');

class GBAudioProcessor {
  constructor() {
    // GBA音频参数
    this.sampleRate = 32768; // GBA音频采样率
    this.channels = 2;       // 立体声
    this.bitDepth = 16;      // 16位音频

    // 创建音频播放器
    this.audioPlayer = new NodeAudioPlayer(this.sampleRate, this.channels, this.bitDepth);

    // 音频缓冲区管理
    this.audioBuffer = [];
    this.bufferSize = 1024;  // 减小缓冲区大小以减少延迟
    this.targetBufferLength = 3; // 目标缓冲区数量
    this.minBufferLength = 1;   // 最小缓冲区数量

    // 音频同步
    this.audioLatency = 0;
    this.lastProcessTime = 0;
    this.sampleCounter = 0;

    // 音频状态
    this.enabled = false;
    this.volume = 1.0;
    this.paused = false;

    // 性能监控
    this.processedSamples = 0;
    this.droppedSamples = 0;
  }

  /**
   * 初始化音频系统
   */
  initialize() {
    try {
      this.audioPlayer.start();
      this.enabled = true;
      console.log('Audio system initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize audio system:', error);
      this.enabled = false;
      return false;
    }
  }

  /**
   * 处理音频样本
   * @param {Float32Array} leftSamples - 左声道样本
   * @param {Float32Array} rightSamples - 右声道样本
   */
  processSamples(leftSamples, rightSamples) {
    if (!this.enabled || this.paused || !leftSamples || !rightSamples) {
      return;
    }

    const currentTime = performance.now();

    try {
      // 计算音频延迟
      if (this.lastProcessTime > 0) {
        this.audioLatency = currentTime - this.lastProcessTime;
      }
      this.lastProcessTime = currentTime;

      // 将左右声道样本合并为立体声PCM数据
      const interleaved = this.interleaveSamples(leftSamples, rightSamples);

      // 应用音量
      this.applyVolume(interleaved);

      // 转换为16位PCM Buffer
      const pcmBuffer = this.floatTo16BitPCM(interleaved);

      // 添加到缓冲区
      this.audioBuffer.push(pcmBuffer);
      this.processedSamples += interleaved.length;

      // 如果缓冲区太长，丢弃旧的缓冲区
      if (this.audioBuffer.length > this.targetBufferLength) {
        const dropped = this.audioBuffer.shift();
        this.droppedSamples += dropped.length / 2; // 每个样本2字节
      }

      // 播放音频（如果缓冲区足够）
      if (this.audioBuffer.length >= this.minBufferLength) {
        this.flushBuffer();
      }
    } catch (error) {
      console.error('Error processing audio samples:', error);
    }
  }

  /**
   * 应用音量到样本
   * @param {Float32Array} samples - 音频样本
   */
  applyVolume(samples) {
    if (this.volume !== 1.0) {
      for (let i = 0; i < samples.length; i++) {
        samples[i] *= this.volume;
      }
    }
  }

  /**
   * 刷新音频缓冲区
   */
  flushBuffer() {
    if (this.audioBuffer.length > 0 && !this.paused) {
      const buffer = this.audioBuffer.shift();
      this.audioPlayer.play(buffer);
    }
  }

  /**
   * 交错左右声道样本
   * @param {Float32Array} left - 左声道样本
   * @param {Float32Array} right - 右声道样本
   * @returns {Float32Array} 交错后的样本
   */
  interleaveSamples(left, right) {
    const length = Math.min(left.length, right.length);
    const interleaved = new Float32Array(length * 2);

    for (let i = 0; i < length; i++) {
      interleaved[i * 2] = left[i];     // 左声道
      interleaved[i * 2 + 1] = right[i]; // 右声道
    }

    return interleaved;
  }

  /**
   * 将浮点数样本转换为16位PCM
   * @param {Float32Array} samples - 浮点数样本 (-1.0 到 1.0)
   * @returns {Buffer} 16位PCM Buffer
   */
  floatTo16BitPCM(samples) {
    const buffer = Buffer.alloc(samples.length * 2);

    for (let i = 0; i < samples.length; i++) {
      // 将浮点数 (-1.0 到 1.0) 转换为16位整数 (-32768 到 32767)
      const int16 = Math.max(-1, Math.min(1, samples[i])) * 0x7FFF;
      buffer.writeInt16LE(Math.round(int16), i * 2);
    }

    return buffer;
  }

  /**
   * 设置音量
   * @param {number} volume - 音量值 (0.0 - 1.0)
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.audioPlayer.setVolume(this.volume);
  }

  /**
   * 启用音频
   */
  enable() {
    if (!this.enabled) {
      this.enabled = this.initialize();
    }
  }

  /**
   * 禁用音频
   */
  disable() {
    if (this.enabled) {
      this.audioPlayer.stop();
      this.enabled = false;
      this.audioBuffer = [];
    }
  }

  /**
   * 暂停音频
   */
  pause() {
    if (this.enabled && !this.paused) {
      this.paused = true;
      this.audioPlayer.pause();
    }
  }

  /**
   * 恢复音频
   */
  resume() {
    if (this.enabled && this.paused) {
      this.paused = false;
      this.audioPlayer.resume();
    }
  }

  /**
   * 切换暂停状态
   */
  togglePause() {
    if (this.paused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  /**
   * 获取音频系统状态
   */
  getStatus() {
    return {
      enabled: this.enabled,
      paused: this.paused,
      volume: this.volume,
      sampleRate: this.sampleRate,
      channels: this.channels,
      bufferSize: this.bufferSize,
      bufferLength: this.audioBuffer.length,
      targetBufferLength: this.targetBufferLength,
      audioLatency: this.audioLatency,
      processedSamples: this.processedSamples,
      droppedSamples: this.droppedSamples
    };
  }

  /**
   * 清空音频缓冲区
   */
  clearBuffer() {
    this.audioBuffer = [];
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats() {
    return {
      processedSamples: this.processedSamples,
      droppedSamples: this.droppedSamples,
      dropRate: this.processedSamples > 0 ? (this.droppedSamples / this.processedSamples) : 0,
      bufferUtilization: this.audioBuffer.length / this.targetBufferLength,
      averageLatency: this.audioLatency
    };
  }

  /**
   * 关闭音频系统
   */
  shutdown() {
    this.disable();
    this.audioBuffer = [];
    console.log('Audio system shutdown complete');
  }
}

module.exports = { GBAudioProcessor };