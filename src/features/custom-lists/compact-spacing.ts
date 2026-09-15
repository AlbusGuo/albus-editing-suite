import type { Extension, Text as CodeMirrorText } from '@codemirror/state';
import {
	Decoration,
	type DecorationSet,
	type EditorView,
	ViewPlugin,
	type ViewUpdate,
} from '@codemirror/view';

const SEPARATOR_CLASS = 'editing-suite-compact-list-separator';
const COMPACT_LIST_PATTERN =
	/^(?:\s*>[ \t]?)*\s*\d+[.)]\s+\{[^}\n]+\}-\s+/u;

export function createCompactListSpacingExtension(
	isEnabled: () => boolean,
): Extension {
	return ViewPlugin.fromClass(class {
		decorations: DecorationSet;

		constructor(view: EditorView) {
			this.decorations = buildDecorations(view.state.doc, isEnabled());
		}

		update(update: ViewUpdate): void {
			if (
				update.docChanged ||
				update.transactions.some((transaction) =>
					transaction.reconfigured,
				)
			) {
				this.decorations = buildDecorations(
					update.state.doc,
					isEnabled(),
				);
			}
		}
	}, {
		decorations: (value) => value.decorations,
	});
}

function buildDecorations(
	document: CodeMirrorText,
	enabled: boolean,
): DecorationSet {
	if (!enabled) {
		return Decoration.none;
	}
	const decorations = [];
	let previousLineFrom = 0;
	let previousLineText: string | null = null;

	for (let lineNumber = 1; lineNumber <= document.lines; lineNumber++) {
		const line = document.line(lineNumber);
		if (
			previousLineText !== null &&
			COMPACT_LIST_PATTERN.test(line.text) &&
			isMatchingBlankLine(previousLineText, line.text)
		) {
			decorations.push(
				Decoration.line({ class: SEPARATOR_CLASS })
					.range(previousLineFrom),
			);
		}
		previousLineFrom = line.from;
		previousLineText = line.text;
	}
	return Decoration.set(decorations, true);
}

function isMatchingBlankLine(previous: string, current: string): boolean {
	const previousQuote = parseQuotePrefix(previous);
	const currentQuote = parseQuotePrefix(current);
	return (
		previousQuote.depth === currentQuote.depth &&
		previousQuote.rest.trim() === ''
	);
}

function parseQuotePrefix(text: string): { depth: number; rest: string } {
	const match = /^\s*((?:>[ \t]?)*)(.*)$/u.exec(text);
	const prefix = match?.[1] ?? '';
	return {
		depth: Array.from(prefix).filter((character) => character === '>').length,
		rest: match?.[2] ?? text,
	};
}
