class ASCIIRenderer {
  constructor(width, height, useColor = false, colorMode = 'ansi256') {
    this.width = width || 240;
    this.height = height || 160;
    this.useColor = useColor;
    this.colorMode = colorMode; // 'ansi16', 'ansi256', 'rgb'
    this.frameCount = 0;
  }

  /**
   * 将像素数据渲染为ASCII艺术
   * @param {Uint8ClampedArray} pixelData - 像素数据 (RGBA格式)
   */
  render(pixelData) {
    let output = '';

    // 字符集，从暗到亮
    const chars = ' .:-=+*#%@';

    for (let y = 0; y < this.height; y += 2) { // 每两行合并为一行以保持比例
      for (let x = 0; x < this.width; x++) {
        // 获取像素索引
        const idx = (y * this.width + x) * 4;
        const r = pixelData[idx];
        const g = pixelData[idx + 1];
        const b = pixelData[idx + 2];

        // 计算亮度 (使用ITU-R BT.709标准)
        const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b;

        // 映射到字符集索引
        const charIndex = Math.floor((brightness / 255) * (chars.length - 1));
        const char = chars[charIndex];

        if (this.useColor) {
          // 添加颜色
          output += this.colorize(char, r, g, b);
        } else {
          output += char;
        }
      }
      output += '\n';
    }

    this.frameCount++;
    return output;
  }

  /**
   * 为字符添加颜色
   * @param {string} char - 字符
   * @param {number} r - 红色分量
   * @param {number} g - 绿色分量
   * @param {number} b - 蓝色分量
   */
  colorize(char, r, g, b) {
    switch (this.colorMode) {
      case 'ansi16':
        // 转换为ANSI 16色
        const ansi16 = 30 + Math.round(r / 255) * 1 + Math.round(g / 255) * 2 + Math.round(b / 255) * 4;
        return `\x1b[${ansi16}m${char}\x1b[0m`;

      case 'ansi256':
        // 转换为ANSI 256色
        const ansi256 = 16 + (36 * Math.round(r/51)) + (6 * Math.round(g/51)) + Math.round(b/51);
        return `\x1b[38;5;${ansi256}m${char}\x1b[0m`;

      case 'rgb':
        // 使用RGB颜色
        return `\x1b[38;2;${r};${g};${b}m${char}\x1b[0m`;

      default:
        return char;
    }
  }

  /**
   * 设置渲染器尺寸
   * @param {number} width - 宽度
   * @param {number} height - 高度
   */
  setDimensions(width, height) {
    this.width = width;
    this.height = height;
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

module.exports = { ASCIIRenderer };