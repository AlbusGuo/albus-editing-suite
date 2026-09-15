import type { Text as CodeMirrorText } from '@codemirror/state';
import { getProtectedLineMask } from '../negative-headings/protected-lines';

type NativeCounterStyle =
	| 'lower-alpha'
	| 'upper-alpha'
	| 'lower-roman'
	| 'upper-roman';

export interface CustomListEntry {
	markerFrom: number;
	markerColumns: number;
	markerText: string;
	replaceTo: number;
}

export interface MarkerSpec {
	counterStyle: NativeCounterStyle | 'decimal';
	prefix: string;
	start: number;
	suffix: string;
}

export interface LeadingDirective {
	compact: boolean;
	pattern: string;
	raw: string;
}

interface ListRuntimeState {
	nextIndex: number;
	spec: MarkerSpec;
}

export function parseCustomListEntries(
	document: CodeMirrorText,
): CustomListEntry[] {
	const entries: CustomListEntry[] = [];
	const entriesByList = new Map<ListRuntimeState, CustomListEntry[]>();
	const activeLists = new Map<number, ListRuntimeState>();
	const protectedLines = getProtectedLineMask(
		document.toString().split('\n'),
	);

	for (let lineNumber = 1; lineNumber <= document.lines; lineNumber += 1) {
		if (protectedLines[lineNumber - 1] === true) {
			activeLists.clear();
			continue;
		}
		const line = document.line(lineNumber);
		const match = /^((?: {0,3}>[ \t]?)*)(\s*)(\d+)([.)])(\s+)(.*)$/u
			.exec(line.text);
		if (!match) {
			if (line.text.trim() !== '') {
				clearListsAtOrAboveIndent(
					activeLists,
					getIndentWidth(line.text),
				);
			}
			continue;
		}

		const quotePrefix = match[1] ?? '';
		const indentText = match[2] ?? '';
		const numberText = match[3] ?? '';
		const delimiter = match[4] ?? '';
		const spacing = match[5] ?? '';
		const contentText = match[6] ?? '';
		const indentWidth = getIndentWidth(indentText);
		pruneDeeperLists(activeLists, indentWidth);

		const markerFrom = line.from + quotePrefix.length + indentText.length;
		const contentFrom = markerFrom +
			numberText.length +
			delimiter.length +
			spacing.length;
		const directive = parseLeadingDirective(contentText);
		let listState = activeLists.get(indentWidth) ?? null;
		let replaceTo = contentFrom;

		if (directive) {
			const spec = resolveMarkerSpec(directive.pattern);
			if (!spec) {
				activeLists.delete(indentWidth);
				continue;
			}
			listState = {
				nextIndex: 0,
				spec,
			};
			activeLists.set(indentWidth, listState);
			replaceTo = contentFrom + directive.raw.length;
		}
		if (!listState) {
			continue;
		}

		const entry = {
			markerFrom,
			markerColumns: 3,
			markerText: formatMarkerText(
				listState.spec,
				listState.nextIndex,
			),
			replaceTo,
		};
		entries.push(entry);
		const listEntries = entriesByList.get(listState) ?? [];
		listEntries.push(entry);
		entriesByList.set(listState, listEntries);
		listState.nextIndex += 1;
	}
	for (const listEntries of entriesByList.values()) {
		const markerColumns = Math.max(
			3,
			...listEntries.map((entry) =>
				getMarkerDisplayColumns(entry.markerText),
			),
		);
		for (const entry of listEntries) {
			entry.markerColumns = markerColumns;
		}
	}

	return entries;
}

export function getMarkerDisplayColumns(text: string): number {
	let columns = 0;
	for (const character of text) {
		const codePoint = character.codePointAt(0) ?? 0;
		columns += isWideCodePoint(codePoint) ? 2 : 1;
	}
	return Math.max(1, columns);
}

export function parseLeadingDirective(
	text: string,
): LeadingDirective | null {
	const match = /^\{([^}]+)\}(-)?(\s*)/u.exec(text);
	if (!match) {
		return null;
	}
	return {
		compact: match[2] === '-',
		pattern: match[1] ?? '',
		raw: match[0],
	};
}

