import {
	EditorSelection,
	RangeSetBuilder,
	type Extension,
	type Text as CodeMirrorText,
} from '@codemirror/state';
import {
	Decoration,
	type DecorationSet,
	ViewPlugin,
	type ViewUpdate,
} from '@codemirror/view';
import { editorLivePreviewField } from 'obsidian';
import { getProtectedLineMask } from '../negative-headings/protected-lines';

interface HeadingMarkerRange {
	from: number;
	to: number;
}

export function createHeadingMarkerCollapseExtension(
	isEnabled: () => boolean,
): Extension {
	return ViewPlugin.fromClass(class {
		decorations: DecorationSet;
		private active: boolean;
		private entries: HeadingMarkerRange[] = [];
		private entriesDirty = false;

		constructor(update: ViewUpdate['view']) {
			this.active = isActive(update.state, isEnabled);
			if (this.active) {
				this.entries = parseHeadingMarkers(update.state.doc);
				this.decorations = buildDecorations(
					this.entries,
					update.state.selection,
				);
			} else {
				this.decorations = Decoration.none;
			}
		}

		update(update: ViewUpdate): void {
			const active = isActive(update.state, isEnabled);
			if (!active) {
				this.active = false;
				this.entries = [];
				this.entriesDirty = false;
				this.decorations = Decoration.none;
				return;
			}
			if (!this.active) {
				this.active = true;
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
				this.entries = parseHeadingMarkers(update.state.doc);
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

function isActive(
	state: ViewUpdate['state'],
	isEnabled: () => boolean,
): boolean {
	return isEnabled() && state.field(editorLivePreviewField, false) !== false;
}

function parseHeadingMarkers(document: CodeMirrorText): HeadingMarkerRange[] {
	const protectedLines = getProtectedLineMask(
		document.toString().split('\n'),
	);
	const entries: HeadingMarkerRange[] = [];
	for (let lineNumber = 1; lineNumber <= document.lines; lineNumber += 1) {
		if (protectedLines[lineNumber - 1] === true) {
			continue;
		}
		const line = document.line(lineNumber);
		const match = /^( {0,3})(#{1,6})([ \t]+)(?=\S)/u.exec(line.text);
		if (!match) {
			continue;
		}
		const indentation = match[1] ?? '';
		const marker = match[2] ?? '';
		const spacing = match[3] ?? '';
		const from = line.from + indentation.length;
		entries.push({
			from,
			to: from + marker.length + spacing.length,
		});
	}
	return entries;
}

function buildDecorations(
	entries: readonly HeadingMarkerRange[],
	selection: EditorSelection,
): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	for (const entry of entries) {
		if (selectionOverlaps(selection, entry.from, entry.to)) {
			continue;
		}
		builder.add(entry.from, entry.to, Decoration.replace({}));
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
	entries: readonly HeadingMarkerRange[],
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
