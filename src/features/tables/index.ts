import type { Plugin } from 'obsidian';
import type { TableStyle } from '../../settings';
import { getAppDocuments } from '../../utils/app-documents';
import type { FeatureController } from '../controller';

const FULL_WIDTH_BODY_CLASS = 'editing-suite-table-full-width-enabled';
const CENTERED_BODY_CLASS = 'editing-suite-table-centered-enabled';
const ROUNDED_GRID_BODY_CLASS = 'editing-suite-table-style-rounded-grid';
const THREE_LINE_BODY_CLASS = 'editing-suite-table-style-three-line';

export function registerTableAdjustments(
	plugin: Plugin,
	isFullWidth: () => boolean,
	isCentered: () => boolean,
	getStyle: () => TableStyle,
): FeatureController {
	const applyState = (): void => {
		const style = getStyle();
		for (const document of getAppDocuments(plugin.app)) {
			document.body.classList.toggle(
				FULL_WIDTH_BODY_CLASS,
				isFullWidth(),
			);
			document.body.classList.toggle(
				CENTERED_BODY_CLASS,
				isCentered(),
			);
			document.body.classList.toggle(
				ROUNDED_GRID_BODY_CLASS,
				style === 'rounded-grid',
			);
			document.body.classList.toggle(
				THREE_LINE_BODY_CLASS,
				style === 'three-line',
			);
		}
	};

	plugin.registerEvent(plugin.app.workspace.on('window-open', () => {
		applyState();
	}));
	plugin.app.workspace.onLayoutReady(() => {
		applyState();
	});
	plugin.register(() => {
		for (const document of getAppDocuments(plugin.app)) {
			document.body.classList.remove(
				FULL_WIDTH_BODY_CLASS,
				CENTERED_BODY_CLASS,
				ROUNDED_GRID_BODY_CLASS,
				THREE_LINE_BODY_CLASS,
			);
		}
	});
	applyState();

	return { refresh: applyState };
}
