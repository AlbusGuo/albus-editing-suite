import type { EditorView } from '@codemirror/view';

const editorViewIds = new WeakMap<EditorView, number>();
let nextEditorViewId = 1;
let nextReadingInstanceId = 1;

export function getEditorSidenoteInstanceId(
	view: EditorView,
	sourceId: number,
): string {
	let viewId = editorViewIds.get(view);
	if (viewId === undefined) {
		viewId = nextEditorViewId++;
		editorViewIds.set(view, viewId);
	}
	return `editor-${viewId}-${sourceId}`;
}

export function createReadingSidenoteInstanceId(): string {
	return `reading-${nextReadingInstanceId++}`;
}
