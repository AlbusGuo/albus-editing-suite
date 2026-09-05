import type { Editor, Plugin } from 'obsidian';
import {
	CLOZE_EMOJI,
	findClozeMatches,
} from './syntax';

interface AbsoluteClozeMatch {
	content: string;
	from: number;
	to: number;
}

const WORD_CHARACTER = /[\p{L}\p{N}_-]/u;

export function registerClozeCommand(
	plugin: Plugin,
	isEnabled: () => boolean,
): void {
	plugin.addCommand({
		id: 'toggle-cloze',
		name: '切换挖空',
		editorCheckCallback: (checking, editor) => {
			if (!isEnabled()) {
				return false;
			}
			if (!checking) {
				toggleCloze(editor);
			}
			return true;
		},
	});
}

function findClozeAtRange(
	documentText: string,
	from: number,
	to: number,
): AbsoluteClozeMatch | null {
	for (const match of findClozeMatches(documentText)) {
		if (match.from <= from && match.to >= to) {
			return match;
		}
	}

	return null;
}

function toggleCloze(editor: Editor): void {
	const documentText = editor.getValue();
	const selectionFrom = editor.posToOffset(editor.getCursor('from'));
	const selectionTo = editor.posToOffset(editor.getCursor('to'));
	const existing = findClozeAtRange(
		documentText,
		selectionFrom,
		selectionTo,
	);

	if (existing) {
		unwrapCloze(editor, existing, selectionFrom, selectionTo);
		return;
	}

	if (editor.somethingSelected()) {
		wrapRange(editor, selectionFrom, selectionTo);
		return;
	}

	wrapWordAtCursor(editor);
}

function unwrapCloze(
	editor: Editor,
	match: AbsoluteClozeMatch,
	selectionFrom: number,
	selectionTo: number,
): void {
	editor.replaceRange(
		match.content,
		editor.offsetToPos(match.from),
		editor.offsetToPos(match.to),
	);

	const contentFrom = match.from + 2 + CLOZE_EMOJI.length;
	const mapPosition = (position: number): number => {
		if (position <= contentFrom) {
			return match.from;
		}
		return Math.min(
			match.from + match.content.length,
			match.from + position - contentFrom,
		);
	};

	editor.setSelection(
		editor.offsetToPos(mapPosition(selectionFrom)),
		editor.offsetToPos(mapPosition(selectionTo)),
	);
}

function wrapRange(editor: Editor, from: number, to: number): void {
	const content = editor.getValue().slice(from, to);
	const replacement = `==${CLOZE_EMOJI}${content}==`;
	editor.replaceRange(
		replacement,
		editor.offsetToPos(from),
		editor.offsetToPos(to),
	);
	editor.setSelection(
		editor.offsetToPos(from + 2 + CLOZE_EMOJI.length),
		editor.offsetToPos(from + 2 + CLOZE_EMOJI.length + content.length),
	);
}

function wrapWordAtCursor(editor: Editor): void {
	const cursor = editor.getCursor();
	const line = editor.getLine(cursor.line);
	let start = cursor.ch;
	let end = cursor.ch;

	while (start > 0 && WORD_CHARACTER.test(line.charAt(start - 1))) {
		start--;
	}
	while (end < line.length && WORD_CHARACTER.test(line.charAt(end))) {
		end++;
	}

	const from = editor.posToOffset({ line: cursor.line, ch: start });
	const to = editor.posToOffset({ line: cursor.line, ch: end });
	wrapRange(editor, from, to);
	if (start === end) {
		editor.setCursor(
			editor.offsetToPos(from + 2 + CLOZE_EMOJI.length),
		);
	}
}
