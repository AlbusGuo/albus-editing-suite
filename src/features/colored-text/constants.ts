import {
	COLOR_LABELS,
	SUITE_COLOR_KEYS,
	TEXT_COLOR_EMOJIS,
	type SuiteColor,
} from '../../utils/color-markers';

export const COLORED_TEXT_COLORS = {
	red: {
		emoji: TEXT_COLOR_EMOJIS.red,
		label: COLOR_LABELS.red,
	},
	orange: {
		emoji: TEXT_COLOR_EMOJIS.orange,
		label: COLOR_LABELS.orange,
	},
	yellow: {
		emoji: TEXT_COLOR_EMOJIS.yellow,
		label: COLOR_LABELS.yellow,
	},
	green: {
		emoji: TEXT_COLOR_EMOJIS.green,
		label: COLOR_LABELS.green,
	},
	blue: {
		emoji: TEXT_COLOR_EMOJIS.blue,
		label: COLOR_LABELS.blue,
	},
	purple: {
		emoji: TEXT_COLOR_EMOJIS.purple,
		label: COLOR_LABELS.purple,
	},
} as const;

export type ColoredTextColor = SuiteColor;

export const COLORED_TEXT_COLOR_KEYS = SUITE_COLOR_KEYS;
