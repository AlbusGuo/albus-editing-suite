import {
	findProofEndOffsets,
	PROOF_END_SYMBOL,
} from './syntax';

const PROOF_END_CLASS = 'editing-suite-proof-end';
const EXCLUDED_SELECTOR = [
	`.${PROOF_END_CLASS}`,
	'pre',
	'code',
	'mjx-container',
	'.math',
	'.katex',
	'svg',
	'script',
	'style',
	'textarea',
	'a',
	'.callout-title',
].join(', ');

export function renderProofEndSymbols(
	root: HTMLElement,
	enabled: boolean,
): void {
	clearProofEndSymbols(root);
	if (!enabled || root.closest(EXCLUDED_SELECTOR)) {
		return;
	}
	const walker = root.ownerDocument.createTreeWalker(
		root,
		4,
	);
	const nodes: Text[] = [];
	let node: Node | null;
	while ((node = walker.nextNode())) {
		if (
			node.nodeType === 3 &&
			(node as Text).data.includes(PROOF_END_SYMBOL) &&
			!node.parentElement?.closest(EXCLUDED_SELECTOR)
		) {
			nodes.push(node as Text);
		}
	}
	for (const text of nodes) {
		wrapSymbols(text);
	}
}

export function clearProofEndSymbols(root: ParentNode): void {
	root.querySelectorAll<HTMLElement>(`.${PROOF_END_CLASS}`)
		.forEach((element) => element.replaceWith(PROOF_END_SYMBOL));
}

function wrapSymbols(text: Text): void {
	const value = text.data;
	const fragment = text.ownerDocument.createDocumentFragment();
	let start = 0;
	for (const index of findProofEndOffsets(value)) {
		fragment.append(value.slice(start, index));
		const marker = text.ownerDocument.createElement('span');
		marker.className = PROOF_END_CLASS;
		marker.textContent = PROOF_END_SYMBOL;
		fragment.appendChild(marker);
		start = index + 1;
	}
	if (start === 0) {
		return;
	}
	fragment.append(value.slice(start));
	text.replaceWith(fragment);
}
