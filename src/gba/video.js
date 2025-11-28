import GameBoyAdvanceRenderProxy from "./video/proxy.js";
import GameBoyAdvanceSoftwareRenderer from "./video/software.js";

export default class GameBoyAdvanceVideo {
	constructor(options = {}) {
		this.CYCLES_PER_PIXEL = 4;

		this.HORIZONTAL_PIXELS = 240;
		this.HBLANK_PIXELS = 68;
		this.HDRAW_LENGTH = 1006;
		this.HBLANK_LENGTH = 226;
		this.HORIZONTAL_LENGTH = 1232;

		this.VERTICAL_PIXELS = 160;
		this.VBLANK_PIXELS = 68;
		this.VERTICAL_TOTAL_PIXELS = 228;

		this.TOTAL_LENGTH = 280896;

		this.drawCallback = function () {};
		this.vblankCallback = function () {};
		this.frameCallback = options.onFrame || null;

		this.renderPath = this._createRenderPath();
		this.usesWorker = this.renderPath instanceof GameBoyAdvanceRenderProxy;

		this.frameBuffer = new Uint8ClampedArray(
			this.HORIZONTAL_PIXELS * this.VERTICAL_PIXELS * 4
		);
		this.renderBacking = this._createPixelData(this.usesWorker);
		if (!this.usesWorker) {
			this.renderBacking.data = this.frameBuffer;
		}

		try {
			this.renderPath.setBacking(this.renderBacking);
		} catch (error) {
			console.warn(
				"Falling back to software renderer:",
				error.message
			);
			this.renderPath = new GameBoyAdvanceSoftwareRenderer();
			this.usesWorker = false;
			this.renderBacking.data = this.frameBuffer;
			this.renderPath.setBacking(this.renderBacking);
		}
	}
	clear() {
		this.renderPath.clear(this.cpu.mmu);

		// DISPSTAT
		this.DISPSTAT_MASK = 0xff38;
		this.inHblank = false;
		this.inVblank = false;
		this.vcounter = 0;
		this.vblankIRQ = 0;
		this.hblankIRQ = 0;
		this.vcounterIRQ = 0;
		this.vcountSetting = 0;

		// VCOUNT
		this.vcount = -1;

		this.lastHblank = 0;
		this.nextHblank = this.HDRAW_LENGTH;
		this.nextEvent = this.nextHblank;

		this.nextHblankIRQ = 0;
		this.nextVblankIRQ = 0;
		this.nextVcounterIRQ = 0;
	}
	freeze() {
		return {
			inHblank: this.inHblank,
			inVblank: this.inVblank,
			vcounter: this.vcounter,
			vblankIRQ: this.vblankIRQ,
			hblankIRQ: this.hblankIRQ,
			vcounterIRQ: this.vcounterIRQ,
			vcountSetting: this.vcountSetting,
			vcount: this.vcount,
			lastHblank: this.lastHblank,
			nextHblank: this.nextHblank,
			nextEvent: this.nextEvent,
			nextHblankIRQ: this.nextHblankIRQ,
			nextVblankIRQ: this.nextVblankIRQ,
			nextVcounterIRQ: this.nextVcounterIRQ,
			renderPath: this.renderPath.freeze(this.core.encodeBase64)
		};
	}
	defrost(frost) {
		this.inHblank = frost.inHblank;
		this.inVblank = frost.inVblank;
		this.vcounter = frost.vcounter;
		this.vblankIRQ = frost.vblankIRQ;
		this.hblankIRQ = frost.hblankIRQ;
		this.vcounterIRQ = frost.vcounterIRQ;
		this.vcountSetting = frost.vcountSetting;
		this.vcount = frost.vcount;
		this.lastHblank = frost.lastHblank;
		this.nextHblank = frost.nextHblank;
		this.nextEvent = frost.nextEvent;
		this.nextHblankIRQ = frost.nextHblankIRQ;
		this.nextVblankIRQ = frost.nextVblankIRQ;
		this.nextVcounterIRQ = frost.nextVcounterIRQ;
		this.renderPath.defrost(frost.renderPath, this.core.decodeBase64);
	}
	getFrameBuffer() {
		return this.frameBuffer;
	}
	setFrameCallback(callback) {
		this.frameCallback = callback;
	}
	setFrameBuffer(buffer) {
		if (!(buffer instanceof Uint8ClampedArray)) {
			throw new Error("Frame buffer must be a Uint8ClampedArray");
		}
		this.frameBuffer = buffer;
		if (!this.usesWorker) {
			this.renderBacking.data = buffer;
		}
	}
	updateTimers(cpu) {
		var cycles = cpu.cycles;

		if (this.nextEvent <= cycles) {
			if (this.inHblank) {
				// End Hblank
				this.inHblank = false;
				this.nextEvent = this.nextHblank;

				++this.vcount;

				switch (this.vcount) {
					case this.VERTICAL_PIXELS:
						this.inVblank = true;
						this.renderPath.finishDraw(this);
						this.nextVblankIRQ = this.nextEvent + this.TOTAL_LENGTH;
						this.cpu.mmu.runVblankDmas();
						if (this.vblankIRQ) {
							this.cpu.irq.raiseIRQ(this.cpu.irq.IRQ_VBLANK);
						}
						this.vblankCallback();
						break;
					case this.VERTICAL_TOTAL_PIXELS - 1:
						this.inVblank = false;
						break;
					case this.VERTICAL_TOTAL_PIXELS:
						this.vcount = 0;
						this.renderPath.startDraw();
						break;
				}

				this.vcounter = this.vcount == this.vcountSetting;
				if (this.vcounter && this.vcounterIRQ) {
					this.cpu.irq.raiseIRQ(this.cpu.irq.IRQ_VCOUNTER);
					this.nextVcounterIRQ += this.TOTAL_LENGTH;
				}

				if (this.vcount < this.VERTICAL_PIXELS) {
					this.renderPath.drawScanline(this.vcount);
				}
			} else {
				// Begin Hblank
				this.inHblank = true;
				this.lastHblank = this.nextHblank;
				this.nextEvent = this.lastHblank + this.HBLANK_LENGTH;
				this.nextHblank = this.nextEvent + this.HDRAW_LENGTH;
				this.nextHblankIRQ = this.nextHblank;

				if (this.vcount < this.VERTICAL_PIXELS) {
					this.cpu.mmu.runHblankDmas();
				}
				if (this.hblankIRQ) {
					this.cpu.irq.raiseIRQ(this.cpu.irq.IRQ_HBLANK);
				}
			}
		}
	}
	writeDisplayStat(value) {
		this.vblankIRQ = value & 0x0008;
		this.hblankIRQ = value & 0x0010;
		this.vcounterIRQ = value & 0x0020;
		this.vcountSetting = (value & 0xff00) >> 8;

		if (this.vcounterIRQ) {
			// FIXME: this can be too late if we're in the middle of an Hblank
			this.nextVcounterIRQ =
				this.nextHblank +
				this.HBLANK_LENGTH +
				(this.vcountSetting - this.vcount) * this.HORIZONTAL_LENGTH;
			if (this.nextVcounterIRQ < this.nextEvent) {
				this.nextVcounterIRQ += this.TOTAL_LENGTH;
			}
		}
	}
	readDisplayStat() {
		return this.inVblank | (this.inHblank << 1) | (this.vcounter << 2);
	}
	finishDraw(pixelData) {
		const source =
			(pixelData && pixelData.data) || this.renderBacking.data;
		if (source && source !== this.frameBuffer) {
			this.frameBuffer.set(source);
		}
		if (this.frameCallback) {
			this.frameCallback(this.frameBuffer);
		}
		this.drawCallback();
	}

	_createRenderPath() {
		try {
			return new GameBoyAdvanceRenderProxy();
		} catch (error) {
			console.warn(
				"Falling back to software renderer (worker creation failed):",
				error.message
			);
			return new GameBoyAdvanceSoftwareRenderer();
		}
	}

	_createPixelData(preferShared) {
		const length = this.HORIZONTAL_PIXELS * this.VERTICAL_PIXELS * 4;
		let buffer = null;
		if (preferShared && typeof SharedArrayBuffer !== "undefined") {
			try {
				buffer = new SharedArrayBuffer(length);
			} catch (error) {
				buffer = null;
			}
		}
		if (!buffer) {
			buffer = new ArrayBuffer(length);
		}
		return {
			width: this.HORIZONTAL_PIXELS,
			height: this.VERTICAL_PIXELS,
			data: new Uint8ClampedArray(buffer)
		};
	}

	dispose() {
		if (this.renderPath && typeof this.renderPath.dispose === "function") {
			this.renderPath.dispose();
		}
	}
}
