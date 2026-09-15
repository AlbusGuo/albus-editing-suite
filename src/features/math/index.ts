import { MarkdownView, type Plugin } from 'obsidian';
import { getAppDocuments } from '../../utils/app-documents';
import type { FeatureController } from '../controller';
import {
	clearTaggedMathSpacing,
	markTaggedMathSpacing,
} from './tagged-spacing';

const ENABLED_BODY_CLASS = 'editing-suite-math-enabled';
const MARGIN_BODY_CLASS = 'editing-suite-math-margin-enabled';
const OVERFLOW_BODY_CLASS = 'editing-suite-math-overflow-enabled';
const DISPLAY_MARGIN_PROPERTY = '--editing-suite-display-math-margin';
const OVERFLOW_MARKER_ATTRIBUTE = 'data-editing-suite-math-overflow';

export function registerMathAdjustments(
	plugin: Plugin,
	getDisplayMargin: () => number | null,
	getOverflowScroll: () => boolean,
): FeatureController {
	const originalOverflow = new Map<HTMLElement, string | null>();
	const observers = new Map<Document, MutationObserver>();
	const cleanupDisconnected = (): void => {
		for (const container of originalOverflow.keys()) {
			if (!container.isConnected) {
				originalOverflow.delete(container);
			}
		}
	};

	const applyOverflow = (root: ParentNode): void => {
		if (!getOverflowScroll()) {
			return;
		}
		cleanupDisconnected();
		for (const container of collectDisplayMath(root)) {
			if (!originalOverflow.has(container)) {
				originalOverflow.set(
					container,
					container.getAttribute('overflow'),
				);
			}
			container.setAttribute(OVERFLOW_MARKER_ATTRIBUTE, '');
			container.setAttribute('overflow', 'scroll');
		}
	};

	const restoreOverflow = (): void => {
		for (const [container, overflow] of originalOverflow) {
			container.removeAttribute(OVERFLOW_MARKER_ATTRIBUTE);
			if (overflow === null) {
				container.removeAttribute('overflow');
			} else {
				container.setAttribute('overflow', overflow);
			}
		}
		originalOverflow.clear();
	};
	const stopObservers = (): void => {
		for (const observer of observers.values()) {
			observer.disconnect();
		}
		observers.clear();
	};

	const registerDocument = (document: Document): void => {
		if (observers.has(document)) {
			return;
		}
		const Observer = document.defaultView?.MutationObserver;
		if (!Observer) {
			return;
		}
		const observer = new Observer((records) => {
			if (!getOverflowScroll()) {
				return;
			}
			cleanupDisconnected();
			for (const record of records) {
				for (const node of Array.from(record.addedNodes)) {
					if (node.nodeType === 1) {
						applyOverflow(node as Element);
					}
				}
			}
		});
		observer.observe(document.body, {
			childList: true,
			subtree: true,
		});
		observers.set(document, observer);
	};

	const applyState = (): void => {
		const overflowEnabled = getOverflowScroll();
		if (!overflowEnabled) {
			stopObservers();
			restoreOverflow();
		}
		for (const document of getAppDocuments(plugin.app)) {
			if (overflowEnabled) {
				registerDocument(document);
			}
			document.body.classList.add(ENABLED_BODY_CLASS);
			const displayMargin = getDisplayMargin();
			document.body.classList.toggle(
				MARGIN_BODY_CLASS,
				displayMargin !== null,
			);
			document.body.classList.toggle(
				OVERFLOW_BODY_CLASS,
				overflowEnabled,
			);
			if (displayMargin === null) {
				document.body.style.removeProperty(DISPLAY_MARGIN_PROPERTY);
			} else {
				document.body.style.setProperty(
					DISPLAY_MARGIN_PROPERTY,
					`${displayMargin}em`,
				);
			}
			applyOverflow(document);
		}
	};

	plugin.registerEvent(plugin.app.workspace.on('window-open', () => {
		applyState();
	}));
	plugin.registerMarkdownPostProcessor(async (element, context) => {
		applyOverflow(element);
		const info = context.getSectionInfo(element);
		if (!info?.text.includes('\\tag')) {
			return;
		}
		const openSource = getOpenMarkdownSource(plugin, context.sourcePath);
		if (openSource !== null) {
			markTaggedMathSpacing(element, info, openSource);
			return;
		}
		const file = plugin.app.vault.getFileByPath(context.sourcePath);
		if (!file) {
			return;
		}
		markTaggedMathSpacing(
			element,
			info,
			await plugin.app.vault.cachedRead(file),
		);
	});
	plugin.app.workspace.onLayoutReady(() => {
		applyState();
	});
	plugin.register(() => {
		restoreOverflow();
		stopObservers();
		for (const document of getAppDocuments(plugin.app)) {
			clearTaggedMathSpacing(document);
			document.body.classList.remove(
				ENABLED_BODY_CLASS,
				MARGIN_BODY_CLASS,
				OVERFLOW_BODY_CLASS,
			);
			document.body.style.removeProperty(DISPLAY_MARGIN_PROPERTY);
		}
	});
	applyState();

	return { refresh: applyState };
}

function collectDisplayMath(root: ParentNode): HTMLElement[] {
	const containers = Array.from(root.querySelectorAll<HTMLElement>(
		'mjx-container[display]',
	));
	if (
		root.nodeType === 1 &&
		(root as Element).matches('mjx-container[display]')
	) {
		containers.unshift(root as HTMLElement);
	}
	return containers;
}

function getOpenMarkdownSource(
	plugin: Plugin,
	sourcePath: string,
): string | null {
	let source: string | null = null;
	plugin.app.workspace.iterateAllLeaves((leaf) => {
		if (
			source === null &&
			leaf.view instanceof MarkdownView &&
			leaf.view.file?.path === sourcePath
		) {
			source = leaf.view.getViewData();
		}
	});
	return source;
}
