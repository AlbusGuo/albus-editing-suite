import { hasValidInlineMarkBoundaries } from '../../utils/inline-mark';

export interface SidenoteMatch {
	content: string;
	contentFrom: number;
	contentTo: number;
	from: number;
	to: number;
}

export type SidenotePositionFilter = (position: number) => boolean;

export const SIDENOTE_OPENING = '{{📝';
export const SIDENOTE_CLOSING = '}}';

export function hasValidSidenoteSourceBounds(
	prefix: string,
	suffix: string,
): boolean {
	return (
		prefix.startsWith(SIDENOTE_OPENING) &&
		isHorizontalWhitespaceOnly(
			prefix.slice(SIDENOTE_OPENING.length),
		) &&
		suffix.endsWith(SIDENOTE_CLOSING) &&
		isHorizontalWhitespaceOnly(
			suffix.slice(0, -SIDENOTE_CLOSING.length),
		)
	);
}

export function canAffectSidenoteSyntax(text: string): boolean {
	return /[{}]|📝/u.test(text);
}

export function findSidenoteMatches(
	text: string,
	isExcluded: SidenotePositionFilter = () => false,
): SidenoteMatch[] {
	const matches: SidenoteMatch[] = [];
	let searchFrom = 0;

	while (searchFrom < text.length - SIDENOTE_CLOSING.length + 1) {
		const opening = findOpeningDelimiter(text, searchFrom, isExcluded);
		if (opening < 0) {
			break;
		}

		const rawContentFrom = opening + SIDENOTE_OPENING.length;
		const closing = findClosingDelimiter(
			text,
			rawContentFrom,
			isExcluded,
		);
		if (closing < 0) {
			searchFrom = rawContentFrom;
			continue;
		}

		const contentFrom = skipHorizontalWhitespaceForward(
			text,
			rawContentFrom,
			closing,
		);
		const contentTo = skipHorizontalWhitespaceBackward(
			text,
			closing,
			contentFrom,
		);
		const content = text.slice(contentFrom, contentTo);
		if (hasValidInlineMarkBoundaries(content)) {
			matches.push({
				content,
				contentFrom,
				contentTo,
				from: opening,
				to: closing + SIDENOTE_CLOSING.length,
			});
		}
		searchFrom = closing + SIDENOTE_CLOSING.length;
	}

	return matches;
}

export function findMarkdownSidenoteMatches(text: string): SidenoteMatch[] {
	const excluded = buildExcludedRanges(text);
	return findSidenoteMatches(
		text,
		(position) => rangeContainsPosition(excluded, position),
	);
}

interface SourceRange {
	from: number;
	to: number;
}

