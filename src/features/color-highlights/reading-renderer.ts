import type { App } from 'obsidian';
import { getAppDocuments } from '../../utils/app-documents';
import { isSuiteColor, type SuiteColor } from '../../utils/color-markers';
import {
	DEFAULT_HIGHLIGHT_COLOR,
	HIGHLIGHT_COLORS,
} from './constants';
import { detectHighlightPrefix } from './syntax';

const COLOR_CLASS_PREFIX = 'editing-suite-reading-highlight-';
const CLOZE_CLASS = 'editing-suite-reading-cloze';
const ORIGINAL_TEXT_DATA = 'editingSuiteOriginalText';
const ORIGINAL_NODE_DATA = 'editingSuiteOriginalFirstNode';
const TEXT_MUTATED_DATA = 'editingSuiteTextMutated';

function getFirstTextNode(element: HTMLElement): Text | null {
	const walker = element.ownerDocument.createTreeWalker(
		element,
		NodeFilter.SHOW_TEXT,
	);

	return walker.nextNode() as Text | null;
}

function removeColorClasses(element: HTMLElement): void {
	for (const color of HIGHLIGHT_COLORS) {
		element.classList.remove(`${COLOR_CLASS_PREFIX}${color}`);
	}
}

function restoreText(element: HTMLElement): void {
	if (element.dataset[TEXT_MUTATED_DATA] !== '1') {
		return;
	}

	const originalNodeText = element.dataset[ORIGINAL_NODE_DATA];
	const textNode = getFirstTextNode(element);
	if (originalNodeText !== undefined && textNode) {
		textNode.nodeValue = originalNodeText;
	}

	delete element.dataset[TEXT_MUTATED_DATA];
}

function clearStoredText(element: HTMLElement): void {
	delete element.dataset[ORIGINAL_TEXT_DATA];
	delete element.dataset[ORIGINAL_NODE_DATA];
	delete element.dataset[TEXT_MUTATED_DATA];
}

export class ReadingHighlightRenderer {
	constructor(
		private readonly app: App,
		private readonly isEnabled: () => boolean,
	) {}

	apply(rootElement: ParentNode): void {
		const marks = Array.from(
			rootElement.querySelectorAll<HTMLElement>('mark'),
		);
		if (rootElement.nodeType === 1 && (rootElement as Element).matches('mark')) {
			marks.unshift(rootElement as HTMLElement);
		}

		marks.forEach((markElement) => {
			removeColorClasses(markElement);
			restoreText(markElement);
			if (!this.isEnabled()) {
				clearStoredText(markElement);
				return;
			}
			if (markElement.classList.contains(CLOZE_CLASS)) {
				clearStoredText(markElement);
				return;
			}
			const nativeColor = getNativeHighlightColor(markElement);
			if (nativeColor) {
				markElement.classList.add(`${COLOR_CLASS_PREFIX}${nativeColor}`);
				clearStoredText(markElement);
				return;
			}

			const originalText =
				markElement.dataset[ORIGINAL_TEXT_DATA] ??
				(markElement.textContent ?? '');
			markElement.dataset[ORIGINAL_TEXT_DATA] = originalText;

			const prefix = detectHighlightPrefix(originalText);
			if (prefix.excluded) {
				markElement.dataset[ORIGINAL_TEXT_DATA] = originalText;
				return;
			}
			const color = prefix.color ?? DEFAULT_HIGHLIGHT_COLOR;
			markElement.classList.add(`${COLOR_CLASS_PREFIX}${color}`);
			if (prefix.emojiLength === 0) {
				clearStoredText(markElement);
				return;
			}

			const textNode = getFirstTextNode(markElement);
			if (!textNode) {
				return;
			}

			const nodeText = textNode.nodeValue ?? '';
			const nodePrefix = detectHighlightPrefix(nodeText);
			if (nodePrefix.emojiLength === 0) {
				return;
			}

			markElement.dataset[ORIGINAL_NODE_DATA] = nodeText;
			textNode.nodeValue =
				nodeText.slice(0, nodePrefix.emojiOffset) +
				nodeText.slice(
					nodePrefix.emojiOffset + nodePrefix.emojiLength,
				);
			markElement.dataset[TEXT_MUTATED_DATA] = '1';
		});
	}

	refreshAll(): void {
		for (const document of getAppDocuments(this.app)) {
			const previewElements = document.querySelectorAll<HTMLElement>(
				'.markdown-preview-view',
			);
			previewElements.forEach((previewElement) => {
				this.apply(previewElement);
			});
		}
	}

	clearAll(): void {
		for (const document of getAppDocuments(this.app)) {
			const markElements = document.querySelectorAll<HTMLElement>(
				'mark[class*="editing-suite-reading-highlight-"]',
			);
			markElements.forEach((markElement) => {
				removeColorClasses(markElement);
				restoreText(markElement);
				clearStoredText(markElement);
			});
		}
	}
}

function getNativeHighlightColor(element: HTMLElement): SuiteColor | null {
	const color = element.dataset.highlight ?? '';
	return isSuiteColor(color) ? color : null;
}
