export const READING_CODE_CLASS = 'editing-suite-native-code-content';

const ANCHOR_CLASS = 'editing-suite-native-code-line-anchor';

interface InsertionPoint {
	container: Node;
	offset: number;
}

export function insertReadingLineAnchors(code: HTMLElement): number {
	removeReadingLineAnchors(code);
	const text = getCodeText(code);
	const points = collectLineStarts(code);
	if (endsWithLineBreak(text) && points.length > 1) {
		points.pop();
	}
	for (let index = points.length - 1; index >= 0; index--) {
		const point = points[index];
		if (!point) {
			continue;
		}
		const anchor = code.ownerDocument.createElement('span');
		anchor.className = ANCHOR_CLASS;
		anchor.dataset.lineNumber = String(index + 1);
		anchor.setAttribute('aria-hidden', 'true');
		const range = code.ownerDocument.createRange();
		range.setStart(point.container, point.offset);
		range.collapse(true);
		range.insertNode(anchor);
		range.detach();
	}
	return points.length;
}

export function removeReadingLineAnchors(code: HTMLElement): void {
	code.querySelectorAll<HTMLElement>(`.${ANCHOR_CLASS}`)
		.forEach((anchor) => anchor.remove());
	code.normalize();
}

export function hasCompleteReadingLineAnchors(
	code: HTMLElement,
	lineCount: number,
): boolean {
	return (
		code.isConnected &&
		code.querySelectorAll(`.${ANCHOR_CLASS}`).length === lineCount &&
		countCodeLines(getCodeText(code)) === lineCount
	);
}

function collectLineStarts(code: HTMLElement): InsertionPoint[] {
	const points: InsertionPoint[] = [];
	const visit = (node: Node): void => {
		if (node.nodeType === 3) {
			const text = node.textContent ?? '';
			if (points.length === 0 && text.length > 0) {
				points.push({ container: node, offset: 0 });
			}
			for (const match of text.matchAll(/\r\n|\r|\n/gu)) {
				points.push({
					container: node,
					offset: (match.index ?? 0) + match[0].length,
				});
			}
			return;
		}
		if (node.nodeType !== 1) {
			return;
		}
		const element = node as HTMLElement;
		if (element.tagName === 'BR') {
			const parent = element.parentNode;
			if (!parent) {
				return;
			}
			const elementOffset = Array.from(parent.childNodes).indexOf(element);
			if (points.length === 0) {
				points.push({ container: parent, offset: elementOffset });
			}
			points.push({ container: parent, offset: elementOffset + 1 });
			return;
		}
		for (const child of Array.from(element.childNodes)) {
			visit(child);
		}
	};
	for (const child of Array.from(code.childNodes)) {
		visit(child);
	}
	if (points.length === 0) {
		points.push({ container: code, offset: 0 });
	}
	return points;
}

function getCodeText(code: HTMLElement): string {
	let text = '';
	const visit = (node: Node): void => {
		if (node.nodeType === 3) {
			text += node.textContent ?? '';
			return;
		}
		if (node.nodeType !== 1) {
			return;
		}
		const element = node as HTMLElement;
		if (element.classList.contains(ANCHOR_CLASS)) {
			return;
		}
		if (element.tagName === 'BR') {
			text += '\n';
			return;
		}
		for (const child of Array.from(element.childNodes)) {
			visit(child);
		}
	};
	for (const child of Array.from(code.childNodes)) {
		visit(child);
	}
	return text;
}

function countCodeLines(text: string): number {
	const matches = text.match(/\r\n|\r|\n/gu)?.length ?? 0;
	return Math.max(1, matches + (endsWithLineBreak(text) ? 0 : 1));
}

function endsWithLineBreak(text: string): boolean {
	return text.endsWith('\n') || text.endsWith('\r');
}
