const GENERIC_FONT_FAMILIES = new Set([
	'cursive',
	'emoji',
	'fangsong',
	'fantasy',
	'math',
	'monospace',
	'sans-serif',
	'serif',
	'system-ui',
	'ui-monospace',
	'ui-rounded',
	'ui-sans-serif',
	'ui-serif',
]);

/** Convert a user-facing comma-separated font list into a safe CSS stack. */
export function formatCssFontFamily(fontFamily: string): string {
	return fontFamily
		.replace(/"/gu, '')
		.split(',')
		.map((value) => ({
			exact: value.replace(/^\s+/u, ''),
			normalized: value.trim(),
		}))
		.filter((value) => Boolean(value.normalized))
		.map(({ exact, normalized }) => {
			if (GENERIC_FONT_FAMILIES.has(normalized.toLocaleLowerCase())) {
				return normalized;
			}
			return `"${exact
				.replace(/\\/gu, '\\\\')
				.replace(/"/gu, '\\"')}"`;
		})
		.join(', ');
}
