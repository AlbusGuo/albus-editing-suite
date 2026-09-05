import type { Extension, Range } from '@codemirror/state';
import {
	Decoration,
	type DecorationSet,
	type EditorView,
	ViewPlugin,
	type ViewUpdate,
} from '@codemirror/view';
import {
	computeFencedCodeLines,
	getVisibleDocumentLines,
	isExcludedMarkdownPosition,
	isInsideCode,
	isSourceMode,
} from '../../utils/editor-context';
import { hasValidInlineMarkBoundaries } from '../../utils/inline-mark';
import {
	COLORED_TEXT_COLOR_KEYS,
	type ColoredTextColor,
} from './constants';
import {
	COLORED_TEXT_OPENING,
	createColoredTextRegex,
	detectColoredTextPrefix,
} from './syntax';

const COLOR_DECORATIONS = Object.fromEntries(
	COLORED_TEXT_COLOR_KEYS.map((color) => [
		color,
		Decoration.mark({
			class: `editing-suite-editor-colored-text-${color}`,
		}),
	]),
) as Record<ColoredTextColor, Decoration>;

const HIDE_EMOJI = Decoration.replace({});

function buildDecorations(
	view: EditorView,
	isEnabled: () => boolean,
): DecorationSet {
	if (!isEnabled()) {
		return Decoration.none;
	}
	const decorations: Range<Decoration>[] = [];
	const coloredTextRegex = createColoredTextRegex();
	const documentText = view.state.doc.toString();
	const fencedCodeLines = computeFencedCodeLines(documentText);
	const selections = view.state.selection.ranges;
	const showEmojiPrefix = isSourceMode(view);

	for (const line of getVisibleDocumentLines(view)) {
		coloredTextRegex.lastIndex = 0;
		let match: RegExpExecArray | null;

		while ((match = coloredTextRegex.exec(line.text)) !== null) {
			const innerText = match[1];
			const textFrom = line.from + match.index;
			if (
				innerText === undefined ||
				!hasValidInlineMarkBoundaries(innerText)
			) {
				continue;
			}

			const textTo = textFrom + match[0].length;
			const prefix = detectColoredTextPrefix(innerText);
			if (isExcludedMarkdownPosition(view, textFrom)) {
				continue;
			}
			const innerFrom = textFrom + COLORED_TEXT_OPENING.length;
			if (
				!prefix.color ||
				isInsideCode(view, fencedCodeLines, textFrom)
			) {
				continue;
			}

			decorations.push(
				COLOR_DECORATIONS[prefix.color].range(textFrom, textTo),
			);
			const emojiFrom = innerFrom + prefix.emojiOffset;
			const emojiTo = emojiFrom + prefix.emojiLength;
			const cursorInside = selections.some(
				(selection) =>
					selection.from <= textTo && selection.to >= textFrom,
			);
			if (
				!showEmojiPrefix &&
				!cursorInside &&
				emojiFrom < emojiTo
			) {
				decorations.push(HIDE_EMOJI.range(emojiFrom, emojiTo));
			}
		}
	}

	return Decoration.set(decorations, true);
}

export function createColoredTextEditorExtension(
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
