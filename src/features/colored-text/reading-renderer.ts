import type { App } from 'obsidian';
import { getAppDocuments } from '../../utils/app-documents';
import { COLORED_TEXT_COLOR_KEYS } from './constants';
import { detectColoredTextPrefix } from './syntax';

const COLOR_CLASS_PREFIX = 'editing-suite-reading-colored-text-';
const ORIGINAL_NODE_DATA = 'editingSuiteColoredTextOriginalNode';
const TEXT_MUTATED_DATA = 'editingSuiteColoredTextMutated';

interface ColoredTextElement {
	container: HTMLElement;
}

export class ColoredTextReadingRenderer {
	constructor(
		private readonly app: App,
		private readonly isEnabled: () => boolean,
	) {}

	apply(root: ParentNode): void {
		for (const element of collectColoredTextElements(root)) {
			this.clearElement(element);
			if (!this.isEnabled()) {
				continue;
			}
			const textNode = getFirstTextNode(element.container);
			const nodeText = textNode?.nodeValue ?? '';
			const prefix = detectColoredTextPrefix(nodeText);
			if (!textNode || !prefix.color || prefix.emojiLength === 0) {
				continue;
			}
			element.container.classList.add(
				`${COLOR_CLASS_PREFIX}${prefix.color}`,
			);
			element.container.dataset[ORIGINAL_NODE_DATA] = nodeText;
			textNode.nodeValue =
				nodeText.slice(0, prefix.emojiOffset) +
				nodeText.slice(prefix.emojiOffset + prefix.emojiLength);
			element.container.dataset[TEXT_MUTATED_DATA] = '1';
		}
	}

	refreshAll(): void {
		for (const document of getAppDocuments(this.app)) {
			document
				.querySelectorAll<HTMLElement>('.markdown-preview-view')
				.forEach((preview) => this.apply(preview));
		}
	}

	clearAll(): void {
		for (const document of getAppDocuments(this.app)) {
			document
				.querySelectorAll<HTMLElement>(
					`strong[class*="${COLOR_CLASS_PREFIX}"]`,
				)
				.forEach((container) => this.clearElement({ container }));
		}
	}

	private clearElement(element: ColoredTextElement): void {
		for (const color of COLORED_TEXT_COLOR_KEYS) {
			element.container.classList.remove(`${COLOR_CLASS_PREFIX}${color}`);
		}
		if (element.container.dataset[TEXT_MUTATED_DATA] === '1') {
			const textNode = getFirstTextNode(element.container);
			const original = element.container.dataset[ORIGINAL_NODE_DATA];
			if (textNode && original !== undefined) {
				textNode.nodeValue = original;
			}
		}
		delete element.container.dataset[ORIGINAL_NODE_DATA];
		delete element.container.dataset[TEXT_MUTATED_DATA];
	}
}

function collectColoredTextElements(root: ParentNode): ColoredTextElement[] {
	const containers = Array.from(root.querySelectorAll<HTMLElement>('strong'));
	if (root.nodeType === 1 && (root as Element).matches('strong')) {
		containers.unshift(root as HTMLElement);
	}
	const elements: ColoredTextElement[] = [];
	for (const container of containers) {
		elements.push({ container });
	}
	return elements;
}

function getFirstTextNode(element: HTMLElement): Text | null {
	const walker = element.ownerDocument.createTreeWalker(
		element,
		NodeFilter.SHOW_TEXT,
	);
	return walker.nextNode() as Text | null;
}
