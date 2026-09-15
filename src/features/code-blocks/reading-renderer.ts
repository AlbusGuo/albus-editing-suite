import type { App } from 'obsidian';
import { getAppDocuments } from '../../utils/app-documents';
import { createCodeHeader } from './header-renderer';
import { resolveCodeLanguage } from './language-registry';
import {
	hasCompleteReadingLineAnchors,
	insertReadingLineAnchors,
	READING_CODE_CLASS,
	removeReadingLineAnchors,
} from './reading-line-numbers';

const BLOCK_CLASS = 'editing-suite-reading-code-block';
const HEADER_CLASS = 'editing-suite-reading-code-header';

interface BlockState {
	code: HTMLElement;
	lineCount: number;
	observer: MutationObserver | null;
}

interface ReadingRootState {
	frame: number | null;
	observer: MutationObserver | null;
	pendingBlocks: Set<HTMLElement>;
}

interface CodeBlockElements {
	code: HTMLElement;
	pre: HTMLElement;
}

export class CodeBlockReadingRenderer {
	private readonly states = new WeakMap<HTMLElement, BlockState>();
	private readonly readingRoots = new Map<HTMLElement, ReadingRootState>();

	constructor(
		private readonly app: App,
		private readonly isEnabled: () => boolean,
	) {}

