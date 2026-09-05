import { detectColorMarker } from '../../utils/color-markers';
import type { ColoredTextColor } from './constants';

interface ColoredTextPrefixMatch {
	color?: ColoredTextColor;
	emojiLength: number;
	emojiOffset: number;
	text: string;
}

export function createColoredTextRegex(): RegExp {
	return /\*\*([^*\n]+?)\*\*/g;
}

export const COLORED_TEXT_OPENING = '**';
export const COLORED_TEXT_CLOSING = '**';

export function detectColoredTextPrefix(
	text: string,
): ColoredTextPrefixMatch {
	const marker = detectColorMarker(text);
	return {
		color: marker.color,
		emojiLength: marker.emojiLength,
		emojiOffset: marker.emojiOffset,
		text: marker.text,
	};
}
