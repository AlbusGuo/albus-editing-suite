import type { MarkdownPostProcessorContext } from 'obsidian';
import { parseNegativeHeadingLine } from './parser';
import {
	collectNegativeHeadingMatches,
	collectReadingBlocks,
	promoteNegativeHeading,
} from './reading-dom';

export function renderNegativeHeadings(
	root: HTMLElement,
	context: MarkdownPostProcessorContext,
	isEnabled: () => boolean,
): void {
	if (!isEnabled()) {
		return;
	}
	for (const block of collectReadingBlocks(root)) {
		transformBlock(block, context);
	}
}

function transformBlock(
	block: HTMLElement,
	context: MarkdownPostProcessorContext,
): void {
	const sourceStates = getSourceStates(block, context);
	const matches = collectNegativeHeadingMatches(block);

	for (const [index, match] of matches.entries()) {
		match.escaped = sourceStates[index] ?? false;
	}

	for (let index = matches.length - 1; index >= 0; index--) {
		const match = matches[index];
		if (match && !match.escaped) {
			promoteNegativeHeading(block, match);
		}
	}
}

function getSourceStates(
	block: HTMLElement,
	context: MarkdownPostProcessorContext,
): boolean[] {
	const section = context.getSectionInfo(block);
	if (!section) {
		return [];
	}

	const lines = section.text.split('\n');
	const states: boolean[] = [];
	for (
		let lineNumber = section.lineStart;
		lineNumber <= section.lineEnd && lineNumber < lines.length;
		lineNumber++
	) {
		const line = lines[lineNumber];
		if (line === undefined) {
			continue;
		}
		const match = parseNegativeHeadingLine(line);
		if (match) {
			states.push(match.escaped);
		}
	}

	return states;
}
