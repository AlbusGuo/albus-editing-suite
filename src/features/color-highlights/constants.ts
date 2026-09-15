import {
	COLOR_LABELS,
	HIGHLIGHT_COLOR_EMOJIS,
	SUITE_COLOR_KEYS,
	type SuiteColor,
} from '../../utils/color-markers';

export const COLOR_HIGHLIGHTS = {
	red: {
		emoji: HIGHLIGHT_COLOR_EMOJIS.red,
		label: COLOR_LABELS.red,
	},
	orange: {
		emoji: HIGHLIGHT_COLOR_EMOJIS.orange,
		label: COLOR_LABELS.orange,
	},
	yellow: {
		emoji: HIGHLIGHT_COLOR_EMOJIS.yellow,
		label: COLOR_LABELS.yellow,
	},
	green: {
		emoji: HIGHLIGHT_COLOR_EMOJIS.green,
		label: COLOR_LABELS.green,
	},
	blue: {
		emoji: HIGHLIGHT_COLOR_EMOJIS.blue,
		label: COLOR_LABELS.blue,
	},
	purple: {
		emoji: HIGHLIGHT_COLOR_EMOJIS.purple,
		label: COLOR_LABELS.purple,
	},
} as const;

export type HighlightColor = SuiteColor;

export const DEFAULT_HIGHLIGHT_COLOR: HighlightColor = 'yellow';

export const HIGHLIGHT_COLORS = SUITE_COLOR_KEYS;

export function getHighlightWritePrefix(color: HighlightColor): string {
	return COLOR_HIGHLIGHTS[color].emoji;
}
