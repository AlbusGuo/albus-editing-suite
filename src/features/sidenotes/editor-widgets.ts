import type { EditorState } from '@codemirror/state';
import {
	EditorView,
	WidgetType,
} from '@codemirror/view';
import {
	type App,
	type MarkdownView,
	MarkdownRenderChild,
	MarkdownRenderer,
} from 'obsidian';
import {
	type IndexedSidenote,
	sidenoteLiveEditEffect,
} from './editor-model';
import {
	type InlineEditorHandle,
	openInlineMarkdownEditor,
} from './inline-editor';
import type { SidenoteLayoutController } from './layout';
import {
	setupSidenotePopup,
	toggleSidenotePopup,
} from './popup';
import {
	SIDENOTE_CLOSING,
	SIDENOTE_OPENING,
	findSidenoteMatches,
	hasValidSidenoteSourceBounds,
} from './syntax';
import { getEditorSidenoteInstanceId } from './instance-id';
import { observeSidenoteImages } from './image-support';

export interface SidenoteEditorHost {
	app: App;
	coordinator: SidenoteEditCoordinator;
	getMarkdownView(view: EditorView): MarkdownView | null;
	getSourcePath(view: EditorView): string;
	isEnabled(): boolean;
	layout: SidenoteLayoutController;
}

interface WidgetCleanup {
	closeEditor: ((commit: boolean) => void) | null;
	disposeImages: () => void;
	disposeLayout: () => void;
	disposePopup: () => void;
	host: SidenoteEditorHost;
	item: IndexedSidenote;
	renderChild: MarkdownRenderChild | null;
	renderVersion: number;
	view: EditorView;
}

const widgetCleanups = new WeakMap<HTMLElement, WidgetCleanup>();
const FOCUS_INDICATOR_SUPPRESSION_CLASS =
	'editing-suite-focus-indicator-suppressed';

export class SidenoteEditCoordinator {
	private activeClose: ((commit: boolean) => void) | null = null;
	private pendingEdit: {
		containerEl: HTMLElement;
		expiresAt: number;
		sourcePosition: number;
	} | null = null;

	begin(closeCurrent: (commit: boolean) => void): void {
		this.activeClose?.(true);
		this.activeClose = closeCurrent;
	}

	finish(closeCurrent: (commit: boolean) => void): void {
		if (this.activeClose === closeCurrent) {
			this.activeClose = null;
		}
	}

	request(sourcePosition: number, containerEl: HTMLElement): void {
		this.pendingEdit = {
			containerEl,
			expiresAt: Date.now() + 2000,
			sourcePosition,
		};
	}

	consume(sourcePosition: number, view: EditorView): boolean {
		const pending = this.pendingEdit;
		if (!pending) {
			return false;
		}
		if (pending.expiresAt < Date.now()) {
			this.pendingEdit = null;
			return false;
		}
		if (
			pending.sourcePosition !== sourcePosition ||
			!pending.containerEl.contains(view.dom)
		) {
			return false;
		}
		this.pendingEdit = null;
		return true;
	}

	dispose(): void {
		this.activeClose?.(false);
		this.activeClose = null;
		this.pendingEdit = null;
	}
}

export class SidenoteReferenceWidget extends WidgetType {
	constructor(
		private readonly number: number,
		private readonly sourcePosition: number,
		private readonly sourceId: number,
	) {
		super();
	}

	eq(other: SidenoteReferenceWidget): boolean {
		return (
			this.number === other.number &&
			this.sourcePosition === other.sourcePosition &&
			this.sourceId === other.sourceId
		);
	}

	toDOM(view: EditorView): HTMLElement {
		const instanceId = getEditorSidenoteInstanceId(
			view,
			this.sourceId,
		);
		const reference = view.dom.ownerDocument.createElement('sup');
		reference.className = 'editing-suite-sidenote-reference';
		reference.dataset.sidenoteInstance = instanceId;
		const link = view.dom.ownerDocument.createElement('a');
		link.className =
			'footnote-ref editing-suite-sidenote-reference-link';
		link.textContent = String(this.number);
		link.setAttribute('role', 'button');
		link.setAttribute('aria-description', `编辑边注 ${this.number}`);
		link.tabIndex = 0;
		let suppressClickUntil = 0;
		const findAnchor = (): HTMLElement | undefined => Array.from(
			view.dom.querySelectorAll<HTMLElement>(
				'.editing-suite-sidenote-anchor',
			),
		).find(
			(candidate) => candidate.dataset.sidenoteInstance === instanceId,
		);
		const activate = (focusPopup: boolean): void => {
			const anchor = findAnchor();
			if (anchor?.classList.contains('is-popup-only')) {
				toggleSidenotePopup(anchor, focusPopup);
				return;
			}
			view.dispatch({ selection: { anchor: this.sourcePosition } });
			view.focus();
		};
		link.addEventListener('pointerdown', (event) => {
			const anchor = findAnchor();
			if (!anchor?.classList.contains('is-popup-only')) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			suppressClickUntil = event.timeStamp + 750;
			toggleSidenotePopup(anchor);
		});
		link.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();
			if (event.timeStamp <= suppressClickUntil) {
				suppressClickUntil = 0;
				return;
			}
			activate(false);
		});
		link.addEventListener('keydown', (event) => {
			if (event.key !== 'Enter' && event.key !== ' ') {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			activate(true);
		});
		reference.appendChild(link);
		return reference;
	}

	ignoreEvent(): boolean {
		return true;
	}
}

