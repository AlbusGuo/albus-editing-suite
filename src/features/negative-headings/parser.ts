interface NegativeHeadingMatch {
	contentFrom: number;
	escaped: boolean;
	tokenFrom: number;
	tokenTo: number;
}

interface NegativeHeadingPrefix {
	content: string;
	prefixEnd: number;
}

const QUOTE_PREFIX = /^(?:(?: {0,3}>)[ \t]?)+/;
const LIST_PREFIX = /^(?:\s*(?:[-*+]|\d+[.)])[ \t]+)/;
const NEGATIVE_HEADING_TOKEN = /^(\\?)-#[ \t]+/;

export function parseNegativeHeadingPrefix(
	line: string,
): NegativeHeadingPrefix | null {
	let prefixEnd = line.match(QUOTE_PREFIX)?.[0].length ?? 0;
	const remainder = line.slice(prefixEnd);
	const listPrefix = remainder.match(LIST_PREFIX)?.[0];

	if (listPrefix) {
		prefixEnd += listPrefix.length;
	} else if (/^[ \t]/.test(remainder)) {
		return null;
	}

	return {
		content: line.slice(prefixEnd),
		prefixEnd,
	};
}

export function parseNegativeHeadingLine(
	line: string,
): NegativeHeadingMatch | null {
	const prefix = parseNegativeHeadingPrefix(line);
	if (!prefix) {
		return null;
	}

	const token = prefix.content.match(NEGATIVE_HEADING_TOKEN);
	if (!token) {
		return null;
	}

	const tokenFrom = prefix.prefixEnd;
	const tokenTo = tokenFrom + token[0].length;
	return {
		contentFrom: tokenTo,
		escaped: token[1] === '\\',
		tokenFrom,
		tokenTo,
	};
}
