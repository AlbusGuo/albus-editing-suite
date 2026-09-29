import { MarkdownView, type Plugin } from 'obsidian';
import type { ListMarkerColor } from '../../settings';
import { getAppDocuments } from '../../utils/app-documents';
import type { FeatureController } from '../controller';
import { registerCustomListCommands } from './commands';
import { createCustomListEditorExtension } from './editor-extension';
import { createCompactListSpacingExtension } from './compact-spacing';
import { renderCustomLists } from './reading-renderer';

const ENABLED_BODY_CLASS = 'editing-suite-custom-lists-enabled';
const TEXT_MARKER_BODY_CLASS = 'editing-suite-list-marker-text-color';

export function registerCustomLists(
	plugin: Plugin,
	isEnabled: () => boolean,
	getMarkerColor: () => ListMarkerColor,
): FeatureController {
	const applyEnabledState = (): void => {
		for (const document of getAppDocuments(plugin.app)) {
			document.body.classList.toggle(ENABLED_BODY_CLASS, isEnabled());
			document.body.classList.toggle(
				TEXT_MARKER_BODY_CLASS,
				getMarkerColor() === 'text',
			);
		}
	};
	const refreshReadingViews = (): void => {
		for (const leaf of plugin.app.workspace.getLeavesOfType('markdown')) {
			if (leaf.view instanceof MarkdownView) {
				leaf.view.previewMode.rerender(true);
			}
		}
	};

	registerCustomListCommands(plugin, isEnabled);
	plugin.registerEditorExtension(createCustomListEditorExtension(isEnabled));
	plugin.registerEditorExtension(
		createCompactListSpacingExtension(isEnabled),
	);
	plugin.registerMarkdownPostProcessor((element) => {
		if (isEnabled()) {
			renderCustomLists(element);
		}
	});
	plugin.registerEvent(plugin.app.workspace.on('window-open', () => {
		applyEnabledState();
		refreshReadingViews();
	}));
	plugin.app.workspace.onLayoutReady(() => {
		applyEnabledState();
		refreshReadingViews();
	});
	plugin.register(() => {
		for (const document of getAppDocuments(plugin.app)) {
			document.body.classList.remove(ENABLED_BODY_CLASS);
			document.body.classList.remove(TEXT_MARKER_BODY_CLASS);
		}
	});
	applyEnabledState();

	return {
		refresh: () => {
			applyEnabledState();
			plugin.app.workspace.updateOptions();
			refreshReadingViews();
		},
	};
}
