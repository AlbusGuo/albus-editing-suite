import {
	type Editor,
	MarkdownView,
	Notice,
	type Plugin,
} from 'obsidian';
import { isInlineMarkdownEditor } from './inline-editor';
import {
	SIDENOTE_CLOSING,
	SIDENOTE_OPENING,
} from './syntax';

const EMPTY_SIDENOTE_PLACEHOLDER = '输入边注';

export function registerSidenoteCommand(
	plugin: Plugin,
	isEnabled: () => boolean,
	requestEdit: (
		sourcePosition: number,
		containerEl: HTMLElement,
	) => void,
): void {
	plugin.addCommand({
		id: 'toggle-sidenote',
		name: '插入边注',
		editorCheckCallback: (checking, editor) => {
			if (!isEnabled()) {
				return false;
			}
			if (isInlineMarkdownEditor(editor)) {
				if (!checking) {
					new Notice('边注不支持嵌套');
				}
				return true;
			}
			const markdownView =
				plugin.app.workspace.getActiveViewOfType(MarkdownView);
			if (!markdownView) {
				return false;
			}
			if (!checking) {
				insertSidenote(
					editor,
					(sourcePosition) => requestEdit(
						sourcePosition,
						markdownView.containerEl,
					),
				);
			}
			return true;
		},
	});
}

function insertSidenote(
	editor: Editor,
	requestEdit: (sourcePosition: number) => void,
): void {
	const cursor = editor.getCursor('head');
	const sourcePosition = editor.posToOffset(cursor);
	const syntax =
		`${SIDENOTE_OPENING}${EMPTY_SIDENOTE_PLACEHOLDER}${SIDENOTE_CLOSING}`;
	requestEdit(sourcePosition);
	editor.replaceRange(syntax, cursor);
	editor.setCursor(editor.offsetToPos(sourcePosition + syntax.length));
}
