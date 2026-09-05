import { detectColorMarker } from '../../utils/color-markers';
import { CLOZE_EMOJI } from '../cloze/syntax';
import type { HighlightColor } from './constants';

interface HighlightPrefixMatch {
	color?: HighlightColor;
	emojiLength: number;
	emojiOffset: number;
	excluded: boolean;
	text: string;
}

export function createHighlightRegex(): RegExp {
	return /==(?![=])((?:[^=\n]|=[^=\n])+?)==/g;
}

export function detectHighlightPrefix(text: string): HighlightPrefixMatch {
	const marker = detectColorMarker(text);
	const content = text.trimStart();
	return {
		color: marker.color,
		emojiLength: marker.emojiLength,
		emojiOffset: marker.emojiOffset,
		excluded: content.startsWith(CLOZE_EMOJI),
		text: marker.text,
	};
}
