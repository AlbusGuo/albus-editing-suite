import {
	type App,
	MarkdownRenderChild,
	type MarkdownPostProcessorContext,
	MarkdownView,
} from 'obsidian';
import { stripColorMarkers } from '../../utils/color-markers';
import { getAppDocuments } from '../../utils/app-documents';
import type { SidenoteLayoutController } from './layout';
import { createReadingSidenoteInstanceId } from './instance-id';
import { observeSidenoteImages } from './image-support';
import {
	setupSidenotePopup,
	toggleSidenotePopup,
} from './popup';
import {
	findMarkdownSidenoteMatches,
	findSidenoteMatches,
	SIDENOTE_OPENING,
	type SidenoteMatch,
} from './syntax';

const ANCHOR_CLASS = 'editing-suite-reading-sidenote-anchor';
const PRINT_FOOTNOTES_CLASS = 'editing-suite-print-footnotes';

interface IndexedSidenote extends SidenoteMatch {
	number: number;
}

interface SourceIndex {
	items: IndexedSidenote[];
	lineOffsets: number[];
}

interface TextSegment {
	end: number;
	endPoint: DomPoint;
	start: number;
	startPoint: DomPoint;
	textNode?: Text;
}

interface DomPoint {
	node: Node;
	offset: number;
}

interface TextStream {
	segments: TextSegment[];
	text: string;
}

interface DomMatch {
	block: HTMLElement;
	match: SidenoteMatch;
	stream: TextStream;
}

class SidenoteRenderChild extends MarkdownRenderChild {
	constructor(
		containerEl: HTMLElement,
		private readonly cleanup: () => void,
	) {
		super(containerEl);
	}

	onunload(): void {
		this.cleanup();
	}
}

export class SidenoteReadingRenderer {
	private readonly sourceCache = new Map<string, Promise<SourceIndex | null>>();
	private readonly cleanups = new WeakMap<HTMLElement, () => void>();
	private readonly originals = new WeakMap<HTMLElement, DocumentFragment>();
	private readonly references = new WeakMap<HTMLElement, HTMLElement>();

	constructor(
		private readonly app: App,
		private readonly isEnabled: () => boolean,
		private readonly layout: SidenoteLayoutController,
	) {}

	apply(
		element: HTMLElement,
		context: MarkdownPostProcessorContext,
	): void | Promise<void> {
		if (!this.isEnabled()) {
			this.clearRoot(element);
			return;
		}
		const section = context.getSectionInfo(element);
		if (
			section
				? !section.text.includes(SIDENOTE_OPENING)
				: !(element.textContent ?? '').includes(SIDENOTE_OPENING)
		) {
			return;
		}
		const liveContent = this.getLiveEditorContent(context.sourcePath);
		if (liveContent !== null) {
			this.applySourceIndex(
				element,
				context,
				createSourceIndex(liveContent),
			);
			return;
		}
		return this.getSourceIndex(context.sourcePath).then((sourceIndex) => {
			if (sourceIndex && this.isEnabled()) {
				this.applySourceIndex(element, context, sourceIndex);
			}
		});
	}

	invalidate(path: string): void {
		this.sourceCache.delete(path);
	}

	clearAll(): void {
		for (const document of getAppDocuments(this.app)) {
			document
				.querySelectorAll<HTMLElement>(`.${ANCHOR_CLASS}`)
				.forEach((anchor) => this.restoreAnchor(anchor));
		}
	}

	private async getSourceIndex(path: string): Promise<SourceIndex | null> {
		let cached = this.sourceCache.get(path);
		if (!cached) {
			cached = this.loadSourceIndex(path).catch(() => null);
			this.sourceCache.set(path, cached);
		}
		return cached;
	}

	private async loadSourceIndex(path: string): Promise<SourceIndex | null> {
		const file = this.app.vault.getFileByPath(path);
		if (!file) {
			return null;
		}
		const content = await this.app.vault.cachedRead(file);
		return createSourceIndex(content);
	}

