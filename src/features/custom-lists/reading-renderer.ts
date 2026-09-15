import {
	formatMarkerText,
	getMarkerDisplayColumns,
	parseLeadingDirective,
	resolveMarkerSpec,
	type LeadingDirective,
	type MarkerSpec,
} from './parser';

const ITEM_CLASS = 'editing-suite-custom-list-item';
const LIST_CLASS = 'editing-suite-custom-list';
const COMPACT_LIST_CLASS = 'editing-suite-compact-custom-list';
const MARKER_ATTRIBUTE = 'data-editing-suite-custom-list-marker';
const MARKER_WIDTH_PROPERTY = '--editing-suite-custom-list-marker-width';

export function renderCustomLists(root: HTMLElement): void {
	const lists: HTMLOListElement[] = [];
	if (root.tagName === 'OL') {
		lists.push(root as HTMLOListElement);
	}
	root.querySelectorAll<HTMLOListElement>('ol').forEach((list) => {
		lists.push(list);
	});
	for (const list of lists) {
		const items = list.querySelectorAll<HTMLLIElement>(':scope > li');
		clearListState(list);
		if (!hasValidDirective(items)) {
			continue;
		}
		applyMarkers(list, items);
	}
}

function hasValidDirective(items: NodeListOf<HTMLLIElement>): boolean {
	return Array.from(items).some((item) => {
		const directive = getDirective(item);
		return directive !== null && resolveMarkerSpec(directive.pattern) !== null;
	});
}

function getDirective(
	item: HTMLLIElement,
): LeadingDirective | null {
	return parseLeadingDirective(getInlineRoot(item).textContent ?? '');
}

function applyMarkers(
	list: HTMLOListElement,
	items: NodeListOf<HTMLLIElement>,
): void {
	let currentSpec: MarkerSpec | null = null;
	let currentCompact = false;
	let hasCompactItems = false;
	let currentIndex = 0;
	let markerColumns = 3;
	items.forEach((item) => {
		const directive = getDirective(item);
		if (directive) {
			const nextSpec = resolveMarkerSpec(directive.pattern);
			if (!nextSpec) {
				currentSpec = null;
				return;
			}
			currentSpec = nextSpec;
			currentCompact = directive.compact;
			currentIndex = 0;
			stripLeadingDirective(item, directive);
		}
		if (!currentSpec) {
			return;
		}
		item.classList.add(ITEM_CLASS);
		hasCompactItems ||= currentCompact;
		const markerText = formatMarkerText(currentSpec, currentIndex);
		item.setAttribute(
			MARKER_ATTRIBUTE,
			markerText,
		);
		markerColumns = Math.max(
			markerColumns,
			getMarkerDisplayColumns(markerText),
		);
		currentIndex += 1;
	});
	list.classList.add(LIST_CLASS);
	list.classList.toggle(COMPACT_LIST_CLASS, hasCompactItems);
	list.style.setProperty(MARKER_WIDTH_PROPERTY, `${markerColumns}ch`);
}

function clearListState(list: HTMLOListElement): void {
	list.classList.remove(LIST_CLASS, COMPACT_LIST_CLASS);
	list.style.removeProperty(MARKER_WIDTH_PROPERTY);
	list.querySelectorAll<HTMLLIElement>(`:scope > li.${ITEM_CLASS}`)
		.forEach((item) => {
			item.removeAttribute(MARKER_ATTRIBUTE);
			item.classList.remove(ITEM_CLASS);
		});
}

function getInlineRoot(item: HTMLLIElement): HTMLElement {
	const firstElement = item.firstElementChild;
	return firstElement?.tagName === 'P'
		? firstElement as HTMLElement
		: item;
}

function stripLeadingDirective(
	item: HTMLLIElement,
	directive: LeadingDirective,
): void {
	const inlineRoot = getInlineRoot(item);
	const nodes = Array.from(inlineRoot.childNodes);
	let inDirective = false;
	for (const node of nodes) {
		if (node.nodeType === 3) {
			const original = node.textContent ?? '';
			let text = original;
			if (!inDirective) {
				const opening = text.search(/\S/u);
				if (opening === -1) {
					node.remove();
					continue;
				}
				if (text[opening] !== '{') {
					return;
				}
				inDirective = true;
				text = text.slice(opening + 1);
			}
			const closing = text.indexOf('}');
			if (closing === -1) {
				node.remove();
				continue;
			}
			let remainder = text.slice(closing + 1);
			if (directive.compact && remainder.startsWith('-')) {
				remainder = remainder.slice(1);
			}
			remainder = remainder.replace(/^\s+/u, '');
			if (remainder) {
				node.textContent = remainder;
			} else {
				node.remove();
			}
			return;
		}
		if (inDirective) {
			node.remove();
		}
	}
}
