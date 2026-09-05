import { Prec, StateEffect } from '@codemirror/state';
import {
	EditorView,
	keymap,
	type ViewUpdate,
} from '@codemirror/view';
import {
	type App,
	type MarkdownFileInfo,
	type MarkdownView,
	type TFile,
} from 'obsidian';
import { isCommandSurface } from './dom-utils';

const REGISTER_CUSTOM_BUTTONS_EDITOR_EVENT =
	'albus-custom-buttons:register-editor-view';

export interface InlineEditorCloseResult {
	committed: boolean;
	text: string;
}

export interface InlineEditorHandle {
	close(options: { commit: boolean }): void;
}

interface InlineEditorOptions {
	app: App;
	doc: string;
	markdownView: MarkdownView | null;
	onChange(value: string): void;
	onClose(result: InlineEditorCloseResult): void;
	parent: HTMLElement;
	selectAll?: boolean;
}

interface EmbeddedMarkdownEditor {
	editMode: object;
	editable: boolean;
	showEditor(): void;
	unload(): void;
}

interface MarkdownEmbedRegistry {
	embedByExtension: {
		md(
			owner: { app: App; containerEl: HTMLElement },
			file: TFile | null,
			subpath: string,
		): EmbeddedMarkdownEditor;
	};
}

interface AppWithEmbedRegistry extends App {
	embedRegistry: MarkdownEmbedRegistry;
}

interface NativeMarkdownEditor {
	cm: EditorView;
}

interface NativeMarkdownEditMode {
	_loaded?: boolean;
	editor: NativeMarkdownEditor;
	onUpdate(update: ViewUpdate, changed: boolean): void;
	set(data: string, clear: boolean): void;
	unload(): void;
}

interface NativeMarkdownOwner {
	app: App;
	editMode: NativeMarkdownEditMode | null;
	editor: NativeMarkdownEditor | null;
	file: TFile | null;
	getFile(): TFile | null;
	getMode(): 'source';
	onMarkdownScroll(): void;
	requestSave(): void;
	save(): void;
	syncScroll(): void;
	toggleMode(): void;
}

interface ToggleableMarkdownView extends MarkdownView {
	toggleMode(): void;
}

type NativeMarkdownEditModeConstructor = new (
	app: App,
	container: HTMLElement,
	owner: NativeMarkdownOwner,
) => NativeMarkdownEditMode;

const editModeConstructors = new WeakMap<
	App,
	NativeMarkdownEditModeConstructor
>();
const inlineMarkdownEditors = new WeakSet<object>();

export function isInlineMarkdownEditor(editor: unknown): boolean {
	if (typeof editor !== 'object' || editor === null) {
		return false;
	}
	if (inlineMarkdownEditors.has(editor)) {
		return true;
	}
	const view = (editor as { cm?: EditorView }).cm;
	return Boolean(
		view?.dom.closest(
			'.editing-suite-sidenote-content, ' +
				'.editing-suite-sidenote-margin',
		),
	);
}