	private getLiveEditorContent(path: string): string | null {
		let content: string | null = null;
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (
				content === null &&
				leaf.view instanceof MarkdownView &&
				leaf.view.file?.path === path
			) {
				content = leaf.view.editor.getValue();
			}
		});
		return content;
	}

	private applySourceIndex(
		element: HTMLElement,
		context: MarkdownPostProcessorContext,
		sourceIndex: SourceIndex,
	): void {
		const domMatches = collectDomMatches(element);
		if (domMatches.length === 0) {
			return;
		}
		const section = context.getSectionInfo(element);
		let indexedItems: IndexedSidenote[];
		if (section) {
			const sectionFrom = sourceIndex.lineOffsets[section.lineStart] ?? 0;
			const sectionTo =
				sourceIndex.lineOffsets[section.lineEnd + 1] ??
				Number.POSITIVE_INFINITY;
			indexedItems = sourceIndex.items.filter(
				(item) => item.from >= sectionFrom && item.from < sectionTo,
			);
		} else {
			const fallback = matchDomItemsToSource(
				domMatches,
				sourceIndex.items,
			);
			if (!fallback) {
				return;
			}
			indexedItems = fallback;
		}
		if (domMatches.length !== indexedItems.length) {
			return;
		}
		const printContainer = getPrintContainer(element);
		for (let index = domMatches.length - 1; index >= 0; index--) {
			const domMatch = domMatches[index];
			const sourceItem = indexedItems[index];
			if (domMatch && sourceItem) {
				if (printContainer) {
					this.replacePrintDomMatch(
						domMatch,
						sourceItem,
						printContainer,
					);
				} else {
					this.replaceDomMatch(domMatch, sourceItem, context);
				}
			}
		}
	}

	private replacePrintDomMatch(
		domMatch: DomMatch,
		item: IndexedSidenote,
		printContainer: HTMLElement,
	): void {
		const contentRange = createRange(
			domMatch.stream,
			domMatch.match.contentFrom,
			domMatch.match.contentTo,
		);
		const fullRange = createRange(
			domMatch.stream,
			domMatch.match.from,
			domMatch.match.to,
		);
		if (!contentRange || !fullRange) {
			return;
		}
		const document = domMatch.block.ownerDocument;
		const contentFragment = contentRange.cloneContents();
		const insertionMarker = document.createComment(
			'editing-suite-print-sidenote-reference',
		);
		const insertionRange = createRange(
			domMatch.stream,
			domMatch.match.from,
			domMatch.match.from,
		);
		if (!insertionRange) {
			return;
		}
		insertionRange.insertNode(insertionMarker);
		fullRange.setStartAfter(insertionMarker);
		fullRange.extractContents();

		const reference = document.createElement('sup');
		reference.className = 'editing-suite-sidenote-reference';
		const referenceNumber = document.createElement('span');
		referenceNumber.className =
			'editing-suite-sidenote-reference-link';
		referenceNumber.textContent = String(item.number);
		reference.appendChild(referenceNumber);
		insertionMarker.replaceWith(reference);

		const list = getPrintFootnoteList(printContainer);
		const oldEntry = list.querySelector<HTMLElement>(
			`:scope > li[data-sidenote-number="${item.number}"]`,
		);
		oldEntry?.remove();
		const entry = document.createElement('li');
		entry.dataset.sidenoteNumber = String(item.number);
		const number = document.createElement('span');
		number.className = 'editing-suite-print-footnote-number';
		number.textContent = String(item.number);
		const content = document.createElement('div');
		content.className = 'editing-suite-print-footnote-content';
		content.appendChild(contentFragment);
		entry.append(number, content);
		list.appendChild(entry);
		for (const child of Array.from(list.children).sort(
			(left, right) =>
				getSidenoteNumber(left) - getSidenoteNumber(right),
		)) {
			list.appendChild(child);
		}
		const section = list.closest<HTMLElement>(
			`.${PRINT_FOOTNOTES_CLASS}`,
		);
		if (section) {
			printContainer.appendChild(section);
		}
	}

	private replaceDomMatch(
		domMatch: DomMatch,
		item: IndexedSidenote,
		context: MarkdownPostProcessorContext,
	): void {
		const contentRange = createRange(
			domMatch.stream,
			domMatch.match.contentFrom,
			domMatch.match.contentTo,
		);
		const fullRange = createRange(
			domMatch.stream,
			domMatch.match.from,
			domMatch.match.to,
		);
		if (!contentRange || !fullRange) {
			return;
		}
		const document = domMatch.block.ownerDocument;
		const contentFragment = contentRange.cloneContents();
		const insertionMarker = document.createComment(
			'editing-suite-sidenote-anchor',
		);
		const insertionRange = createRange(
			domMatch.stream,
			domMatch.match.from,
			domMatch.match.from,
		);
		if (!insertionRange) {
			return;
		}
		insertionRange.insertNode(insertionMarker);
		fullRange.setStartAfter(insertionMarker);
		const originalFragment = fullRange.extractContents();
		const anchor = document.createElement('span');
		const instanceId = createReadingSidenoteInstanceId();
		anchor.className = `editing-suite-sidenote-anchor ${ANCHOR_CLASS}`;
		anchor.dataset.sidenoteInstance = instanceId;
		anchor.dataset.sidenoteNumber = String(item.number);

		const reference = document.createElement('sup');
		reference.className = 'editing-suite-sidenote-reference';
		reference.dataset.sidenoteInstance = instanceId;
		const referenceLink = document.createElement('a');
		referenceLink.className =
			'footnote-ref editing-suite-sidenote-reference-link';
		referenceLink.textContent = String(item.number);
		referenceLink.setAttribute('aria-label', `边注 ${item.number}`);
		referenceLink.tabIndex = -1;
		const openPopup = (focusPopup: boolean): void => {
			if (!anchor.classList.contains('is-popup-only')) {
				return;
			}
			toggleSidenotePopup(anchor, focusPopup);
		};
		referenceLink.addEventListener('click', (event) => {
			if (!anchor.classList.contains('is-popup-only')) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			openPopup(false);
		});
		referenceLink.addEventListener('keydown', (event) => {
			if (
				(event.key !== 'Enter' && event.key !== ' ') ||
				!anchor.classList.contains('is-popup-only')
			) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			openPopup(true);
		});
		reference.appendChild(referenceLink);
		const margin = document.createElement('aside');
		margin.className = 'editing-suite-sidenote-margin';
		margin.dataset.sidenoteNumber = String(item.number);
		const number = document.createElement('span');
		number.className = 'editing-suite-sidenote-number';
		number.textContent = String(item.number);
		const content = document.createElement('div');
		content.className = 'editing-suite-sidenote-content';
		content.appendChild(contentFragment);
		margin.append(number, content);
		anchor.appendChild(margin);

		insertionMarker.replaceWith(reference, anchor);
		this.originals.set(anchor, originalFragment);
		this.references.set(anchor, reference);
		const disposeLayout = this.layout.register(anchor, margin);
		const disposePopup = setupSidenotePopup(anchor);
		const disposeImages = observeSidenoteImages(
			content,
			() => this.layout.schedule(),
		);
		const cleanup = (): void => {
			disposeImages();
			disposeLayout();
			disposePopup();
		};
		this.cleanups.set(anchor, cleanup);
		context.addChild(new SidenoteRenderChild(anchor, cleanup));
	}

	private clearRoot(root: ParentNode): void {
		root
			.querySelectorAll<HTMLElement>(`.${ANCHOR_CLASS}`)
			.forEach((anchor) => this.restoreAnchor(anchor));
	}

	private restoreAnchor(anchor: HTMLElement): void {
		this.cleanups.get(anchor)?.();
		this.cleanups.delete(anchor);
		const original = this.originals.get(anchor);
		const reference = this.references.get(anchor);
		const parent = reference?.parentNode ?? anchor.parentNode;
		const insertionPoint = reference ?? anchor;
		if (original && parent) {
			parent.insertBefore(original, insertionPoint);
		}
		this.originals.delete(anchor);
		this.references.delete(anchor);
		reference?.remove();
		anchor.remove();
	}
}

