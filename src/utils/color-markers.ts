export const COLOR_LABELS = {
	red: '红色',
	orange: '橙色',
	yellow: '黄色',
	green: '绿色',
	blue: '蓝色',
	purple: '紫色',
} as const;

export type SuiteColor = keyof typeof COLOR_LABELS;

export const SUITE_COLOR_KEYS = Object.keys(COLOR_LABELS) as SuiteColor[];

export const COLOR_EMOJIS: Record<SuiteColor, string> = {
	red: '🔴',
	orange: '🟠',
	yellow: '🟡',
	green: '🟢',
	blue: '🔵',
	purple: '🟣',
};

export const HIGHLIGHT_COLOR_EMOJIS = COLOR_EMOJIS;
export const TEXT_COLOR_EMOJIS = COLOR_EMOJIS;

interface ColorMarkerMatch {
	color?: SuiteColor;
	emojiLength: number;
	emojiOffset: number;
	text: string;
}

const COLOR_MARKERS = new Map<string, SuiteColor>([
	['🔴', 'red'],
	['🟥', 'red'],
	['🟠', 'orange'],
	['🟧', 'orange'],
	['🟡', 'yellow'],
	['🟨', 'yellow'],
	['🟢', 'green'],
	['🟩', 'green'],
	['🔵', 'blue'],
	['🟦', 'blue'],
	['🟣', 'purple'],
	['🟪', 'purple'],
]);

export function isSuiteColor(value: string): value is SuiteColor {
	return Object.prototype.hasOwnProperty.call(COLOR_LABELS, value);
}

export function stripColorMarkers(text: string): string {
	let output = text;
	for (const marker of COLOR_MARKERS.keys()) {
		output = output.replaceAll(marker, '');
	}
	return output;
}

export function detectColorMarker(text: string): ColorMarkerMatch {
	const leadingWhitespace = text.match(/^\s*/u)?.[0] ?? '';
	const content = text.slice(leadingWhitespace.length);

	for (const [emoji, color] of COLOR_MARKERS) {
		if (content.startsWith(emoji)) {
			return {
				color,
				emojiLength: emoji.length,
				emojiOffset: leadingWhitespace.length,
				text: `${leadingWhitespace}${content.slice(emoji.length)}`,
			};
		}
	}

	return {
		emojiLength: 0,
		emojiOffset: 0,
		text,
	};
}