export function openInlineMarkdownEditor(
	options: InlineEditorOptions,
): InlineEditorHandle {
	const previousActiveEditor = options.app.workspace.activeEditor;
	let handle: InlineEditorHandle | null = null;
	const owner: NativeMarkdownOwner = {
		app: options.app,
		editMode: null,
		editor: null,
		file: options.markdownView?.file ?? null,
		getFile: () => options.markdownView?.file ?? null,
		getMode: () => 'source',
		onMarkdownScroll: () => undefined,
		requestSave: () => undefined,
		save: () => undefined,
		syncScroll: () => undefined,
		toggleMode: () => {
			const markdownView = options.markdownView as
				ToggleableMarkdownView | null;
			handle?.close({ commit: true });
			if (typeof markdownView?.toggleMode === 'function') {
				markdownView.toggleMode();
			}
		},
	};
	const EditMode = getMarkdownEditModeConstructor(
		options.app,
		options.parent.ownerDocument,
	);
	const editMode = new EditMode(options.app, options.parent, owner);
	owner.editMode = editMode;
	owner.editor = editMode.editor;
	inlineMarkdownEditors.add(editMode.editor);
	editMode.set(options.doc, false);

	const view = editMode.editor.cm;
	const activeOwner = owner as unknown as MarkdownFileInfo;
	view.dom.classList.add('editing-suite-sidenote-cm-editor');
	let closed = false;
	let outsidePointerDown: ((event: PointerEvent) => void) | null = null;
	let commandSurfacePointerUp: ((event: PointerEvent) => void) | null = null;
	let commandContextKeyDown: ((event: KeyboardEvent) => void) | null = null;
	let commandContextFocusIn: ((event: FocusEvent) => void) | null = null;
	let pendingCompositionText: string | null = null;
	const contentEditableObserver = new MutationObserver(() => {
		ensureContentEditable(view);
	});
	const activateInlineEditor = (): void => {
		if (!closed) {
			options.app.workspace.activeEditor = activeOwner;
		}
	};
	const handleEditorFocusIn = (): void => {
		activateInlineEditor();
		requestSelectionToolbarRegistration(view);
	};
	const ensureEditableOnMouseDown = (): void => {
		ensureContentEditable(view);
		activateInlineEditor();
	};
	const stopOuterPropagation = (event: Event): void => {
		event.stopPropagation();
	};
	const ownsCommandTarget = (target: EventTarget | null): boolean => {
		if (!(target instanceof view.dom.ownerDocument.defaultView!.Node)) {
			return false;
		}
		if (view.dom.contains(target)) {
			return true;
		}
		return target.nodeType === 1 && isCommandSurface(target as Element);
	};
	const onCompositionEnd = (): void => {
		const animationWindow = view.dom.ownerDocument.defaultView;
		animationWindow?.requestAnimationFrame(() => {
			if (closed) {
				return;
			}
			const value = pendingCompositionText ?? view.state.doc.toString();
			pendingCompositionText = null;
			options.onChange(value);
		});
	};
	view.dispatch({
		effects: StateEffect.appendConfig.of([
			createSidenoteEditorTheme(options.parent),
			Prec.highest(keymap.of([
				{
					key: 'Escape',
					preventDefault: true,
					run: () => {
						handle?.close({ commit: false });
						return true;
					},
				},
				{
					key: 'Mod-Enter',
					preventDefault: true,
					run: () => {
						handle?.close({ commit: true });
						return true;
					},
				},
			])),
		]),
	});

	const originalOnUpdate = editMode.onUpdate.bind(editMode);
	editMode.onUpdate = (update, changed): void => {
		originalOnUpdate(update, changed);
		if (changed) {
			const value = view.state.doc.toString();
			if (view.composing) {
				pendingCompositionText = value;
			} else {
				pendingCompositionText = null;
				options.onChange(value);
			}
		}
	};

	ensureContentEditable(view);
	contentEditableObserver.observe(view.contentDOM, {
		attributeFilter: ['contenteditable'],
		attributes: true,
	});
	view.contentDOM.addEventListener('compositionend', onCompositionEnd);
	view.dom.addEventListener('focusin', handleEditorFocusIn, true);
	view.dom.addEventListener('keydown', activateInlineEditor, true);
	options.parent.addEventListener(
		'mousedown',
		ensureEditableOnMouseDown,
		true,
	);
	for (const eventName of [
		'click',
		'dblclick',
		'mousedown',
		'pointerdown',
	] as const) {
		view.dom.addEventListener(eventName, stopOuterPropagation);
	}

	const inlineEditorHandle: InlineEditorHandle = {
		close: (closeOptions) => {
			if (closed) {
				return;
			}
			closed = true;
			inlineMarkdownEditors.delete(editMode.editor);
			const text = view.state.doc.toString();
			if (outsidePointerDown) {
				view.dom.ownerDocument.removeEventListener(
					'pointerdown',
					outsidePointerDown,
					true,
				);
				outsidePointerDown = null;
			}
			if (commandSurfacePointerUp) {
				view.dom.ownerDocument.removeEventListener(
					'pointerup',
					commandSurfacePointerUp,
					true,
				);
				commandSurfacePointerUp = null;
			}
			const ownerWindow = view.dom.ownerDocument.defaultView;
			if (commandContextKeyDown && ownerWindow) {
				ownerWindow.removeEventListener(
					'keydown',
					commandContextKeyDown,
					true,
				);
				commandContextKeyDown = null;
			}
			if (commandContextFocusIn) {
				view.dom.ownerDocument.removeEventListener(
					'focusin',
					commandContextFocusIn,
					true,
				);
				commandContextFocusIn = null;
			}
			contentEditableObserver.disconnect();
			view.contentDOM.removeEventListener(
				'compositionend',
				onCompositionEnd,
			);
			view.dom.removeEventListener('focusin', handleEditorFocusIn, true);
			view.dom.removeEventListener(
				'keydown',
				activateInlineEditor,
				true,
			);
			options.parent.removeEventListener(
				'mousedown',
				ensureEditableOnMouseDown,
				true,
			);
			for (const eventName of [
				'click',
				'dblclick',
				'mousedown',
				'pointerdown',
			] as const) {
				view.dom.removeEventListener(eventName, stopOuterPropagation);
			}
			editMode.onUpdate = () => undefined;
			const activeBeforeUnload = options.app.workspace.activeEditor;
			const activeBeforeUnloadWasInline = isInlineEditorActive(
				activeBeforeUnload,
				owner,
				editMode.editor,
				view,
			);
			const restoreTarget = options.markdownView ?? previousActiveEditor;
			if (editMode._loaded !== false) {
				editMode.unload();
			}
			if (options.markdownView) {
				owner.editor = options.markdownView.editor as unknown as
					NativeMarkdownEditor;
				if (activeBeforeUnloadWasInline && activeBeforeUnload) {
					redirectEditorToMarkdownView(
						activeBeforeUnload,
						options.markdownView,
					);
				}
			}
			const restoreActiveEditor = (): void => {
				const activeEditor = options.app.workspace.activeEditor;
				if (
					activeEditor === null ||
					isInlineEditorActive(
						activeEditor,
						owner,
						editMode.editor,
						view,
					)
				) {
					options.app.workspace.activeEditor = restoreTarget;
				}
			};
			options.app.workspace.activeEditor = restoreTarget;
			options.onClose({
				committed: closeOptions.commit,
				text,
			});
			view.dom.ownerDocument.defaultView?.queueMicrotask(
				restoreActiveEditor,
			);
		},
	};
	handle = inlineEditorHandle;

	outsidePointerDown = (event: PointerEvent): void => {
		const target = event.target as Node | null;
		if (
			!target ||
			view.dom.contains(target) ||
			options.parent.contains(target)
		) {
			return;
		}
		if (
			target.nodeType === 1 &&
			isCommandSurface(target as Element)
		) {
			activateInlineEditor();
			return;
		}
		handle?.close({ commit: true });
	};
	commandSurfacePointerUp = (event: PointerEvent): void => {
		const target = event.target as Node | null;
		if (
			target?.nodeType === 1 &&
			isCommandSurface(target as Element)
		) {
			activateInlineEditor();
		}
	};
	commandContextKeyDown = (event: KeyboardEvent): void => {
		if (ownsCommandTarget(event.target)) {
			activateInlineEditor();
		}
	};
	commandContextFocusIn = (event: FocusEvent): void => {
		if (!ownsCommandTarget(event.target)) {
			return;
		}
		activateInlineEditor();
		view.dom.ownerDocument.defaultView?.queueMicrotask(() => {
			if (!closed && ownsCommandTarget(view.dom.ownerDocument.activeElement)) {
				activateInlineEditor();
			}
		});
	};
	view.dom.ownerDocument.addEventListener(
		'pointerdown',
		outsidePointerDown,
		true,
	);
	view.dom.ownerDocument.addEventListener(
		'pointerup',
		commandSurfacePointerUp,
		true,
	);
	view.dom.ownerDocument.defaultView?.addEventListener(
		'keydown',
		commandContextKeyDown,
		true,
	);
	view.dom.ownerDocument.addEventListener(
		'focusin',
		commandContextFocusIn,
		true,
	);
	requestSelectionToolbarRegistration(view);
	const animationWindow = view.dom.ownerDocument.defaultView;
	animationWindow?.requestAnimationFrame(() => {
		if (!closed) {
			ensureContentEditable(view);
			view.focus();
			activateInlineEditor();
			view.dispatch({
				selection: options.selectAll
					? { anchor: 0, head: view.state.doc.length }
					: { anchor: view.state.doc.length },
			});
		}
	});
	return inlineEditorHandle;
}

