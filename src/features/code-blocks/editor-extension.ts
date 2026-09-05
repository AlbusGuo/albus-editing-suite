import { syntaxTree } from '@codemirror/language';
import {
	type Extension,
	type Range,
} from '@codemirror/state';
import {
	Decoration,
	type DecorationSet,
	type EditorView,
	ViewPlugin,
	type ViewUpdate,
	WidgetType,
} from '@codemirror/view';
import { setIcon } from 'obsidian';
import { isSourceMode } from '../../utils/editor-context';
import {
	collectCodeBlocks,
	type CodeBlockModel,
} from './code-block-model';
import { createCodeHeader } from './header-renderer';
import type { CodeLanguageInfo } from './language-registry';

class CodeLineNumberWidget extends WidgetType {
	constructor(private readonly lineNumber: number) {
		super();
	}

	eq(other: CodeLineNumberWidget): boolean {
		return this.lineNumber === other.lineNumber;
	}

	toDOM(view: EditorView): HTMLElement {
		const element = view.dom.ownerDocument.createElement('span');
		element.className = 'editing-suite-code-line-number';
		element.textContent = String(this.lineNumber);
		element.setAttribute('aria-hidden', 'true');
		return element;
	}

	ignoreEvent(): boolean {
		return true;
	}
}

class CodeCopyButtonWidget extends WidgetType {
	private resetTimer: number | null = null;

	constructor(
		private readonly codeFrom: number,
		private readonly codeTo: number,
	) {
		super();
	}

	eq(other: CodeCopyButtonWidget): boolean {
		return (
			this.codeFrom === other.codeFrom &&
			this.codeTo === other.codeTo
		);
	}

	toDOM(view: EditorView): HTMLElement {
		const button = view.dom.ownerDocument.createElement('button');
		button.className = 'editing-suite-code-copy-button';
		button.type = 'button';
		setIcon(button, 'copy');
		button.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();
			void this.copy(view, button);
		});
		return button;
	}

	destroy(dom: HTMLElement): void {
		const window = dom.ownerDocument.defaultView;
		if (this.resetTimer !== null && window) {
			window.clearTimeout(this.resetTimer);
		}
		this.resetTimer = null;
	}

	ignoreEvent(): boolean {
		return true;
	}

	private async copy(
		view: EditorView,
		button: HTMLButtonElement,
	): Promise<void> {
		const window = button.ownerDocument.defaultView;
		const clipboard = window?.navigator.clipboard;
		if (!window || !clipboard) {
			return;
		}
		const documentLength = view.state.doc.length;
		const from = Math.min(this.codeFrom, documentLength);
		const to = Math.max(from, Math.min(this.codeTo, documentLength));
		try {
			await clipboard.writeText(view.state.doc.sliceString(from, to));
		} catch {
			return;
		}
		if (!button.isConnected) {
			return;
		}
		setIcon(button, 'check');
		button.classList.add('is-copied');
		if (this.resetTimer !== null) {
			window.clearTimeout(this.resetTimer);
		}
		this.resetTimer = window.setTimeout(() => {
			if (button.isConnected) {
				setIcon(button, 'copy');
				button.classList.remove('is-copied');
			}
			this.resetTimer = null;
		}, 1000);
	}
}

class CodeFooterWidget extends WidgetType {
	constructor(
		private readonly sourcePosition: number,
		private readonly sourceText: string,
	) {
		super();
	}

	eq(other: CodeFooterWidget): boolean {
		return (
			this.sourcePosition === other.sourcePosition &&
			this.sourceText === other.sourceText
		);
	}

	toDOM(view: EditorView): HTMLElement {
		const footer = view.dom.ownerDocument.createElement('span');
		footer.className = 'editing-suite-code-footer-interaction';
		footer.textContent = this.sourceText;
		footer.setAttribute('aria-label', '编辑代码块结束标记');
		footer.addEventListener('pointerdown', (event) => {
			activateSourceLine(view, this.sourcePosition, event);
		});
		return footer;
	}

