export class GuiRendererUnavailable extends Error {
	constructor(message, cause) {
		super(message);
		this.name = 'GuiRendererUnavailable';
		if (cause) {
			this.cause = cause;
		}
	}
}