function requestSelectionToolbarRegistration(view: EditorView): void {
	const ownerWindow = view.dom.ownerDocument.defaultView;
	if (!ownerWindow || !view.dom.isConnected) {
		return;
	}
	view.dom.dispatchEvent(new ownerWindow.CustomEvent(
		REGISTER_CUSTOM_BUTTONS_EDITOR_EVENT,
		{
			bubbles: true,
			composed: true,
		},
	));
}

function getMarkdownEditModeConstructor(
	app: App,
	document: Document,
): NativeMarkdownEditModeConstructor {
	const cached = editModeConstructors.get(app);
	if (cached) {
		return cached;
	}
	const previousActiveEditor = app.workspace.activeEditor;
	const registry = (app as AppWithEmbedRegistry).embedRegistry;
	const embed = registry.embedByExtension.md(
		{ app, containerEl: document.createElement('div') },
		null,
		'',
	);
	try {
		embed.editable = true;
		embed.showEditor();
		const directPrototype = Object.getPrototypeOf(embed.editMode) as
			object | null;
		const basePrototype = directPrototype
			? Object.getPrototypeOf(directPrototype) as object | null
			: null;
		const constructor = basePrototype?.constructor;
		if (typeof constructor !== 'function') {
			throw new Error('无法创建 Obsidian 内嵌 Markdown 编辑器');
		}
		const EditMode = constructor as NativeMarkdownEditModeConstructor;
		editModeConstructors.set(app, EditMode);
		return EditMode;
	} finally {
		embed.unload();
		if (app.workspace.activeEditor !== previousActiveEditor) {
			app.workspace.activeEditor = previousActiveEditor;
		}
	}
}

