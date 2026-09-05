import type {
	MarkdownSectionInformation,
} from 'obsidian';

const TIGHT_BEFORE_CLASS = 'editing-suite-tagged-math-tight-before';
const TIGHT_AFTER_CLASS = 'editing-suite-tagged-math-tight-after';

export function markTaggedMathSpacing(
	root: HTMLElement,
	info: MarkdownSectionInformation,
	source: string,
): void {
	if (!info.text.includes('\\tag')) {
		return;
	}
	const lines = source.split('\n');
	const renderedSource = lines
		.slice(info.lineStart, info.lineEnd + 1)
		.join('\n');
	if (!renderedSource.includes('\\tag')) {
		return;
	}
	const wrapper = root.matches('.el-div')
		? root
		: root.closest<HTMLElement>('.el-div') ??
			root.querySelector<HTMLElement>('.el-div') ?? root;
	wrapper.classList.remove(TIGHT_BEFORE_CLASS, TIGHT_AFTER_CLASS);
	const previousLine = info.lineStart > 0
		? lines[info.lineStart - 1]
		: undefined;
	if (previousLine !== undefined && previousLine.trim() !== '') {
		wrapper.classList.add(TIGHT_BEFORE_CLASS);
	}
	const nextLine = lines[info.lineEnd + 1];
	if (nextLine !== undefined && nextLine.trim() !== '') {
		wrapper.classList.add(TIGHT_AFTER_CLASS);
	}
}

export function clearTaggedMathSpacing(root: ParentNode): void {
	root.querySelectorAll<HTMLElement>(
		`.${TIGHT_BEFORE_CLASS}, .${TIGHT_AFTER_CLASS}`,
	)
		.forEach((element) => {
			element.classList.remove(
				TIGHT_BEFORE_CLASS,
				TIGHT_AFTER_CLASS,
			);
		});
}
