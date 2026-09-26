import { syntaxTree } from '@codemirror/language';
import type { Extension, Range } from '@codemirror/state';
import {
	Decoration,
	type DecorationSet,
	type EditorView,
	type PluginValue,
	ViewPlugin,
	type ViewUpdate,
} from '@codemirror/view';
import {
	computeFencedCodeLines,
	isExcludedMarkdownPosition,
	isInsideCode,
	isSourceMode,
} from '../../utils/editor-context';
import { CLOZE_EMOJI, findClozeMatches } from './syntax';

const HIDE_EMOJI = Decoration.replace({});
const CLOZE_ID_ATTRIBUTE = 'data-editing-suite-cloze-id';
const HOVERED_CLASS = 'editing-suite-editor-cloze-hovered';
const HIDDEN_MATH_CLASS = 'editing-suite-editor-cloze-math';

interface HiddenMathRange {
	clozeId: string;
	from: number;
	to: number;
}

interface ClozeDecorations {
	decorations: DecorationSet;
	hiddenMath: HiddenMathRange[];
}

class ClozeViewPlugin implements PluginValue {
	decorations: DecorationSet;
	private hiddenMath: HiddenMathRange[];
	private hoveredId: string | null = null;
	private readonly mathMeasureKey = {};

	constructor(
		private readonly view: EditorView,
		private readonly isEnabled: () => boolean,
	) {
		const state = buildDecorations(this.view, isEnabled);
		this.decorations = state.decorations;
		this.hiddenMath = state.hiddenMath;
		this.requestMathSync(this.view);
	}

	update(update: ViewUpdate): void {
		if (update.docChanged) {
			this.hoveredId = null;
		}
		if (
			update.docChanged ||
			update.viewportChanged ||
			update.selectionSet
		) {
			const state = buildDecorations(update.view, this.isEnabled);
			this.decorations = state.decorations;
			this.hiddenMath = state.hiddenMath;
			this.requestMathSync(update.view);
		}
		if (this.hoveredId !== null) {
			const hoveredId = this.hoveredId;
			update.view.requestMeasure({
				read: () => hoveredId,
				write: (id) => this.applyHoveredState(update.view, id),
			});
		}
	}

	handlePointerMove(view: EditorView, event: MouseEvent): void {
		const target = event.target as HTMLElement | null;
		const groupElement = target?.closest<HTMLElement>(
			`[${CLOZE_ID_ATTRIBUTE}]`,
		);
		let id = groupElement?.getAttribute(CLOZE_ID_ATTRIBUTE) ?? null;

		if (id === null) {
			const position = view.posAtCoords({
				x: event.clientX,
				y: event.clientY,
			});
			if (position !== null) {
				id = findClozeIdAtPosition(view, position);
			}
		}

		if (id === this.hoveredId) {
			return;
		}
		this.hoveredId = id;
		this.applyHoveredState(view, id);
	}

	clearHover(view: EditorView): void {
		this.hoveredId = null;
		this.applyHoveredState(view, null);
	}

	destroy(): void {
		this.hoveredId = null;
		applyMathElements(collectMathElements(this.view, []));
	}

	private requestMathSync(view: EditorView): void {
		view.requestMeasure({
			key: this.mathMeasureKey,
			read: () => collectMathElements(view, this.hiddenMath),
			write: (elements) => applyMathElements(elements),
		});
	}

	private applyHoveredState(view: EditorView, id: string | null): void {
		view.dom
			.querySelectorAll<HTMLElement>(`.${HOVERED_CLASS}`)
			.forEach((element) => element.classList.remove(HOVERED_CLASS));
		if (id === null) {
			return;
		}
		view.dom
			.querySelectorAll<HTMLElement>(
				`[${CLOZE_ID_ATTRIBUTE}="${id}"]`,
			)
			.forEach((element) => element.classList.add(HOVERED_CLASS));
	}
}

