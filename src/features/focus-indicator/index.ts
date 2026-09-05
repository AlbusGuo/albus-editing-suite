import type { Plugin } from 'obsidian';
import { getAppDocuments } from '../../utils/app-documents';
import type { FeatureController } from '../controller';

const ENABLED_BODY_CLASS = 'editing-suite-focus-indicator-enabled';

export function registerFocusIndicator(
	plugin: Plugin,
	isEnabled: () => boolean,
): FeatureController {
	const applyState = (): void => {
		for (const document of getAppDocuments(plugin.app)) {
			document.body.classList.toggle(ENABLED_BODY_CLASS, isEnabled());
		}
	};

	plugin.registerEvent(plugin.app.workspace.on('window-open', applyState));
	plugin.app.workspace.onLayoutReady(applyState);
	plugin.register(() => {
		for (const document of getAppDocuments(plugin.app)) {
			document.body.classList.remove(ENABLED_BODY_CLASS);
		}
	});
	applyState();

	return { refresh: applyState };
}
