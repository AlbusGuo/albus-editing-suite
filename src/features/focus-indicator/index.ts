import type { Plugin } from 'obsidian';
import { getAppDocuments } from '../../utils/app-documents';
import type { FeatureController } from '../controller';

const ENABLED_BODY_CLASS = 'editing-suite-focus-indicator-enabled';
const SUPPRESSED_BODY_CLASS = 'editing-suite-focus-indicator-suppressed';
const SIDENOTE_EDITOR_SELECTOR = '.editing-suite-sidenote-cm-editor';
const EDITING_SIDENOTE_SELECTOR =
	'.editing-suite-sidenote-margin[data-editing="true"]';

export function registerFocusIndicator(
	plugin: Plugin,
	isEnabled: () => boolean,
): FeatureController {
	const registeredDocuments = new WeakSet<Document>();
	const isSidenoteTarget = (
		document: Document,
		target: EventTarget | null,
	): boolean => {
		const ElementConstructor = document.defaultView?.Element;
		return Boolean(
			ElementConstructor &&
			target instanceof ElementConstructor &&
			target.closest(SIDENOTE_EDITOR_SELECTOR),
		);
	};
	const hasSidenoteEditorFocus = (document: Document): boolean => {
		return (
			document.querySelector(EDITING_SIDENOTE_SELECTOR) !== null ||
			isSidenoteTarget(document, document.activeElement) ||
			document.querySelector(
				`${SIDENOTE_EDITOR_SELECTOR}.cm-focused`,
			) !== null
		);
	};
	const applyDocumentState = (
		document: Document,
		forceSuppressed = false,
	): void => {
		const enabled = isEnabled();
		document.body.classList.toggle(ENABLED_BODY_CLASS, enabled);
		document.body.classList.toggle(
			SUPPRESSED_BODY_CLASS,
			enabled && (forceSuppressed || hasSidenoteEditorFocus(document)),
		);
	};
	const registerDocument = (document: Document): void => {
		if (registeredDocuments.has(document)) {
			return;
		}
		registeredDocuments.add(document);
		plugin.registerDomEvent(document, 'pointerdown', (event) => {
			if (isSidenoteTarget(document, event.target)) {
				applyDocumentState(document, true);
			}
		}, { capture: true });
		plugin.registerDomEvent(document, 'focusin', (event) => {
			applyDocumentState(
				document,
				isSidenoteTarget(document, event.target),
			);
		}, { capture: true });
		plugin.registerDomEvent(document, 'focusout', () => {
			document.defaultView?.queueMicrotask(() => {
				applyDocumentState(document);
			});
		}, { capture: true });
	};
	const applyState = (): void => {
		for (const document of getAppDocuments(plugin.app)) {
			registerDocument(document);
			applyDocumentState(document);
		}
	};

	plugin.registerEvent(plugin.app.workspace.on('window-open', applyState));
	plugin.app.workspace.onLayoutReady(applyState);
	plugin.register(() => {
		for (const document of getAppDocuments(plugin.app)) {
			document.body.classList.remove(
				ENABLED_BODY_CLASS,
				SUPPRESSED_BODY_CLASS,
			);
		}
	});
	applyState();

	return { refresh: applyState };
}
