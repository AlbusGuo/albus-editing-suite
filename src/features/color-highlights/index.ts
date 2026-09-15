import type { Plugin } from 'obsidian';
import type { FeatureController } from '../controller';
import { getAppDocuments } from '../../utils/app-documents';
import { registerColorHighlightCommands } from './commands';
import { createColorHighlightExtension } from './editor-extension';
import { ReadingHighlightRenderer } from './reading-renderer';

const ENABLED_BODY_CLASS = 'editing-suite-color-highlights-enabled';
const WAVE_BODY_CLASS = 'editing-suite-color-highlight-wave-enabled';

export function registerColorHighlights(
	plugin: Plugin,
	isEnabled: () => boolean,
	isWaveEnabled: () => boolean,
): FeatureController {
	const readingRenderer = new ReadingHighlightRenderer(plugin.app, isEnabled);
	let isActive = true;
	const applyEnabledState = (): void => {
		for (const document of getAppDocuments(plugin.app)) {
			document.body.classList.toggle(ENABLED_BODY_CLASS, isEnabled());
			document.body.classList.toggle(
				WAVE_BODY_CLASS,
				isEnabled() && isWaveEnabled(),
			);
		}
	};

	registerColorHighlightCommands(plugin, isEnabled);
	plugin.registerEditorExtension(createColorHighlightExtension(isEnabled));
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
			document.body.classList.remove(WAVE_BODY_CLASS);
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
