const BLOCK_SELECTOR = 'p, li';
const HEADING_ATTRIBUTE = 'data-editing-suite-negative-heading';
const EXCLUDED_CONTAINER = [
	'pre',
	'code',
	'.math',
	'.math-block',
	'.math-inline',
	'mjx-container',
	`[${HEADING_ATTRIBUTE}="true"]`,
].join(', ');

interface DomHeadingMatch {
	escaped: boolean;
	lineEnd: LineEnd;
	node: Text;
	offset: number;
	tokenLength: number;
}

type LineEnd =
	| { type: 'newline'; node: Text; offset: number }
	| { type: 'break'; node: Node }
	| { type: 'end'; node: Node; offset: number };

export function collectReadingBlocks(root: HTMLElement): HTMLElement[] {
	const blocks: HTMLElement[] = [];
	if (root.matches(BLOCK_SELECTOR)) {
		blocks.push(root);
	}
	root
		.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)
		.forEach((block) => blocks.push(block));

	return Array.from(new Set(blocks)).filter((block) => {
		if (block.closest(EXCLUDED_CONTAINER)) {
			return false;
		}
		return !(
			block.tagName === 'LI' &&
			block.querySelector(':scope > p')
		);
	});
}

export function collectNegativeHeadingMatches(
	block: HTMLElement,
): DomHeadingMatch[] {
	const matches: DomHeadingMatch[] = [];
	const showAll =
		block.ownerDocument.defaultView?.NodeFilter.SHOW_ALL ??
		NodeFilter.SHOW_ALL;
	const walker = block.ownerDocument.createTreeWalker(block, showAll);
	let atLineStart = true;

	while (walker.nextNode()) {
		const current = walker.currentNode;
		if (current.nodeType === Node.ELEMENT_NODE) {
			const element = current as HTMLElement;
			if (
				element.matches(`[${HEADING_ATTRIBUTE}="true"]`) ||
				element.tagName === 'BR'
			) {
				atLineStart = true;
			}
			continue;
		}

		const textNode = current as Text;
		if (textNode.parentElement?.closest(EXCLUDED_CONTAINER)) {
			continue;
		}
		const nearestBlock = textNode.parentElement?.closest(BLOCK_SELECTOR);
		if (nearestBlock && nearestBlock !== block) {
			continue;
		}

		const value = textNode.nodeValue ?? '';
		let offset = 0;
		while (offset < value.length) {
			if (value.charAt(offset) === '\n') {
				atLineStart = true;
				offset++;
				continue;
			}
			if (!atLineStart) {
				offset++;
				continue;
			}
			if (/^[ \t\r]$/.test(value.charAt(offset))) {
				atLineStart = false;
				continue;
			}

			const token = value.slice(offset).match(/^-#[ \t]+/)?.[0];
			if (token) {
				matches.push({
					escaped: false,
					lineEnd: findLineEnd(
						block,
						textNode,
						offset + token.length,
					),
					node: textNode,
					offset,
					tokenLength: token.length,
				});
				offset += token.length;
				atLineStart = false;
				continue;
			}
			atLineStart = false;
		}
	}

	return matches;
}

export function promoteNegativeHeading(
	block: HTMLElement,
	match: DomHeadingMatch,
): void {
	const document = block.ownerDocument;
	const range = document.createRange();
	range.setStart(match.node, match.offset + match.tokenLength);
	if (match.lineEnd.type === 'break') {
		range.setEndBefore(match.lineEnd.node);
	} else {
		range.setEnd(match.lineEnd.node, match.lineEnd.offset);
	}

	const fragment = range.extractContents();
	removeToken(match);
	if (!hasVisibleContent(fragment)) {
		return;
	}

	const heading = document.createElement('span');
	heading.className = 'editing-suite-negative-heading';
	heading.dataset.editingSuiteNegativeHeading = 'true';
	heading.setAttribute('role', 'heading');
	heading.setAttribute('aria-level', '7');
	heading.appendChild(fragment);
	range.insertNode(heading);
	removeLineDelimiter(match.lineEnd);
}

function findLineEnd(
	root: HTMLElement,
	startNode: Text,
	startOffset: number,
): LineEnd {
	let current: Node = startNode;
	let offset = startOffset;

	while (current) {
		if (current.nodeType === Node.TEXT_NODE) {
			const value = (current as Text).nodeValue ?? '';
			const newline = value.indexOf('\n', offset);
			if (newline >= 0) {
				return {
					type: 'newline',
					node: current as Text,
					offset: newline,
				};
			}
		}

		const next = getNextNode(root, current);
		if (!next) {
			break;
		}
		if (next.nodeType === Node.ELEMENT_NODE) {
			const element = next as HTMLElement;
			if (
				['UL', 'OL', 'BLOCKQUOTE', 'PRE', 'TABLE', 'HR'].includes(
					element.tagName,
				)
			) {
				return current.nodeType === Node.TEXT_NODE
					? {
						type: 'end',
						node: current,
						offset: (current.nodeValue ?? '').length,
					}
					: {
						type: 'end',
						node: current,
						offset: current.childNodes.length,
					};
			}
			if (element.tagName === 'BR') {
				return {
					type: 'break',
					node: element,
				};
			}
		}

		current = next;
		offset = 0;
	}

	return current.nodeType === Node.TEXT_NODE
		? {
			type: 'end',
			node: current,
			offset: (current.nodeValue ?? '').length,
		}
		: {
			type: 'end',
			node: root,
			offset: root.childNodes.length,
		};
}

function getNextNode(root: Node, node: Node): Node | null {
	if (node.firstChild) {
		return node.firstChild;
	}

	let current: Node | null = node;
	while (current && current !== root) {
		if (current.nextSibling) {
			return current.nextSibling;
		}
		current = current.parentNode;
	}

	return null;
}

function removeToken(match: DomHeadingMatch): void {
	const value = match.node.nodeValue ?? '';
	match.node.nodeValue =
		value.slice(0, match.offset) +
		value.slice(match.offset + match.tokenLength);
}

function removeLineDelimiter(lineEnd: LineEnd): void {
	if (lineEnd.type === 'newline') {
		const value = lineEnd.node.nodeValue ?? '';
		lineEnd.node.nodeValue =
			value.slice(0, lineEnd.offset) +
			value.slice(lineEnd.offset + 1);
	} else if (lineEnd.type === 'break') {
		lineEnd.node.parentNode?.removeChild(lineEnd.node);
	}
}

function hasVisibleContent(fragment: DocumentFragment): boolean {
	const nodeFilter = fragment.ownerDocument.defaultView?.NodeFilter;
	const showTextAndElements = nodeFilter
		? nodeFilter.SHOW_TEXT | nodeFilter.SHOW_ELEMENT
		: NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT;
	const walker = fragment.ownerDocument.createTreeWalker(
		fragment,
		showTextAndElements,
	);

	while (walker.nextNode()) {
		const node = walker.currentNode;
		if (
			node.nodeType === Node.TEXT_NODE &&
			(node.nodeValue ?? '').trim()
		) {
			return true;
		}
		if (
			node.nodeType === Node.ELEMENT_NODE &&
			(node as HTMLElement).tagName !== 'BR'
		) {
			return true;
		}
	}

	return false;
}
