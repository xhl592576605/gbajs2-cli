import TerminalRenderer from './terminal/TerminalRenderer.js';
import WindowRenderer from './gui/WindowRenderer.js';

export const createRenderer = ({ target = 'terminal', options = {} } = {}) => {
	const normalized = String(target || 'terminal').toLowerCase();
	if (normalized === 'terminal') {
		return new TerminalRenderer(options);
	}
	if (normalized === 'gui') {
		return new WindowRenderer(options);
	}
	throw new Error(`暂不支持的渲染目标: ${target}`);
};

export default { createRenderer };
