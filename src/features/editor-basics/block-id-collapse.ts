import { syntaxTree } from '@codemirror/language';
import {
	type EditorSelection,
	type EditorState,
	type Extension,
	type Range,
} from '@codemirror/state';
import {
	Decoration,
	type DecorationSet,
	type EditorView,
	ViewPlugin,
	type ViewUpdate,
} from '@codemirror/view';
import { isSourceMode } from '../../utils/editor-context';

const COLLAPSED_LINE_CLASS = 'editing-suite-collapsed-block-id-line';
const BLOCK_ID_PATTERN = /^\^[A-Za-z0-9-]+$/u;
const HIDDEN_ID = Decoration.replace({});

interface BlockIdEntry {
	from: number;
	lineFrom: number;
	ownerFrom: number;
	ownerTo: number;
	standalone: boolean;
	to: number;
}

export function createBlockIdCollapseExtension(
	isEnabled: () => boolean,
): Extension {
	return ViewPlugin.fromClass(class {
		decorations: DecorationSet;
		private enabled: boolean;
		private entries: BlockIdEntry[];

		constructor(view: EditorView) {
			this.enabled = isEnabled();
			this.entries = this.enabled ? collectBlockIds(view.state) : [];
			this.decorations = buildDecorations(
				view,
				this.entries,
				this.enabled,
			);
		}

		update(update: ViewUpdate): void {
			const enabled = isEnabled();
			const syntaxChanged =
				update.docChanged ||
				syntaxTree(update.startState) !== syntaxTree(update.state);
			const reconfigured = update.transactions.some(
				(transaction) => transaction.reconfigured,
			);
			if (enabled && (!this.enabled || syntaxChanged || reconfigured)) {
				this.entries = collectBlockIds(update.state);
			} else if (!enabled) {
				this.entries = [];
			}
			if (
				enabled !== this.enabled ||
				syntaxChanged ||
				reconfigured ||
				update.selectionSet
			) {
				this.decorations = buildDecorations(
					update.view,
					this.entries,
					enabled,
				);
			}
			this.enabled = enabled;
		}
	}, {
		decorations: (value) => value.decorations,
	});
}

function collectBlockIds(state: EditorState): BlockIdEntry[] {
	const entries: BlockIdEntry[] = [];
	const seen = new Set<string>();
	const tree = syntaxTree(state);
	tree.iterate({
		enter: (node) => {
			if (!node.type.name.toLowerCase().includes('blockid')) {
				return;
			}
			const text = state.sliceDoc(node.from, node.to);
			if (!BLOCK_ID_PATTERN.test(text)) {
				return;
			}
			const key = `${node.from}:${node.to}`;
			if (seen.has(key)) {
				return;
			}
			seen.add(key);
			const line = state.doc.lineAt(node.from);
			const beforeId = line.text.slice(0, node.from - line.from);
			const standalone = stripQuotePrefix(beforeId).trim() === '';
			const owner = standalone
				? resolveStandaloneOwner(state, node.from, node.to)
				: { from: line.from, to: line.to };
			entries.push({
				from: node.from,
				lineFrom: line.from,
				ownerFrom: owner.from,
				ownerTo: owner.to,
				standalone,
				to: node.to,
			});
		},
	});
	return entries.sort((left, right) => left.from - right.from);
}

function resolveStandaloneOwner(
	state: EditorState,
	from: number,
	to: number,
): { from: number; to: number } {
	const line = state.doc.lineAt(from);
	let node = syntaxTree(state).resolveInner(from, 1);
	while (node.parent) {
		node = node.parent;
		if (node.type.name.toLowerCase() === 'document') {
			break;
		}
		if (node.from < line.from && node.to >= to) {
			return { from: node.from, to: line.to };
		}
	}
	if (line.number > 1) {
		const previous = state.doc.line(line.number - 1);
		if (previous.text.trim() !== '') {
			return { from: previous.from, to: line.to };
		}
	}
	return { from: line.from, to: line.to };
}

function buildDecorations(
	view: EditorView,
	entries: readonly BlockIdEntry[],
	enabled: boolean,
): DecorationSet {
	if (!enabled || isSourceMode(view)) {
		return Decoration.none;
	}
	const decorations: Range<Decoration>[] = [];
	for (const entry of entries) {
		if (selectionTouchesOwner(view.state.selection, entry)) {
			continue;
		}
		decorations.push(HIDDEN_ID.range(entry.from, entry.to));
		if (entry.standalone) {
			decorations.push(
				Decoration.line({ class: COLLAPSED_LINE_CLASS })
					.range(entry.lineFrom),
			);
		}
	}
	return Decoration.set(decorations, true);
}

function selectionTouchesOwner(
	selection: EditorSelection,
	entry: BlockIdEntry,
): boolean {
	return selection.ranges.some((range) =>
		range.from <= entry.ownerTo && range.to >= entry.ownerFrom,
	);
}

function stripQuotePrefix(text: string): string {
	return text.replace(/^(?: {0,3}>[ \t]?)+/u, '');
}
