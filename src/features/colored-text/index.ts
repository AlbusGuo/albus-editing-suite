import type { Plugin } from 'obsidian';
import type { FeatureController } from '../controller';
import { getAppDocuments } from '../../utils/app-documents';
import { registerColoredTextCommands } from './commands';
import { createColoredTextEditorExtension } from './editor-extension';
import { ColoredTextReadingRenderer } from './reading-renderer';

const ENABLED_BODY_CLASS = 'editing-suite-colored-text-enabled';
const BOLD_BODY_CLASS = 'editing-suite-colored-text-bold';

export function registerColoredText(
	plugin: Plugin,
	isEnabled: () => boolean,
	isBoldEnabled: () => boolean,
): FeatureController {
	const readingRenderer = new ColoredTextReadingRenderer(
		plugin.app,
		isEnabled,
	);
	let isActive = true;
	const applyEnabledState = (): void => {
		for (const document of getAppDocuments(plugin.app)) {
			document.body.classList.toggle(ENABLED_BODY_CLASS, isEnabled());
			document.body.classList.toggle(
				BOLD_BODY_CLASS,
				isEnabled() && isBoldEnabled(),
			);
		}
	};

	registerColoredTextCommands(plugin, isEnabled);
	plugin.registerEditorExtension(createColoredTextEditorExtension(isEnabled));
	plugin.registerMarkdownPostProcessor((element) => {
		readingRenderer.apply(element);
	});
	plugin.registerEvent(
		plugin.app.workspace.on('window-open', () => {
			applyEnabledState();
			readingRenderer.refreshAll();
		}),
	);
	plugin.app.workspace.onLayoutReady(() => {
		if (isActive) {
			applyEnabledState();
			readingRenderer.refreshAll();
		}
	});
	plugin.register(() => {
		isActive = false;
		readingRenderer.clearAll();
		for (const document of getAppDocuments(plugin.app)) {
			document.body.classList.remove(ENABLED_BODY_CLASS);
			document.body.classList.remove(BOLD_BODY_CLASS);
		}
	});
	applyEnabledState();

	return {
		refresh: () => {
			applyEnabledState();
			plugin.app.workspace.updateOptions();
			readingRenderer.refreshAll();
		},
	};
}
