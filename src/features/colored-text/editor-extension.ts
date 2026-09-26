import type { Extension, Range } from '@codemirror/state';
import {
	Decoration,
	type DecorationSet,
	type EditorView,
	ViewPlugin,
	type ViewUpdate,
	WidgetType,
} from '@codemirror/view';
import { Menu, type MenuItem } from 'obsidian';
import {
	computeFencedCodeLines,
	getVisibleDocumentLines,
	isExcludedMarkdownPosition,
	isInsideCode,
	isSourceMode,
} from '../../utils/editor-context';
import { hasValidInlineMarkBoundaries } from '../../utils/inline-mark';
import {
	COLORED_TEXT_COLORS,
	COLORED_TEXT_COLOR_KEYS,
	type ColoredTextColor,
} from './constants';
import {
	COLORED_TEXT_OPENING,
	createColoredTextRegex,
	detectColoredTextPrefix,
} from './syntax';

const COLOR_DECORATIONS = Object.fromEntries(
	COLORED_TEXT_COLOR_KEYS.map((color) => [
		color,
		Decoration.mark({
			class: `editing-suite-editor-colored-text-${color}`,
		}),
	]),
) as Record<ColoredTextColor, Decoration>;

const HIDE_EMOJI = Decoration.replace({});

class ColoredTextColorWidget extends WidgetType {
	constructor(
		private readonly color: ColoredTextColor,
		private readonly from: number,
		private readonly to: number,
	) {
		super();
	}

	eq(other: ColoredTextColorWidget): boolean {
		return (
			this.color === other.color &&
			this.from === other.from &&
			this.to === other.to
		);
	}

	toDOM(view: EditorView): HTMLElement {
		const element = view.dom.ownerDocument.createElement('span');
		element.className =
			'cm-highlight-color-widget editing-suite-colored-text-color-widget';
		element.dataset.highlight = this.color;
		element.setAttribute('role', 'button');
		element.setAttribute(
			'aria-label',
			`更改彩色文本颜色, 当前为${COLORED_TEXT_COLORS[this.color].label}`,
		);
		element.tabIndex = 0;
		const swatch = view.dom.ownerDocument.createElement('img');
		swatch.className = 'highlight-swatch';
		swatch.src =
			'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>';
		swatch.draggable = false;
		swatch.dataset.highlight = this.color;
		element.append(swatch, view.dom.ownerDocument.createTextNode('\u200B'));
		element.addEventListener('mousedown', (event) => {
			if (!hasModifier(event)) {
				event.preventDefault();
			}
		});
		element.addEventListener('click', (event) => {
			if (hasModifier(event) || !view.state.selection.main.empty) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			this.openMenu(view, element, event);
		});
		element.addEventListener('keydown', (event) => {
			if (event.key !== 'Enter' && event.key !== ' ') {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			this.openMenu(view, element);
		});
		return element;
	}

	ignoreEvent(): boolean {
		return false;
	}

	private openMenu(
		view: EditorView,
		element: HTMLElement,
		event?: MouseEvent,
	): void {
		const menu = new Menu();
		for (const color of COLORED_TEXT_COLOR_KEYS) {
			const definition = COLORED_TEXT_COLORS[color];
			menu.addItem((item) => {
				setColorMenuIcon(item, color);
				item
					.setTitle(definition.label)
					.setChecked(color === this.color)
					.onClick(() => this.setColor(view, color));
			});
		}
		if (event) {
			menu.showAtMouseEvent(event);
			return;
		}
		const rect = element.getBoundingClientRect();
		menu.showAtPosition(
			{ x: rect.left, y: rect.bottom },
			element.ownerDocument,
		);
	}

	private setColor(
		view: EditorView,
		color: ColoredTextColor,
	): void {
		if (this.from < 0 || this.to > view.state.doc.length) {
			return;
		}
		view.dispatch({
			changes: {
				from: this.from,
				to: this.to,
				insert: COLORED_TEXT_COLORS[color].emoji,
			},
			userEvent: 'input.type',
		});
		view.focus();
	}
}

function hasModifier(event: MouseEvent): boolean {
	return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
}

interface MenuItemWithIconElement {
	iconEl?: HTMLElement;
}

function setColorMenuIcon(
	item: MenuItem,
	color: ColoredTextColor,
): void {
	const iconElement = (item as unknown as MenuItemWithIconElement).iconEl;
	if (!iconElement) {
		item.setIcon('circle');
		return;
	}
	iconElement.empty();
	const swatch = iconElement.createDiv({
		cls: 'highlight-swatch editing-suite-color-menu-swatch',
	});
	swatch.dataset.highlight = color;
}

function buildDecorations(
	view: EditorView,
	isEnabled: () => boolean,
): DecorationSet {
	if (!isEnabled()) {
		return Decoration.none;
	}
	const decorations: Range<Decoration>[] = [];
	const coloredTextRegex = createColoredTextRegex();
	const documentText = view.state.doc.toString();
	const fencedCodeLines = computeFencedCodeLines(documentText);
	const selections = view.state.selection.ranges;
	const showEmojiPrefix = isSourceMode(view);

	for (const line of getVisibleDocumentLines(view)) {
		coloredTextRegex.lastIndex = 0;
		let match: RegExpExecArray | null;

		while ((match = coloredTextRegex.exec(line.text)) !== null) {
			const innerText = match[1];
			const textFrom = line.from + match.index;
			if (
				innerText === undefined ||
				!hasValidInlineMarkBoundaries(innerText)
			) {
				continue;
			}

			const textTo = textFrom + match[0].length;
			const prefix = detectColoredTextPrefix(innerText);
			if (isExcludedMarkdownPosition(view, textFrom)) {
				continue;
			}
			const innerFrom = textFrom + COLORED_TEXT_OPENING.length;
			if (
				!prefix.color ||
				isInsideCode(view, fencedCodeLines, textFrom)
			) {
				continue;
			}

			decorations.push(
				COLOR_DECORATIONS[prefix.color].range(textFrom, textTo),
			);
			const emojiFrom = innerFrom + prefix.emojiOffset;
			const emojiTo = emojiFrom + prefix.emojiLength;
			const cursorInside = selections.some(
				(selection) =>
					selection.from <= textTo && selection.to >= textFrom,
			);
			if (
				!showEmojiPrefix &&
				emojiFrom < emojiTo
			) {
				if (cursorInside) {
					decorations.push(
						Decoration.replace({
							widget: new ColoredTextColorWidget(
								prefix.color,
								emojiFrom,
								emojiTo,
							),
						}).range(emojiFrom, emojiTo),
					);
				} else {
					decorations.push(HIDE_EMOJI.range(emojiFrom, emojiTo));
				}
			}
		}
	}

	return Decoration.set(decorations, true);
}

export function createColoredTextEditorExtension(
	isEnabled: () => boolean,
): Extension {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;

			constructor(view: EditorView) {
				this.decorations = buildDecorations(view, isEnabled);
			}

			update(update: ViewUpdate): void {
				if (
					update.docChanged ||
					update.viewportChanged ||
					update.selectionSet
				) {
					this.decorations = buildDecorations(update.view, isEnabled);
				}
			}
		},
		{
			decorations: (value) => value.decorations,
		},
	);
}
