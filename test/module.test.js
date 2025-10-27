const { GameBoyAdvance } = require('../src/index');

describe('GameBoyAdvance Module', () => {
  test('should be able to import GameBoyAdvance class', () => {
    expect(GameBoyAdvance).toBeDefined();
  });

  test('should be able to create GameBoyAdvance instance', () => {
    const gba = new GameBoyAdvance();
    expect(gba).toBeInstanceOf(GameBoyAdvance);
  });

  test('should have correct initial properties', () => {
    const gba = new GameBoyAdvance();
    expect(gba.rom).toBeNull();
    expect(gba.LOG_ERROR).toBe(1);
    expect(gba.LOG_WARN).toBe(2);
  });
});

describe('GameBoyAdvance Core Modules', () => {
  test('should be able to import core modules', () => {
    // 测试核心模块导入
    const { GameBoyAdvanceMMU } = require('../src/core/mmu');
    const { ARMCore } = require('../src/core/core');
    const { GameBoyAdvanceAudio } = require('../src/core/audio');

    expect(GameBoyAdvanceMMU).toBeDefined();
    expect(ARMCore).toBeDefined();
    expect(GameBoyAdvanceAudio).toBeDefined();
  });

  test('should be able to create core module instances', () => {
    // 测试核心模块实例化
    const { GameBoyAdvanceMMU } = require('../src/core/mmu');
    const { ARMCore } = require('../src/core/core');
    const { GameBoyAdvanceAudio } = require('../src/core/audio');

    // 注意：这些模块可能需要特定的初始化参数
    const mmu = new GameBoyAdvanceMMU();
    expect(mmu).toBeInstanceOf(GameBoyAdvanceMMU);

    // Audio模块应该可以在Node.js环境下创建
    const audio = new GameBoyAdvanceAudio();
    expect(audio).toBeInstanceOf(GameBoyAdvanceAudio);
  });
});