const Speaker = require('speaker');
const { Transform } = require('stream');

class NodeAudioPlayer {
  constructor(sampleRate = 32768, channels = 2, bitDepth = 16) {
    this.sampleRate = sampleRate;
    this.channels = channels;
    this.bitDepth = bitDepth;

    // 创建Speaker实例
    this.speaker = new Speaker({
      channels: this.channels,
      bitDepth: this.bitDepth,
      sampleRate: this.sampleRate
    });

    this.isPlaying = false;
    this.audioQueue = [];
    this.isProcessing = false;
  }

  /**
   * 播放音频数据
   * @param {Buffer} audioData - 音频数据（PCM格式）
   */
  play(audioData) {
    if (!audioData || audioData.length === 0) {
      return;
    }

    try {
      // 将音频数据写入Speaker
      if (this.speaker) {
        this.speaker.write(audioData);
      }
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  }

  /**
   * 开始播放
   */
  start() {
    if (!this.isPlaying) {
      this.isPlaying = true;
      // Speaker会自动开始播放
    }
  }

  /**
   * 停止播放
   */
  stop() {
    if (this.speaker) {
      this.speaker.end();
    }
    this.isPlaying = false;
  }

  /**
   * 获取音频设备信息
   */
  getDeviceInfo() {
    return {
      sampleRate: this.sampleRate,
      channels: this.channels,
      bitDepth: this.bitDepth,
      isPlaying: this.isPlaying
    };
  }

  /**
   * 设置音量
   * @param {number} volume - 音量值 (0.0 - 1.0)
   */
  setVolume(volume) {
    // 在Node.js中，音量控制通常通过处理音频数据来实现
    console.log(`Volume set to: ${volume}`);
  }
}

module.exports = { NodeAudioPlayer };