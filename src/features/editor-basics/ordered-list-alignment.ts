import {
	EditorSelection,
	RangeSetBuilder,
	type Extension,
	type Text as CodeMirrorText,
} from '@codemirror/state';
import {
	Decoration,
	type DecorationSet,
	type EditorView,
	ViewPlugin,
	type ViewUpdate,
	WidgetType,
} from '@codemirror/view';
import { parseCustomListEntries } from '../custom-lists/parser';
import { getProtectedLineMask } from '../negative-headings/protected-lines';

const MARKER_CLASS = 'editing-suite-ordered-list-editor-marker';

interface OrderedListMarkerEntry {
	from: number;
	text: string;
	to: number;
}

export function createOrderedListAlignmentExtension(
	isEnabled: () => boolean,
	isCustomListsEnabled: () => boolean,
): Extension {
	return ViewPlugin.fromClass(class {
		decorations: DecorationSet;
		private customListsEnabled: boolean;
		private enabled: boolean;
		private entries: OrderedListMarkerEntry[] = [];
		private entriesDirty = false;

		constructor(view: EditorView) {
			this.enabled = isEnabled();
			this.customListsEnabled = isCustomListsEnabled();
			if (this.enabled) {
				this.entries = parseOrderedListMarkers(
					view.state.doc,
					this.customListsEnabled,
				);
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
			const customListsEnabled = isCustomListsEnabled();
			if (!enabled) {
				this.enabled = false;
				this.customListsEnabled = customListsEnabled;
				this.entries = [];
				this.entriesDirty = false;
				this.decorations = Decoration.none;
				return;
			}
			if (
				!this.enabled ||
				customListsEnabled !== this.customListsEnabled
			) {
				this.enabled = true;
				this.customListsEnabled = customListsEnabled;
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
				this.entries = parseOrderedListMarkers(
					update.state.doc,
					this.customListsEnabled,
				);
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

function parseOrderedListMarkers(
	document: CodeMirrorText,
	customListsEnabled: boolean,
): OrderedListMarkerEntry[] {
	const protectedLines = getProtectedLineMask(
		document.toString().split('\n'),
	);
	const customMarkerPositions = customListsEnabled
		? new Set(
			parseCustomListEntries(document).map((entry) => entry.markerFrom),
		)
		: new Set<number>();
	const entries: OrderedListMarkerEntry[] = [];

	for (let lineNumber = 1; lineNumber <= document.lines; lineNumber += 1) {
		if (protectedLines[lineNumber - 1] === true) {
			continue;
		}
		const line = document.line(lineNumber);
		const match = /^((?: {0,3}>[ \t]?)*)(\s*)(\d+)([.)])(\s+)/u
			.exec(line.text);
		if (!match) {
			continue;
		}
		const quotePrefix = match[1] ?? '';
		const indent = match[2] ?? '';
		const number = match[3] ?? '';
		const delimiter = match[4] ?? '';
		const spacing = match[5] ?? '';
		const from = line.from + quotePrefix.length + indent.length;
		if (customMarkerPositions.has(from)) {
			continue;
		}
		entries.push({
			from,
			text: `${number}${delimiter}`,
			to: from + number.length + delimiter.length + spacing.length,
		});
	}

	return entries;
}

class OrderedListMarkerWidget extends WidgetType {
	constructor(private readonly markerText: string) {
		super();
	}

	eq(other: OrderedListMarkerWidget): boolean {
		return this.markerText === other.markerText;
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
		return marker;
	}
}

function buildDecorations(
	entries: readonly OrderedListMarkerEntry[],
	selection: EditorSelection,
): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	for (const entry of entries) {
		if (selectionOverlaps(selection, entry.from, entry.to)) {
			continue;
		}
		builder.add(
			entry.from,
			entry.to,
			Decoration.replace({
				widget: new OrderedListMarkerWidget(entry.text),
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
	entries: readonly OrderedListMarkerEntry[],
	previous: EditorSelection,
	current: EditorSelection,
): boolean {
	return entries.some((entry) =>
		selectionOverlaps(previous, entry.from, entry.to) ||
		selectionOverlaps(current, entry.from, entry.to),
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
