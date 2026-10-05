interface FeatureSettings {
	cloze: boolean;
	codeBlocks: boolean;
	colorHighlights: boolean;
	coloredText: boolean;
	customLists: boolean;
	inlineCode: boolean;
	negativeHeadings: boolean;
	proofEnd: boolean;
	sidenotes: boolean;
}

export type SidenotePosition = 'left' | 'right';
export type ListMarkerColor = 'default' | 'text';
export type LinkStyle = 'default' | 'red-outline';
export type DividerStyle = 'default' | 'diamond-gradient';
export type TableStyle = 'default' | 'rounded-grid' | 'three-line';
export type SettingsTab = 'editor' | 'extensions';

export const EDITOR_WIDTH_MIN = 400;
export const EDITOR_WIDTH_MAX = 1400;
export const EDITOR_WIDTH_STEP = 10;
export const DEFAULT_EDITOR_WIDTH = 800;
export const OBSIDIAN_DEFAULT_EDITOR_WIDTH = 700;
export const DISPLAY_MATH_MARGIN_MIN = 0;
export const DISPLAY_MATH_MARGIN_MAX = 2;
export const DISPLAY_MATH_MARGIN_STEP = 0.1;
export const DEFAULT_DISPLAY_MATH_MARGIN = 0.5;
export const OBSIDIAN_DEFAULT_DISPLAY_MATH_MARGIN = 1;

export interface EditingSuiteSettings {
	collapseBlockIds: boolean;
	collapseHeadingMarkers: boolean;
	colorHighlightWave: boolean;
	coloredTextBold: boolean;
	dividerStyle: DividerStyle;
	editorWidth: number;
	editorWidthUsesDefault: boolean;
	focusIndicator: boolean;
	features: FeatureSettings;
	linkStyle: LinkStyle;
	listMarkerColor: ListMarkerColor;
	mathDisplayMargin: number;
	mathDisplayMarginUsesDefault: boolean;
	mathOverflowScroll: boolean;
	seamlessTypography: boolean;
	settingsTab: SettingsTab;
	sidenotePosition: SidenotePosition;
	tableCentered: boolean;
	tableFullWidth: boolean;
	tableStyle: TableStyle;
}

const DEFAULT_SETTINGS: EditingSuiteSettings = {
	collapseBlockIds: false,
	collapseHeadingMarkers: false,
	colorHighlightWave: true,
	coloredTextBold: false,
	dividerStyle: 'default',
	editorWidth: DEFAULT_EDITOR_WIDTH,
	editorWidthUsesDefault: false,
	focusIndicator: true,
	features: {
		cloze: true,
		codeBlocks: true,
		colorHighlights: true,
		coloredText: true,
		customLists: true,
		inlineCode: true,
		negativeHeadings: true,
		proofEnd: true,
		sidenotes: true,
	},
	linkStyle: 'default',
	listMarkerColor: 'default',
	mathDisplayMargin: DEFAULT_DISPLAY_MATH_MARGIN,
	mathDisplayMarginUsesDefault: false,
	mathOverflowScroll: true,
	seamlessTypography: true,
	settingsTab: 'editor',
	sidenotePosition: 'left',
	tableCentered: true,
	tableFullWidth: true,
	tableStyle: 'default',
};

