import {
	EditorSelection,
	RangeSetBuilder,
	type Extension,
} from '@codemirror/state';
import {
	Decoration,
	type DecorationSet,
	type EditorView,
	ViewPlugin,
	type ViewUpdate,
	WidgetType,
} from '@codemirror/view';
import {
	type CustomListEntry,
	parseCustomListEntries,
} from './parser';

const MARKER_CLASS = 'editing-suite-custom-list-editor-marker';

export function createCustomListEditorExtension(
	isEnabled: () => boolean,
): Extension {
	return ViewPlugin.fromClass(class {
		decorations: DecorationSet;
		private entries: CustomListEntry[] = [];
		private entriesDirty = false;
		private enabled: boolean;

		constructor(view: EditorView) {
			this.enabled = isEnabled();
			if (this.enabled) {
				this.entries = parseCustomListEntries(view.state.doc);
				this.decorations = buildDecorations(
					this.entries,
					view.state.selection,
				);
			} else {
				this.decorations = Decoration.none;
			}
		}

		update(update: ViewUpdate): void {
			const enabled = isEnabled();
			if (!enabled) {
				this.enabled = false;
				this.entries = [];
				this.entriesDirty = false;
				this.decorations = Decoration.none;
				return;
			}
			if (!this.enabled) {
				this.enabled = true;
				this.entriesDirty = true;
			}
			if (update.view.composing) {
				this.decorations = mapDecorations(this.decorations, update);
				if (update.docChanged) {
					this.entriesDirty = true;
				}
				return;
			}
			if (this.entriesDirty || update.docChanged) {
				this.entries = parseCustomListEntries(update.state.doc);
				this.entriesDirty = false;
				this.decorations = buildDecorations(
					this.entries,
					update.state.selection,
				);
				return;
			}
			if (
				update.selectionSet &&
				selectionChangeAffectsEntries(
					this.entries,
					update.startState.selection,
					update.state.selection,
				)
			) {
				this.decorations = buildDecorations(
					this.entries,
					update.state.selection,
				);
			}
		}
	}, {
		decorations: (value) => value.decorations,
	});
}

class CustomListMarkerWidget extends WidgetType {
	constructor(
		private readonly markerText: string,
		private readonly markerColumns: number,
	) {
		super();
	}

	eq(other: CustomListMarkerWidget): boolean {
		return this.markerText === other.markerText &&
			this.markerColumns === other.markerColumns;
	}

	toDOM(view: EditorView): HTMLElement {
		const marker = view.dom.ownerDocument.createElement('span');
		marker.className = [
			'cm-formatting',
			'cm-formatting-list',
			'cm-formatting-list-ol',
			MARKER_CLASS,
		].join(' ');
		marker.textContent = this.markerText;
		marker.style.setProperty(
			'--editing-suite-custom-list-marker-width',
			`${this.markerColumns}ch`,
		);
		return marker;
	}
}

function buildDecorations(
	entries: readonly CustomListEntry[],
	selection: EditorSelection,
): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	for (const entry of entries) {
		if (selectionOverlaps(selection, entry.markerFrom, entry.replaceTo)) {
			continue;
		}
		builder.add(
			entry.markerFrom,
			entry.replaceTo,
			Decoration.replace({
				widget: new CustomListMarkerWidget(
					entry.markerText,
					entry.markerColumns,
				),
			}),
		);
	}
	return builder.finish();
}

function mapDecorations(
	decorations: DecorationSet,
	update: ViewUpdate,
): DecorationSet {
	let mapped = decorations;
	for (const transaction of update.transactions) {
		mapped = mapped.map(transaction.changes);
	}
	return mapped;
}

function selectionChangeAffectsEntries(
	entries: readonly CustomListEntry[],
	previous: EditorSelection,
	current: EditorSelection,
): boolean {
	return entries.some((entry) =>
		selectionOverlaps(previous, entry.markerFrom, entry.replaceTo) ||
		selectionOverlaps(current, entry.markerFrom, entry.replaceTo),
	);
}

function selectionOverlaps(
	selection: EditorSelection,
	from: number,
	to: number,
): boolean {
	return selection.ranges.some((range) =>
		range.from <= to && range.to >= from,
	);
}