function buildDecorations(
	view: EditorView,
	isEnabled: () => boolean,
): ClozeDecorations {
	if (!isEnabled() || isSourceMode(view)) {
		return {
			decorations: Decoration.none,
			hiddenMath: [],
		};
	}

	const decorations: Range<Decoration>[] = [];
	const hiddenMath: HiddenMathRange[] = [];
	const documentText = view.state.doc.toString();
	const fencedCodeLines = computeFencedCodeLines(documentText);
	const visitedLines = new Set<number>();

	for (const visibleRange of view.visibleRanges) {
		let line = view.state.doc.lineAt(visibleRange.from);
		while (line.from <= visibleRange.to) {
			if (!visitedLines.has(line.from)) {
				visitedLines.add(line.from);
				for (const match of findClozeMatches(line.text)) {
					const clozeFrom = line.from + match.from;
					const clozeTo = line.from + match.to;
					const clozeId = String(clozeFrom);
					if (
						isInsideCode(view, fencedCodeLines, clozeFrom) ||
						isExcludedMarkdownPosition(view, clozeFrom)
					) {
						continue;
					}

					decorations.push(
						Decoration.mark({
							attributes: {
								[CLOZE_ID_ATTRIBUTE]: clozeId,
							},
							class: 'editing-suite-editor-cloze',
						}).range(clozeFrom, clozeTo),
					);
					const cursorInside = view.state.selection.ranges.some(
						(selection) =>
							selection.from <= clozeTo &&
							selection.to >= clozeFrom,
					);
					if (cursorInside) {
						continue;
					}

					const emojiFrom = clozeFrom + 2;
					const emojiTo = emojiFrom + CLOZE_EMOJI.length;
					const answerTo = clozeTo - 2;
					decorations.push(HIDE_EMOJI.range(emojiFrom, emojiTo));
					if (emojiTo < answerTo) {
						decorations.push(
							Decoration.mark({
								attributes: {
									[CLOZE_ID_ATTRIBUTE]: clozeId,
								},
								class: 'editing-suite-editor-cloze-answer',
							}).range(emojiTo, answerTo),
						);
						hiddenMath.push(...collectInlineMathRanges(
							view,
							emojiTo,
							answerTo,
							clozeId,
						));
					}
				}
			}

			if (line.to >= view.state.doc.length) {
				break;
			}
			line = view.state.doc.line(line.number + 1);
		}
	}

	return {
		decorations: Decoration.set(decorations, true),
		hiddenMath,
	};
}

function collectInlineMathRanges(
	view: EditorView,
	from: number,
	to: number,
	clozeId: string,
): HiddenMathRange[] {
	const ranges: HiddenMathRange[] = [];
	let mathFrom = -1;
	syntaxTree(view.state).iterate({
		from,
		to,
		enter(node) {
			const name = node.type.name.toLowerCase();
			if (
				mathFrom < 0 &&
				name.includes('formatting-math-begin') &&
				!name.includes('math-block')
			) {
				mathFrom = node.from;
				return;
			}
			if (mathFrom >= 0 && name.includes('formatting-math-end')) {
				if (mathFrom >= from && node.to <= to) {
					ranges.push({ clozeId, from: mathFrom, to: node.to });
				}
				mathFrom = -1;
			}
		},
	});
	return ranges;
}

interface MathElementState {
	clozeId: string | null;
	element: HTMLElement;
}

function collectMathElements(
	view: EditorView,
	ranges: readonly HiddenMathRange[],
): MathElementState[] {
	return Array.from(view.dom.querySelectorAll<HTMLElement>(
		`.math:not(.math-block), .${HIDDEN_MATH_CLASS}`,
	)).map((element) => ({
		clozeId: findMathClozeId(view, element, ranges),
		element,
	}));
}

function findMathClozeId(
	view: EditorView,
	element: HTMLElement,
	ranges: readonly HiddenMathRange[],
): string | null {
	let positions: number[] = [];
	try {
		positions = [
			view.posAtDOM(element, 0),
			view.posAtDOM(element, element.childNodes.length),
		];
	} catch {
		const rect = element.getBoundingClientRect();
		const position = view.posAtCoords({
			x: rect.left + rect.width / 2,
			y: rect.top + rect.height / 2,
		});
		if (position !== null) {
			positions = [position];
		}
	}
	for (const range of ranges) {
		if (positions.some((position) =>
			position >= range.from && position <= range.to,
		)) {
			return range.clozeId;
		}
	}
	return null;
}

function applyMathElements(elements: readonly MathElementState[]): void {
	for (const { clozeId, element } of elements) {
		element.classList.toggle(HIDDEN_MATH_CLASS, clozeId !== null);
		if (clozeId === null) {
			element.removeAttribute(CLOZE_ID_ATTRIBUTE);
			element.classList.remove(HOVERED_CLASS);
		} else {
			element.setAttribute(CLOZE_ID_ATTRIBUTE, clozeId);
		}
	}
}

function findClozeIdAtPosition(
	view: EditorView,
	position: number,
): string | null {
	const line = view.state.doc.lineAt(position);
	for (const match of findClozeMatches(line.text)) {
		const from = line.from + match.from;
		const to = line.from + match.to;
		if (position >= from && position <= to) {
			return String(from);
		}
	}
	return null;
}

export function createClozeEditorExtension(
	isEnabled: () => boolean,
): Extension {
	return ViewPlugin.fromClass(
		class extends ClozeViewPlugin {
			constructor(view: EditorView) {
				super(view, isEnabled);
			}
		},
		{
			decorations: (value) => value.decorations,
			eventHandlers: {
				mousemove(event, view): void {
					this.handlePointerMove(view, event);
				},
				mouseleave(_event, view): void {
					this.clearHover(view);
				},
			},
		},
	);
}
