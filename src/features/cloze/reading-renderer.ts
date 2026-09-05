import type { App } from 'obsidian';
import { getAppDocuments } from '../../utils/app-documents';
import { createClozeLine } from './line-element';
import { CLOZE_EMOJI } from './syntax';

const CLOZE_CLASS = 'editing-suite-reading-cloze';
const ANSWER_CLASS = 'editing-suite-reading-cloze-answer';
const REVEALED_CLASS = 'is-revealed';
const ORIGINAL_NODE_DATA = 'editingSuiteClozeOriginalNode';

function getFirstTextNode(element: HTMLElement): Text | null {
	const walker = element.ownerDocument.createTreeWalker(
		element,
		NodeFilter.SHOW_TEXT,
	);

	return walker.nextNode() as Text | null;
}

export class ClozeReadingRenderer {
	constructor(
		private readonly app: App,
		private readonly isEnabled: () => boolean,
	) {}

	apply(rootElement: ParentNode): void {
		const clozeElements = rootElement.querySelectorAll<HTMLElement>('mark');

		clozeElements.forEach((element) => {
			if (element.classList.contains(CLOZE_CLASS)) {
				if (!this.isEnabled()) {
					this.clearElement(element);
				}
				return;
			}
			if (!this.isEnabled()) {
				return;
			}

			const textNode = getFirstTextNode(element);
			const nodeText = textNode?.nodeValue ?? '';
			if (
				!textNode ||
				!nodeText.startsWith(CLOZE_EMOJI) ||
				textNode.parentElement?.closest('code, pre')
			) {
				return;
			}

			element.dataset[ORIGINAL_NODE_DATA] = nodeText;
			textNode.nodeValue = nodeText.slice(CLOZE_EMOJI.length);
			const answerElement = element.ownerDocument.createElement('span');
			answerElement.className = ANSWER_CLASS;
			while (element.firstChild) {
				answerElement.appendChild(element.firstChild);
			}
			element.append(
				answerElement,
				createClozeLine(element.ownerDocument),
			);
			element.classList.add(CLOZE_CLASS);
			element.setAttribute('role', 'button');
			element.setAttribute('tabindex', '0');
			element.setAttribute('aria-expanded', 'false');
			element.setAttribute('aria-label', '显示挖空内容');

		});
	}

	handleClick(event: MouseEvent): void {
		const element = this.findEventElement(event);
		if (!element) {
			return;
		}
		if (
			element.classList.contains(REVEALED_CLASS) &&
			(event.target as Element | null)?.closest('a')
		) {
			return;
		}
		event.preventDefault();
		this.toggleElement(element);
	}

	handleKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Enter' && event.key !== ' ') {
			return;
		}
		const element = this.findEventElement(event);
		if (!element) {
			return;
		}
		event.preventDefault();
		this.toggleElement(element);
	}

	refreshAll(): void {
		for (const document of getAppDocuments(this.app)) {
			document
				.querySelectorAll<HTMLElement>('.markdown-preview-view')
				.forEach((previewElement) => this.apply(previewElement));
		}
	}

	clearAll(): void {
		for (const document of getAppDocuments(this.app)) {
			document
				.querySelectorAll<HTMLElement>(`.${CLOZE_CLASS}`)
				.forEach((element) => this.clearElement(element));
		}
	}

	private toggleElement(element: HTMLElement): void {
		const revealed = element.classList.toggle(REVEALED_CLASS);
		element.setAttribute('aria-expanded', String(revealed));
		element.setAttribute(
			'aria-label',
			revealed ? '隐藏挖空内容' : '显示挖空内容',
		);
	}

	private findEventElement(event: Event): HTMLElement | null {
		if (!this.isEnabled()) {
			return null;
		}
		const target = event.target as Element | null;
		return target?.closest<HTMLElement>(`.${CLOZE_CLASS}`) ?? null;
	}

	private clearElement(element: HTMLElement): void {
		const answerElement = element.querySelector<HTMLElement>(
			`:scope > .${ANSWER_CLASS}`,
		);
		element
			.querySelector<SVGSVGElement>(':scope > .editing-suite-cloze-line')
			?.remove();
		if (answerElement) {
			while (answerElement.firstChild) {
				element.insertBefore(answerElement.firstChild, answerElement);
			}
			answerElement.remove();
		}

		const textNode = getFirstTextNode(element);
		const originalNode = element.dataset[ORIGINAL_NODE_DATA];
		if (textNode && originalNode !== undefined) {
			textNode.nodeValue = originalNode;
		}
		delete element.dataset[ORIGINAL_NODE_DATA];
		element.classList.remove(CLOZE_CLASS, REVEALED_CLASS);
		element.removeAttribute('role');
		element.removeAttribute('tabindex');
		element.removeAttribute('aria-expanded');
		element.removeAttribute('aria-label');
	}
}
