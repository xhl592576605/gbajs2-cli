export function hex(number, leading, usePrefix) {
	if (typeof usePrefix === "undefined") {
		usePrefix = true;
	}
	if (typeof leading === "undefined") {
		leading = 8;
	}
	var string = (number >>> 0).toString(16).toUpperCase();
	leading -= string.length;
	if (leading < 0) return string;
	return (usePrefix ? "0x" : "") + new Array(leading + 1).join("0") + string;
}

export class Pointer {
	constructor() {
		this.index = 0;
		this.top = 0;
		this.stack = [];
	}
	advance(amount) {
		var index = this.index;
		this.index += amount;
		return index;
	}
	mark() {
		return this.index - this.top;
	}
	push() {
		this.stack.push(this.top);
		this.top = this.index;
	}
	pop() {
		this.top = this.stack.pop();
	}
	readString(view) {
		var length = view.getUint32(this.advance(4), true);
		var bytes = [];
		for (var i = 0; i < length; ++i) {
			bytes.push(String.fromCharCode(view.getUint8(this.advance(1))));
		}
		return bytes.join("");
	}
}

export class Serializer {
	static ensureArrayBuffer(value) {
		if (value instanceof ArrayBuffer) {
			return value.slice(0);
		}
		if (ArrayBuffer.isView(value)) {
			var copy = new ArrayBuffer(value.byteLength);
			new Uint8Array(copy).set(
				new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
			);
			return copy;
		}
		if (
			typeof Buffer !== "undefined" &&
			Buffer.isBuffer &&
			Buffer.isBuffer(value)
		) {
			var buffer = new ArrayBuffer(value.length);
			new Uint8Array(buffer).set(value);
			return buffer;
		}
		throw new Error("Unsupported value type for serialization");
	}

	static prefix(value) {
		return Serializer.ensureArrayBuffer(value);
	}
}

export default {
	hex,
	Pointer,
	Serializer
};
