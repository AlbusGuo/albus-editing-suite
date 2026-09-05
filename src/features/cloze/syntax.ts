export const CLOZE_EMOJI = '⚫';

interface ClozeMatch {
	content: string;
	from: number;
	to: number;
}

function createClozeRegex(): RegExp {
	return /==(⚫(?:[^=\n]|=[^=\n])*?)==/g;
}

function getClozeContent(inner: string): string | null {
	return inner.startsWith(CLOZE_EMOJI)
		? inner.slice(CLOZE_EMOJI.length)
		: null;
}

function isEscapedClozeStart(text: string, start: number): boolean {
	let backslashCount = 0;
	for (let index = start - 1; index >= 0; index--) {
		if (text.charAt(index) !== '\\') {
			break;
		}
		backslashCount++;
	}

	return backslashCount % 2 === 1;
}

export function findClozeMatches(text: string): ClozeMatch[] {
	const matches: ClozeMatch[] = [];
	const regex = createClozeRegex();
	let match: RegExpExecArray | null;

	while ((match = regex.exec(text)) !== null) {
		const inner = match[1];
		if (inner === undefined || isEscapedClozeStart(text, match.index)) {
			continue;
		}

		const content = getClozeContent(inner);
		if (content === null) {
			continue;
		}

		matches.push({
			content,
			from: match.index,
			to: match.index + match[0].length,
		});
	}

	return matches;
}
