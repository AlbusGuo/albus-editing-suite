import { syntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';
import {
	resolveCodeLanguage,
	type CodeLanguageInfo,
} from './language-registry';

export interface CodeBlockModel {
	closeLine: number | null;
	from: number;
	language: CodeLanguageInfo;
	openLine: number;
	to: number;
}

interface PendingCodeBlock {
	from: number;
	language: CodeLanguageInfo;
	openLine: number;
}

export function collectCodeBlocks(state: EditorState): CodeBlockModel[] {
	const blocks: CodeBlockModel[] = [];
	let pending: PendingCodeBlock | null = null;

	syntaxTree(state).iterate({
		enter: (node) => {
			const name = node.type.name.toLowerCase();
			if (name.includes('hypermd-codeblock-begin')) {
				const line = state.doc.lineAt(node.from);
				pending = {
					from: line.from,
					language: resolveCodeLanguage(
						extractFenceLanguage(line.text),
					),
					openLine: line.number,
				};
			} else if (name.includes('hypermd-codeblock-end') && pending) {
				const line = state.doc.lineAt(node.from);
				blocks.push({
					...pending,
					closeLine: line.number,
					to: line.to,
				});
				pending = null;
			}
		},
	});

	const unclosed = pending as PendingCodeBlock | null;
	if (unclosed) {
		blocks.push({
			...unclosed,
			closeLine: null,
			to: state.doc.length,
		});
	}

	return blocks;
}

export function extractFenceLanguage(lineText: string): string {
	const info = lineText.match(/(?:`{3,}|~{3,})(.*)$/)?.[1]?.trim() ?? '';
	if (!info) {
		return '';
	}

	if (info.startsWith('{')) {
		return info
			.slice(1, info.indexOf('}') >= 0 ? info.indexOf('}') : undefined)
			.split(/[\s,]/, 1)[0] ?? '';
	}

	return info.split(/\s/, 1)[0] ?? '';
}