	ignoreEvent(): boolean {
		return false;
	}
}

class CodeHeaderWidget extends WidgetType {
	constructor(
		private readonly language: CodeLanguageInfo,
		private readonly sourcePosition: number,
	) {
		super();
	}

	eq(other: CodeHeaderWidget): boolean {
		return (
			this.sourcePosition === other.sourcePosition &&
			this.language.canonical === other.language.canonical
		);
	}

	toDOM(view: EditorView): HTMLElement {
		const header = createCodeHeader(
			view.dom.ownerDocument,
			this.language,
			'span',
		);
		header.classList.add('editing-suite-code-native-header');
		header.setAttribute('aria-label', '编辑代码块语言');
		header.addEventListener('pointerdown', (event) => {
			activateSourceLine(view, this.sourcePosition, event);
		});
		return header;
	}

	ignoreEvent(): boolean {
		return false;
	}
}

class CodeBlockViewPlugin {
	decorations: DecorationSet;
	private boundaries: CodeBlockBoundary[];
	private boundarySelectionSignature: string;
	private blocks: CodeBlockModel[];

	constructor(view: EditorView) {
		this.blocks = collectCodeBlocks(view.state);
		this.boundaries = createCodeBlockBoundaries(view, this.blocks);
		this.boundarySelectionSignature =
			getBoundarySelectionSignature(view, this.boundaries);
		this.decorations = buildDecorations(view, this.blocks);
	}

	update(update: ViewUpdate): void {
		const syntaxChanged =
			update.docChanged ||
			syntaxTree(update.startState) !== syntaxTree(update.state);
		const reconfigured = update.transactions.some(
			(transaction) => transaction.reconfigured,
		);
		if (syntaxChanged || reconfigured) {
			this.blocks = collectCodeBlocks(update.state);
			this.boundaries = createCodeBlockBoundaries(
				update.view,
				this.blocks,
			);
		}

		const nextBoundarySelectionSignature =
			update.selectionSet || syntaxChanged || reconfigured
				? getBoundarySelectionSignature(
					update.view,
					this.boundaries,
				)
				: this.boundarySelectionSignature;
		const boundarySelectionChanged =
			nextBoundarySelectionSignature !==
			this.boundarySelectionSignature;
		this.boundarySelectionSignature = nextBoundarySelectionSignature;

		if (
			syntaxChanged ||
			reconfigured ||
			update.viewportChanged ||
			boundarySelectionChanged
		) {
			this.decorations = buildDecorations(update.view, this.blocks);
		}
	}

	handlePointerDown(view: EditorView, event: PointerEvent): boolean {
		const target = event.target as HTMLElement | null;
		const header = target?.closest<HTMLElement>(
			'.editing-suite-code-block-begin > .editing-suite-code-native-header',
		);
		const line = header?.closest<HTMLElement>(
			'.editing-suite-code-block-begin',
		);
		if (header && line && view.dom.contains(line)) {
			const position = view.posAtDOM(line, 0);
			activateSourceLine(
				view,
				view.state.doc.lineAt(position).from,
				event,
			);
			return true;
		}

		const footerLine = target?.closest<HTMLElement>(
			'.editing-suite-code-block-end.is-source-hidden',
		);
		if (!footerLine || !view.dom.contains(footerLine)) {
			return false;
		}
		const footerPosition = view.posAtDOM(footerLine, 0);
		activateSourceLine(
			view,
			view.state.doc.lineAt(footerPosition).from,
			event,
		);
		return true;
	}
}

