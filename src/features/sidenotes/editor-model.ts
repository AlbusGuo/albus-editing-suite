import {
	type EditorState,
	StateEffect,
	type Transaction,
} from '@codemirror/state';
import {
	canAffectSidenoteSyntax,
	findMarkdownSidenoteMatches,
	type SidenoteMatch,
} from './syntax';

export interface IndexedSidenote extends SidenoteMatch {
	number: number;
}

export interface SidenoteLiveEdit {
	content: string;
	from: number;
}

export const sidenoteLiveEditEffect =
	StateEffect.define<SidenoteLiveEdit>();

export function buildSidenoteIndex(state: EditorState): IndexedSidenote[] {
	const matches = findMarkdownSidenoteMatches(state.doc.toString());
	return matches.map((match, index) => ({
		...match,
		number: index + 1,
	}));
}

export function updateSidenoteIndex(
	items: readonly IndexedSidenote[],
	transaction: Transaction,
): IndexedSidenote[] {
	let requiresReparse = false;
	transaction.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
		const removed = transaction.startState.doc.sliceString(fromA, toA);
		const added = inserted.toString();
		if (
			canAffectSidenoteSyntax(removed) ||
			removed.includes('\n') ||
			canAffectSidenoteSyntax(added) ||
			added.includes('\n') ||
			items.some((item) => fromA <= item.to && toA >= item.from)
		) {
			requiresReparse = true;
		}
	});
	if (requiresReparse) {
		return buildSidenoteIndex(transaction.state);
	}
	return items.map((item) => ({
		...item,
		contentFrom: transaction.changes.mapPos(item.contentFrom, 1),
		contentTo: transaction.changes.mapPos(item.contentTo, -1),
		from: transaction.changes.mapPos(item.from, 1),
		to: transaction.changes.mapPos(item.to, -1),
	}));
}

export function applySidenoteLiveEdit(
	items: readonly IndexedSidenote[],
	transaction: Transaction,
	edit: SidenoteLiveEdit,
): IndexedSidenote[] {
	return items.map((item) => {
		if (item.from !== edit.from) {
			return {
				...item,
				contentFrom: transaction.changes.mapPos(item.contentFrom, 1),
				contentTo: transaction.changes.mapPos(item.contentTo, -1),
				from: transaction.changes.mapPos(item.from, 1),
				to: transaction.changes.mapPos(item.to, -1),
			};
		}
		const contentFrom = transaction.changes.mapPos(item.contentFrom, -1);
		return {
			...item,
			content: edit.content,
			contentFrom,
			contentTo: contentFrom + edit.content.length,
			from: transaction.changes.mapPos(item.from, -1),
			to: transaction.changes.mapPos(item.to, 1),
		};
	});
}

export function selectionTouchesItem(
	state: EditorState,
	item: IndexedSidenote,
): boolean {
	return state.selection.ranges.some(
		(selection) => selection.from <= item.to && selection.to >= item.from,
	);
}

export function getSelectionSignature(
	state: EditorState,
	items: readonly IndexedSidenote[],
): string {
	return items
		.filter((item) => selectionTouchesItem(state, item))
		.map((item) => item.from)
		.join(',');
}
