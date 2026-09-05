import type { App } from 'obsidian';

export function getAppDocuments(app: App): Document[] {
	const documents = new Set<Document>();
	const addDocument = (document: Document | null | undefined): void => {
		if (document?.documentElement && document.body) {
			documents.add(document);
		}
	};

	addDocument(window.document);
	if (typeof activeDocument !== 'undefined') {
		addDocument(activeDocument);
	}
	addDocument(app.workspace.containerEl.ownerDocument);
	app.workspace.iterateAllLeaves((leaf) => {
		addDocument(leaf.view.containerEl.ownerDocument);
	});

	return Array.from(documents);
}
