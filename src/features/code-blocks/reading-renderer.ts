import type { App } from 'obsidian';
import { getAppDocuments } from '../../utils/app-documents';
import { createCodeHeader } from './header-renderer';
import { resolveCodeLanguage } from './language-registry';

const BLOCK_CLASS = 'editing-suite-reading-code-block';
const CODE_CLASS = 'editing-suite-reading-code-content';
const HEADER_CLASS = 'editing-suite-reading-code-header';
const LINE_CLASS = 'editing-suite-reading-code-line';
const LINE_CONTENT_CLASS = 'editing-suite-reading-code-line-content';

interface CodeBlockElements {
	code: HTMLElement;
	pre: HTMLElement;
}

export class CodeBlockReadingRenderer {
	private readonly observers = new WeakMap<HTMLElement, MutationObserver>();

	constructor(
		private readonly app: App,
		private readonly isEnabled: () => boolean,
	) {}

	apply(root: ParentNode): void {
		if (!this.isEnabled()) {
			this.clearDecorated(root);
			return;
		}

		for (const { code, pre } of collectCodeBlocks(root)) {
			if (shouldExclude(pre, code)) {
				if (pre.classList.contains(BLOCK_CLASS)) {
					this.clearElement(pre);
				}
				continue;
			}
			const language = resolveCodeLanguage(getLanguageToken(code, pre));
			const lineCount = countCodeLines(code.textContent ?? '');
			const signature = `${language.canonical}:${lineCount}`;
			if (
				pre.classList.contains(BLOCK_CLASS) &&
				pre.dataset.editingSuiteCodeSignature === signature &&
				pre.querySelector(`:scope > .${HEADER_CLASS}`) &&
				code.querySelector(`:scope > .${LINE_CLASS}`)
			) {
				this.observeBlock(pre);
				continue;
			}
			this.clearElement(pre);

			const digits = Math.min(6, Math.max(1, String(lineCount).length));
			const header = createCodeHeader(pre.ownerDocument, language);
			header.classList.add(HEADER_CLASS);
			wrapCodeLines(code);

			pre.classList.add(
				BLOCK_CLASS,
				`editing-suite-code-digits-${digits}`,
				`editing-suite-code-language-${language.group}`,
			);
			code.classList.add(CODE_CLASS);
			pre.dataset.editingSuiteCodeLanguage = language.canonical;
			pre.dataset.editingSuiteCodeSignature = signature;
			pre.insertBefore(header, pre.firstChild);
			this.observeBlock(pre);
		}
	}

	refreshAll(): void {
		for (const document of getAppDocuments(this.app)) {
			document
				.querySelectorAll<HTMLElement>(
					'.markdown-preview-view, .markdown-source-view .cm-embed-block',
				)
				.forEach((element) => this.apply(element));
		}
	}

	clearAll(): void {
		for (const document of getAppDocuments(this.app)) {
			document
				.querySelectorAll<HTMLElement>(`pre.${BLOCK_CLASS}`)
				.forEach((element) => this.clearElement(element));
		}
	}

	private clearElement(pre: HTMLElement): void {
		this.stopObservingBlock(pre);
		pre
			.querySelectorAll<HTMLElement>(
				`:scope > .${HEADER_CLASS}`,
			)
			.forEach((element) => element.remove());
		pre.classList.remove(BLOCK_CLASS);
		for (const className of Array.from(pre.classList)) {
			if (
				className.startsWith('editing-suite-code-digits-') ||
				className.startsWith('editing-suite-code-language-')
			) {
				pre.classList.remove(className);
			}
		}
		const code = pre.querySelector<HTMLElement>(':scope > code');
		if (code) {
			unwrapCodeLines(code);
			code.classList.remove(CODE_CLASS);
		}
		delete pre.dataset.editingSuiteCodeLanguage;
		delete pre.dataset.editingSuiteCodeSignature;
	}

	private observeBlock(pre: HTMLElement): void {
		if (this.observers.has(pre)) {
			return;
		}
		const Observer = pre.ownerDocument.defaultView?.MutationObserver;
		if (!Observer) {
			return;
		}
		const observer = new Observer(() => {
			if (!pre.isConnected || !this.isEnabled()) {
				this.stopObservingBlock(pre);
				return;
			}
			const code = pre.querySelector<HTMLElement>(':scope > code');
			const isComplete =
				pre.querySelector(`:scope > .${HEADER_CLASS}`) !== null &&
				code !== null &&
				code.querySelector(`:scope > .${LINE_CLASS}`) !== null;
			if (!isComplete) {
				this.apply(pre);
			}
		});
		observer.observe(pre, {
			childList: true,
			characterData: true,
			subtree: true,
		});
		this.observers.set(pre, observer);
	}

	private stopObservingBlock(pre: HTMLElement): void {
		const observer = this.observers.get(pre);
		if (!observer) {
			return;
		}
		observer.disconnect();
		this.observers.delete(pre);
	}

	private clearDecorated(root: ParentNode): void {
		const decorated = Array.from(
			root.querySelectorAll<HTMLElement>(`pre.${BLOCK_CLASS}`),
		);
		const rootElement = root as Element;
		if (rootElement.matches?.(`pre.${BLOCK_CLASS}`)) {
			decorated.unshift(rootElement as HTMLElement);
		}
		decorated.forEach((element) => this.clearElement(element));
	}

}

