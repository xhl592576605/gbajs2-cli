class MemoryView {
	constructor(memory, offset) {
		this.buffer = memory;
		this.view = new DataView(
			this.buffer,
			typeof offset === "number" ? offset : 0
		);
		this.mask = memory.byteLength - 1;
		this.resetMask();
	}
	resetMask() {
		this.mask8 = this.mask & 0xffffffff;
		this.mask16 = this.mask & 0xfffffffe;
		this.mask32 = this.mask & 0xfffffffc;
	}
	load8(offset) {
		return this.view.getInt8(offset & this.mask8);
	}
	load16(offset) {
		return this.view.getInt16(offset & this.mask, true);
	}
	loadU8(offset) {
		return this.view.getUint8(offset & this.mask8);
	}
	loadU16(offset) {
		return this.view.getUint16(offset & this.mask, true);
	}
	load32(offset) {
		var rotate = (offset & 3) << 3;
		var mem = this.view.getInt32(offset & this.mask32, true);
		return (mem >>> rotate) | (mem << (32 - rotate));
	}
	store8(offset, value) {
		this.view.setInt8(offset & this.mask8, value);
	}
	store16(offset, value) {
		this.view.setInt16(offset & this.mask16, value, true);
	}
	store32(offset, value) {
		this.view.setInt32(offset & this.mask32, value, true);
	}
	invalidatePage() {}
	replaceData(memory, offset) {
		this.buffer = memory;
		this.view = new DataView(
			this.buffer,
			typeof offset === "number" ? offset : 0
		);
		if (this.icache) {
			this.icache = new Array(this.icache.length);
		}
	}
}

class MemoryBlock extends MemoryView {
	constructor(size, cacheBits) {
		super(new ArrayBuffer(size));
		this.ICACHE_PAGE_BITS = cacheBits;
		this.PAGE_MASK = (2 << this.ICACHE_PAGE_BITS) - 1;
		this.icache = new Array(size >> (this.ICACHE_PAGE_BITS + 1));
	}
	invalidatePage(address) {
		var page = this.icache[(address & this.mask) >> this.ICACHE_PAGE_BITS];
		if (page) {
			page.invalid = true;
		}
	}
}

export { MemoryView, MemoryBlock };
export default {
	MemoryView,
	MemoryBlock
};
