import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import FileSystem from '../src/utils/fileSystem.js';

async function createTmpDir() {
  return fs.promises.mkdtemp(path.join(os.tmpdir(), 'gbajs2-fs-'));
}

test('FileSystem loads ROM from disk', async () => {
  const tmpDir = await createTmpDir();
  const romPath = path.join(tmpDir, 'demo.gba');
  await fs.promises.writeFile(romPath, Buffer.from([0xde, 0xad, 0xbe, 0xef]));

  const fsHelper = new FileSystem({ saveDir: tmpDir, biosPath: romPath });
  const rom = await fsHelper.loadRom(romPath);
  assert.equal(rom.length, 4);
  assert.equal(rom[0], 0xde);
});

test('FileSystem loads custom BIOS path', async () => {
  const tmpDir = await createTmpDir();
  const biosPath = path.join(tmpDir, 'bios.bin');
  await fs.promises.writeFile(biosPath, Buffer.from([1, 2, 3]));

  const fsHelper = new FileSystem({ biosPath, saveDir: tmpDir });
  const bios = await fsHelper.loadBios();
  assert.equal(bios[2], 3);
});

test('FileSystem writes and reads save files', async () => {
  const tmpDir = await createTmpDir();
  const fsHelper = new FileSystem({ saveDir: tmpDir, biosPath: path.join(tmpDir, 'bios.bin') });
  const romId = 'pokemon.gba';
  const data = new Uint8Array([5, 6, 7]);

  const savePath = await fsHelper.writeSave(romId, data);
  const saved = await fsHelper.readSave(romId);

  assert.ok(await fs.promises.stat(savePath));
  assert.equal(saved[1], 6);
});
