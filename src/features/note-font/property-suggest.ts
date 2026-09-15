import type { Plugin } from 'obsidian';
import { getAppDocuments } from '../../utils/app-documents';
import {
	FontSuggest,
	type FontInputElement,
} from './font-suggest';

const FONT_PROPERTY_KEYS = new Set(['font', '字体']);

export function registerFontPropertySuggestions(plugin: Plugin): () => void {
	const registeredDocuments = new WeakSet<Document>();
	const suggestions = new Map<FontInputElement, FontSuggest>();

	const cleanupDisconnected = (): void => {
		for (const [input, suggest] of suggestions) {
			if (!input.isConnected) {
				suggest.destroy();
				suggestions.delete(input);
			}
		}
	};

	const attach = (input: FontInputElement): void => {
		cleanupDisconnected();
		let suggest = suggestions.get(input);
		if (!suggest) {
			suggest = new FontSuggest(plugin.app, input);
			suggest.onSelect((font) => {
				suggest?.setValue(font);
				dispatchValueChange(input);
				suggest?.close();
			});
			suggestions.set(input, suggest);
			input.classList.add('editing-suite-font-property-input');
		}
	};

	const registerDocument = (document: Document): void => {
		if (registeredDocuments.has(document)) {
			return;
		}
		registeredDocuments.add(document);
		plugin.registerDomEvent(document, 'focusin', (event) => {
			const input = findFontPropertyInput(event.target, document);
			if (input) {
				attach(input);
			}
		}, { capture: true });
	};

	const registerDocuments = (): void => {
		for (const document of getAppDocuments(plugin.app)) {
			registerDocument(document);
		}
	};

	plugin.registerEvent(plugin.app.workspace.on('window-open', () => {
		registerDocuments();
	}));
	plugin.app.workspace.onLayoutReady(registerDocuments);
	registerDocuments();

	return () => {
		for (const [input, suggest] of suggestions) {
			suggest.destroy();
			input.classList.remove('editing-suite-font-property-input');
		}
		suggestions.clear();
	};
}

function findFontPropertyInput(
	target: EventTarget | null,
	document: Document,
): FontInputElement | null {
	const ElementConstructor = document.defaultView?.Element;
	if (!ElementConstructor || !(target instanceof ElementConstructor)) {
		return null;
	}
	const element = target;
	const valueContainer = element.closest<HTMLElement>(
		'.metadata-property-value',
	);
	const property = valueContainer?.closest<HTMLElement>(
		'.metadata-property',
	);
	if (!valueContainer || !property || !isFontProperty(property)) {
		return null;
	}
	const editable = element.closest<HTMLElement>(
		'input, div[contenteditable="true"]',
	);
	if (!editable || !valueContainer.contains(editable)) {
		return null;
	}
	const InputConstructor = document.defaultView?.HTMLInputElement;
	if (InputConstructor && editable.instanceOf(InputConstructor)) {
		if (editable.type !== 'text' && editable.type !== 'search') {
			return null;
		}
		return editable;
	}
	const DivConstructor = document.defaultView?.HTMLDivElement;
	return DivConstructor && editable.instanceOf(DivConstructor)
		? editable
		: null;
}

function isFontProperty(property: HTMLElement): boolean {
	const dataKey = property.dataset.propertyKey?.trim();
	if (dataKey && FONT_PROPERTY_KEYS.has(dataKey.toLocaleLowerCase())) {
		return true;
	}
	const keyElement = property.querySelector<HTMLElement>(
		'.metadata-property-key-input',
	);
	const InputConstructor = property.ownerDocument.defaultView
		?.HTMLInputElement;
	const key = InputConstructor && keyElement?.instanceOf(InputConstructor)
		? keyElement.value
		: keyElement?.textContent ?? '';
	return FONT_PROPERTY_KEYS.has(key.trim().toLocaleLowerCase());
}

function dispatchValueChange(input: FontInputElement): void {
	const ownerWindow = input.ownerDocument.defaultView;
	const EventConstructor = ownerWindow?.Event ?? Event;
	input.dispatchEvent(new EventConstructor('input', { bubbles: true }));
	input.dispatchEvent(new EventConstructor('change', { bubbles: true }));
}
