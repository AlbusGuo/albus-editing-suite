import {
	type EditorState,
	type Extension,
	type Range,
	StateField,
} from '@codemirror/state';
import {
	Decoration,
	type DecorationSet,
	EditorView,
	ViewPlugin,
	type ViewUpdate,
} from '@codemirror/view';
import { editorLivePreviewField } from 'obsidian';
import {
	applySidenoteLiveEdit,
	buildSidenoteIndex,
	getSelectionSignature,
	type IndexedSidenote,
	selectionTouchesItem,
	sidenoteLiveEditEffect,
	updateSidenoteIndex,
} from './editor-model';
import {
	type SidenoteEditorHost,
	SidenoteMarginWidget,
	SidenoteReferenceWidget,
} from './editor-widgets';

export {
	type SidenoteEditorHost,
	SidenoteEditCoordinator,
} from './editor-widgets';

interface SidenoteFieldValue {
	atomicRanges: DecorationSet;
	decorations: DecorationSet;
	items: IndexedSidenote[];
	selectionSignature: string;
}

export function createSidenoteEditorExtension(
	host: SidenoteEditorHost,
): Extension {
	const field = StateField.define<SidenoteFieldValue>({
		create: (state) => createFieldValue(state, host),
		update: (value, transaction) => {
			if (!transaction.docChanged && !transaction.reconfigured) {
				if (!transaction.selection) {
					return value;
				}
				const selectionSignature = getSelectionSignature(
					transaction.state,
					value.items,
				);
				if (selectionSignature === value.selectionSignature) {
					return value;
				}
			}
			const liveEdit = transaction.effects.find((effect) =>
				effect.is(sidenoteLiveEditEffect),
			)?.value;
			const items = liveEdit
				? applySidenoteLiveEdit(value.items, transaction, liveEdit)
				: transaction.docChanged
					? updateSidenoteIndex(value.items, transaction)
					: value.items;
			return createFieldValue(transaction.state, host, items);
		},
		provide: (stateField) => EditorView.decorations.from(
			stateField,
			(value) => value.decorations,
		),
	});

	const layoutPlugin = ViewPlugin.fromClass(class {
		update(update: ViewUpdate): void {
			if (
				update.selectionSet ||
				update.docChanged ||
				update.viewportChanged ||
				update.geometryChanged
			) {
				host.layout.schedule();
			}
		}
	});

	return [
		field,
		EditorView.atomicRanges.of(
			(view) => view.state.field(field).atomicRanges,
		),
		layoutPlugin,
	];
}

function createFieldValue(
	state: EditorState,
	host: SidenoteEditorHost,
	items: IndexedSidenote[] = buildSidenoteIndex(state),
): SidenoteFieldValue {
	const selectionSignature = getSelectionSignature(state, items);
	if (
		!host.isEnabled() ||
		state.field(editorLivePreviewField, false) === false
	) {
		return {
			atomicRanges: Decoration.none,
			decorations: Decoration.none,
			items,
			selectionSignature,
		};
	}

	const decorations: Range<Decoration>[] = [];
	const atomicRanges: Range<Decoration>[] = [];
	for (const item of items) {
		decorations.push(
			Decoration.widget({
				side: -2,
				widget: new SidenoteMarginWidget(item, host),
			}).range(item.from),
		);
		if (selectionTouchesItem(state, item)) {
			continue;
		}
		decorations.push(
			Decoration.replace({
				widget: new SidenoteReferenceWidget(
					item.number,
					item.contentFrom,
					item.from,
				),
			}).range(item.from, item.to),
		);
		atomicRanges.push(Decoration.mark({}).range(item.from, item.to));
	}

	return {
		atomicRanges: Decoration.set(atomicRanges, true),
		decorations: Decoration.set(decorations, true),
		items,
		selectionSignature,
	};
}
