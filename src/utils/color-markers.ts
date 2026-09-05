export const COLOR_LABELS = {
	yellow: '黄色',
	green: '绿色',
	red: '红色',
	purple: '紫色',
	blue: '蓝色',
} as const;

export type SuiteColor = keyof typeof COLOR_LABELS;

export const SUITE_COLOR_KEYS = Object.keys(COLOR_LABELS) as SuiteColor[];

export const COLOR_EMOJIS: Record<SuiteColor, string> = {
	yellow: '🟡',
	green: '🟢',
	red: '🔴',
	purple: '🟣',
	blue: '🔵',
};

export const HIGHLIGHT_COLOR_EMOJIS = COLOR_EMOJIS;
export const TEXT_COLOR_EMOJIS = COLOR_EMOJIS;

interface ColorMarkerMatch {
	color?: SuiteColor;
	emojiLength: number;
	emojiOffset: number;
	text: string;
}

const COLOR_MARKERS = new Map<string, SuiteColor>(
	SUITE_COLOR_KEYS.map((color) => [COLOR_EMOJIS[color], color]),
);

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