function wrapCodeLines(code: HTMLElement): void {
	const lines = splitNodesIntoLines(Array.from(code.childNodes));
	if (
		lines.length > 1 &&
		lines.at(-1)?.length === 0 &&
		endsWithLineBreak(code.textContent ?? '')
	) {
		lines.pop();
	}

	const fragment = code.ownerDocument.createDocumentFragment();
	for (const [index, lineNodes] of lines.entries()) {
		if (index > 0) {
			fragment.append(code.ownerDocument.createTextNode('\n'));
		}
		const line = code.ownerDocument.createElement('span');
		const content = code.ownerDocument.createElement('span');
		line.className = LINE_CLASS;
		line.dataset.lineNumber = String(index + 1);
		content.className = LINE_CONTENT_CLASS;
		content.append(...lineNodes);
		line.append(content);
		fragment.append(line);
	}
	code.replaceChildren(fragment);
}

function unwrapCodeLines(code: HTMLElement): void {
	const lines = Array.from(code.children).filter(
		(element): element is HTMLElement =>
			element.classList.contains(LINE_CLASS),
	);
	if (lines.length === 0 || lines.length !== code.children.length) {
		return;
	}
	const contents = lines.map((line) =>
		line.querySelector<HTMLElement>(`:scope > .${LINE_CONTENT_CLASS}`),
	);
	if (contents.some((content) => content === null)) {
		return;
	}

	const fragment = code.ownerDocument.createDocumentFragment();
	for (const [index, content] of contents.entries()) {
		if (index > 0) {
			fragment.append(code.ownerDocument.createTextNode('\n'));
		}
		while (content?.firstChild) {
			fragment.append(content.firstChild);
		}
	}
	code.replaceChildren(fragment);
}

function splitNodesIntoLines(nodes: Node[]): Node[][] {
	const lines: Node[][] = [[]];
	for (const node of nodes) {
		mergeLines(lines, splitNodeIntoLines(node));
	}
	return lines;
}

function splitNodeIntoLines(node: Node): Node[][] {
	if (node.nodeType === 3) {
		const text = node.textContent ?? '';
		const parts = text.split(/\r\n|\r|\n/);
		return parts.map((part) => {
			if (part.length === 0) {
				return [];
			}
			const clone = node.cloneNode(false);
			clone.textContent = part;
			return [clone];
		});
	}

	if (node.nodeType === 1) {
		const element = node as HTMLElement;
		const childLines = splitNodesIntoLines(Array.from(element.childNodes));
		return childLines.map((children) => {
			if (children.length === 0) {
				return [];
			}
			const clone = element.cloneNode(false) as HTMLElement;
			clone.append(...children);
			return [clone];
		});
	}

	return [[node.cloneNode(true)]];
}

function mergeLines(target: Node[][], addition: Node[][]): void {
	const targetLine = target.at(-1);
	const firstAddition = addition[0];
	if (!targetLine || !firstAddition) {
		return;
	}
	targetLine.push(...firstAddition);
	for (let index = 1; index < addition.length; index++) {
		const line = addition[index];
		if (line) {
			target.push(line);
		}
	}
}

function endsWithLineBreak(text: string): boolean {
	return text.endsWith('\n') || text.endsWith('\r');
}

function collectCodeBlocks(root: ParentNode): CodeBlockElements[] {
	const blocks = Array.from(
		root.querySelectorAll<HTMLElement>('pre:not(.frontmatter)'),
	);
	const rootElement = root as Element;
	if (rootElement.matches?.('pre:not(.frontmatter)')) {
		blocks.unshift(rootElement as HTMLElement);
	}
	const elements: CodeBlockElements[] = [];
	for (const pre of blocks) {
		const code = pre.querySelector<HTMLElement>(':scope > code');
		if (code) {
			elements.push({ code, pre });
		}
	}
	return elements;
}

function shouldExclude(pre: HTMLElement, code: HTMLElement): boolean {
	return (
		code.classList.contains('language-output') ||
		pre.matches('.frontmatter')
	);
}

function getLanguageToken(code: HTMLElement, pre: HTMLElement): string {
	for (let index = 0; index < code.classList.length; index++) {
		const className = code.classList.item(index);
		if (!className) {
			continue;
		}
		if (className.startsWith('language-')) {
			return className.slice('language-'.length);
		}
	}
	for (let index = 0; index < pre.classList.length; index++) {
		const className = pre.classList.item(index);
		if (!className) {
			continue;
		}
		if (className.startsWith('language-')) {
			return className.slice('language-'.length);
		}
	}
	return '';
}

function countCodeLines(text: string): number {
	let lineCount = 1;
	for (let index = 0; index < text.length; index++) {
		const character = text.charCodeAt(index);
		if (character === 13) {
			lineCount++;
			if (text.charCodeAt(index + 1) === 10) {
				index++;
			}
		} else if (character === 10) {
			lineCount++;
		}
	}
	const lastCharacter = text.charCodeAt(text.length - 1);
	if (lastCharacter === 10 || lastCharacter === 13) {
		lineCount--;
	}
	return Math.max(1, lineCount);
}
