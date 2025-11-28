import { Buffer } from "buffer";

export function base64ToArrayBuffer(base64) {
	// https://stackoverflow.com/questions/21797299/convert-base64-string-to-arraybuffer
	if (typeof Buffer !== "undefined") {
		var buffer = Buffer.from(base64, "base64");
		var copy = new ArrayBuffer(buffer.length);
		new Uint8Array(copy).set(buffer);
		return copy;
	}
	var decoder =
		(typeof window !== "undefined" && window.atob
			? window.atob.bind(window)
			: typeof atob !== "undefined"
			? atob
			: null);
	if (!decoder) {
		throw new Error("No base64 decoder available");
	}
	var binaryString = decoder(base64);
	var len = binaryString.length;
	var bytes = new Uint8Array(len);
	for (var i = 0; i < len; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes.buffer;
}

export const biosBin = base64ToArrayBuffer(
	"BgAA6v7//+oFAADq/v//6v7//+oAAKDhDAAA6v7//+oC86DjAABd4wHToAMg0E0CAEAt6QIAXuUEAFDjCQAACwUAUOMHAAALAEC96A7wsOEPUC3pAQOg4wDgj+IE8BDlD1C96ATwXuIQQC3pBNBN4rAQzeEBQ6DjAkyE4rAA1OGyAM3hsBDd4QEAgOGwAMThAUOg4x8AoOMA8CnhAACg4wEDxOXTAKDjAPAp4bgAVOGwEN3hABAR4AAQIRC4EEQR8///CgFDoOMCTITisgDd4bAAxOEE0I3iEIC96A==\n"
);

export default biosBin;
