const QUOTE_PREFIX = /^(?: {0,3}>[ \t]?)+/;

export function getProtectedLineMask(lines: readonly string[]): boolean[] {
	const codeLines = getFencedCodeLineMask(lines);
	const frontmatterLines = getFrontmatterLineMask(lines);
	const protectedLines = codeLines.map(
		(isCode, index) => isCode || frontmatterLines[index] === true,
	);
	let inMathBlock = false;

	for (let index = 0; index < lines.length; index++) {
		if (protectedLines[index] === true) {
			continue;
		}

		const logicalLine = (lines[index] ?? '').replace(QUOTE_PREFIX, '');
		if (logicalLine.trim() === '$$') {
			protectedLines[index] = true;
			inMathBlock = !inMathBlock;
			continue;
		}
		if (inMathBlock) {
			protectedLines[index] = true;
		}
	}

	return protectedLines;
}

function getFencedCodeLineMask(lines: readonly string[]): boolean[] {
	const mask = new Array<boolean>(lines.length).fill(false);
	let fenceCharacter = '';
	let fenceLength = 0;

	for (let index = 0; index < lines.length; index++) {
		const logicalLine = (lines[index] ?? '').replace(QUOTE_PREFIX, '');

		if (!fenceCharacter) {
			const openingFence = logicalLine.match(/^ {0,3}(`{3,}|~{3,})/)?.[1];
			if (!openingFence) {
				continue;
			}

			fenceCharacter = openingFence.charAt(0);
			fenceLength = openingFence.length;
			mask[index] = true;
			continue;
		}

		mask[index] = true;
		const closingFence = logicalLine.match(/^ {0,3}(`+|~+)[ \t]*$/)?.[1];
		if (
			closingFence &&
			closingFence.charAt(0) === fenceCharacter &&
			closingFence.length >= fenceLength
		) {
			fenceCharacter = '';
			fenceLength = 0;
		}
	}

	return mask;
}

function getFrontmatterLineMask(lines: readonly string[]): boolean[] {
	const mask = new Array<boolean>(lines.length).fill(false);
	if (lines[0]?.trim() !== '---') {
		return mask;
	}

	for (let index = 0; index < lines.length; index++) {
		mask[index] = true;
		if (
			index > 0 &&
			(lines[index]?.trim() === '---' || lines[index]?.trim() === '...')
		) {
			break;
		}
	}

	return mask;
}
