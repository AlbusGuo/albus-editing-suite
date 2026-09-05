import type { Editor, Plugin } from 'obsidian';
import { splitBoundaryWhitespace } from '../../utils/inline-mark';
import {
	COLORED_TEXT_COLORS,
	COLORED_TEXT_COLOR_KEYS,
	type ColoredTextColor,
} from './constants';
import {
	COLORED_TEXT_CLOSING,
	COLORED_TEXT_OPENING,
	createColoredTextRegex,
	detectColoredTextPrefix,
} from './syntax';

interface ColoredTextMatch {
	from: number;
	inner: string;
	to: number;
}

export function registerColoredTextCommands(
	plugin: Plugin,
	isEnabled: () => boolean,
): void {
	for (const color of COLORED_TEXT_COLOR_KEYS) {
		const definition = COLORED_TEXT_COLORS[color];
		plugin.addCommand({
			id: `color-text-${color}`,
			name: `文本着色为${definition.label}`,
			editorCheckCallback: (checking, editor) => {
				if (!isEnabled()) {
					return false;
				}
				if (!checking) {
					applyColoredText(editor, color);
				}
				return true;
			},
		});
	}
}

function findColoredTextAtOffset(
	text: string,
	offset: number,
): ColoredTextMatch | null {
	const coloredTextRegex = createColoredTextRegex();
	let match: RegExpExecArray | null;

	while ((match = coloredTextRegex.exec(text)) !== null) {
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

function findColoredTextAtCursor(editor: Editor): ColoredTextMatch | null {
	const cursor = editor.getCursor();
	const lineStart = editor.posToOffset({ line: cursor.line, ch: 0 });
	const match = findColoredTextAtOffset(
		editor.getLine(cursor.line),
		cursor.ch,
	);

	if (!match) {
		return null;
	}

	return {
		from: lineStart + match.from,
		inner: match.inner,
		to: lineStart + match.to,
	};
}

function collectOverlappingColoredText(
	documentText: string,
	from: number,
	to: number,
): ColoredTextMatch[] {
	const matches: ColoredTextMatch[] = [];
	const coloredTextRegex = createColoredTextRegex();
	let match: RegExpExecArray | null;

	while ((match = coloredTextRegex.exec(documentText)) !== null) {
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

function stripColoredTextPrefix(text: string): string {
	return detectColoredTextPrefix(text).text;
}

function stripColoredTextSyntax(text: string): string {
	return text.replace(
		createColoredTextRegex(),
		(_match: string, inner: string) => stripColoredTextPrefix(inner),
	);
}

function applyColoredText(editor: Editor, color: ColoredTextColor): void {
	if (editor.somethingSelected()) {
		applyColorToSelection(editor, color);
		return;
	}

	const cursorOffset = editor.posToOffset(editor.getCursor());
	const coloredText = findColoredTextAtCursor(editor);
	if (coloredText) {
		recolorText(editor, coloredText, color, cursorOffset);
		return;
	}

	colorWordAtCursor(editor, color);
}

function applyColorToSelection(editor: Editor, color: ColoredTextColor): void {
	const selectionFrom = editor.posToOffset(editor.getCursor('from'));
	const selectionTo = editor.posToOffset(editor.getCursor('to'));
	const documentText = editor.getValue();
	const overlappingColoredText = collectOverlappingColoredText(
		documentText,
		selectionFrom,
		selectionTo,
	);
	const emoji = COLORED_TEXT_COLORS[color].emoji;

	if (overlappingColoredText.length === 0) {
		const selectedText = documentText.slice(selectionFrom, selectionTo);
		const parts = splitBoundaryWhitespace(selectedText);
		if (!parts.content) {
			return;
		}
		const replacement =
			`${parts.leading}${COLORED_TEXT_OPENING}${emoji}` +
			`${parts.content}${COLORED_TEXT_CLOSING}${parts.trailing}`;
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
	for (const coloredText of overlappingColoredText) {
		unionFrom = Math.min(unionFrom, coloredText.from);
		unionTo = Math.max(unionTo, coloredText.to);
	}

	const strippedText = stripColoredTextSyntax(
		documentText.slice(unionFrom, unionTo),
	);
	const parts = splitBoundaryWhitespace(strippedText);
	if (!parts.content) {
		return;
	}

	const replacement =
		`${parts.leading}${COLORED_TEXT_OPENING}${emoji}` +
		`${parts.content}${COLORED_TEXT_CLOSING}${parts.trailing}`;
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

function recolorText(
	editor: Editor,
	coloredText: ColoredTextMatch,
	color: ColoredTextColor,
	cursorOffset: number,
): void {
	const parts = splitBoundaryWhitespace(
		stripColoredTextPrefix(coloredText.inner),
	);
	if (!parts.content) {
		return;
	}
	const replacement =
		`${parts.leading}${COLORED_TEXT_OPENING}` +
		`${COLORED_TEXT_COLORS[color].emoji}${parts.content}` +
		`${COLORED_TEXT_CLOSING}${parts.trailing}`;
	editor.replaceRange(
		replacement,
		editor.offsetToPos(coloredText.from),
		editor.offsetToPos(coloredText.to),
	);

	const relativeCursor = Math.max(0, cursorOffset - coloredText.from);
	editor.setCursor(
		editor.offsetToPos(
			coloredText.from + Math.min(relativeCursor, replacement.length),
		),
	);
}

const WORD_CHARACTER = /[\p{L}\p{N}_-]/u;

function colorWordAtCursor(editor: Editor, color: ColoredTextColor): void {
	const cursor = editor.getCursor();
	const line = editor.getLine(cursor.line);
	const emoji = COLORED_TEXT_COLORS[color].emoji;
	let start = cursor.ch;
	let end = cursor.ch;

	while (start > 0 && WORD_CHARACTER.test(line.charAt(start - 1))) {
		start--;
	}
	while (end < line.length && WORD_CHARACTER.test(line.charAt(end))) {
		end++;
	}

	if (start === end) {
		const coloredText =
			`${COLORED_TEXT_OPENING}${emoji}${COLORED_TEXT_CLOSING}`;
		editor.replaceRange(coloredText, cursor);
		editor.setCursor({
			line: cursor.line,
			ch: cursor.ch + COLORED_TEXT_OPENING.length + emoji.length,
		});
		return;
	}

	const coloredText =
		`${COLORED_TEXT_OPENING}${emoji}${line.slice(start, end)}` +
		COLORED_TEXT_CLOSING;
	editor.replaceRange(
		coloredText,
		{ line: cursor.line, ch: start },
		{ line: cursor.line, ch: end },
	);
	editor.setCursor({
		line: cursor.line,
		ch: start + coloredText.length,
	});
}