function getPrintContainer(element: HTMLElement): HTMLElement | null {
	return element.closest<HTMLElement>('.print') ??
		element.parentElement?.closest<HTMLElement>('.print') ??
		null;
}

function getPrintFootnoteList(printContainer: HTMLElement): HTMLOListElement {
	let section = printContainer.querySelector<HTMLElement>(
		`:scope > .${PRINT_FOOTNOTES_CLASS}`,
	);
	if (!section) {
		section = printContainer.ownerDocument.createElement('section');
		section.className = `footnotes ${PRINT_FOOTNOTES_CLASS}`;
		section.appendChild(printContainer.ownerDocument.createElement('hr'));
		section.appendChild(printContainer.ownerDocument.createElement('ol'));
		printContainer.appendChild(section);
	}
	const list = section.querySelector<HTMLOListElement>(':scope > ol');
	if (list) {
		return list;
	}
	const replacement = printContainer.ownerDocument.createElement('ol');
	section.appendChild(replacement);
	return replacement;
}

function getSidenoteNumber(element: Element): number {
	const value = Number.parseInt(
		(element as HTMLElement).dataset.sidenoteNumber ?? '',
		10,
	);
	return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function matchDomItemsToSource(
	domMatches: readonly DomMatch[],
	sourceItems: readonly IndexedSidenote[],
): IndexedSidenote[] | null {
	const matched: IndexedSidenote[] = [];
	let cursor = 0;
	for (const domMatch of domMatches) {
		const target = normalizeComparableText(domMatch.match.content);
		let found = -1;
		for (let index = cursor; index < sourceItems.length; index++) {
			const item = sourceItems[index];
			if (
				item &&
				normalizeComparableText(item.content) === target
			) {
				found = index;
				break;
			}
		}
		if (found < 0) {
			return null;
		}
		const item = sourceItems[found];
		if (!item) {
			return null;
		}
		matched.push(item);
		cursor = found + 1;
	}
	return matched;
}

function normalizeComparableText(text: string): string {
	return stripColorMarkers(text
		.replace(/`[^`]*`/g, '')
		.replace(/\$+[^$]*\$+/g, '')
		.replace(/\uFFFC/g, '')
		.replace(/!\[\[[^\]]+\]\]/g, '')
		.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
		.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
		.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
		.replace(/\[\[([^\]]+)\]\]/g, '$1')
		.replace(/==/g, '')
		.replace(/⚫\uFE0F?/gu, '')
		.replace(/[*_~]/g, '')
		.replace(/\\([{}])/g, '$1')
		.replace(/\s+/g, ' ')
		.trim());
}

function collectDomMatches(root: HTMLElement): DomMatch[] {
	const blocks = collectTextBlocks(root);
	const matches: DomMatch[] = [];
	for (const block of blocks) {
		const stream = createTextStream(block);
		for (const match of findSidenoteMatches(stream.text)) {
			matches.push({ block, match, stream });
		}
	}
	return matches;
}

function collectTextBlocks(root: HTMLElement): HTMLElement[] {
	const selector = 'p, li, h1, h2, h3, h4, h5, h6, blockquote';
	const blocks = Array.from(root.querySelectorAll<HTMLElement>(selector));
	if (root.matches(selector)) {
		blocks.unshift(root);
	}
	return blocks.filter((block) => {
		if (block.closest(`.${ANCHOR_CLASS}, pre, code, .math, mjx-container`)) {
			return false;
		}
		return !blocks.some(
			(other) => other !== block && block.contains(other),
		);
	});
}

function createTextStream(block: HTMLElement): TextStream {
	const segments: TextSegment[] = [];
	let text = '';
	const appendText = (node: Text): void => {
		const value = node.nodeValue ?? '';
		if (!value) {
			return;
		}
		const start = text.length;
		text += value;
		segments.push({
			end: text.length,
			endPoint: { node, offset: node.length },
			start,
			startPoint: { node, offset: 0 },
			textNode: node,
		});
	};
	const appendPlaceholder = (element: Element): void => {
		const parent = element.parentNode;
		if (!parent) {
			return;
		}
		const childIndex = Array.prototype.indexOf.call(
			parent.childNodes,
			element,
		);
		if (childIndex < 0) {
			return;
		}
		const start = text.length;
		text += '\uFFFC';
		segments.push({
			end: text.length,
			endPoint: { node: parent, offset: childIndex + 1 },
			start,
			startPoint: { node: parent, offset: childIndex },
		});
	};
	const appendNode = (node: Node): void => {
		if (node.nodeType === 3) {
			appendText(node as Text);
			return;
		}
		if (node.nodeType !== 1) {
			return;
		}
		const element = node as Element;
		if (element.matches(
			`code, pre, .math, mjx-container, .internal-embed, ` +
			`.image-embed, img, .${ANCHOR_CLASS}`,
		)) {
			appendPlaceholder(element);
			return;
		}
		for (const child of Array.from(element.childNodes)) {
			appendNode(child);
		}
	};
	for (const child of Array.from(block.childNodes)) {
		appendNode(child);
	}
	return { segments, text };
}

function createRange(
	stream: TextStream,
	from: number,
	to: number,
): Range | null {
	const start = getDomPoint(stream.segments, from);
	const end = getDomPoint(stream.segments, to);
	if (!start || !end) {
		return null;
	}
	const document = start.node.ownerDocument;
	if (!document) {
		return null;
	}
	const range = document.createRange();
	range.setStart(start.node, start.offset);
	range.setEnd(end.node, end.offset);
	return range;
}

function getDomPoint(
	segments: readonly TextSegment[],
	position: number,
): DomPoint | null {
	for (const segment of segments) {
		if (position <= segment.end) {
			if (!segment.textNode) {
				return position <= segment.start
					? segment.startPoint
					: segment.endPoint;
			}
			return {
				node: segment.textNode,
				offset: Math.max(0, Math.min(
					position - segment.start,
					segment.textNode.length,
				)),
			};
		}
	}
	return null;
}

function getLineOffsets(content: string): number[] {
	const offsets = [0];
	for (let index = 0; index < content.length; index++) {
		if (content.charAt(index) === '\n') {
			offsets.push(index + 1);
		}
	}
	return offsets;
}

function createSourceIndex(content: string): SourceIndex {
	return {
		items: findMarkdownSidenoteMatches(content).map((item, index) => ({
			...item,
			number: index + 1,
		})),
		lineOffsets: getLineOffsets(content),
	};
}
