import {
	MarkdownView,
	type Plugin,
	TFile,
} from 'obsidian';
import type { EditorView } from '@codemirror/view';
import { getAppDocuments } from '../../utils/app-documents';
import type { FeatureController } from '../controller';
import { registerSidenoteCommand } from './commands';
import { isCommandSurface } from './dom-utils';
import {
	createSidenoteEditorExtension,
	SidenoteEditCoordinator,
} from './editor-extension';
import { SidenoteLayoutController } from './layout';
import { SidenoteReadingRenderer } from './reading-renderer';
import type { SidenotePosition } from '../../settings';

const ENABLED_BODY_CLASS = 'editing-suite-sidenotes-enabled';

export function registerSidenotes(
	plugin: Plugin,
	isEnabled: () => boolean,
	getPosition: () => SidenotePosition,
): FeatureController {
	const layout = new SidenoteLayoutController(getPosition);
	const coordinator = new SidenoteEditCoordinator();
	const guardedDocuments = new WeakSet<Document>();
	const readingRenderer = new SidenoteReadingRenderer(
		plugin.app,
		isEnabled,
		layout,
	);
	const applyEnabledState = (): void => {
		for (const document of getAppDocuments(plugin.app)) {
			document.body.classList.toggle(ENABLED_BODY_CLASS, isEnabled());
			registerActiveEditorGuard(plugin, document, guardedDocuments);
		}
	};

	registerSidenoteCommand(
		plugin,
		isEnabled,
		(sourcePosition, containerEl) =>
			coordinator.request(sourcePosition, containerEl),
	);
	plugin.registerEditorExtension(createSidenoteEditorExtension({
		app: plugin.app,
		coordinator,
		getMarkdownView: (view) => getEditorMarkdownView(plugin, view),
		getSourcePath: (view) => {
			return getEditorMarkdownView(plugin, view)?.file?.path ?? '';
		},
		isEnabled,
		layout,
	}));
	plugin.registerMarkdownPostProcessor(
		(element, context) => readingRenderer.apply(element, context),
		-100,
	);
	plugin.registerEvent(plugin.app.vault.on('modify', (file) => {
		if (file instanceof TFile) {
			readingRenderer.invalidate(file.path);
		}
	}));
	plugin.registerEvent(plugin.app.workspace.on('resize', () => {
		layout.schedule();
	}));
	plugin.registerEvent(plugin.app.workspace.on('layout-change', () => {
		layout.schedule();
	}));
	plugin.registerEvent(plugin.app.workspace.on('window-open', () => {
		applyEnabledState();
	}));
	plugin.app.workspace.onLayoutReady(() => {
		applyEnabledState();
	});
	plugin.register(() => {
		coordinator.dispose();
		readingRenderer.clearAll();
		layout.dispose();
		for (const document of getAppDocuments(plugin.app)) {
			document.body.classList.remove(ENABLED_BODY_CLASS);
		}
	});
	applyEnabledState();

	return {
		refresh: () => {
			applyEnabledState();
			plugin.app.workspace.updateOptions();
			if (!isEnabled()) {
				readingRenderer.clearAll();
			}
			plugin.app.workspace.iterateAllLeaves((leaf) => {
				if (leaf.view instanceof MarkdownView) {
					leaf.view.previewMode.rerender(true);
				}
			});
			layout.schedule();
		},
	};
}

function registerActiveEditorGuard(
	plugin: Plugin,
	document: Document,
	guardedDocuments: WeakSet<Document>,
): void {
	if (guardedDocuments.has(document)) {
		return;
	}
	guardedDocuments.add(document);
	const guardedSourceViews = new WeakSet<HTMLElement>();
	let lastFocusedMarkdownView: MarkdownView | null = null;
	const activateMarkdownView = (markdownView: MarkdownView): void => {
		lastFocusedMarkdownView = markdownView;
		const current = plugin.app.workspace.activeEditor;
		const currentEditor = current?.editor as unknown as {
			cm?: { dom?: { isConnected?: boolean } };
		} | undefined;
		if (
			current &&
			current !== markdownView &&
			current.file === markdownView.file &&
			currentEditor?.cm?.dom?.isConnected === false
		) {
			try {
				current.editor = markdownView.editor;
			} catch {
				// Internal getter-only wrappers are replaced below.
			}
		}
		plugin.app.workspace.activeEditor = markdownView;
	};
	const findMainMarkdownView = (target: EventTarget | null): MarkdownView | null => {
		if (!(target instanceof document.defaultView!.Element)) {
			return null;
		}
		if (target.closest('.editing-suite-sidenote-cm-editor')) {
			return null;
		}
		const sourceView = target.closest<HTMLElement>(
			'.markdown-source-view.mod-cm6',
		);
		if (!sourceView) {
			return null;
		}
		let result: MarkdownView | null = null;
		plugin.app.workspace.iterateAllLeaves((leaf) => {
			if (
				!result &&
				leaf.view instanceof MarkdownView &&
				leaf.view.containerEl.contains(sourceView)
			) {
				result = leaf.view;
			}
		});
		return result;
	};
	const registerSourceViewKeyGuard = (
		sourceView: HTMLElement,
		markdownView: MarkdownView,
	): void => {
		if (guardedSourceViews.has(sourceView)) {
			return;
		}
		guardedSourceViews.add(sourceView);
		plugin.registerDomEvent(sourceView, 'keydown', () => {
			activateMarkdownView(markdownView);
		}, { capture: true });
	};
	const restoreFromFocus = (markdownView: MarkdownView): void => {
		const activeElement = document.activeElement;
		if (
			activeElement &&
			markdownView.containerEl.contains(activeElement) &&
			!activeElement.closest(
				'.editing-suite-sidenote-cm-editor',
			)
		) {
			activateMarkdownView(markdownView);
		}
	};
	plugin.registerDomEvent(document, 'pointerdown', (event) => {
		const markdownView = findMainMarkdownView(event.target);
		if (markdownView) {
			activateMarkdownView(markdownView);
			return;
		}
		if (
			lastFocusedMarkdownView &&
			plugin.app.workspace.getActiveViewOfType(MarkdownView) ===
				lastFocusedMarkdownView &&
			document.querySelector(
				'.editing-suite-sidenote-cm-editor',
			) === null &&
			event.target instanceof document.defaultView!.Element &&
			isCommandSurface(event.target)
		) {
			activateMarkdownView(lastFocusedMarkdownView);
		}
	}, { capture: true });
	plugin.registerDomEvent(document, 'focusin', (event) => {
		const markdownView = findMainMarkdownView(event.target);
		if (!markdownView) {
			return;
		}
		if (event.target instanceof document.defaultView!.Element) {
			const sourceView = event.target.closest<HTMLElement>(
				'.markdown-source-view.mod-cm6',
			);
			if (sourceView) {
				registerSourceViewKeyGuard(sourceView, markdownView);
			}
		}
		activateMarkdownView(markdownView);
		const window = document.defaultView;
		window?.queueMicrotask(() => restoreFromFocus(markdownView));
		window?.requestAnimationFrame(() => restoreFromFocus(markdownView));
	}, { capture: true });
}

function getEditorMarkdownView(
	plugin: Plugin,
	view: EditorView,
): MarkdownView | null {
	let markdownView: MarkdownView | null = null;
	plugin.app.workspace.iterateAllLeaves((leaf) => {
		if (
			!markdownView &&
			leaf.view instanceof MarkdownView &&
			leaf.view.containerEl.contains(view.dom)
		) {
			markdownView = leaf.view;
		}
	});
	return markdownView;
}
