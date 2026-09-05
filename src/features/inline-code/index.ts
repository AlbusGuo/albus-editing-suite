import type { Plugin } from 'obsidian';
import { getAppDocuments } from '../../utils/app-documents';
import type { FeatureController } from '../controller';

const ENABLED_BODY_CLASS = 'editing-suite-inline-code-enabled';
const COPIED_CLASS = 'editing-suite-inline-code-copied';
const READING_CODE_SELECTOR = '.markdown-preview-view :not(pre) > code';
const EDITOR_CODE_SELECTOR =
	'.markdown-source-view.mod-cm6 .cm-inline-code:not(.cm-formatting)';
const FEEDBACK_DURATION = 1000;

interface FeedbackTimer {
	id: number;
	window: Window;
}

export function registerInlineCode(
	plugin: Plugin,
	isEnabled: () => boolean,
): FeatureController {
	const registeredDocuments = new WeakSet<Document>();
	const feedbackTimers = new Map<HTMLElement, FeedbackTimer>();

	const clearFeedback = (): void => {
		for (const [element, timer] of feedbackTimers) {
			timer.window.clearTimeout(timer.id);
			element.classList.remove(COPIED_CLASS);
		}
		feedbackTimers.clear();
	};

	const showCopiedFeedback = (element: HTMLElement): void => {
		const window = element.ownerDocument.defaultView;
		if (!window) {
			return;
		}
		const previous = feedbackTimers.get(element);
		if (previous) {
			previous.window.clearTimeout(previous.id);
		}
		element.classList.add(COPIED_CLASS);
		const id = window.setTimeout(() => {
			element.classList.remove(COPIED_CLASS);
			feedbackTimers.delete(element);
		}, FEEDBACK_DURATION);
		feedbackTimers.set(element, { id, window });
	};

	const findTarget = (
		event: Event,
		document: Document,
		selector: string,
	): HTMLElement | null => {
		const HTMLElementClass = document.defaultView?.HTMLElement;
		if (!HTMLElementClass || !(event.target instanceof HTMLElementClass)) {
			return null;
		}
		const element = event.target.closest<HTMLElement>(selector);
		if (
			!element ||
			element.closest('pre') ||
			element.closest('.HyperMD-codeblock')
		) {
			return null;
		}
		return element;
	};

	const copyElement = async (element: HTMLElement): Promise<void> => {
		const text = element.textContent;
		const clipboard = element.ownerDocument.defaultView?.navigator.clipboard;
		if (!text || !clipboard) {
			return;
		}
		try {
			await clipboard.writeText(text);
		} catch {
			return;
		}
		if (element.isConnected && isEnabled()) {
			showCopiedFeedback(element);
		}
	};

	const handlePointerDown = (
		event: PointerEvent,
		document: Document,
	): void => {
		if (!isEnabled() || event.button !== 0 || !event.isPrimary) {
			return;
		}
		const element = findTarget(event, document, EDITOR_CODE_SELECTOR);
		if (!element) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		void copyElement(element);
	};

	const handleClick = (event: MouseEvent, document: Document): void => {
		if (!isEnabled() || event.button !== 0) {
			return;
		}
		if (findTarget(event, document, EDITOR_CODE_SELECTOR)) {
			event.preventDefault();
			event.stopPropagation();
			return;
		}
		const element = findTarget(event, document, READING_CODE_SELECTOR);
		if (!element) {
			return;
		}
		const selection = document.getSelection();
		if (selection && !selection.isCollapsed) {
			return;
		}
		void copyElement(element);
	};

	const registerDocument = (document: Document): void => {
		if (registeredDocuments.has(document)) {
			return;
		}
		registeredDocuments.add(document);
		plugin.registerDomEvent(document, 'pointerdown', (event) => {
			handlePointerDown(event, document);
		}, { capture: true });
		plugin.registerDomEvent(document, 'click', (event) => {
			handleClick(event, document);
		}, { capture: true });
	};

	const applyState = (): void => {
		if (!isEnabled()) {
			clearFeedback();
		}
		for (const document of getAppDocuments(plugin.app)) {
			document.body.classList.toggle(ENABLED_BODY_CLASS, isEnabled());
			registerDocument(document);
		}
	};

	plugin.registerEvent(plugin.app.workspace.on('window-open', applyState));
	plugin.app.workspace.onLayoutReady(applyState);
	plugin.register(() => {
		clearFeedback();
		for (const document of getAppDocuments(plugin.app)) {
			document.body.classList.remove(ENABLED_BODY_CLASS);
		}
	});
	applyState();

	return { refresh: applyState };
}
