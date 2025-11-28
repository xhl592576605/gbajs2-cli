import { performance } from 'perf_hooks';

class FrameScheduler {
	constructor({ fpsLimit = 59.73, onTick, now = () => performance.now(), setTimeoutFn = setTimeout, clearTimeoutFn = clearTimeout } = {}) {
		this.fpsLimit = fpsLimit;
		this.onTick = typeof onTick === 'function' ? onTick : null;
		this.now = now;
		this.setTimeout = setTimeoutFn;
		this.clearTimeout = clearTimeoutFn;
		this.interval = 1000 / this.fpsLimit;
		this.running = false;
		this.handle = null;
		this.lastTick = this.now();
	}

	setLimit(limit) {
		if (!Number.isFinite(limit)) {
			return;
		}
		const clamped = Math.min(60, Math.max(30, limit));
		this.fpsLimit = clamped;
		this.interval = 1000 / this.fpsLimit;
	}

	start() {
		if (this.running) {
			return;
		}
		this.running = true;
		this.lastTick = this.now();
		this.scheduleNext(0);
	}

	stop() {
		this.running = false;
		if (this.handle) {
			this.clearTimeout(this.handle);
			this.handle = null;
		}
	}

	scheduleNext(delay) {
		this.handle = this.setTimeout(() => this.tick(), Math.max(0, delay));
	}

	tick() {
		if (!this.running) {
			return;
		}
		const now = this.now();
		const delta = now - this.lastTick;
		if (delta < this.interval) {
			this.scheduleNext(this.interval - delta);
			return;
		}
		this.lastTick = now;
		if (this.onTick) {
			this.onTick();
		}
		this.scheduleNext(0);
	}
}

export default FrameScheduler;
