import type { Extension, Range } from '@codemirror/state';
import {
	Decoration,
	type DecorationSet,
	type EditorView,
	ViewPlugin,
	type ViewUpdate,
} from '@codemirror/view';
import { requireApiVersion } from 'obsidian';
import {
	computeFencedCodeLines,
	getVisibleDocumentLines,
	isExcludedMarkdownPosition,
	isInsideCode,
	isSourceMode,
} from '../../utils/editor-context';
import { hasValidInlineMarkBoundaries } from '../../utils/inline-mark';
import {
	DEFAULT_HIGHLIGHT_COLOR,
	HIGHLIGHT_COLORS,
	type HighlightColor,
} from './constants';
import { createHighlightRegex, detectHighlightPrefix } from './syntax';

const COLOR_DECORATIONS = Object.fromEntries(
	HIGHLIGHT_COLORS.map((color) => [
		color,
		Decoration.mark({
			class: `editing-suite-editor-highlight-${color}`,
		}),
	]),
) as Record<HighlightColor, Decoration>;

const HIDE_EMOJI = Decoration.replace({});
const HAS_NATIVE_COLOR_HIGHLIGHTS = requireApiVersion('1.14.0');

function buildDecorations(
	view: EditorView,
	isEnabled: () => boolean,
): DecorationSet {
	if (!isEnabled()) {
		return Decoration.none;
	}
	const decorations: Range<Decoration>[] = [];
	const highlightRegex = createHighlightRegex();
	const fencedCodeLines = computeFencedCodeLines(view.state.doc.toString());
	const selections = view.state.selection.ranges;
	const showEmojiPrefix = isSourceMode(view);

	for (const line of getVisibleDocumentLines(view)) {
		highlightRegex.lastIndex = 0;
		let match: RegExpExecArray | null;

		while ((match = highlightRegex.exec(line.text)) !== null) {
			const innerText = match[1];
			if (
				innerText === undefined ||
				!hasValidInlineMarkBoundaries(innerText)
			) {
				continue;
			}

			const highlightFrom = line.from + match.index;
			const highlightTo = highlightFrom + match[0].length;
			if (isExcludedMarkdownPosition(view, highlightFrom)) {
				continue;
			}
			const innerFrom = highlightFrom + 2;
			const prefix = detectHighlightPrefix(innerText);
			if (prefix.excluded) {
				continue;
			}
			const color = prefix.color ?? DEFAULT_HIGHLIGHT_COLOR;

			decorations.push(
				COLOR_DECORATIONS[color].range(
					highlightFrom,
					highlightTo,
				),
			);

			const emojiFrom = innerFrom + prefix.emojiOffset;
			const emojiTo = emojiFrom + prefix.emojiLength;
			const cursorInside = selections.some(
				(selection) =>
					selection.from <= highlightTo &&
					selection.to >= highlightFrom,
			);
			const keepVisibleInCode = isInsideCode(
				view,
				fencedCodeLines,
				emojiFrom,
			);

			if (
				!HAS_NATIVE_COLOR_HIGHLIGHTS &&
				!showEmojiPrefix &&
				!keepVisibleInCode &&
				!cursorInside &&
				emojiFrom < emojiTo
			) {
				decorations.push(HIDE_EMOJI.range(emojiFrom, emojiTo));
			}
		}
	}

	return Decoration.set(decorations, true);
}

export function createColorHighlightExtension(
	isEnabled: () => boolean,
): Extension {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;

			constructor(view: EditorView) {
				this.decorations = buildDecorations(view, isEnabled);
			}

			update(update: ViewUpdate): void {
				if (
					update.docChanged ||
					update.viewportChanged ||
					update.selectionSet
				) {
					this.decorations = buildDecorations(update.view, isEnabled);
				}
			}
		},
		{
			decorations: (value) => value.decorations,
		},
	);
}
