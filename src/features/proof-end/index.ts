import { MarkdownView, type Plugin } from 'obsidian';
import { getAppDocuments } from '../../utils/app-documents';
import type { FeatureController } from '../controller';
import { createProofEndEditorExtension } from './editor-extension';
import {
	clearProofEndSymbols,
	renderProofEndSymbols,
} from './reading-renderer';

const ENABLED_BODY_CLASS = 'editing-suite-proof-end-enabled';

export function registerProofEnd(
	plugin: Plugin,
	isEnabled: () => boolean,
): FeatureController {
	const applyState = (): void => {
		for (const document of getAppDocuments(plugin.app)) {
			document.body.classList.toggle(ENABLED_BODY_CLASS, isEnabled());
		}
	};
	const refreshReadingViews = (): void => {
		for (const leaf of plugin.app.workspace.getLeavesOfType('markdown')) {
			if (leaf.view instanceof MarkdownView) {
				leaf.view.previewMode.rerender(true);
			}
		}
	};

	plugin.registerEditorExtension(createProofEndEditorExtension(isEnabled));
	plugin.registerMarkdownPostProcessor((element) => {
		renderProofEndSymbols(element, isEnabled());
	});
	plugin.registerEvent(plugin.app.workspace.on('window-open', applyState));
	plugin.app.workspace.onLayoutReady(applyState);
	plugin.register(() => {
		for (const document of getAppDocuments(plugin.app)) {
			document.body.classList.remove(ENABLED_BODY_CLASS);
			clearProofEndSymbols(document);
		}
	});
	applyState();

	return {
		refresh: () => {
			applyState();
			plugin.app.workspace.updateOptions();
			refreshReadingViews();
		},
	};
}
