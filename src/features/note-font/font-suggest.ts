import { AbstractInputSuggest, type App } from 'obsidian';
import { formatCssFontFamily } from './font';
import { getSystemFontFamilies } from './system-fonts';

export type FontInputElement = HTMLInputElement | HTMLDivElement;

const GENERIC_FONT_FAMILIES = [
	'system-ui',
	'sans-serif',
	'serif',
	'monospace',
];

const OBSIDIAN_BUNDLED_FONT_FAMILIES = [
	'Inter',
	'Source Code Pro',
];

const COMMON_FONT_CANDIDATES = [
	'American Typewriter',
	'Arial',
	'Arial Black',
	'Avenir',
	'Avenir Next',
	'Bahnschrift',
	'Baskerville',
	'Calibri',
	'Cambria',
	'Cambria Math',
	'Candara',
	'Charter',
	'Comic Sans MS',
	'Consolas',
	'Constantia',
	'Corbel',
	'Courier New',
	'Didot',
	'FangSong',
	'Futura',
	'Georgia',
	'Helvetica',
	'Helvetica Neue',
	'Hoefler Text',
	'Impact',
	'KaiTi',
	'Menlo',
	'Microsoft JhengHei',
	'Microsoft YaHei',
	'Monaco',
	'Noto Sans',
	'Noto Sans CJK SC',
	'Noto Serif',
	'Noto Serif CJK SC',
	'Optima',
	'Palatino',
	'PingFang SC',
	'Rockwell',
	'Segoe Print',
	'Segoe UI',
	'SimHei',
	'SimSun',
	'Songti SC',
	'Tahoma',
	'Times New Roman',
	'Trebuchet MS',
	'Verdana',
	'Yu Gothic',
];

const FONT_PROBE_TEXT = 'abcdefghijklmnopqrstuvwxyz0123456789中文字体测试';
const FONT_BASELINES = ['monospace', 'sans-serif', 'serif'];

interface FontDetector {
	baselines: Map<string, number>;
	context: CanvasRenderingContext2D;
}

let availableFontFamiliesPromise: Promise<string[]> | null = null;

export class FontSuggest extends AbstractInputSuggest<string> {
	private readonly fontFamiliesPromise: Promise<string[]>;

	constructor(app: App, inputEl: FontInputElement) {
		super(app, inputEl);
		this.limit = 50;
		availableFontFamiliesPromise ??= loadAvailableFontFamilies(
			inputEl.ownerDocument,
		);
		this.fontFamiliesPromise = availableFontFamiliesPromise;
	}

	destroy(): void {
		this.close();
	}

	protected async getSuggestions(query: string): Promise<string[]> {
		const fontFamilies = await this.fontFamiliesPromise;
		const normalizedQuery = query.trim().toLocaleLowerCase();
		if (!normalizedQuery) {
			return fontFamilies;
		}
		return fontFamilies
			.filter((font) => font.toLocaleLowerCase().includes(normalizedQuery))
			.sort((left, right) => {
				const leftStarts = left.toLocaleLowerCase()
					.startsWith(normalizedQuery);
				const rightStarts = right.toLocaleLowerCase()
					.startsWith(normalizedQuery);
				return Number(rightStarts) - Number(leftStarts);
			});
	}

	renderSuggestion(font: string, element: HTMLElement): void {
		element.addClass('editing-suite-font-suggestion');
		element.style.setProperty(
			'--editing-suite-font-preview',
			`${formatCssFontFamily(font)}, var(--font-interface)`,
		);
		element.setText(font.trim());
	}
}

async function loadAvailableFontFamilies(
	document: Document,
): Promise<string[]> {
	const detector = createFontDetector(document);
	const fontFamilies = [
		...GENERIC_FONT_FAMILIES,
		...OBSIDIAN_BUNDLED_FONT_FAMILIES,
	];
	const seen = new Set(fontFamilies);
	const ownerWindow = document.defaultView ?? window;

	for (let index = 0; index < COMMON_FONT_CANDIDATES.length; index++) {
		const font = COMMON_FONT_CANDIDATES[index];
		if (font && !seen.has(font) && isFontAvailable(detector, font)) {
			seen.add(font);
			fontFamilies.push(font);
		}
		if ((index + 1) % 10 === 0) {
			await new Promise<void>((resolve) => {
				ownerWindow.setTimeout(resolve, 0);
			});
		}
	}

	const systemFontFamilies = await getSystemFontFamilies();
	for (let index = 0; index < systemFontFamilies.length; index++) {
		const font = systemFontFamilies[index];
		if (font && !seen.has(font)) {
			seen.add(font);
			fontFamilies.push(font);
		}
		if ((index + 1) % 100 === 0) {
			await new Promise<void>((resolve) => {
				ownerWindow.setTimeout(resolve, 0);
			});
		}
	}
	return fontFamilies.sort((left, right) => left.localeCompare(right));
}

function createFontDetector(document: Document): FontDetector | null {
	const context = document.createElement('canvas').getContext('2d');
	if (!context) {
		return null;
	}
	const baselines = new Map<string, number>();
	for (const baseline of FONT_BASELINES) {
		context.font = `72px ${baseline}`;
		baselines.set(
			baseline,
			context.measureText(FONT_PROBE_TEXT).width,
		);
	}
	return { baselines, context };
}

function isFontAvailable(
	detector: FontDetector | null,
	fontFamily: string,
): boolean {
	if (!detector || !fontFamily.trim()) {
		return false;
	}
	if (GENERIC_FONT_FAMILIES.includes(fontFamily)) {
		return true;
	}
	for (const baseline of FONT_BASELINES) {
		detector.context.font =
			`72px ${formatCssFontFamily(fontFamily)}, ${baseline}`;
		if (
			detector.context.measureText(FONT_PROBE_TEXT).width !==
			detector.baselines.get(baseline)
		) {
			return true;
		}
	}
	return false;
}