function buildExcludedRanges(text: string): SourceRange[] {
	const ranges: SourceRange[] = [];
	const lines = getSourceLines(text);
	let fenceCharacter = '';
	let fenceLength = 0;
	let frontmatter = lines[0]?.text.trim() === '---';

	for (const [index, line] of lines.entries()) {
		if (frontmatter) {
			ranges.push({ from: line.from, to: line.to });
			if (index > 0 && /^(?:---|\.\.\.)\s*$/.test(line.text)) {
				frontmatter = false;
			}
			continue;
		}

		const fence = line.text.match(/^\s{0,3}(`{3,}|~{3,})/)?.[1] ?? '';
		if (fenceCharacter) {
			ranges.push({ from: line.from, to: line.to });
			if (
				fence &&
				fence.charAt(0) === fenceCharacter &&
				fence.length >= fenceLength
			) {
				fenceCharacter = '';
				fenceLength = 0;
			}
			continue;
		}
		if (fence) {
			fenceCharacter = fence.charAt(0);
			fenceLength = fence.length;
			ranges.push({ from: line.from, to: line.to });
			continue;
		}

		collectPairedDelimiterRanges(line, '`', ranges);
		collectPairedDelimiterRanges(line, '$', ranges);
	}
	return ranges.sort((left, right) => left.from - right.from);
}

interface SourceLine {
	from: number;
	text: string;
	to: number;
}

function getSourceLines(text: string): SourceLine[] {
	const lines: SourceLine[] = [];
	let from = 0;
	for (let index = 0; index <= text.length; index++) {
		if (index !== text.length && text.charAt(index) !== '\n') {
			continue;
		}
		const to = index;
		lines.push({
			from,
			text: text.slice(from, to).replace(/\r$/, ''),
			to,
		});
		from = index + 1;
	}
	return lines;
}

function collectPairedDelimiterRanges(
	line: SourceLine,
	delimiter: '`' | '$',
	ranges: SourceRange[],
): void {
	let opening: { length: number; position: number } | null = null;
	for (let index = 0; index < line.text.length;) {
		if (
			line.text.charAt(index) !== delimiter ||
			isEscaped(line.text, index)
		) {
			index++;
			continue;
		}
		let length = 1;
		while (line.text.charAt(index + length) === delimiter) {
			length++;
		}
		if (!opening) {
			opening = { length, position: index };
		} else if (opening.length === length) {
			ranges.push({
				from: line.from + opening.position,
				to: line.from + index + length,
			});
			opening = null;
		}
		index += length;
	}
}

function rangeContainsPosition(
	ranges: readonly SourceRange[],
	position: number,
): boolean {
	let low = 0;
	let high = ranges.length;
	while (low < high) {
		const middle = Math.floor((low + high) / 2);
		const range = ranges[middle];
		if (!range || range.to <= position) {
			low = middle + 1;
		} else {
			high = middle;
		}
	}
	const range = ranges[low];
	return Boolean(range && range.from <= position && position < range.to);
}

function findOpeningDelimiter(
	text: string,
	from: number,
	isExcluded: SidenotePositionFilter,
): number {
	let position = text.indexOf(SIDENOTE_OPENING, from);
	while (position >= 0) {
		const contentStart = position + SIDENOTE_OPENING.length;
		if (
			!isEscaped(text, position) &&
			!isExcluded(position) &&
			contentStart < text.length
		) {
			return position;
		}
		position = text.indexOf(SIDENOTE_OPENING, contentStart);
	}
	return -1;
}

function findClosingDelimiter(
	text: string,
	contentFrom: number,
	isExcluded: SidenotePositionFilter,
): number {
	let braceDepth = 0;
	for (
		let position = contentFrom;
		position < text.length - SIDENOTE_CLOSING.length + 1;
		position++
	) {
		if (isBlankLineStart(text, position)) {
			return -1;
		}
		const character = text.charAt(position);
		if (character === '{' && !isEscaped(text, position)) {
			braceDepth++;
			continue;
		}
		if (character === '}' && braceDepth > 0) {
			braceDepth--;
			continue;
		}
		if (!text.startsWith(SIDENOTE_CLOSING, position)) {
			continue;
		}
		if (
			isEscaped(text, position) ||
			(
				isExcluded(position) &&
				isExcluded(position + SIDENOTE_CLOSING.length - 1)
			)
		) {
			position++;
			continue;
		}
		return position;
	}
	return -1;
}

function isEscaped(text: string, position: number): boolean {
	let backslashes = 0;
	for (let index = position - 1; index >= 0; index--) {
		if (text.charAt(index) !== '\\') {
			break;
		}
		backslashes++;
	}
	return backslashes % 2 === 1;
}

function isHorizontalWhitespace(character: string): boolean {
	return character === ' ' || character === '\t';
}

function isHorizontalWhitespaceOnly(text: string): boolean {
	for (const character of text) {
		if (!isHorizontalWhitespace(character)) {
			return false;
		}
	}
	return true;
}

function skipHorizontalWhitespaceForward(
	text: string,
	position: number,
	limit: number,
): number {
	while (
		position < limit &&
		isHorizontalWhitespace(text.charAt(position))
	) {
		position++;
	}
	return position;
}

function skipHorizontalWhitespaceBackward(
	text: string,
	position: number,
	limit: number,
): number {
	while (
		position > limit &&
		isHorizontalWhitespace(text.charAt(position - 1))
	) {
		position--;
	}
	return position;
}

function isBlankLineStart(text: string, position: number): boolean {
	if (text.charAt(position) !== '\n') {
		return false;
	}
	let cursor = position + 1;
	while (
		text.charAt(cursor) === ' ' ||
		text.charAt(cursor) === '\t' ||
		text.charAt(cursor) === '\r'
	) {
		cursor++;
	}
	return text.charAt(cursor) === '\n';
}
