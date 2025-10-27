const { createCanvas, Image } = require('canvas');
const fs = require('fs');
const path = require('path');

class PNGRenderer {
  constructor(width, height, outputDir) {
    this.width = width || 240;
    this.height = height || 160;
    this.outputDir = outputDir || './frames';

    // 创建输出目录
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    // 创建Canvas
    this.canvas = createCanvas(this.width, this.height);
    this.ctx = this.canvas.getContext('2d');

    // 帧计数器
    this.frameCount = 0;
  }

  /**
   * 将像素数据渲染为PNG并保存到文件
   * @param {Uint8ClampedArray} pixelData - 像素数据 (RGBA格式)
   * @param {string} filename - 可选的文件名
   */
  render(pixelData, filename) {
    // 创建ImageData对象
    const imageData = this.ctx.createImageData(this.width, this.height);

    // 复制像素数据
    imageData.data.set(pixelData);

    // 将图像数据放到Canvas上
    this.ctx.putImageData(imageData, 0, 0);

    // 生成文件名
    const frameFilename = filename || `frame_${this.frameCount.toString().padStart(6, '0')}.png`;
    const outputPath = path.join(this.outputDir, frameFilename);

    // 保存为PNG文件
    const buffer = this.canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);

    this.frameCount++;

    return outputPath;
  }

  /**
   * 设置Canvas尺寸
   * @param {number} width - 宽度
   * @param {number} height - 高度
   */
  setDimensions(width, height) {
    this.width = width;
    this.height = height;
    this.canvas = createCanvas(this.width, this.height);
    this.ctx = this.canvas.getContext('2d');
  }

  /**
   * 获取当前帧数
   */
  getFrameCount() {
    return this.frameCount;
  }

  /**
   * 重置帧计数器
   */
  reset() {
    this.frameCount = 0;
  }
}

module.exports = { PNGRenderer };