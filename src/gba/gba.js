import fs from "fs";
import { Buffer } from "buffer";
import ARMCore from "./core.js";
import GameBoyAdvanceMMU from "./mmu.js";
import GameBoyAdvanceInterruptHandler from "./irq.js";
import GameBoyAdvanceIO from "./io.js";
import GameBoyAdvanceAudio from "./audio.js";
import GameBoyAdvanceVideo from "./video.js";
import GameBoyAdvanceKeypad from "./keypad.js";
import GameBoyAdvanceSIO from "./sio.js";

export default class GameBoyAdvance {
	constructor(options = {}) {
		this.LOG_ERROR = 1;
		this.LOG_WARN = 2;
		this.LOG_STUB = 4;
		this.LOG_INFO = 8;
		this.LOG_DEBUG = 16;

		this.SYS_ID = "com.endrift.gbajs";

		this.logLevel = this.LOG_ERROR | this.LOG_WARN;

		this.rom = null;

		this.cpu = new ARMCore();
		this.mmu = new GameBoyAdvanceMMU();
		this.irq = new GameBoyAdvanceInterruptHandler();
		this.io = new GameBoyAdvanceIO();
		this.audio = new GameBoyAdvanceAudio();
		this.video = new GameBoyAdvanceVideo();
		this.keypad = new GameBoyAdvanceKeypad();
		this.sio = new GameBoyAdvanceSIO();

		// TODO: simplify this graph
		this.cpu.mmu = this.mmu;
		this.cpu.irq = this.irq;

		this.mmu.cpu = this.cpu;
		this.mmu.core = this;

		this.irq.cpu = this.cpu;
		this.irq.io = this.io;
		this.irq.audio = this.audio;
		this.irq.video = this.video;
		this.irq.core = this;

		this.io.cpu = this.cpu;
		this.io.audio = this.audio;
		this.io.video = this.video;
		this.io.keypad = this.keypad;
		this.io.sio = this.sio;
		this.io.core = this;

		this.audio.cpu = this.cpu;
		this.audio.core = this;

		this.video.cpu = this.cpu;
		this.video.core = this;

		this.keypad.core = this;

		this.sio.core = this;

		this.doStep = this.waitFrame;
		this.paused = false;

		this.seenFrame = false;
		this.seenSave = false;
		this.lastVblank = 0;

		this.queue = null;
		this.reportFPS = null;
		this.throttle = 16; // This is rough, but the 2/3ms difference gives us a good overhead
		this.savePath = options.savePath || null;

		const scheduler =
			typeof options.queueFrame === "function"
				? options.queueFrame
				: (fn) => {
						this.queue = setTimeout(fn, this.throttle);
				  };
		this.enqueueFrame = (fn) => scheduler(fn);

		if (typeof options.onFrame === "function") {
			this.video.setFrameCallback(options.onFrame);
		}

		this.video.vblankCallback = () => {
			this.seenFrame = true;
		};
	}
	setBios(bios, real) {
		this.mmu.loadBios(this._ensureArrayBuffer(bios), real);
	}
	setRom(rom) {
		this.reset();

		const romData = this._ensureArrayBuffer(rom);
		this.rom = this.mmu.loadRom(romData, true);
		if (!this.rom) {
			return false;
		}
		this.retrieveSavedata();
		return true;
	}
	hasRom() {
		return !!this.rom;
	}
	loadRomFromFile(romSource, callback) {
		let romData = romSource;
		if (typeof romSource === "string") {
			romData = fs.readFileSync(romSource);
		} else if (
			!(romSource instanceof ArrayBuffer) &&
			!ArrayBuffer.isView(romSource) &&
			!(
				typeof Buffer !== "undefined" &&
				Buffer.isBuffer &&
				Buffer.isBuffer(romSource)
			)
		) {
			throw new Error("Unsupported ROM source");
		}
		var result = this.setRom(this._ensureArrayBuffer(romData));
		if (callback) {
			callback(result);
		}
		return result;
	}
	reset() {
		this.audio.pause(true);

		this.mmu.clear();
		this.io.clear();
		this.audio.clear();
		this.video.clear();
		this.sio.clear();

		this.mmu.mmap(this.mmu.REGION_IO, this.io);
		this.mmu.mmap(
			this.mmu.REGION_PALETTE_RAM,
			this.video.renderPath.palette
		);
		this.mmu.mmap(this.mmu.REGION_VRAM, this.video.renderPath.vram);
		this.mmu.mmap(this.mmu.REGION_OAM, this.video.renderPath.oam);

		this.cpu.resetCPU(0);
	}
	step() {
		while (this.doStep()) {
			this.cpu.step();
		}
	}
	waitFrame() {
		var seen = this.seenFrame;
		this.seenFrame = false;
		return !seen;
	}
	pause() {
		this.paused = true;
		this.audio.pause(true);
		if (this.queue) {
			clearTimeout(this.queue);
			this.queue = null;
		}
	}
	advanceFrame() {
		this.step();
		if (this.seenSave) {
			if (!this.mmu.saveNeedsFlush()) {
				this.storeSavedata();
				this.seenSave = false;
			} else {
				this.mmu.flushSave();
			}
		} else if (this.mmu.saveNeedsFlush()) {
			this.seenSave = true;
			this.mmu.flushSave();
		}
	}
	runFrame() {
		this.advanceFrame();
		return this.video.getFrameBuffer();
	}
	runStable() {
		if (this.interval) {
			return; // Already running
		}
		var self = this;
		var timer = 0;
		var frames = 0;
		var runFunc;
		var start = Date.now();
		this.paused = false;
		this.audio.pause(false);

		if (this.reportFPS) {
			runFunc = function () {
				try {
					timer += Date.now() - start;
					if (self.paused) {
						return;
					} else {
						this.enqueueFrame(runFunc);
					}
					start = Date.now();
					self.advanceFrame();
					++frames;
					if (frames == 60) {
						self.reportFPS((frames * 1000) / timer);
						frames = 0;
						timer = 0;
					}
				} catch (exception) {
					self.ERROR(exception);
					if (exception.stack) {
						self.logStackTrace(exception.stack.split("\n"));
					}
					throw exception;
				}
			};
		} else {
			runFunc = function () {
				try {
					if (self.paused) {
						return;
					} else {
						this.enqueueFrame(runFunc);
					}
					self.advanceFrame();
				} catch (exception) {
					self.ERROR(exception);
					if (exception.stack) {
						self.logStackTrace(exception.stack.split("\n"));
					}
					throw exception;
				}
			};
		}
		this.enqueueFrame(runFunc);
	}
	setSavedata(data) {
		this.mmu.loadSavedata(this._ensureArrayBuffer(data));
	}
	loadSavedataFromFile(saveSource) {
		let data = saveSource;
		if (typeof saveSource === "string") {
			this.savePath = this.savePath || saveSource;
			data = fs.readFileSync(saveSource);
		}
		this.setSavedata(data);
	}
	decodeSavedata(string) {
		this.setSavedata(this.decodeBase64(string));
	}
	decodeBase64(string) {
		if (typeof Buffer !== "undefined") {
			var decoded = Buffer.from(string, "base64");
			var buffer = new ArrayBuffer(decoded.length);
			new Uint8Array(buffer).set(decoded);
			return buffer;
		}
		if (typeof atob !== "undefined") {
			var length = (string.length * 3) / 4;
			if (string[string.length - 2] == "=") {
				length -= 2;
			} else if (string[string.length - 1] == "=") {
				length -= 1;
			}
			var buffer = new ArrayBuffer(length);
			var view = new Uint8Array(buffer);
			var bits = string.match(/..../g);
			for (var i = 0; i + 2 < length; i += 3) {
				var s = atob(bits.shift());
				view[i] = s.charCodeAt(0);
				view[i + 1] = s.charCodeAt(1);
				view[i + 2] = s.charCodeAt(2);
			}
			if (i < length) {
				var tail = atob(bits.shift());
				view[i++] = tail.charCodeAt(0);
				if (tail.length > 1) {
					view[i++] = tail.charCodeAt(1);
				}
			}
			return buffer;
		}
		throw new Error("No base64 decoder available");
	}
	encodeBase64(view) {
		var source = view;
		if (view instanceof DataView) {
			source = new Uint8Array(
				view.buffer,
				view.byteOffset,
				view.byteLength
			);
		} else if (!(view instanceof Uint8Array)) {
			source = new Uint8Array(view);
		}
		if (typeof Buffer !== "undefined") {
			return Buffer.from(source).toString("base64");
		}
		if (typeof btoa !== "undefined") {
			var data = [];
			var wordstring = [];
			for (var i = 0; i < source.length; ++i) {
				wordstring.push(String.fromCharCode(source[i]));
				while (wordstring.length >= 3) {
					data.push(btoa(wordstring.splice(0, 3).join("")));
				}
			}
			if (wordstring.length) {
				data.push(btoa(wordstring.join("")));
			}
			return data.join("");
		}
		throw new Error("No base64 encoder available");
	}
	downloadSavedata(targetPath) {
		var sram = this.mmu.save;
		if (!sram) {
			this.WARN("No save data available");
			return null;
		}
		var data = new Uint8Array(sram.buffer);
		var outputPath = targetPath || this.savePath;
		if (outputPath) {
			fs.writeFileSync(outputPath, Buffer.from(data));
			return outputPath;
		}
		throw new Error("No save path provided for download");
	}
	storeSavedata() {
		var sram = this.mmu.save;
		if (!sram) {
			this.WARN("No save data available");
			return;
		}
		if (this.savePath) {
			try {
				fs.writeFileSync(
					this.savePath,
					Buffer.from(new Uint8Array(sram.buffer))
				);
				return;
			} catch (error) {
				this.WARN("Could not store savedata! " + error);
			}
		}
		this.WARN("Could not store savedata! No save path configured.");
	}
	retrieveSavedata() {
		if (this.savePath && fs.existsSync(this.savePath)) {
			try {
				var data = fs.readFileSync(this.savePath);
				this.setSavedata(data);
				return true;
			} catch (error) {
				this.WARN("Could not retrieve savedata! " + error);
			}
		}
		return false;
	}
	setSavePath(savePath) {
		this.savePath = savePath;
	}
	setFrameCallback(callback) {
		this.video.setFrameCallback(callback);
	}
	setFrameBuffer(buffer) {
		this.video.setFrameBuffer(buffer);
	}
	getFrameBuffer() {
		return this.video.getFrameBuffer();
	}
	pullAudioSamples(frameCount) {
		return this.audio.pullSamples(frameCount);
	}
	dispose() {
		this.pause();
		if (this.video && typeof this.video.dispose === "function") {
			this.video.dispose();
		}
	}
	freeze() {
		return {
			cpu: this.cpu.freeze(),
			mmu: this.mmu.freeze(),
			irq: this.irq.freeze(),
			io: this.io.freeze(),
			audio: this.audio.freeze(),
			video: this.video.freeze()
		};
	}
	defrost(frost) {
		this.cpu.defrost(frost.cpu);
		this.mmu.defrost(frost.mmu);
		this.audio.defrost(frost.audio);
		this.video.defrost(frost.video);
		this.irq.defrost(frost.irq);
		this.io.defrost(frost.io);
	}
	log(level, message) {}
	setLogger(logger) {
		this.log = logger;
	}
	logStackTrace(stack) {
		var overflow = stack.length - 32;
		this.ERROR("Stack trace follows:");
		if (overflow > 0) {
			this.log(-1, "> (Too many frames)");
		}
		for (var i = Math.max(overflow, 0); i < stack.length; ++i) {
			this.log(-1, "> " + stack[i]);
		}
	}
	ERROR(error) {
		if (this.logLevel & this.LOG_ERROR) {
			this.log(this.LOG_ERROR, error);
		}
	}
	WARN(warn) {
		if (this.logLevel & this.LOG_WARN) {
			this.log(this.LOG_WARN, warn);
		}
	}
	STUB(func) {
		if (this.logLevel & this.LOG_STUB) {
			this.log(this.LOG_STUB, func);
		}
	}
	INFO(info) {
		if (this.logLevel & this.LOG_INFO) {
			this.log(this.LOG_INFO, info);
		}
	}
	DEBUG(info) {
		if (this.logLevel & this.LOG_DEBUG) {
			this.log(this.LOG_DEBUG, info);
		}
	}
	ASSERT_UNREACHED(err) {
		throw new Error("Should be unreached: " + err);
	}
	ASSERT(test, err) {
		if (!test) {
			throw new Error("Assertion failed: " + err);
		}
	}
	_ensureArrayBuffer(data) {
		if (data instanceof ArrayBuffer) {
			return data.slice(0);
		}
		if (ArrayBuffer.isView(data)) {
			var copy = new ArrayBuffer(data.byteLength);
			new Uint8Array(copy).set(
				new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
			);
			return copy;
		}
		if (
			typeof Buffer !== "undefined" &&
			Buffer.isBuffer &&
			Buffer.isBuffer(data)
		) {
			var bufferCopy = new ArrayBuffer(data.length);
			new Uint8Array(bufferCopy).set(data);
			return bufferCopy;
		}
		throw new Error("Unsupported data type");
	}
}
