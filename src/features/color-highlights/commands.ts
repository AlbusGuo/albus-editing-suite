import type { Editor, Plugin } from 'obsidian';
import { splitBoundaryWhitespace } from '../../utils/inline-mark';
import {
	COLOR_HIGHLIGHTS,
	HIGHLIGHT_COLORS,
	getHighlightWritePrefix,
	type HighlightColor,
} from './constants';
import { createHighlightRegex, detectHighlightPrefix } from './syntax';

interface HighlightMatch {
	from: number;
	inner: string;
	to: number;
}

export function registerColorHighlightCommands(
	plugin: Plugin,
	isEnabled: () => boolean,
): void {
	for (const color of HIGHLIGHT_COLORS) {
		const definition = COLOR_HIGHLIGHTS[color];

		plugin.addCommand({
			id: `highlight-${color}`,
			name: `高亮为${definition.label}`,
			editorCheckCallback: (checking, editor) => {
				if (!isEnabled()) {
					return false;
				}
				if (!checking) {
					applyColorHighlight(editor, color);
				}
				return true;
			},
		});
	}
}

function findHighlightAtOffset(
	text: string,
	offset: number,
): HighlightMatch | null {
	const highlightRegex = createHighlightRegex();
	let match: RegExpExecArray | null;

	while ((match = highlightRegex.exec(text)) !== null) {
		const inner = match[1];
		if (inner === undefined) {
			continue;
		}

		const from = match.index;
		const to = from + match[0].length;
		if (from > offset) {
			break;
		}
		if (offset >= from && offset <= to) {
			return { from, inner, to };
		}
	}

	return null;
}

function findHighlightAtCursor(editor: Editor): HighlightMatch | null {
	const cursor = editor.getCursor();
	const lineStart = editor.posToOffset({ line: cursor.line, ch: 0 });
	const match = findHighlightAtOffset(editor.getLine(cursor.line), cursor.ch);

	if (!match) {
		return null;
	}

	return {
		from: lineStart + match.from,
		inner: match.inner,
		to: lineStart + match.to,
	};
}

function collectOverlappingHighlights(
	documentText: string,
	from: number,
	to: number,
): HighlightMatch[] {
	const matches: HighlightMatch[] = [];
	const highlightRegex = createHighlightRegex();
	let match: RegExpExecArray | null;

	while ((match = highlightRegex.exec(documentText)) !== null) {
		const inner = match[1];
		if (inner === undefined) {
			continue;
		}

		const matchFrom = match.index;
		const matchTo = matchFrom + match[0].length;
		if (matchFrom >= to) {
			break;
		}
		if (matchTo > from) {
			matches.push({ from: matchFrom, inner, to: matchTo });
		}
	}

	return matches;
}

function stripHighlightPrefix(text: string): string {
	return detectHighlightPrefix(text).text;
}

function stripHighlights(text: string): string {
	return text.replace(
		createHighlightRegex(),
		(_match, inner: string) => stripHighlightPrefix(inner),
	);
}

function applyColorHighlight(editor: Editor, color: HighlightColor): void {
	if (editor.somethingSelected()) {
		applyColorToSelection(editor, color);
		return;
	}

	const cursorOffset = editor.posToOffset(editor.getCursor());
	const highlight = findHighlightAtCursor(editor);
	if (highlight) {
		recolorHighlight(editor, highlight, color, cursorOffset);
		return;
	}

	highlightWordAtCursor(editor, color);
}

function applyColorToSelection(editor: Editor, color: HighlightColor): void {
	const selectionFrom = editor.posToOffset(editor.getCursor('from'));
	const selectionTo = editor.posToOffset(editor.getCursor('to'));
	const documentText = editor.getValue();
	const overlappingHighlights = collectOverlappingHighlights(
		documentText,
		selectionFrom,
		selectionTo,
	);
	const prefix = getHighlightWritePrefix(color);

	if (overlappingHighlights.length === 0) {
		const selectedText = documentText.slice(selectionFrom, selectionTo);
		const parts = splitBoundaryWhitespace(selectedText);
		if (!parts.content) {
			return;
		}
		const replacement =
			`${parts.leading}==${prefix}${parts.content}==${parts.trailing}`;
		editor.replaceRange(
			replacement,
			editor.offsetToPos(selectionFrom),
			editor.offsetToPos(selectionTo),
		);
		editor.setSelection(
			editor.offsetToPos(selectionFrom),
			editor.offsetToPos(selectionFrom + replacement.length),
		);
		return;
	}

	let unionFrom = selectionFrom;
	let unionTo = selectionTo;
	for (const highlight of overlappingHighlights) {
		unionFrom = Math.min(unionFrom, highlight.from);
		unionTo = Math.max(unionTo, highlight.to);
	}

	const strippedText = stripHighlights(documentText.slice(unionFrom, unionTo));
	const parts = splitBoundaryWhitespace(strippedText);
	if (!parts.content) {
		return;
	}

	const replacement =
		`${parts.leading}==${prefix}${parts.content}==${parts.trailing}`;
	editor.replaceRange(
		replacement,
		editor.offsetToPos(unionFrom),
		editor.offsetToPos(unionTo),
	);
	editor.setSelection(
		editor.offsetToPos(unionFrom),
		editor.offsetToPos(unionFrom + replacement.length),
	);
}

function recolorHighlight(
	editor: Editor,
	highlight: HighlightMatch,
	color: HighlightColor,
	cursorOffset: number,
): void {
	const parts = splitBoundaryWhitespace(
		stripHighlightPrefix(highlight.inner),
	);
	if (!parts.content) {
		return;
	}
	const replacement =
		`${parts.leading}==${getHighlightWritePrefix(color)}${parts.content}==${parts.trailing}`;
	editor.replaceRange(
		replacement,
		editor.offsetToPos(highlight.from),
		editor.offsetToPos(highlight.to),
	);

	const relativeCursor = Math.max(0, cursorOffset - highlight.from);
	editor.setCursor(
		editor.offsetToPos(
			highlight.from + Math.min(relativeCursor, replacement.length),
		),
	);
}

const WORD_CHARACTER = /[\p{L}\p{N}_-]/u;

function highlightWordAtCursor(editor: Editor, color: HighlightColor): void {
	const cursor = editor.getCursor();
	const line = editor.getLine(cursor.line);
	const prefix = getHighlightWritePrefix(color);
	let start = cursor.ch;
	let end = cursor.ch;

	while (start > 0 && WORD_CHARACTER.test(line.charAt(start - 1))) {
		start--;
	}
	while (end < line.length && WORD_CHARACTER.test(line.charAt(end))) {
		end++;
	}

	if (start === end) {
		const highlight = `==${prefix}==`;
		editor.replaceRange(highlight, cursor);
		editor.setCursor({
			line: cursor.line,
			ch: cursor.ch + 2 + prefix.length,
		});
		return;
	}

	const highlight = `==${prefix}${line.slice(start, end)}==`;
	editor.replaceRange(
		highlight,
		{ line: cursor.line, ch: start },
		{ line: cursor.line, ch: end },
	);
	editor.setCursor({
		line: cursor.line,
		ch: start + highlight.length,
	});
}
