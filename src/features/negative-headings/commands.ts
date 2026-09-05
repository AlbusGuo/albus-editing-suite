import type {
	Editor,
	EditorChange,
	EditorPosition,
	Plugin,
} from 'obsidian';
import {
	parseNegativeHeadingLine,
	parseNegativeHeadingPrefix,
} from './parser';
import { getProtectedLineMask } from './protected-lines';

interface ToggleEntry {
	changeForSet: EditorChange | null;
	changeForUnset: EditorChange | null;
	negative: boolean;
}

export function registerNegativeHeadingCommands(
	plugin: Plugin,
	isEnabled: () => boolean,
): void {
	plugin.addCommand({
		id: 'toggle-negative-heading',
		name: '智能切换负标题',
		editorCheckCallback: (checking, editor) => {
			if (!isEnabled()) {
				return false;
			}
			if (!checking) {
				toggleNegativeHeadings(editor);
			}
			return true;
		},
	});
}

function toggleNegativeHeadings(editor: Editor): void {
	const anchor = editor.getCursor('anchor');
	const head = editor.getCursor('head');
	const from = editor.getCursor('from');
	const to = editor.getCursor('to');
	const hasSelection = from.line !== to.line || from.ch !== to.ch;
	const lines = editor.getValue().split('\n');
	const protectedLines = getProtectedLineMask(lines);
	const entries: ToggleEntry[] = [];

	for (let lineNumber = from.line; lineNumber <= to.line; lineNumber++) {
		const line = lines[lineNumber] ?? '';
		if (
			protectedLines[lineNumber] === true ||
			(hasSelection && from.line !== to.line && !line.trim())
		) {
			continue;
		}

		const entry = createToggleEntry(line, lineNumber);
		if (entry) {
			entries.push(entry);
		}
	}

	if (entries.length === 0) {
		return;
	}

	const negativeCount = entries.filter((entry) => entry.negative).length;
	const shouldUnset = negativeCount > entries.length - negativeCount;
	const changes = entries
		.map((entry) =>
			shouldUnset ? entry.changeForUnset : entry.changeForSet,
		)
		.filter((change): change is EditorChange => change !== null);

	if (changes.length === 0) {
		return;
	}

	editor.transaction({ changes });
	const adjustedAnchor = adjustPosition(anchor, changes);
	const adjustedHead = adjustPosition(head, changes);
	if (hasSelection) {
		editor.setSelection(adjustedAnchor, adjustedHead);
	} else {
		editor.setCursor(adjustedHead);
	}
}

function createToggleEntry(
	line: string,
	lineNumber: number,
): ToggleEntry | null {
	const negativeHeading = parseNegativeHeadingLine(line);
	if (negativeHeading?.escaped) {
		return null;
	}
	if (negativeHeading) {
		return {
			changeForSet: null,
			changeForUnset: {
				text: '',
				from: {
					line: lineNumber,
					ch: negativeHeading.tokenFrom,
				},
				to: {
					line: lineNumber,
					ch: negativeHeading.tokenTo,
				},
			},
			negative: true,
		};
	}

	const prefix = parseNegativeHeadingPrefix(line);
	if (!prefix || /^\\-#(?:[ \t]|$)/.test(prefix.content)) {
		return null;
	}

	const nativeHeading = prefix.content.match(/^#{1,6}[ \t]+/)?.[0];
	return {
		changeForSet: {
			text: '-# ',
			from: {
				line: lineNumber,
				ch: prefix.prefixEnd,
			},
			to: {
				line: lineNumber,
				ch: prefix.prefixEnd + (nativeHeading?.length ?? 0),
			},
		},
		changeForUnset: null,
		negative: false,
	};
}

function adjustPosition(
	position: EditorPosition,
	changes: readonly EditorChange[],
): EditorPosition {
	let character = position.ch;

	for (const change of changes) {
		const to = change.to ?? change.from;
		if (
			change.from.line !== position.line ||
			to.line !== position.line ||
			character < change.from.ch
		) {
			continue;
		}

		const removedLength = to.ch - change.from.ch;
		if (character >= to.ch) {
			character += change.text.length - removedLength;
		} else {
			character = change.from.ch + change.text.length;
		}
	}

	return {
		line: position.line,
		ch: Math.max(0, character),
	};
}