	apply(root: ParentNode): void {
		if (!this.isEnabled()) {
			this.clearDecorated(root);
			return;
		}
		this.observeReadingRoot(root);

		for (const { code, pre } of collectCodeBlocks(root)) {
			if (shouldExclude(pre, code)) {
				this.clearElement(pre);
				continue;
			}
			const current = this.states.get(pre);
			if (
				current?.code === code &&
				hasCompleteReadingLineAnchors(code, current.lineCount) &&
				pre.querySelector(`:scope > .${HEADER_CLASS}`)
			) {
				resetHorizontalScroll(pre, code);
				continue;
			}

			this.clearElement(pre);
			const language = resolveCodeLanguage(getLanguageToken(code, pre));
			const lineCount = insertReadingLineAnchors(code);
			const digits = Math.min(6, Math.max(1, String(lineCount).length));
			const header = createCodeHeader(pre.ownerDocument, language);
			header.classList.add(HEADER_CLASS);
			pre.classList.add(
				BLOCK_CLASS,
				`editing-suite-code-digits-${digits}`,
				`editing-suite-code-language-${language.group}`,
			);
			code.classList.add(READING_CODE_CLASS);
			pre.dataset.editingSuiteCodeLanguage = language.canonical;
			pre.insertBefore(header, pre.firstChild);
			resetHorizontalScroll(pre, code);
			this.observeBlock(pre, code, lineCount);
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
		this.stopObservingReadingRoots();
		for (const document of getAppDocuments(this.app)) {
			document
				.querySelectorAll<HTMLElement>(`pre.${BLOCK_CLASS}`)
				.forEach((element) => this.clearElement(element));
		}
	}

	private clearElement(pre: HTMLElement): void {
		this.stopObservingBlock(pre);
		pre.querySelectorAll<HTMLElement>(`:scope > .${HEADER_CLASS}`)
			.forEach((element) => element.remove());
		const code = pre.querySelector<HTMLElement>(':scope > code');
		if (code) {
			removeReadingLineAnchors(code);
			code.classList.remove(READING_CODE_CLASS);
		}
		pre.classList.remove(BLOCK_CLASS);
		for (const className of Array.from(pre.classList)) {
			if (
				className.startsWith('editing-suite-code-digits-') ||
				className.startsWith('editing-suite-code-language-')
			) {
				pre.classList.remove(className);
			}
		}
		delete pre.dataset.editingSuiteCodeLanguage;
	}

	private observeBlock(
		pre: HTMLElement,
		code: HTMLElement,
		lineCount: number,
	): void {
		const Observer = pre.ownerDocument.defaultView?.MutationObserver;
		if (!Observer) {
			this.states.set(pre, { code, lineCount, observer: null });
			return;
		}
		const observer = new Observer(() => {
			const state = this.states.get(pre);
			if (!state || !pre.isConnected || !this.isEnabled()) {
				this.stopObservingBlock(pre);
				return;
			}
			if (!hasCompleteReadingLineAnchors(state.code, state.lineCount)) {
				this.stopObservingBlock(pre);
				this.apply(pre);
			}
		});
		observer.observe(code, {
			childList: true,
			characterData: true,
			subtree: true,
		});
		this.states.set(pre, { code, lineCount, observer });
	}

	private stopObservingBlock(pre: HTMLElement): void {
		const state = this.states.get(pre);
		state?.observer?.disconnect();
		this.states.delete(pre);
	}

	private observeReadingRoot(root: ParentNode): void {
		const rootElement = root as Element;
		const readingRoot = rootElement.matches?.('.markdown-preview-view')
			? rootElement as HTMLElement
			: rootElement.closest?.<HTMLElement>('.markdown-preview-view') ?? null;
		if (!readingRoot || this.readingRoots.has(readingRoot)) {
			return;
		}
		const Observer = readingRoot.ownerDocument.defaultView?.MutationObserver;
		if (!Observer) {
			return;
		}
		const state: ReadingRootState = {
			frame: null,
			observer: null,
			pendingBlocks: new Set(),
		};
		const observer = new Observer((mutations) => {
			if (!readingRoot.isConnected || !this.isEnabled()) {
				this.stopObservingReadingRoot(readingRoot);
				return;
			}
			for (const mutation of mutations) {
				for (const node of Array.from(mutation.addedNodes)) {
					collectAddedCodeBlocks(node, readingRoot, state.pendingBlocks);
				}
			}
			if (state.pendingBlocks.size === 0 || state.frame !== null) {
				return;
			}
			const window = readingRoot.ownerDocument.defaultView;
			if (!window) {
				return;
			}
			state.frame = window.requestAnimationFrame(() => {
				state.frame = null;
				const blocks = Array.from(state.pendingBlocks);
				state.pendingBlocks.clear();
				for (const block of blocks) {
					if (block.isConnected && readingRoot.contains(block)) {
						this.apply(block);
					}
				}
			});
		});
		state.observer = observer;
		observer.observe(readingRoot, { childList: true, subtree: true });
		this.readingRoots.set(readingRoot, state);
	}

	private stopObservingReadingRoot(readingRoot: HTMLElement): void {
		const state = this.readingRoots.get(readingRoot);
		if (!state) {
			return;
		}
		state.observer?.disconnect();
		const window = readingRoot.ownerDocument.defaultView;
		if (state.frame !== null && window) {
			window.cancelAnimationFrame(state.frame);
		}
		state.pendingBlocks.clear();
		this.readingRoots.delete(readingRoot);
	}

	private stopObservingReadingRoots(): void {
		for (const readingRoot of Array.from(this.readingRoots.keys())) {
			this.stopObservingReadingRoot(readingRoot);
		}
	}

	private clearDecorated(root: ParentNode): void {
		const selector = `pre.${BLOCK_CLASS}`;
		const decorated = Array.from(
			root.querySelectorAll<HTMLElement>(selector),
		);
		const rootElement = root as Element;
		if (rootElement.matches?.(selector)) {
			decorated.unshift(rootElement as HTMLElement);
		}
		decorated.forEach((element) => this.clearElement(element));
	}
}

function collectAddedCodeBlocks(
	node: Node,
	readingRoot: HTMLElement,
	target: Set<HTMLElement>,
): void {
	if (node.nodeType !== 1) {
		return;
	}
	const element = node as HTMLElement;
	const parentBlock = element.closest<HTMLElement>('pre:not(.frontmatter)');
	if (
		parentBlock &&
		!parentBlock.classList.contains(BLOCK_CLASS) &&
		readingRoot.contains(parentBlock)
	) {
		target.add(parentBlock);
	}
	element.querySelectorAll<HTMLElement>('pre:not(.frontmatter)')
		.forEach((block) => {
			if (!block.classList.contains(BLOCK_CLASS)) {
				target.add(block);
			}
		});
}

function getLanguageToken(code: HTMLElement, pre: HTMLElement): string {
	for (const element of [code, pre]) {
		for (const className of Array.from(element.classList)) {
			if (className.startsWith('language-')) {
				return className.slice('language-'.length);
			}
		}
	}
	return '';
}

function collectCodeBlocks(root: ParentNode): CodeBlockElements[] {
	const blocks = Array.from(
		root.querySelectorAll<HTMLElement>('pre:not(.frontmatter)'),
	);
	const rootElement = root as Element;
	if (rootElement.matches?.('pre:not(.frontmatter)')) {
		blocks.unshift(rootElement as HTMLElement);
	}
	return blocks.flatMap((pre) => {
		const code = pre.querySelector<HTMLElement>(':scope > code');
		return code ? [{ code, pre }] : [];
	});
}

function shouldExclude(pre: HTMLElement, code: HTMLElement): boolean {
	return code.classList.contains('language-output') || pre.matches('.frontmatter');
}

function resetHorizontalScroll(pre: HTMLElement, code: HTMLElement): void {
	pre.scrollLeft = 0;
	code.scrollLeft = 0;
}
