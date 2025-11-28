import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

/**
 * 基于文件的日志系统
 * 存储位置: ~/.gbajs2/logs/
 * 按日期分割文件
 */
export class Logger {
  constructor(level = 'info') {
    // 日志级别映射
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4
    };

    // 设置当前日志级别
    this.currentLevel = this.levels[level] || 2;

    // 模块名称
    this.module = 'GBA';

    // 日志目录
    this.logDir = this.getLogDir();

    // 当前日志文件路径
    this.currentLogFile = null;

    // 初始化日志目录
    this.initLogDir();
  }

  /**
   * 获取日志目录路径
   */
  getLogDir() {
    // 开发模式：项目根目录下的logs
    // 使用标准的NODE_ENV环境变量判断
    const isDevMode = this.isDevelopmentMode();

    if (isDevMode) {
      return path.join(process.cwd(), 'logs');
    }
    // 生产模式：用户主目录
    const homeDir = os.homedir();
    return path.join(homeDir, '.gbajs2', 'logs');
  }

  /**
   * 判断是否为开发模式
   */
  isDevelopmentMode() {
    // 使用标准的NODE_ENV环境变量
    // NODE_ENV=development → 开发模式
    // NODE_ENV=production 或未设置 → 生产模式
    return process.env.NODE_ENV === 'development';
  }

  /**
   * 初始化日志目录
   */
  async initLogDir() {
    try {
      await fs.promises.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error('无法创建日志目录:', error.message);
    }
  }

  /**
   * 获取当前日志文件路径
   */
  getCurrentLogFile() {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(this.logDir, `${today}.log`);
  }

  /**
   * 设置日志级别
   */
  setLevel(level) {
    if (this.levels.hasOwnProperty(level)) {
      this.currentLevel = this.levels[level];
      this.info(`日志级别已设置为: ${level.toUpperCase()}`);
    }
  }

  /**
   * 设置模块名称
   */
  setModule(module) {
    this.module = module;
  }

  /**
   * 格式化时间戳
   */
  formatTimestamp() {
    const now = new Date();
    // 本地时间格式：YYYY-MM-DD HH:mm:ss.SSS
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
  }

  /**
   * 格式化日志消息
   */
  formatMessage(level, message, args = []) {
    const timestamp = this.formatTimestamp();
    const moduleTag = `[${this.module}]`;
    const levelTag = `[${level.toUpperCase()}]`;

    let formattedMessage = `${timestamp} ${levelTag} ${moduleTag} ${message}`;

    // 处理额外参数
    if (args.length > 0) {
      const argsStr = args.map(arg => {
        if (typeof arg === 'object') {
          return JSON.stringify(arg, null, 2);
        }
        return String(arg);
      }).join(' ');
      formattedMessage += ` ${argsStr}`;
    }

    return formattedMessage;
  }

  /**
   * 写入日志到文件
   */
  writeToFile(message) {
    try {
      const logFile = this.getCurrentLogFile();
      const logEntry = message + '\n';

      // 同步写入确保日志记录
      fs.appendFileSync(logFile, logEntry, 'utf8');
    } catch (error) {
      // 日志写入失败时的备用方案
      console.error('日志写入失败:', error.message);
    }
  }

  /**
   * 通用日志方法
   */
  log(level, message, ...args) {
    const levelValue = this.levels[level];

    if (levelValue <= this.currentLevel) {
      const formattedMessage = this.formatMessage(level, message, args);

      // 异步写入文件，不等待结果
      this.writeToFile(formattedMessage);
    }
  }

  /**
   * 错误日志
   */
  error(message, ...args) {
    this.log('error', message, ...args);
  }

  /**
   * 警告日志
   */
  warn(message, ...args) {
    this.log('warn', message, ...args);
  }

  /**
   * 信息日志
   */
  info(message, ...args) {
    this.log('info', message, ...args);
  }

  /**
   * 调试日志
   */
  debug(message, ...args) {
    this.log('debug', message, ...args);
  }

  /**
   * 跟踪日志
   */
  trace(message, ...args) {
    this.log('trace', message, ...args);
  }

  /**
   * 性能日志
   */
  performance(operation, startTime, unit = 'ms') {
    const duration = Date.now() - startTime;
    this.info(`[PERF] ${operation} 耗时: ${duration}${unit}`);
  }

  /**
   * 按键操作日志
   */
  keypress(key, action = 'press') {
    this.trace(`[KEY] ${action.toUpperCase()}: ${key}`);
  }

  /**
   * 游戏状态变化日志
   */
  gameState(from, to) {
    this.debug(`[STATE] ${from} -> ${to}`);
  }

  /**
   * ROM加载日志
   */
  romLoad(romPath, size) {
    this.info(`[ROM] 加载: ${romPath} (${size} bytes)`);
  }

  /**
   * 帧率日志
   */
  fps(current, target = 59.73) {
    this.trace(`[FPS] ${current.toFixed(2)}/${target}`);
  }

  /**
   * 内存使用日志
   */
  memory() {
    const usage = process.memoryUsage();
    this.debug(`[MEMORY] RSS: ${(usage.rss / 1024 / 1024).toFixed(2)}MB, Heap: ${(usage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  }

  /**
   * 创建模块专用日志器
   */
  child(moduleName) {
    const childLogger = Object.create(this);
    childLogger.module = moduleName;
    return childLogger;
  }

  /**
   * 获取日志文件列表
   */
  async getLogFiles() {
    try {
      const files = await fs.promises.readdir(this.logDir);
      return files
        .filter(file => file.endsWith('.log'))
        .sort()
        .reverse(); // 最新的在前
    } catch (error) {
      return [];
    }
  }

  /**
   * 读取指定日期的日志
   */
  async readLog(date, lines = 100) {
    try {
      const logFile = path.join(this.logDir, `${date}.log`);
      const content = await fs.promises.readFile(logFile, 'utf8');
      const allLines = content.split('\n').filter(line => line.trim());

      // 返回最后N行
      return allLines.slice(-lines);
    } catch (error) {
      return [];
    }
  }

  /**
   * 清理旧日志文件（保留最近30天）
   */
  async cleanupOldLogs(days = 30) {
    try {
      const files = await this.getLogFiles();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      for (const file of files) {
        const dateStr = file.replace('.log', '');
        const fileDate = new Date(dateStr);

        if (fileDate < cutoffDate) {
          const filePath = path.join(this.logDir, file);
          await fs.promises.unlink(filePath);
          this.info(`清理旧日志文件: ${file}`);
        }
      }
    } catch (error) {
      this.error('清理旧日志失败:', error.message);
    }
  }
}

// 创建全局默认日志实例
const logger = new Logger();

export default logger;

// 导出便捷函数
export const log = {
  error: (message, ...args) => logger.error(message, ...args),
  warn: (message, ...args) => logger.warn(message, ...args),
  info: (message, ...args) => logger.info(message, ...args),
  debug: (message, ...args) => logger.debug(message, ...args),
  trace: (message, ...args) => logger.trace(message, ...args),
  performance: (operation, startTime, unit) => logger.performance(operation, startTime, unit),
  keypress: (key, action) => logger.keypress(key, action),
  gameState: (from, to) => logger.gameState(from, to),
  romLoad: (romPath, size) => logger.romLoad(romPath, size),
  fps: (current, target) => logger.fps(current, target),
  memory: () => logger.memory(),
  setLevel: (level) => logger.setLevel(level),
  child: (moduleName) => logger.child(moduleName),
  getLogFiles: () => logger.getLogFiles(),
  readLog: (date, lines) => logger.readLog(date, lines),
  cleanupOldLogs: (days) => logger.cleanupOldLogs(days)
};