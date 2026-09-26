import type { Plugin } from 'obsidian';
import { getAppDocuments } from '../../utils/app-documents';
import type { FeatureController } from '../controller';
import { registerClozeCommand } from './commands';
import { createClozeEditorExtension } from './editor-extension';
import { ClozeReadingRenderer } from './reading-renderer';

const ENABLED_BODY_CLASS = 'editing-suite-cloze-enabled';
const LINE_THICKNESS_PROPERTY = '--editing-suite-cloze-line-thickness';

export function registerCloze(
	plugin: Plugin,
	isEnabled: () => boolean,
): FeatureController {
	const readingRenderer = new ClozeReadingRenderer(plugin.app, isEnabled);
	const registeredDocuments = new WeakSet<Document>();
	let isActive = true;
	const registerDocument = (document: Document): void => {
		if (registeredDocuments.has(document)) {
			return;
		}
		registeredDocuments.add(document);
		plugin.registerDomEvent(document, 'click', (event) => {
			readingRenderer.handleClick(event);
		}, { capture: true });
		plugin.registerDomEvent(document, 'keydown', (event) => {
			readingRenderer.handleKeydown(event);
		}, { capture: true });
	};
	const applyEnabledState = (): void => {
		for (const document of getAppDocuments(plugin.app)) {
			const enabled = isEnabled();
			document.body.classList.toggle(ENABLED_BODY_CLASS, enabled);
			if (enabled) {
				const ratio = Math.max(
					1,
					document.defaultView?.devicePixelRatio ?? 1,
				);
				document.body.style.setProperty(
					LINE_THICKNESS_PROPERTY,
					`${Number((1 / ratio).toFixed(6))}px`,
				);
			} else {
				document.body.style.removeProperty(LINE_THICKNESS_PROPERTY);
			}
			registerDocument(document);
		}
	};

	registerClozeCommand(plugin, isEnabled);
	plugin.registerEditorExtension(createClozeEditorExtension(isEnabled));
	plugin.registerMarkdownPostProcessor((element) => {
		readingRenderer.apply(element);
	});
	plugin.registerEvent(
		plugin.app.workspace.on('window-open', () => {
			applyEnabledState();
			readingRenderer.refreshAll();
		}),
	);
	plugin.registerEvent(plugin.app.workspace.on('resize', applyEnabledState));
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
			document.body.style.removeProperty(LINE_THICKNESS_PROPERTY);
		}
	});
	applyEnabledState();

	return {
		refresh: () => {
			applyEnabledState();
			plugin.app.workspace.updateOptions();
			if (isEnabled()) {
				readingRenderer.refreshAll();
			} else {
				readingRenderer.clearAll();
			}
		},
	};
}
