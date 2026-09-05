interface BoundaryWhitespace {
	content: string;
	leading: string;
	trailing: string;
}

export function splitBoundaryWhitespace(text: string): BoundaryWhitespace {
	const parts = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
	return {
		content: parts?.[2] ?? text,
		leading: parts?.[1] ?? '',
		trailing: parts?.[3] ?? '',
	};
}

export function hasValidInlineMarkBoundaries(text: string): boolean {
	return text.length > 0 && !/^\s|\s$/u.test(text);
}
