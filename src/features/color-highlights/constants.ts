import {
	COLOR_LABELS,
	HIGHLIGHT_COLOR_EMOJIS,
	SUITE_COLOR_KEYS,
	type SuiteColor,
} from '../../utils/color-markers';

export const COLOR_HIGHLIGHTS = {
	yellow: {
		emoji: HIGHLIGHT_COLOR_EMOJIS.yellow,
		label: COLOR_LABELS.yellow,
	},
	green: {
		emoji: HIGHLIGHT_COLOR_EMOJIS.green,
		label: COLOR_LABELS.green,
	},
	red: {
		emoji: HIGHLIGHT_COLOR_EMOJIS.red,
		label: COLOR_LABELS.red,
	},
	purple: {
		emoji: HIGHLIGHT_COLOR_EMOJIS.purple,
		label: COLOR_LABELS.purple,
	},
	blue: {
		emoji: HIGHLIGHT_COLOR_EMOJIS.blue,
		label: COLOR_LABELS.blue,
	},
} as const;

export type HighlightColor = SuiteColor;

export const DEFAULT_HIGHLIGHT_COLOR: HighlightColor = 'yellow';

export const HIGHLIGHT_COLORS = SUITE_COLOR_KEYS;

export function getHighlightWritePrefix(color: HighlightColor): string {
	return COLOR_HIGHLIGHTS[color].emoji;
}
