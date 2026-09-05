import type { Extension, Text as CodeMirrorText } from '@codemirror/state';
import {
	Decoration,
	type DecorationSet,
	type EditorView,
	ViewPlugin,
	type ViewUpdate,
} from '@codemirror/view';

const SEPARATOR_CLASS = 'editing-suite-callout-list-separator';
const CALLOUT_HEADER_PATTERN = /^\[![^\]]+\]/u;
const LIST_PATTERN = /^(?:[-+*]|\d+[.)])\s+/u;

interface QuoteLine {
	depth: number;
	rest: string;
}

export function createCalloutListSpacingExtension(
	isEnabled: () => boolean,
): Extension {
	return ViewPlugin.fromClass(class {
		decorations: DecorationSet;

		constructor(view: EditorView) {
			this.decorations = buildDecorations(view.state.doc, isEnabled());
		}

		update(update: ViewUpdate): void {
			if (update.docChanged || update.transactions.some(
				(transaction) => transaction.reconfigured,
			)) {
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
	let activeCalloutDepth = 0;
	let previousQuote: QuoteLine | null = null;
	let previousLineFrom = 0;

	for (let lineNumber = 1; lineNumber <= document.lines; lineNumber++) {
		const line = document.line(lineNumber);
		const quote = parseQuoteLine(line.text);
		if (!quote) {
			activeCalloutDepth = 0;
			previousQuote = null;
			previousLineFrom = line.from;
			continue;
		}
		if (activeCalloutDepth > 0 && quote.depth < activeCalloutDepth) {
			activeCalloutDepth = 0;
		}
		if (CALLOUT_HEADER_PATTERN.test(quote.rest.trimStart())) {
			activeCalloutDepth = quote.depth;
		}
		if (
			activeCalloutDepth > 0 &&
			quote.depth >= activeCalloutDepth &&
			LIST_PATTERN.test(quote.rest.trimStart()) &&
			previousQuote &&
			previousQuote.depth >= activeCalloutDepth &&
			previousQuote.rest.trim() === ''
		) {
			decorations.push(
				Decoration.line({ class: SEPARATOR_CLASS })
					.range(previousLineFrom),
			);
		}
		previousQuote = quote;
		previousLineFrom = line.from;
	}
	return Decoration.set(decorations, true);
}

function parseQuoteLine(text: string): QuoteLine | null {
	const match = /^\s*((?:>[ \t]*)+)(.*)$/u.exec(text);
	if (!match) {
		return null;
	}
	return {
		depth: Array.from(match[1] ?? '').filter((character) =>
			character === '>',
		).length,
		rest: match[2] ?? '',
	};
}
