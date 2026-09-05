const STANDALONE_IMAGE_CLASS = 'editing-suite-standalone-image-block';

export function markStandaloneImages(root: HTMLElement): void {
	const paragraphs: HTMLParagraphElement[] = [];
	if (root.tagName === 'P') {
		paragraphs.push(root as HTMLParagraphElement);
	}
	root.querySelectorAll<HTMLParagraphElement>('p').forEach((paragraph) => {
		paragraphs.push(paragraph);
	});
	for (const paragraph of paragraphs) {
		paragraph.classList.toggle(
			STANDALONE_IMAGE_CLASS,
			isStandaloneImageParagraph(paragraph),
		);
	}
}

function isStandaloneImageParagraph(paragraph: HTMLParagraphElement): boolean {
	const contentNodes = Array.from(paragraph.childNodes).filter((node) =>
		node.nodeType !== 3 || node.textContent?.trim() !== '',
	);
	return contentNodes.length === 1 && isImageCarrier(contentNodes[0] ?? null);
}

function isImageCarrier(node: Node | null): boolean {
	if (node?.nodeType !== 1) {
		return false;
	}
	const element = node as HTMLElement;
	if (element.tagName === 'IMG') {
		return true;
	}
	if (element.classList.contains('image-embed')) {
		return element.querySelector('img') !== null;
	}
	if (element.tagName !== 'A') {
		return false;
	}
	const children = Array.from(element.childNodes).filter((child) =>
		child.nodeType !== 3 || child.textContent?.trim() !== '',
	);
	return children.length === 1 && isImageCarrier(children[0] ?? null);
}
