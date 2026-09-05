import { syntaxTree } from '@codemirror/language';
import type { Line } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

interface BacktickRun {
	end: number;
	length: number;
	start: number;
}

interface SyntaxNodeLike {
	parent: SyntaxNodeLike | null;
	type: {
		name: string;
	};
}

export function isSourceMode(view: EditorView): boolean {
	return (
		view.dom
			.closest('.markdown-source-view')
			?.classList.contains('is-live-preview') === false
	);
}

export function getVisibleDocumentLines(view: EditorView): Line[] {
	const lines: Line[] = [];
	const visitedLines = new Set<number>();

	for (const visibleRange of view.visibleRanges) {
		let line = view.state.doc.lineAt(visibleRange.from);
		while (line.from <= visibleRange.to) {
			if (!visitedLines.has(line.from)) {
				visitedLines.add(line.from);
				lines.push(line);
			}
			if (line.to >= view.state.doc.length) {
				break;
			}
			line = view.state.doc.line(line.number + 1);
		}
	}

	return lines;
}

export function computeFencedCodeLines(documentText: string): boolean[] {
	const lines = documentText.split('\n');
	const codeLines = new Array<boolean>(lines.length).fill(false);
	let isOpen = false;
	let fenceCharacter = '';
	let fenceLength = 0;

	for (const [index, line] of lines.entries()) {
		const fenceText = line.match(/^\s{0,3}(`{3,}|~{3,})/)?.[1];

		if (!isOpen) {
			if (fenceText) {
				isOpen = true;
				fenceCharacter = fenceText.charAt(0);
				fenceLength = fenceText.length;
				codeLines[index] = true;
			}
			continue;
		}

		codeLines[index] = true;
		if (
			fenceText &&
			fenceText.charAt(0) === fenceCharacter &&
			fenceText.length >= fenceLength
		) {
			isOpen = false;
		}
	}

	return codeLines;
}

export function isInsideCode(
	view: EditorView,
	fencedCodeLines: boolean[],
	position: number,
): boolean {
	const line = view.state.doc.lineAt(position);
	if (fencedCodeLines[line.number - 1] === true) {
		return true;
	}

	return isInsideInlineCode(line.text, position - line.from);
}

export function isExcludedMarkdownPosition(
	view: EditorView,
	position: number,
): boolean {
	const tree = syntaxTree(view.state);
	if (tree.length === 0) {
		return false;
	}

	const resolvedPosition = Math.max(0, Math.min(position, tree.length - 1));
	let node = tree.resolveInner(resolvedPosition, 1) as SyntaxNodeLike | null;

	while (node) {
		const name = node.type.name.toLowerCase();
		if (
			name.includes('code') ||
			name.includes('math') ||
			name.includes('html') ||
			name.includes('frontmatter')
		) {
			return true;
		}
		node = node.parent;
	}

	return false;
}

function isInsideInlineCode(lineText: string, character: number): boolean {
	const runs: BacktickRun[] = [];
	const backticks = /`+/g;
	let match: RegExpExecArray | null;

	while ((match = backticks.exec(lineText)) !== null) {
		runs.push({
			end: match.index + match[0].length,
			length: match[0].length,
			start: match.index,
		});
	}

	for (let openingIndex = 0; openingIndex < runs.length; openingIndex++) {
		const opening = runs[openingIndex];
		if (!opening) {
			continue;
		}

		for (
			let closingIndex = openingIndex + 1;
			closingIndex < runs.length;
			closingIndex++
		) {
			const closing = runs[closingIndex];
			if (!closing || closing.length !== opening.length) {
				continue;
			}

			if (character >= opening.end && character < closing.start) {
				return true;
			}
			openingIndex = closingIndex;
			break;
		}
	}

	return false;
}
