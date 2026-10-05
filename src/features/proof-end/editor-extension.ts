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
import { findProofEndOffsets } from './syntax';

const PROOF_END_DECORATION = Decoration.mark({
	class: 'editing-suite-proof-end',
});

export function createProofEndEditorExtension(
	isEnabled: () => boolean,
): Extension {
	return ViewPlugin.fromClass(class {
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
	}, {
		decorations: (value) => value.decorations,
	});
}

function buildDecorations(
	view: EditorView,
	isEnabled: () => boolean,
): DecorationSet {
	if (!isEnabled() || isSourceMode(view)) {
		return Decoration.none;
	}
	const decorations: Range<Decoration>[] = [];
	const fencedCodeLines = computeFencedCodeLines(view.state.doc.toString());
	const activeLines = new Set(
		view.state.selection.ranges.map((range) =>
			view.state.doc.lineAt(range.head).number,
		),
	);
	for (const line of getVisibleDocumentLines(view)) {
		if (activeLines.has(line.number)) {
			continue;
		}
		for (const index of findProofEndOffsets(line.text)) {
			const position = line.from + index;
			if (
				isInsideCode(view, fencedCodeLines, position) ||
				isExcludedMarkdownPosition(view, position)
			) {
				continue;
			}
			decorations.push(
				PROOF_END_DECORATION.range(position, position + 1),
			);
		}
	}
	return Decoration.set(decorations, true);
}
