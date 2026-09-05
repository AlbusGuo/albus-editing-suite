import {
	StateEffect,
	type Extension,
	type Line,
	type Range,
} from '@codemirror/state';
import {
	Decoration,
	type DecorationSet,
	type EditorView,
	type PluginValue,
	ViewPlugin,
	type ViewUpdate,
} from '@codemirror/view';
import { editorLivePreviewField } from 'obsidian';
import { isExcludedMarkdownPosition } from '../../utils/editor-context';
import { parseNegativeHeadingLine } from './parser';

const LINE_DECORATION = Decoration.line({
	class: 'editing-suite-negative-heading-line',
});
const TEXT_DECORATION = Decoration.mark({
	class: 'editing-suite-negative-heading-text',
});
const TOKEN_DECORATION = Decoration.mark({
	class: 'editing-suite-negative-heading-token',
});
const EMPTY_TOKEN_DECORATION = Decoration.mark({
	class:
		'editing-suite-negative-heading-token editing-suite-negative-heading-token-empty',
});
const COMPOSITION_REFRESH = StateEffect.define<null>();

class NegativeHeadingViewPlugin implements PluginValue {
	decorations: DecorationSet;
	private compositionRefreshTimer: number | null = null;
	private destroyed = false;

	constructor(
		view: EditorView,
		private readonly isEnabled: () => boolean,
	) {
		this.decorations = buildDecorations(view, isEnabled);
	}

	update(update: ViewUpdate): void {
		const compositionRefresh = update.transactions.some((transaction) =>
			transaction.effects.some((effect) => effect.is(COMPOSITION_REFRESH)),
		);

		if (update.view.composing && !compositionRefresh) {
			if (update.docChanged) {
				this.decorations = this.decorations.map(update.changes);
			}
			return;
		}

		if (
			compositionRefresh ||
			update.docChanged ||
			update.viewportChanged ||
			update.selectionSet
		) {
			this.decorations = buildDecorations(
				update.view,
				this.isEnabled,
			);
		}
	}

	scheduleCompositionRefresh(view: EditorView): void {
		if (this.compositionRefreshTimer !== null) {
			window.clearTimeout(this.compositionRefreshTimer);
		}

		this.compositionRefreshTimer = window.setTimeout(() => {
			this.compositionRefreshTimer = null;
			if (this.destroyed) {
				return;
			}
			if (view.composing) {
				this.scheduleCompositionRefresh(view);
				return;
			}
			view.dispatch({
				effects: COMPOSITION_REFRESH.of(null),
			});
		}, 0);
	}

	destroy(): void {
		this.destroyed = true;
		if (this.compositionRefreshTimer !== null) {
			window.clearTimeout(this.compositionRefreshTimer);
		}
	}
}

export function createNegativeHeadingEditorExtension(
	isEnabled: () => boolean,
): Extension {
	return ViewPlugin.fromClass(class extends NegativeHeadingViewPlugin {
		constructor(view: EditorView) {
			super(view, isEnabled);
		}
	}, {
		decorations: (value) => value.decorations,
		eventHandlers: {
			compositionend(_event, view): void {
				this.scheduleCompositionRefresh(view);
			},
		},
	});
}

function buildDecorations(
	view: EditorView,
	isEnabled: () => boolean,
): DecorationSet {
	if (!isEnabled()) {
		return Decoration.none;
	}
	const decorations: Range<Decoration>[] = [];
	const livePreview = view.state.field(editorLivePreviewField);
	const visitedLines = new Set<number>();

	for (const visibleRange of view.visibleRanges) {
		let line = view.state.doc.lineAt(visibleRange.from);

		while (line.from <= visibleRange.to) {
			if (!visitedLines.has(line.from)) {
				visitedLines.add(line.from);
				addLineDecorations(
					view,
					line,
					livePreview,
					decorations,
				);
			}

			if (line.to >= view.state.doc.length) {
				break;
			}
			line = view.state.doc.line(line.number + 1);
		}
	}

	return Decoration.set(decorations, true);
}

function addLineDecorations(
	view: EditorView,
	line: Line,
	livePreview: boolean,
	decorations: Range<Decoration>[],
): void {
	const match = parseNegativeHeadingLine(line.text);
	if (!match || match.escaped) {
		return;
	}

	const tokenFrom = line.from + match.tokenFrom;
	const tokenTo = line.from + match.tokenTo;
	if (isExcludedMarkdownPosition(view, tokenFrom)) {
		return;
	}

	const trailingWhitespace = line.text.match(/[ \t]+$/)?.[0].length ?? 0;
	const contentTo = line.to - trailingWhitespace;
	const hasContent = contentTo > tokenTo;
	const lineIsActive = view.state.selection.ranges.some(
		(selection) =>
			selection.from <= line.to && selection.to >= line.from,
	);

	decorations.push(LINE_DECORATION.range(line.from));
	if (livePreview && hasContent && !lineIsActive) {
		decorations.push(Decoration.replace({}).range(tokenFrom, tokenTo));
	} else {
		decorations.push(
			(hasContent ? TOKEN_DECORATION : EMPTY_TOKEN_DECORATION).range(
				tokenFrom,
				tokenTo,
			),
		);
	}
	if (hasContent) {
		decorations.push(TEXT_DECORATION.range(tokenTo, contentTo));
	}
}
