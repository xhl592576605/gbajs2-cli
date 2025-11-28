#!/usr/bin/env node
import { createRequire } from 'module';
import path from 'path';
import { spawnSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';

const require = createRequire(import.meta.url);

const log = (msg) => process.stdout.write(`[speaker-build] ${msg}\n`);

const resolveSpeakerDir = () => {
	try {
		const pkgPath = require.resolve('speaker/package.json');
		return path.dirname(pkgPath);
	} catch (error) {
		log('未安装 speaker，跳过音频构建');
		process.exit(0);
	}
};

const ensureBinding = () => {
	const speakerDir = resolveSpeakerDir();
	patchCoreAudioWarnings(speakerDir);
	const bindingPath = path.join(speakerDir, 'build', 'Release', 'binding.node');
	if (existsSync(bindingPath)) {
		log('检测到已有 binding.node，跳过重建');
		return;
	}
	log(`未找到 binding.node，开始在 ${speakerDir} 构建 speaker`);
	const nodeGypBin = require.resolve('node-gyp/bin/node-gyp.js');
	const result = spawnSync(process.execPath, [nodeGypBin, 'rebuild'], {
		cwd: speakerDir,
		stdio: 'inherit'
	});
	if (result.status !== 0) {
		log('speaker 构建失败，可手动运行 "npx node-gyp rebuild" 在 speaker 目录中重新尝试');
		process.exit(result.status || 1);
	}
	if (!existsSync(bindingPath)) {
		log('构建完成但未生成 binding.node，请检查本地编译环境');
		process.exit(1);
	}
	log('speaker binding 构建成功');
};

const patchCoreAudioWarnings = (speakerDir) => {
	const target = path.join(speakerDir, 'deps', 'mpg123', 'src', 'output', 'coreaudio.c');
	if (!existsSync(target)) {
		log('未找到 coreaudio.c，跳过 warning 补丁');
		return;
	}
	let source = readFileSync(target, 'utf8');
	const replacements = [
		{
			needle: 'warning("Didn\'t have any audio data in callback (buffer underflow)");',
			replacement: '// GBAJS2_PATCHED_COREDIO warning removed to avoid stderr spam'
		},
		{
			needle: 'warning2("Error reading from the ring buffer (wanted=%u, read=%u).\\n", wanted, read);',
			replacement: '// GBAJS2_PATCHED_COREDIO warning2 removed'
		},
		{
			needle: 'error("FindNextComponent failed");',
			replacement: '// GBAJS2_PATCHED_COREDIO error removed (FindNextComponent failed)'
		}
	];
	let modified = source;
	replacements.forEach(({ needle, replacement }) => {
		if (modified.includes(needle)) {
			modified = modified.replace(needle, replacement);
		}
	});
	modified = modified.replace(
		'if (wanted!=read)\n\t\t// GBAJS2_PATCHED_COREDIO warning2 removed',
		'if (wanted!=read) {\n\t\t// GBAJS2_PATCHED_COREDIO warning2 removed\n\t\t}'
	);
	if (modified !== source) {
		writeFileSync(target, modified, 'utf8');
		log('已对 coreaudio.c 应用 warning 补丁');
	} else {
		log('coreaudio.c 无需补丁或已应用');
	}
};

ensureBinding();