function ensureContentEditable(view: EditorView): void {
	if (view.contentDOM.contentEditable !== 'true') {
		view.contentDOM.contentEditable = 'true';
	}
}

function isInlineEditorActive(
	activeEditor: MarkdownFileInfo | null,
	owner: NativeMarkdownOwner,
	editor: NativeMarkdownEditor,
	view: EditorView,
): boolean {
	if (activeEditor === owner as unknown as MarkdownFileInfo) {
		return true;
	}
	const activeNativeEditor = (
		activeEditor as unknown as { editor?: unknown } | null
	)?.editor;
	if (activeNativeEditor === editor) {
		return true;
	}
	return (
		activeNativeEditor as { cm?: unknown } | null | undefined
	)?.cm === view;
}

function redirectEditorToMarkdownView(
	activeEditor: MarkdownFileInfo,
	markdownView: MarkdownView,
): void {
	try {
		activeEditor.editor = markdownView.editor;
	} catch {
		// Some internal wrappers expose editor as a getter. The plain owner
		// object is repaired separately and remains the expected fallback.
	}
}

function createSidenoteEditorTheme(parent: HTMLElement) {
	const style = parent.ownerDocument.defaultView?.getComputedStyle(parent);
	const fontFamily = style?.fontFamily || 'var(--font-text)';
	const fontSize = style?.fontSize || 'inherit';
	const fontStyle = style?.fontStyle || 'normal';
	const fontWeight = style?.fontWeight || 'var(--font-normal)';
	const lineHeight = style?.lineHeight || '1.35';
	const color = style?.color || 'var(--text-muted)';
	return EditorView.theme({
		'&': {
			backgroundColor: 'transparent',
			color,
			fontFamily,
			fontSize,
			fontStyle,
			fontWeight,
			lineHeight,
		},
		'.cm-scroller': {
			backgroundColor: 'transparent',
			fontFamily,
			fontSize,
			fontStyle,
			fontWeight,
			lineHeight,
		},
		'.cm-content': {
			backgroundColor: 'transparent',
			fontFamily,
			fontSize,
			fontStyle,
			fontWeight,
			lineHeight,
		},
		'.cm-line': {
			backgroundColor: 'transparent',
			fontFamily,
			fontSize,
			fontStyle,
			fontWeight,
			lineHeight,
		},
		'.cm-activeLine': {
			backgroundColor: 'transparent',
		},
	});
}
