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

class ClozeViewPlugin implements PluginValue {
	decorations: DecorationSet;
	private hoveredId: string | null = null;

	constructor(
		view: EditorView,
		private readonly isEnabled: () => boolean,
	) {
		this.decorations = buildDecorations(view, isEnabled);
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
			this.decorations = buildDecorations(update.view, this.isEnabled);
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
): DecorationSet {
	if (!isEnabled() || isSourceMode(view)) {
		return Decoration.none;
	}

	const decorations: Range<Decoration>[] = [];
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
					}
				}
			}

			if (line.to >= view.state.doc.length) {
				break;
			}
			line = view.state.doc.line(line.number + 1);
		}
	}

	return Decoration.set(decorations, true);
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