export function resolveMarkerSpec(pattern: string): MarkerSpec | null {
	if (/\$[^$]+\$/u.test(pattern)) {
		return null;
	}
	const numeric = /^(.*?)(\d+)([^\d]*)$/u.exec(pattern);
	if (numeric) {
		return {
			counterStyle: 'decimal',
			prefix: numeric[1] ?? '',
			start: Number.parseInt(numeric[2] ?? '1', 10),
			suffix: numeric[3] ?? '',
		};
	}
	return parseSymbolicSpec(pattern);
}

export function formatMarkerText(spec: MarkerSpec, index: number): string {
	const value = spec.start + index;
	return `${spec.prefix}${formatCounter(spec.counterStyle, value)}${spec.suffix}`;
}

function parseSymbolicSpec(pattern: string): MarkerSpec | null {
	const candidates: Array<{
		counterStyle: NativeCounterStyle;
		token: string;
	}> = [
		{ token: 'a', counterStyle: 'lower-alpha' },
		{ token: 'A', counterStyle: 'upper-alpha' },
		{ token: 'i', counterStyle: 'lower-roman' },
		{ token: 'I', counterStyle: 'upper-roman' },
	];
	let best: {
		counterStyle: NativeCounterStyle;
		index: number;
		token: string;
	} | null = null;
	for (const candidate of candidates) {
		const index = findPlaceholderIndex(pattern, candidate.token);
		if (index !== -1 && (!best || index > best.index)) {
			best = { ...candidate, index };
		}
	}
	if (!best) {
		return null;
	}
	return {
		counterStyle: best.counterStyle,
		prefix: pattern.slice(0, best.index),
		start: 1,
		suffix: pattern.slice(best.index + best.token.length),
	};
}

function findPlaceholderIndex(pattern: string, token: string): number {
	for (let index = pattern.length - token.length; index >= 0; index -= 1) {
		if (pattern.slice(index, index + token.length) !== token) {
			continue;
		}
		const previous = index > 0 ? pattern[index - 1] ?? '' : '';
		const next = index + token.length < pattern.length
			? pattern[index + token.length] ?? ''
			: '';
		if (/[A-Za-z0-9]/u.test(previous) || /[A-Za-z0-9]/u.test(next)) {
			continue;
		}
		return index;
	}
	return -1;
}

function formatCounter(
	style: NativeCounterStyle | 'decimal',
	value: number,
): string {
	if (style === 'decimal') {
		return String(value);
	}
	if (style === 'lower-alpha') {
		return toAlphabetic(value).toLowerCase();
	}
	if (style === 'upper-alpha') {
		return toAlphabetic(value).toUpperCase();
	}
	if (style === 'lower-roman') {
		return toRoman(value).toLowerCase();
	}
	return toRoman(value);
}

function toAlphabetic(value: number): string {
	let current = value;
	let output = '';
	while (current > 0) {
		current -= 1;
		output = String.fromCharCode(97 + current % 26) + output;
		current = Math.floor(current / 26);
	}
	return output;
}

function toRoman(value: number): string {
	const numerals: Array<readonly [number, string]> = [
		[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
		[100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
		[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
	];
	let current = value;
	let output = '';
	for (const [number, symbol] of numerals) {
		while (current >= number) {
			output += symbol;
			current -= number;
		}
	}
	return output;
}

function getIndentWidth(text: string): number {
	return (/^(\s*)/u.exec(text)?.[1] ?? '')
		.replace(/\t/gu, '    ')
		.length;
}

function clearListsAtOrAboveIndent(
	activeLists: Map<number, ListRuntimeState>,
	indentWidth: number,
): void {
	for (const key of activeLists.keys()) {
		if (key >= indentWidth) {
			activeLists.delete(key);
		}
	}
}

function pruneDeeperLists(
	activeLists: Map<number, ListRuntimeState>,
	indentWidth: number,
): void {
	for (const key of activeLists.keys()) {
		if (key > indentWidth) {
			activeLists.delete(key);
		}
	}
}

function isWideCodePoint(codePoint: number): boolean {
	return (
		codePoint >= 0x1100 &&
		(
			codePoint <= 0x115f ||
			codePoint === 0x2329 ||
			codePoint === 0x232a ||
			(codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
			(codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
			(codePoint >= 0xf900 && codePoint <= 0xfaff) ||
			(codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
			(codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
			(codePoint >= 0xff00 && codePoint <= 0xff60) ||
			(codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
			(codePoint >= 0x1f300 && codePoint <= 0x1faff) ||
			(codePoint >= 0x20000 && codePoint <= 0x3fffd)
		)
	);
}
