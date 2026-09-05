import { MarkdownView, type Plugin } from 'obsidian';
import type { FeatureController } from '../controller';
import { registerNegativeHeadingCommands } from './commands';
import { createNegativeHeadingEditorExtension } from './editor-extension';
import { renderNegativeHeadings } from './reading-renderer';

export function registerNegativeHeadings(
	plugin: Plugin,
	isEnabled: () => boolean,
): FeatureController {
	registerNegativeHeadingCommands(plugin, isEnabled);
	plugin.registerEditorExtension(
		createNegativeHeadingEditorExtension(isEnabled),
	);
	plugin.registerMarkdownPostProcessor((element, context) => {
		renderNegativeHeadings(element, context, isEnabled);
	});

	return {
		refresh: () => {
			plugin.app.workspace.updateOptions();
			for (const leaf of plugin.app.workspace.getLeavesOfType('markdown')) {
				if (leaf.view instanceof MarkdownView) {
					leaf.view.previewMode.rerender(true);
				}
			}
		},
	};
}
