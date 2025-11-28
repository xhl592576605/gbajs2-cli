import React from 'react';
import { Box, Text } from 'ink';
import logger from '../utils/logger.js';

const h = React.createElement;

class ErrorBoundary extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			hasError: false,
			error: null
		};
	}

	static getDerivedStateFromError(error) {
		return {
			hasError: true,
			error
		};
	}

	componentDidCatch(error, info) {
		logger.error('Ink 组件渲染失败', error?.message || error);
		if (info?.componentStack) {
			logger.debug(info.componentStack);
		}
	}

	render() {
		if (this.state.hasError) {
			return h(
				Box,
				{ flexDirection: 'column', borderStyle: 'round', borderColor: 'red', padding: 1 },
				h(Text, { key: 'title', color: 'red' }, '渲染出现错误'),
				h(Text, { key: 'message', color: 'gray' }, this.state.error?.message || '未知错误'),
				h(Text, { key: 'hint', color: 'gray' }, '请检查日志或重新启动应用')
			);
		}
		return this.props.children;
	}
}

export default ErrorBoundary;
