const GBA_WIDTH = 240;
const GBA_HEIGHT = 160;
const DEFAULT_MAX_SCALE = 8;
const BALANCED_DENSITY = 'balanced';

const clampScale = (value) => {
	if (!Number.isFinite(value)) {
		return 1;
	}
	return Math.max(1, value);
};

const assertDensity = (density) => {
	if (density && density !== BALANCED_DENSITY) {
		throw new Error('仅支持 balanced 渲染密度');
	}
};

export const computeScaleDimensions = ({ scale = 1, density } = {}) => {
	assertDensity(density);
	const normalizedScale = clampScale(scale);
	const metrics = {
		scale: normalizedScale,
		scaleX: Math.ceil(normalizedScale),
		scaleY: Math.ceil(normalizedScale),
		density: BALANCED_DENSITY
	};
	metrics.columns = Math.ceil(GBA_WIDTH / metrics.scaleX);
	metrics.rows = Math.ceil(GBA_HEIGHT / (metrics.scaleY * 2));
	return metrics;
};

const minScaleToFit = ({ columns, availableRows }) => {
	const widthBound = Math.max(1, Math.ceil(GBA_WIDTH / Math.max(1, columns)));
	const heightBound = Math.max(
		1,
		Math.ceil((GBA_HEIGHT / 2) / Math.max(1, availableRows))
	);
	return Math.max(widthBound, heightBound);
};

export const fitScaleToTerminal = ({
	columns,
	rows,
	density,
	reserveRows = 3,
	preferredScale = null,
	maxScale = DEFAULT_MAX_SCALE
} = {}) => {
	assertDensity(density);
	const resolvedColumns = Math.max(0, Number(columns) || 0);
	const resolvedRows = Math.max(0, Number(rows) || 0);
	const availableRows = Math.max(1, resolvedRows - reserveRows);

	if (preferredScale) {
		const metrics = computeScaleDimensions({ scale: preferredScale });
		const fits =
			(!resolvedColumns || metrics.columns <= resolvedColumns) &&
			(!resolvedRows || metrics.rows <= availableRows);
		return {
			...metrics,
			fits,
			source: 'user'
		};
	}

	if (!resolvedColumns || !resolvedRows) {
		const fallback = computeScaleDimensions({ scale: 1 });
		return { ...fallback, fits: false, source: 'fallback' };
	}

	const lowerBound = minScaleToFit({ columns: resolvedColumns, availableRows });
	const scale = Math.min(maxScale, Math.max(1, lowerBound));
	const metrics = computeScaleDimensions({ scale });
	const fits = metrics.columns <= resolvedColumns && metrics.rows <= availableRows;

	return {
		...metrics,
		fits,
		source: fits ? 'auto' : 'fallback'
	};
};

export const describeScale = ({ scale, density = BALANCED_DENSITY, source, columns, rows }) => {
	const parts = [
		`scale=${scale}`,
		`density=${density}`,
		`cols=${columns}`,
		`rows=${rows}`,
		`source=${source || 'unknown'}`
	];
	return parts.join(' · ');
};
