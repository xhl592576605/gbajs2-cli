const { createCanvas, Image } = require('canvas');
const fs = require('fs');
const path = require('path');

class PNGRenderer {
  constructor(width, height, outputDir, options = {}) {
    this.originalWidth = width || 240;
    this.originalHeight = height || 160;
    this.outputDir = outputDir || './frames';

    // 渲染选项
    this.scale = options.scale || 1;
    this.quality = options.quality || 0.9;
    this.format = options.format || 'png';
    this.enableSmoothing = options.enableSmoothing !== false;

    // 计算实际尺寸
    this.width = this.originalWidth * this.scale;
    this.height = this.originalHeight * this.scale;

    // 创建输出目录
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    // 创建Canvas
    this.canvas = createCanvas(this.width, this.height);
    this.ctx = this.canvas.getContext('2d');

    // 设置图像平滑
    this.ctx.imageSmoothingEnabled = this.enableSmoothing;
    this.ctx.imageSmoothingQuality = 'high';

    // 创建临时Canvas用于原始尺寸
    this.tempCanvas = createCanvas(this.originalWidth, this.originalHeight);
    this.tempCtx = this.tempCanvas.getContext('2d');
    this.tempCtx.imageSmoothingEnabled = false;

    // 帧计数器
    this.frameCount = 0;
  }

  /**
   * 将像素数据渲染为PNG并保存到文件
   * @param {Uint8ClampedArray} pixelData - 像素数据 (RGBA格式)
   * @param {string} filename - 可选的文件名
   */
  render(pixelData, filename) {
    // 创建原始尺寸的ImageData对象
    const imageData = this.tempCtx.createImageData(this.originalWidth, this.originalHeight);

    // 复制像素数据
    imageData.data.set(pixelData);

    // 将图像数据放到临时Canvas上
    this.tempCtx.putImageData(imageData, 0, 0);

    // 清空主Canvas
    this.ctx.clearRect(0, 0, this.width, this.height);

    // 如果需要缩放，绘制缩放后的图像
    if (this.scale !== 1) {
      this.ctx.drawImage(
        this.tempCanvas,
        0, 0, this.originalWidth, this.originalHeight,
        0, 0, this.width, this.height
      );
    } else {
      this.ctx.drawImage(this.tempCanvas, 0, 0);
    }

    // 生成文件名
    const frameFilename = filename || `frame_${this.frameCount.toString().padStart(6, '0')}.${this.format}`;
    const outputPath = path.join(this.outputDir, frameFilename);

    // 根据格式保存文件
    let buffer;
    if (this.format === 'jpeg' || this.format === 'jpg') {
      buffer = this.canvas.toBuffer('image/jpeg', { quality: this.quality });
    } else {
      buffer = this.canvas.toBuffer('image/png');
    }

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