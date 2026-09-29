import type { Editor, EditorPosition, Plugin } from 'obsidian';
import { parseLeadingDirective } from './parser';

interface OrderedListCommand {
	id: string;
	name: string;
	pattern: string | null;
}

interface ParsedLine {
	content: string;
	indent: string;
	marker: string | null;
	quote: string;
}

const COMMANDS: readonly OrderedListCommand[] = [
	{ id: 'ordered-list-decimal', name: '有序列表 - 1. 2. 3.', pattern: null },
	{ id: 'ordered-list-decimal-parentheses', name: '有序列表 - (1) (2) (3)', pattern: '(1)' },
	{ id: 'ordered-list-circled', name: '有序列表 - ① ② ③', pattern: '①' },
	{ id: 'ordered-list-decimal-brackets', name: '有序列表 - [1] [2] [3]', pattern: '[1]' },
	{ id: 'ordered-list-decimal-closing-parenthesis', name: '有序列表 - 1) 2) 3)', pattern: '1)' },
	{ id: 'ordered-list-chinese', name: '有序列表 - 一、 二、 三、', pattern: '一、' },
	{ id: 'ordered-list-chinese-parentheses', name: '有序列表 - (一) (二) (三)', pattern: '(一)' },
	{ id: 'ordered-list-lower-alpha', name: '有序列表 - a. b. c.', pattern: 'a.' },
	{ id: 'ordered-list-lower-alpha-parentheses', name: '有序列表 - (a) (b) (c)', pattern: '(a)' },
	{ id: 'ordered-list-upper-alpha', name: '有序列表 - A. B. C.', pattern: 'A.' },
	{ id: 'ordered-list-upper-alpha-parentheses', name: '有序列表 - (A) (B) (C)', pattern: '(A)' },
	{ id: 'ordered-list-lower-roman', name: '有序列表 - i. ii. iii.', pattern: 'i.' },
	{ id: 'ordered-list-upper-roman', name: '有序列表 - I. II. III.', pattern: 'I.' },
	{ id: 'ordered-list-lower-roman-parentheses', name: '有序列表 - (i) (ii) (iii)', pattern: '(i)' },
	{ id: 'ordered-list-upper-roman-parentheses', name: '有序列表 - (I) (II) (III)', pattern: '(I)' },
];

export function registerCustomListCommands(
	plugin: Plugin,
	isEnabled: () => boolean,
): void {
	for (const command of COMMANDS) {
		plugin.addCommand({
			id: command.id,
			name: command.name,
			editorCheckCallback: (checking, editor) => {
				if (!isEnabled()) {
					return false;
				}
				if (!checking) {
					applyOrderedListStyle(editor, command.pattern);
				}
				return true;
			},
		});
	}
}

function applyOrderedListStyle(
	editor: Editor,
	pattern: string | null,
): void {
	const originalFrom = editor.getCursor('from');
	const originalTo = editor.getCursor('to');
	const selected = editor.somethingSelected();
	const range = selected
		? getSelectedLineRange(originalFrom, originalTo)
		: getCurrentListRange(editor, originalFrom.line);
	const sourceLines: string[] = [];
	for (let line = range.from; line <= range.to; line++) {
		sourceLines.push(editor.getLine(line));
	}
	const transformed = transformOrderedListLines(sourceLines, pattern);
	const replacement = transformed.join('\n');
	editor.replaceRange(
		replacement,
		{ line: range.from, ch: 0 },
		{ line: range.to, ch: editor.getLine(range.to).length },
	);
	if (selected) {
		editor.setSelection(
			{ line: range.from, ch: 0 },
			{
				line: range.from + transformed.length - 1,
				ch: transformed[transformed.length - 1]?.length ?? 0,
			},
		);
		return;
	}
	const relativeLine = Math.min(
		originalFrom.line - range.from,
		transformed.length - 1,
	);
	const targetLine = transformed[Math.max(0, relativeLine)] ?? '';
	editor.setCursor({
		line: range.from + Math.max(0, relativeLine),
		ch: targetLine.length,
	});
}

export function transformOrderedListLines(
	lines: readonly string[],
	pattern: string | null,
): string[] {
	if (lines.length === 1 && lines[0]?.trim() === '') {
		return [`1. ${pattern ? `{${pattern}} ` : ''}`];
	}
	let counters = new Map<string, number>();
	let initialized = new Set<string>();
	return lines.map((line) => {
		if (line.trim() === '') {
			counters = new Map();
			initialized = new Set();
			return line;
		}
		const parsed = parseLine(line);
		const key = `${parsed.quote}\u0000${parsed.indent}`;
		const number = (counters.get(key) ?? 0) + 1;
		counters.set(key, number);
		let content = parsed.content;
		const existingDirective = parseLeadingDirective(content);
		if (existingDirective) {
			content = content.slice(existingDirective.raw.length);
		}
		const directive = pattern && !initialized.has(key)
			? `{${pattern}} `
			: '';
		initialized.add(key);
		return `${parsed.quote}${parsed.indent}${number}. ` +
			`${directive}${content}`;
	});
}

function getSelectedLineRange(
	from: EditorPosition,
	to: EditorPosition,
): { from: number; to: number } {
	return {
		from: from.line,
		to: to.ch === 0 && to.line > from.line ? to.line - 1 : to.line,
	};
}

function getCurrentListRange(
	editor: Editor,
	lineNumber: number,
): { from: number; to: number } {
	const current = parseLine(editor.getLine(lineNumber));
	if (!current.marker) {
		return { from: lineNumber, to: lineNumber };
	}
	let from = lineNumber;
	let to = lineNumber;
	while (from > 0 && isSameListLine(editor.getLine(from - 1), current)) {
		from--;
	}
	while (
		to < editor.lineCount() - 1 &&
		isSameListLine(editor.getLine(to + 1), current)
	) {
		to++;
	}
	return { from, to };
}

function isSameListLine(line: string, reference: ParsedLine): boolean {
	const parsed = parseLine(line);
	return parsed.marker !== null &&
		parsed.quote === reference.quote &&
		parsed.indent === reference.indent;
}

function parseLine(line: string): ParsedLine {
	const match = /^((?: {0,3}>[\t ]?)*)([\t ]*)(?:(\d+[.)]|[-+*])([\t ]+))?(.*)$/u
		.exec(line);
	return {
		content: match?.[5] ?? line,
		indent: match?.[2] ?? '',
		marker: match?.[3] ?? null,
		quote: match?.[1] ?? '',
	};
}