export class SidenoteMarginWidget extends WidgetType {
	constructor(
		private readonly item: IndexedSidenote,
		private readonly host: SidenoteEditorHost,
	) {
		super();
	}

	eq(other: SidenoteMarginWidget): boolean {
		return (
			this.item.from === other.item.from &&
			this.item.to === other.item.to &&
			this.item.content === other.item.content &&
			this.item.number === other.item.number
		);
	}

	toDOM(view: EditorView): HTMLElement {
		const document = view.dom.ownerDocument;
		const anchor = document.createElement('span');
		anchor.className = 'editing-suite-sidenote-anchor';
		anchor.dataset.sidenoteInstance = getEditorSidenoteInstanceId(
			view,
			this.item.from,
		);
		anchor.dataset.sidenoteNumber = String(this.item.number);

		const margin = document.createElement('aside');
		margin.className = 'editing-suite-sidenote-margin';
		margin.dataset.sidenoteNumber = String(this.item.number);
		const number = document.createElement('span');
		number.className = 'editing-suite-sidenote-number';
		number.textContent = String(this.item.number);
		const content = document.createElement('div');
		content.className = 'editing-suite-sidenote-content';
		margin.append(number, content);
		anchor.appendChild(margin);

		const disposeLayout = this.host.layout.register(anchor, margin);
		const disposePopup = setupSidenotePopup(anchor);
		const cleanup: WidgetCleanup = {
			closeEditor: null,
			disposeImages: () => undefined,
			disposeLayout,
			disposePopup,
			host: this.host,
			item: this.item,
			renderChild: null,
			renderVersion: 0,
			view,
		};
		widgetCleanups.set(anchor, cleanup);
		const autoEdit = this.host.coordinator.consume(this.item.from, view);
		if (autoEdit) {
			queueMicrotask(() => {
				if (anchor.isConnected && widgetCleanups.has(anchor)) {
					if (
						anchor.classList.contains('is-popup-only') &&
						!anchor.classList.contains('is-popup-open')
					) {
						toggleSidenotePopup(anchor);
					}
					this.openEditor(
						view,
						margin,
						content,
						cleanup,
						true,
					);
				}
			});
		} else {
			void this.renderContent(view, content, cleanup);
		}

		margin.addEventListener('pointerdown', (event) => {
			const target = event.target as Element | null;
			if (target?.closest('.editing-suite-reading-cloze')) {
				event.stopPropagation();
				return;
			}
			if (target?.closest(
				'a, button, [role="button"], ' +
				'.editing-suite-sidenote-cm-editor',
			)) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			this.openEditor(view, margin, content, cleanup);
		});

		return anchor;
	}

	updateDOM(dom: HTMLElement, view: EditorView): boolean {
		const cleanup = widgetCleanups.get(dom);
		if (!cleanup || cleanup.host !== this.host) {
			return false;
		}
		const contentChanged = cleanup.item.content !== this.item.content;
		const anchorChanged =
			cleanup.item.from !== this.item.from ||
			cleanup.item.number !== this.item.number;
		cleanup.item = this.item;
		cleanup.view = view;
		dom.dataset.sidenoteInstance = getEditorSidenoteInstanceId(
			view,
			this.item.from,
		);
		dom.dataset.sidenoteNumber = String(this.item.number);
		const margin = dom.querySelector<HTMLElement>(
			':scope > .editing-suite-sidenote-margin',
		);
		const content = margin?.querySelector<HTMLElement>(
			':scope > .editing-suite-sidenote-content',
		);
		const number = margin?.querySelector<HTMLElement>(
			':scope > .editing-suite-sidenote-number',
		);
		if (!margin || !content || !number) {
			return false;
		}
		margin.dataset.sidenoteNumber = String(this.item.number);
		margin.removeAttribute('aria-label');
		margin.setAttribute('aria-description', `边注 ${this.item.number}`);
		number.textContent = String(this.item.number);
		if (contentChanged && margin.dataset.editing !== 'true') {
			void this.renderContent(view, content, cleanup);
		}
		if (anchorChanged) {
			this.host.layout.schedule();
		}
		return true;
	}

	destroy(dom: HTMLElement): void {
		const cleanup = widgetCleanups.get(dom);
		if (!cleanup) {
			return;
		}
		cleanup.closeEditor?.(false);
		cleanup.disposeImages();
		cleanup.disposeLayout();
		cleanup.disposePopup();
		cleanup.renderVersion++;
		cleanup.renderChild?.unload();
		widgetCleanups.delete(dom);
	}

