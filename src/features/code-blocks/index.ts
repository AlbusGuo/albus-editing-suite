import type { Extension } from '@codemirror/state';
import type { Plugin } from 'obsidian';
import { getAppDocuments } from '../../utils/app-documents';
import type { FeatureController } from '../controller';
import { createCodeBlockEditorExtension } from './editor-extension';
import { CodeBlockReadingRenderer } from './reading-renderer';

const ENABLED_BODY_CLASS = 'editing-suite-code-blocks-enabled';

export function registerCodeBlocks(
	plugin: Plugin,
	isEnabled: () => boolean,
): FeatureController {
	const readingRenderer = new CodeBlockReadingRenderer(plugin.app, isEnabled);
	const editorExtensions: Extension[] = [];
	const editorExtension = createCodeBlockEditorExtension();
	let editorEnabled = isEnabled();
	let isActive = true;
	if (editorEnabled) {
		editorExtensions.push(editorExtension);
	}

	const applyEnabledState = (): void => {
		for (const document of getAppDocuments(plugin.app)) {
			document.body.classList.toggle(ENABLED_BODY_CLASS, isEnabled());
		}
	};

	plugin.registerEditorExtension(editorExtensions);
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
		}
	});
	applyEnabledState();

	return {
		refresh: () => {
			const shouldEnableEditor = isEnabled();
			if (shouldEnableEditor !== editorEnabled) {
				editorEnabled = shouldEnableEditor;
				editorExtensions.length = 0;
				if (editorEnabled) {
					editorExtensions.push(editorExtension);
				}
				plugin.app.workspace.updateOptions();
			}
			applyEnabledState();
			if (isEnabled()) {
				readingRenderer.refreshAll();
			} else {
				readingRenderer.clearAll();
			}
		},
	};
}
