import type { Plugin } from 'obsidian';
import type { LinkStyle } from '../../settings';
import { getAppDocuments } from '../../utils/app-documents';
import type { FeatureController } from '../controller';

const RED_OUTLINE_BODY_CLASS = 'editing-suite-link-style-red-outline';

export function registerLinkStyles(
	plugin: Plugin,
	getStyle: () => LinkStyle,
): FeatureController {
	const applyState = (): void => {
		const isRedOutline = getStyle() === 'red-outline';
		for (const document of getAppDocuments(plugin.app)) {
			document.body.classList.toggle(
				RED_OUTLINE_BODY_CLASS,
				isRedOutline,
			);
		}
	};

	plugin.registerEvent(plugin.app.workspace.on('window-open', applyState));
	plugin.app.workspace.onLayoutReady(applyState);
	plugin.register(() => {
		for (const document of getAppDocuments(plugin.app)) {
			document.body.classList.remove(RED_OUTLINE_BODY_CLASS);
		}
	});
	applyState();

	return { refresh: applyState };
}
