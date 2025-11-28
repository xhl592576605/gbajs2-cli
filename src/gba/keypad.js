export default class GameBoyAdvanceKeypad {
	constructor() {
		this.A = 0;
		this.B = 1;
		this.SELECT = 2;
		this.START = 3;
		this.RIGHT = 4;
		this.LEFT = 5;
		this.UP = 6;
		this.DOWN = 7;
		this.R = 8;
		this.L = 9;

		this.currentDown = 0x03ff;
	}

	pollGamepads() {}

	registerHandlers() {}

	_resolveKeyIndex(keyId) {
		if (typeof keyId === "number") {
			return keyId;
		}
		var normalized = typeof keyId === "string" ? keyId.toUpperCase() : "";
		if (typeof this[normalized] === "number") {
			return this[normalized];
		}
		throw new Error("Unknown key id: " + keyId);
	}

	setKeyState(keyId, pressed) {
		var index = this._resolveKeyIndex(keyId);
		var mask = 1 << index;
		if (pressed) {
			this.currentDown &= ~mask;
		} else {
			this.currentDown |= mask;
		}
	}

	pressKey(keyId) {
		this.setKeyState(keyId, true);
	}

	releaseKey(keyId) {
		this.setKeyState(keyId, false);
	}

	getKeyState() {
		return this.currentDown;
	}
}