	ignoreEvent(): boolean {
		return false;
	}

	private async renderContent(
		view: EditorView,
		content: HTMLElement,
		cleanup: WidgetCleanup,
	): Promise<void> {
		const renderVersion = ++cleanup.renderVersion;
		cleanup.disposeImages();
		cleanup.disposeImages = () => undefined;
		cleanup.renderChild?.unload();
		const renderTarget = content.ownerDocument.createElement('div');
		renderTarget.className =
			'editing-suite-sidenote-rendered-content markdown-rendered';
		content.replaceChildren(renderTarget);
		const renderChild = new MarkdownRenderChild(renderTarget);
		renderChild.load();
		cleanup.renderChild = renderChild;
		try {
			await MarkdownRenderer.render(
				this.host.app,
				cleanup.item.content,
				renderTarget,
				this.host.getSourcePath(view),
				renderChild,
			);
		} catch {
			renderTarget.textContent = this.item.content;
		}
		if (cleanup.renderVersion !== renderVersion) {
			renderChild.unload();
			renderTarget.remove();
			return;
		}
		cleanup.disposeImages = observeSidenoteImages(
			renderTarget,
			() => this.host.layout.schedule(),
		);
	}

	private openEditor(
		view: EditorView,
		margin: HTMLElement,
		content: HTMLElement,
		cleanup: WidgetCleanup,
		selectAll = false,
	): void {
		if (margin.dataset.editing === 'true') {
			return;
		}
		cleanup.renderVersion++;
		cleanup.disposeImages();
		cleanup.disposeImages = () => undefined;
		cleanup.renderChild?.unload();
		cleanup.renderChild = null;
		margin.dataset.editing = 'true';
		margin.ownerDocument.body.classList.add(
			FOCUS_INDICATOR_SUPPRESSION_CLASS,
		);
		content.replaceChildren();
		const markdownView = this.host.getMarkdownView(view);
		const originalText = cleanup.item.content;
		let inlineEditor: InlineEditorHandle;
		const close = (commit: boolean): void => {
			inlineEditor.close({ commit });
		};
		inlineEditor = openInlineMarkdownEditor({
			app: this.host.app,
			doc: cleanup.item.content,
			markdownView,
			selectAll,
			onChange: (value) => {
				this.applyLiveEdit(cleanup, value);
			},
			parent: content,
			onClose: (result) => {
				cleanup.closeEditor = null;
				this.host.coordinator.finish(close);
				margin.dataset.editing = 'false';
				releaseFocusIndicatorSuppression(margin.ownerDocument);
				const draft = result.committed
					? normalizeDraft(result.text)
					: originalText;
				this.applyLiveEdit(cleanup, draft);
				void this.renderContent(cleanup.view, content, cleanup);
				view.focus();
			},
		});
		cleanup.closeEditor = close;
		this.host.coordinator.begin(close);
	}

	private applyLiveEdit(
		cleanup: WidgetCleanup,
		content: string,
	): boolean {
		const { item, view } = cleanup;
		if (
			content === item.content ||
			!isPersistableDraft(content) ||
			!this.sourceStillMatches(view.state, item)
		) {
			return content === item.content;
		}
		view.dispatch({
			changes: {
				from: item.contentFrom,
				to: item.contentTo,
				insert: content,
			},
			effects: sidenoteLiveEditEffect.of({
				content,
				from: item.from,
			}),
		});
		cleanup.item = {
			...item,
			content,
			contentTo: item.contentFrom + content.length,
			to: item.to + content.length - item.content.length,
		};
		return true;
	}

	private sourceStillMatches(
		state: EditorState,
		item: IndexedSidenote,
	): boolean {
		return hasValidSidenoteSourceBounds(
			state.doc.sliceString(item.from, item.contentFrom),
			state.doc.sliceString(item.contentTo, item.to),
		);
	}
}

function releaseFocusIndicatorSuppression(document: Document): void {
	document.defaultView?.queueMicrotask(() => {
		if (
			document.querySelector(
				'.editing-suite-sidenote-margin[data-editing="true"]',
			) === null
		) {
			document.body.classList.remove(
				FOCUS_INDICATOR_SUPPRESSION_CLASS,
			);
		}
	});
}

function isPersistableDraft(text: string): boolean {
	const wrapped = `${SIDENOTE_OPENING}${text}${SIDENOTE_CLOSING}`;
	const match = findSidenoteMatches(wrapped)[0];
	return Boolean(
		match &&
		match.from === 0 &&
		match.to === wrapped.length &&
		match.content === text,
	);
}

function normalizeDraft(text: string): string {
	return text
		.replace(/\r\n?/g, '\n')
		.replace(/\n[ \t]*\n+/g, '\n')
		.trim();
}