function buildDecorations(
	view: EditorView,
	blocks: readonly CodeBlockModel[],
): DecorationSet {
	if (isSourceMode(view)) {
		return Decoration.none;
	}

	const decorations: Range<Decoration>[] = [];
	const visibleLineSpans = getVisibleLineSpans(view);
	const firstVisibleLine = visibleLineSpans[0]?.from;
	const lastVisibleLine = visibleLineSpans.at(-1)?.to;
	if (firstVisibleLine === undefined || lastVisibleLine === undefined) {
		return Decoration.none;
	}
	for (const block of blocks) {
		const blockLastLine = block.closeLine ?? view.state.doc.lines;
		if (blockLastLine < firstVisibleLine) {
			continue;
		}
		if (block.openLine > lastVisibleLine) {
			break;
		}
		if (
			!lineRangeIntersectsSpans(
				block.openLine,
				blockLastLine,
				visibleLineSpans,
			)
		) {
			continue;
		}

		const languageClass =
			`editing-suite-code-language-${block.language.group}`;
		const lastContentLine = (block.closeLine ?? view.state.doc.lines + 1) - 1;
		const firstContentLine = block.openLine + 1;
		if (lineIntersectsSpans(block.openLine, visibleLineSpans)) {
			const openLine = view.state.doc.line(block.openLine);
			const openingLineActive = selectionTouchesLine(
				view,
				openLine.from,
				openLine.to,
			);
			decorations.push(
				Decoration.line({
					attributes: {
						class:
							`editing-suite-code-block editing-suite-code-block-begin ${openingLineActive ? 'is-source-visible' : 'is-source-hidden'} ${languageClass}`,
						'data-code-language': block.language.canonical,
					},
				}).range(openLine.from),
			);
			if (!openingLineActive) {
				decorations.push(
					Decoration.replace({}).range(openLine.from, openLine.to),
					Decoration.widget({
						side: -1,
						widget: new CodeHeaderWidget(
							block.language,
							openLine.from,
						),
					}).range(openLine.from),
				);
			}
			const codeFrom = firstContentLine <= lastContentLine
				? view.state.doc.line(firstContentLine).from
				: openLine.to;
			const codeTo = firstContentLine <= lastContentLine
				? view.state.doc.line(lastContentLine).to
				: openLine.to;
			decorations.push(
				Decoration.widget({
					side: 1,
					widget: new CodeCopyButtonWidget(codeFrom, codeTo),
				}).range(openLine.to),
			);
		}

		const contentLineCount = Math.max(0, lastContentLine - block.openLine);
		const digits = Math.min(6, Math.max(1, String(contentLineCount).length));
		for (const span of visibleLineSpans) {
			const firstVisibleContentLine = Math.max(
				firstContentLine,
				span.from,
			);
			const lastVisibleContentLine = Math.min(
				lastContentLine,
				span.to,
			);
			if (firstVisibleContentLine > lastVisibleContentLine) {
				continue;
			}
			for (
				let lineNumber = firstVisibleContentLine;
				lineNumber <= lastVisibleContentLine;
				lineNumber++
			) {
				const line = view.state.doc.line(lineNumber);
				decorations.push(
					Decoration.line({
						attributes: {
							class:
								`editing-suite-code-block editing-suite-code-block-line editing-suite-code-digits-${digits} ${languageClass}`,
						},
					}).range(line.from),
					Decoration.widget({
						side: -1,
						widget: new CodeLineNumberWidget(
							lineNumber - block.openLine,
						),
					}).range(line.from),
				);
			}
		}

		if (
			block.closeLine !== null &&
			lineIntersectsSpans(block.closeLine, visibleLineSpans)
		) {
			const closeLine = view.state.doc.line(block.closeLine);
			const closingLineActive = selectionTouchesLine(
				view,
				closeLine.from,
				closeLine.to,
			);
			decorations.push(
				Decoration.line({
					attributes: {
						class:
							`editing-suite-code-block editing-suite-code-block-end ${closingLineActive ? 'is-source-visible' : 'is-source-hidden'} ${languageClass}`,
					},
				}).range(closeLine.from),
			);
			if (!closingLineActive) {
				decorations.push(
					Decoration.replace({}).range(closeLine.from, closeLine.to),
					Decoration.widget({
						side: -1,
						widget: new CodeFooterWidget(
							closeLine.from,
							closeLine.text,
						),
					}).range(closeLine.from),
				);
			}
		}
	}

	return Decoration.set(decorations, true);
}