export function normalizeSettings(
	loaded: unknown,
): EditingSuiteSettings {
	const source = isRecord(loaded) ? loaded : {};
	const features = isRecord(source.features) ? source.features : {};

	return {
		collapseBlockIds: readBoolean(
			source.collapseBlockIds,
			DEFAULT_SETTINGS.collapseBlockIds,
		),
		collapseHeadingMarkers: readBoolean(
			source.collapseHeadingMarkers,
			DEFAULT_SETTINGS.collapseHeadingMarkers,
		),
		colorHighlightWave: readBoolean(
			source.colorHighlightWave,
			DEFAULT_SETTINGS.colorHighlightWave,
		),
		coloredTextBold: readBoolean(
			source.coloredTextBold,
			DEFAULT_SETTINGS.coloredTextBold,
		),
		dividerStyle: source.dividerStyle === 'diamond-gradient'
			? 'diamond-gradient'
			: 'default',
		editorWidth: normalizeEditorWidth(source.editorWidth),
		editorWidthUsesDefault: readBoolean(
			source.editorWidthUsesDefault,
			DEFAULT_SETTINGS.editorWidthUsesDefault,
		),
		focusIndicator: readBoolean(
			source.focusIndicator,
			DEFAULT_SETTINGS.focusIndicator,
		),
		features: {
			cloze: readBoolean(
				features.cloze,
				DEFAULT_SETTINGS.features.cloze,
			),
			codeBlocks: readBoolean(
				features.codeBlocks,
				DEFAULT_SETTINGS.features.codeBlocks,
			),
			colorHighlights: readBoolean(
				features.colorHighlights,
				DEFAULT_SETTINGS.features.colorHighlights,
			),
			coloredText: readBoolean(
				features.coloredText,
				DEFAULT_SETTINGS.features.coloredText,
			),
			customLists: readBoolean(
				features.customLists,
				DEFAULT_SETTINGS.features.customLists,
			),
			inlineCode: readBoolean(
				features.inlineCode,
				DEFAULT_SETTINGS.features.inlineCode,
			),
			negativeHeadings: readBoolean(
				features.negativeHeadings,
				DEFAULT_SETTINGS.features.negativeHeadings,
			),
			proofEnd: readBoolean(
				features.proofEnd,
				DEFAULT_SETTINGS.features.proofEnd,
			),
			sidenotes: readBoolean(
				features.sidenotes,
				DEFAULT_SETTINGS.features.sidenotes,
			),
		},
		linkStyle: source.linkStyle === 'red-outline'
			? 'red-outline'
			: 'default',
		listMarkerColor: source.listMarkerColor === 'text'
			? 'text'
			: 'default',
		mathDisplayMargin: normalizeDisplayMathMargin(
			source.mathDisplayMargin,
		),
		mathDisplayMarginUsesDefault: readBoolean(
			source.mathDisplayMarginUsesDefault,
			DEFAULT_SETTINGS.mathDisplayMarginUsesDefault,
		),
		mathOverflowScroll: readBoolean(
			source.mathOverflowScroll,
			DEFAULT_SETTINGS.mathOverflowScroll,
		),
		seamlessTypography: readBoolean(
			source.seamlessTypography,
			DEFAULT_SETTINGS.seamlessTypography,
		),
		settingsTab: source.settingsTab === 'extensions'
			? 'extensions'
			: 'editor',
		sidenotePosition: source.sidenotePosition === 'right' ? 'right' : 'left',
		tableCentered: readBoolean(
			source.tableCentered,
			DEFAULT_SETTINGS.tableCentered,
		),
		tableFullWidth: readBoolean(
			source.tableFullWidth,
			DEFAULT_SETTINGS.tableFullWidth,
		),
		tableStyle: source.tableStyle === 'rounded-grid' ||
			source.tableStyle === 'three-line'
			? source.tableStyle
			: 'default',
	};
}

export function normalizeDisplayMathMargin(value: unknown): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return DEFAULT_DISPLAY_MATH_MARGIN;
	}
	const stepped = Math.round(value / DISPLAY_MATH_MARGIN_STEP) *
		DISPLAY_MATH_MARGIN_STEP;
	const clamped = Math.max(
		DISPLAY_MATH_MARGIN_MIN,
		Math.min(DISPLAY_MATH_MARGIN_MAX, stepped),
	);
	return Number(clamped.toFixed(1));
}

export function normalizeEditorWidth(value: unknown): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return DEFAULT_EDITOR_WIDTH;
	}
	const stepped = Math.round(value / EDITOR_WIDTH_STEP) * EDITOR_WIDTH_STEP;
	return Math.max(EDITOR_WIDTH_MIN, Math.min(EDITOR_WIDTH_MAX, stepped));
}

function readBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
