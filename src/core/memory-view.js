class MemoryView {
	constructor(memory, offset) {
		// this.inherit();
		this.buffer = memory;
		this.view = new DataView(
			this.buffer,
			typeof offset === "number" ? offset : 0
		);
		this.mask = 0;
		this.resetMask();
	}

	resetMask() {
		var bits = 0;
		var size = Math.max(this.buffer.byteLength - 1, 0);
		while (size) {
			bits++;
			size >>= 1;
		}
		this.mask = (1 << bits) - 1;
	}

	load8(offset) {
		return this.view.getInt8(offset & this.mask);
	}

	load16(offset) {
		return this.view.getInt16(offset & this.mask, true);
	}

	loadU8(offset) {
		return this.view.getUint8(offset & this.mask);
	}

	loadU16(offset) {
		return this.view.getUint16(offset & this.mask, true);
	}

	load32(offset) {
		return this.view.getInt32(offset & this.mask, true);
	}

	store8(offset, value) {
		this.view.setInt8(offset & this.mask, value);
	}

	store16(offset, value) {
		this.view.setInt16(offset & this.mask, value, true);
	}

	store32(offset, value) {
		this.view.setInt32(offset & this.mask, value, true);
	}

	replaceData(memory, offset) {
		var view = new Uint8Array(this.buffer);
		view.set(new Uint8Array(memory), offset || 0);
	}

	invalidatePage(address) {
		// Do nothing
	}
}

module.exports = { MemoryView };