interface LineSpan {
	from: number;
	to: number;
}

interface CodeBlockBoundary {
	from: number;
	id: string;
	to: number;
}

function createCodeBlockBoundaries(
	view: EditorView,
	blocks: readonly CodeBlockModel[],
): CodeBlockBoundary[] {
	const boundaries: CodeBlockBoundary[] = [];
	for (const block of blocks) {
		const openLine = view.state.doc.line(block.openLine);
		boundaries.push({
			from: openLine.from,
			id: `o${openLine.from}`,
			to: openLine.to,
		});
		if (block.closeLine !== null) {
			const closeLine = view.state.doc.line(block.closeLine);
			boundaries.push({
				from: closeLine.from,
				id: `c${closeLine.from}`,
				to: closeLine.to,
			});
		}
	}
	return boundaries;
}

function getVisibleLineSpans(view: EditorView): LineSpan[] {
	const spans: LineSpan[] = [];
	for (const range of view.visibleRanges) {
		const from = view.state.doc.lineAt(range.from).number;
		const to = view.state.doc.lineAt(range.to).number;
		const previous = spans.at(-1);
		if (previous && from <= previous.to + 1) {
			previous.to = Math.max(previous.to, to);
		} else {
			spans.push({ from, to });
		}
	}
	return spans;
}

function lineIntersectsSpans(
	lineNumber: number,
	spans: readonly LineSpan[],
): boolean {
	return spans.some(
		(span) => span.from <= lineNumber && span.to >= lineNumber,
	);
}

function lineRangeIntersectsSpans(
	from: number,
	to: number,
	spans: readonly LineSpan[],
): boolean {
	return spans.some((span) => span.from <= to && span.to >= from);
}

function activateSourceLine(
	view: EditorView,
	position: number,
	event: Event,
): void {
	event.preventDefault();
	event.stopPropagation();
	view.dispatch({ selection: { anchor: position } });
	view.focus();
}

function getBoundarySelectionSignature(
	view: EditorView,
	boundaries: readonly CodeBlockBoundary[],
): string {
	const activeBoundaries = new Set<string>();
	for (const selection of view.state.selection.ranges) {
		let index = findFirstBoundaryEndingAtOrAfter(
			boundaries,
			selection.from,
		);
		while (
			index < boundaries.length &&
			boundaries[index]?.from !== undefined &&
			(boundaries[index]?.from ?? Infinity) <= selection.to
		) {
			const boundary = boundaries[index];
			if (boundary && selection.from <= boundary.to) {
				activeBoundaries.add(boundary.id);
			}
			index++;
		}
	}
	return Array.from(activeBoundaries).sort().join(',');
}

function findFirstBoundaryEndingAtOrAfter(
	boundaries: readonly CodeBlockBoundary[],
	position: number,
): number {
	let low = 0;
	let high = boundaries.length;
	while (low < high) {
		const middle = Math.floor((low + high) / 2);
		const boundary = boundaries[middle];
		if (boundary && boundary.to < position) {
			low = middle + 1;
		} else {
			high = middle;
		}
	}
	return low;
}

function selectionTouchesLine(
	view: EditorView,
	from: number,
	to: number,
): boolean {
	return view.state.selection.ranges.some(
		(range) => range.from <= to && range.to >= from,
	);
}

export function createCodeBlockEditorExtension(): Extension {
	return ViewPlugin.fromClass(
		CodeBlockViewPlugin,
		{
			decorations: (value) => value.decorations,
			eventHandlers: {
				pointerdown(event, view): boolean {
					return this.handlePointerDown(view, event);
				},
			},
		},
	);
}
