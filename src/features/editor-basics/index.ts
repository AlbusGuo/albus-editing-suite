import {
	StateEffect,
	type Extension,
	type Range,
} from '@codemirror/state';
import {
	Decoration,
	type DecorationSet,
	type EditorView,
	ViewPlugin,
	type ViewUpdate,
} from '@codemirror/view';
import type { Plugin } from 'obsidian';
import {
	EDITOR_WIDTH_STEP,
	normalizeEditorWidth,
} from '../../settings';
import { getAppDocuments } from '../../utils/app-documents';
import type { FeatureController } from '../controller';
import { createCalloutListSpacingExtension } from './callout-list-spacing';
import { createHeadingMarkerCollapseExtension } from './heading-marker-collapse';
import { markStandaloneImages } from './image-alignment';
import { createOrderedListAlignmentExtension } from './ordered-list-alignment';

const FILE_LINE_WIDTH_PROPERTY = '--file-line-width';
const SEAMLESS_BODY_CLASS = 'editing-suite-seamless-typography-enabled';
const FLOW_SPACING_PROPERTY = '--editing-suite-flow-spacing';
const QUOTE_PADDING_PROPERTY = '--editing-suite-reading-quote-padding';
const WHEEL_THRESHOLD = 80;
const WHEEL_RESET_DELAY = 250;
const HEADING_PATTERN = /^ {0,3}#{1,6}(?:\s|$)/u;
const FRONTMATTER_BOUNDARY = '---';
const FRONTMATTER_END_BOUNDARIES = new Set(['---', '...']);
const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;
const HEADING_CORRECTION_PROPERTY =
	'--editing-suite-current-heading-box-correction';
const HEADING_BLOCK_SIZE_PROPERTY =
	'--editing-suite-current-heading-block-size';
const NORMALIZED_HEADING_CLASS =
	'editing-suite-heading-box-normalized';
const MAX_HEADING_BOX_CORRECTION = 4;
const HEADING_METRICS_CHANGED = StateEffect.define<void>();
const READING_HEADING_METRICS = new WeakMap<
	Document,
	Map<number, HeadingMetric>
>();
const READING_QUOTE_PADDING = new WeakMap<Document, number>();

export function registerEditorBasics(
	plugin: Plugin,
	getWidth: () => number,
	getSeamlessTypography: () => boolean,
	onWidthChange: (width: number) => void,
	getCustomListsEnabled: () => boolean,
	getCollapseHeadingMarkers: () => boolean,
): FeatureController {
	const registeredDocuments = new WeakSet<Document>();
	let wheelDelta = 0;
	let lastWheelTime = 0;

	const applyWidth = (): void => {
		const width = normalizeEditorWidth(getWidth());
		for (const document of getAppDocuments(plugin.app)) {
			document.body.style.setProperty(
				FILE_LINE_WIDTH_PROPERTY,
				`${width}px`,
			);
		}
	};
	const applyTypography = (): void => {
		for (const document of getAppDocuments(plugin.app)) {
			const enabled = getSeamlessTypography();
			document.body.classList.toggle(SEAMLESS_BODY_CLASS, enabled);
			if (!enabled) {
				document.body.style.removeProperty(FLOW_SPACING_PROPERTY);
				document.body.style.removeProperty(QUOTE_PADDING_PROPERTY);
				READING_HEADING_METRICS.delete(document);
				READING_QUOTE_PADDING.delete(document);
				continue;
			}
			cacheReadingHeadingMetrics(document);
			const metrics = measureTypography(document);
			document.body.style.setProperty(
				FLOW_SPACING_PROPERTY,
				`${metrics.lineHeight}px`,
			);
			document.body.style.setProperty(
				QUOTE_PADDING_PROPERTY,
				`${metrics.readingQuotePadding}px`,
			);
		}
	};

	const registerDocument = (document: Document): void => {
		if (registeredDocuments.has(document)) {
			return;
		}
		registeredDocuments.add(document);
		plugin.registerDomEvent(document, 'wheel', (event) => {
			if (
				!event.altKey ||
				event.ctrlKey ||
				event.metaKey ||
				event.shiftKey ||
				event.deltaY === 0
			) {
				return;
			}
			const target = event.target as Element | null;
			if (
				!target?.closest(
					'.markdown-source-view, .markdown-reading-view',
				) ||
				target.closest(
					'.editing-suite-sidenote-margin, .modal, .setting-item',
				)
			) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			if (event.timeStamp - lastWheelTime > WHEEL_RESET_DELAY) {
				wheelDelta = 0;
			}
			lastWheelTime = event.timeStamp;
			wheelDelta -= event.deltaY;
			const steps = Math.trunc(wheelDelta / WHEEL_THRESHOLD);
			if (steps === 0) {
				return;
			}
			wheelDelta -= steps * WHEEL_THRESHOLD;
			const nextWidth = normalizeEditorWidth(
				getWidth() + steps * EDITOR_WIDTH_STEP,
			);
			if (nextWidth !== getWidth()) {
				onWidthChange(nextWidth);
			}
		}, { capture: true, passive: false });
	};

	const refreshDocuments = (): void => {
		for (const document of getAppDocuments(plugin.app)) {
			registerDocument(document);
		}
		applyWidth();
		applyTypography();
	};

	plugin.registerEditorExtension(
		createTypographyEditorExtension(getSeamlessTypography),
	);
	plugin.registerEditorExtension(
		createOrderedListAlignmentExtension(
			getSeamlessTypography,
			getCustomListsEnabled,
		),
	);
	plugin.registerEditorExtension(
		createCalloutListSpacingExtension(getSeamlessTypography),
	);
	plugin.registerEditorExtension(
		createHeadingMarkerCollapseExtension(getCollapseHeadingMarkers),
	);
	plugin.registerMarkdownPostProcessor((element) => {
		markStandaloneImages(element);
	});
	plugin.registerEvent(plugin.app.workspace.on('window-open', () => {
		refreshDocuments();
	}));
	plugin.registerEvent(plugin.app.workspace.on('css-change', () => {
		for (const document of getAppDocuments(plugin.app)) {
			READING_HEADING_METRICS.delete(document);
			READING_QUOTE_PADDING.delete(document);
		}
		refreshDocuments();
	}));
	plugin.registerEvent(plugin.app.workspace.on('file-open', () => {
		for (const document of getAppDocuments(plugin.app)) {
			READING_HEADING_METRICS.delete(document);
		}
		applyTypography();
	}));
	plugin.registerEvent(plugin.app.workspace.on('layout-change', () => {
		applyTypography();
	}));
	plugin.registerEvent(plugin.app.workspace.on('resize', () => {
		applyTypography();
	}));
	plugin.app.workspace.onLayoutReady(() => {
		refreshDocuments();
	});
	plugin.register(() => {
		for (const document of getAppDocuments(plugin.app)) {
			document.body.style.removeProperty(FILE_LINE_WIDTH_PROPERTY);
			document.body.style.removeProperty(FLOW_SPACING_PROPERTY);
			document.body.style.removeProperty(QUOTE_PADDING_PROPERTY);
			document.body.classList.remove(SEAMLESS_BODY_CLASS);
		}
	});
	refreshDocuments();

	return {
		refresh: () => {
			applyWidth();
			applyTypography();
		},
	};
}

interface TypographyMetrics {
	lineHeight: number;
	readingQuotePadding: number;
}

function measureTypography(document: Document): TypographyMetrics {
	const baseElement = document.querySelector<HTMLElement>(
		'.markdown-source-view.mod-cm6 .cm-line:not(.HyperMD-header):not(.HyperMD-codeblock), ' +
			'.markdown-rendered p',
	);
	const bodyStyle = document.defaultView?.getComputedStyle(document.body);
	const baseStyle = baseElement
		? document.defaultView?.getComputedStyle(baseElement)
		: null;
	const fontSize = readNumericValue(
		baseStyle?.fontSize,
		readNumericValue(
			bodyStyle?.getPropertyValue('--font-text-size'),
			16,
		),
	);
	const normalLineHeight = readNumericValue(
		bodyStyle?.getPropertyValue('--line-height-normal'),
		1.5,
	);
	const lineHeight = readNumericValue(
		baseStyle?.lineHeight,
		fontSize * normalLineHeight,
	);
	const quoteLine = document.querySelector<HTMLElement>(
		'.markdown-source-view.mod-cm6.is-live-preview .cm-line.HyperMD-quote',
	);
	const quoteStyle = quoteLine
		? document.defaultView?.getComputedStyle(quoteLine)
		: null;
	const quoteLineRect = quoteLine?.getBoundingClientRect();
	const quoteContentRect = quoteLine
		? findFirstQuoteContentRect(quoteLine)
		: null;
	const quoteBorder = readNumericValue(
		bodyStyle?.getPropertyValue('--blockquote-border-thickness'),
		2,
	);
	const measuredQuotePadding = quoteContentRect && quoteLineRect
		? Math.max(
			0,
			quoteContentRect.left - quoteLineRect.left - quoteBorder,
		)
		: null;
	if (measuredQuotePadding !== null) {
		READING_QUOTE_PADDING.set(
			document,
			roundLayoutMetric(measuredQuotePadding),
		);
	}
	const devicePixelRatio = document.defaultView?.devicePixelRatio ?? 1;
	const fallbackQuoteInset = readNumericValue(
		quoteStyle?.paddingInlineStart,
		fontSize + 1,
	) + 1 / devicePixelRatio;
	const readingQuotePadding = measuredQuotePadding ??
		READING_QUOTE_PADDING.get(document) ??
		Math.max(0, fallbackQuoteInset - quoteBorder);
	return {
		lineHeight: roundMetric(lineHeight),
		readingQuotePadding: roundLayoutMetric(readingQuotePadding),
	};
}

function createTypographyEditorExtension(
	isEnabled: () => boolean,
): Extension {
	return ViewPlugin.fromClass(class {
		decorations: DecorationSet;
		private contentWidth: number;
		private destroyed = false;
		private enabled: boolean;
		private headingLevelMetrics = new Map<number, HeadingMetric>();
		private headingMetrics = new Map<number, HeadingMetric>();
		private refreshQueued = false;

		constructor(view: EditorView) {
			this.contentWidth = view.contentDOM.clientWidth;
			this.enabled = isEnabled();
			if (this.enabled) {
				this.headingLevelMetrics = new Map(
					READING_HEADING_METRICS.get(view.dom.ownerDocument) ?? [],
				);
				this.headingMetrics = getInitialHeadingMetrics(view);
				this.decorations = buildHeadingDecorations(
					view,
					isEnabled,
					this.headingLevelMetrics,
					this.headingMetrics,
				);
				this.requestHeadingMeasurement(view, isEnabled);
			} else {
				this.decorations = Decoration.none;
			}
		}

		update(update: ViewUpdate): void {
			const enabled = isEnabled();
			if (!enabled) {
				this.enabled = false;
				this.headingLevelMetrics.clear();
				this.headingMetrics.clear();
				this.decorations = Decoration.none;
				return;
			}
			if (!this.enabled) {
				this.enabled = true;
				this.headingLevelMetrics = new Map(
					READING_HEADING_METRICS.get(
						update.view.dom.ownerDocument,
					) ?? [],
				);
				this.headingMetrics = getInitialHeadingMetrics(update.view);
			}
			if (update.docChanged) {
				this.headingMetrics = mapHeadingMetrics(
					this.headingMetrics,
					update,
				);
			}
			if (update.geometryChanged || update.viewportChanged) {
				const contentWidth = update.view.contentDOM.clientWidth;
				if (Math.abs(contentWidth - this.contentWidth) >= 0.5) {
					this.contentWidth = contentWidth;
					this.headingMetrics.clear();
				}
			}
			if (update.geometryChanged) {
				for (const [position, metric] of getInitialHeadingMetrics(
					update.view,
				)) {
					this.headingMetrics.set(position, metric);
				}
			}
			const metricsChanged = update.transactions.some((transaction) =>
				transaction.effects.some((effect) =>
					effect.is(HEADING_METRICS_CHANGED),
				),
			);
			if (
				update.docChanged ||
				update.viewportChanged ||
				update.geometryChanged ||
				metricsChanged
			) {
				this.decorations = buildHeadingDecorations(
					update.view,
					isEnabled,
					this.headingLevelMetrics,
					this.headingMetrics,
				);
				if (!metricsChanged) {
					this.requestHeadingMeasurement(update.view, isEnabled);
				}
			}
		}

		destroy(): void {
			this.destroyed = true;
		}

		private requestHeadingMeasurement(
			view: EditorView,
			enabled: () => boolean,
		): void {
			view.requestMeasure({
				key: this,
				read: () => enabled()
					? measureHeadingLayout(view)
					: null,
				write: (measurement) => {
					if (measurement === null) {
						if (this.headingMetrics.size > 0) {
							this.headingMetrics.clear();
							this.scheduleMetricsRefresh(view);
						}
						return;
					}
					const nextMetrics = mergeHeadingMeasurement(
						this.headingMetrics,
						measurement,
					);
					let levelsChanged = false;
					for (const [level, metric] of measurement.levelMetrics) {
						const previous = this.headingLevelMetrics.get(level);
						if (
							!previous ||
							previous.blockSize !== metric.blockSize ||
							previous.correction !== metric.correction
						) {
							this.headingLevelMetrics.set(level, metric);
							levelsChanged = true;
						}
					}
					if (
						!levelsChanged &&
						headingMetricsEqual(this.headingMetrics, nextMetrics)
					) {
						return;
					}
					this.headingMetrics = nextMetrics;
					this.scheduleMetricsRefresh(view);
				},
			});
		}

		private scheduleMetricsRefresh(view: EditorView): void {
			if (this.refreshQueued || this.destroyed) {
				return;
			}
			const window = view.dom.ownerDocument.defaultView;
			if (!window) {
				return;
			}
			this.refreshQueued = true;
			window.queueMicrotask(() => {
				this.refreshQueued = false;
				if (this.destroyed || !view.dom.isConnected) {
					return;
				}
				view.dispatch({
					effects: HEADING_METRICS_CHANGED.of(),
				});
			});
		}
	}, {
		decorations: (value) => value.decorations,
	});
}

interface HeadingMetric {
	blockSize: number;
	correction: number;
}
interface HeadingMeasurement {
	levelMetrics: Map<number, HeadingMetric>;
	metrics: Map<number, HeadingMetric>;
	visitedPositions: Set<number>;
}

function measureHeadingLayout(view: EditorView): HeadingMeasurement {
	const levelMetrics = new Map<number, HeadingMetric>();
	const metrics = new Map<number, HeadingMetric>();
	const visitedPositions = new Set<number>();
	const window = view.dom.ownerDocument.defaultView;
	const devicePixelRatio = window?.devicePixelRatio ?? 1;
	const elements = Array.from(
		view.dom.querySelectorAll<HTMLElement>('.cm-line.HyperMD-header'),
	);
	for (const element of elements) {
			let position: number;
			try {
				position = view.state.doc.lineAt(
					view.posAtDOM(element),
				).from;
			} catch {
				continue;
			}
			visitedPositions.add(position);
			const level = /^ {0,3}(#{1,6})(?:\s|$)/u.exec(
				view.state.doc.lineAt(position).text,
			)?.[1]?.length;
			if (headingContainsMath(view, element)) {
				continue;
			}
			const style = window?.getComputedStyle(element);
			if (!style) {
				continue;
			}
			const lineHeight = readNumericValue(style.lineHeight, 0);
			if (lineHeight <= 0) {
				continue;
			}
			const padding = readNumericValue(style.paddingTop, 0) +
				readNumericValue(style.paddingBottom, 0);
			const normalized = element.classList.contains(
				NORMALIZED_HEADING_CLASS,
			);
			if (normalized) {
				const storedBlockSize = readNumericValue(
					element.style.getPropertyValue(
						HEADING_BLOCK_SIZE_PROPERTY,
					),
					lineHeight,
				);
				if (element.scrollHeight - padding > storedBlockSize * 1.5) {
					continue;
				}
			const metric = {
				blockSize: storedBlockSize,
				correction: readNumericValue(
						element.style.getPropertyValue(
							HEADING_CORRECTION_PROPERTY,
						),
						0,
				),
			};
			metrics.set(position, metric);
			if (level) {
				levelMetrics.set(level, metric);
				}
				continue;
			}
			const contentHeight = element.getBoundingClientRect().height - padding;
			if (contentHeight > lineHeight * 1.5) {
				continue;
			}
			const correction = roundToDevicePixel(
				Math.min(
					MAX_HEADING_BOX_CORRECTION,
					Math.max(0, contentHeight - lineHeight),
				),
				devicePixelRatio,
			);
		const metric = {
			blockSize: roundLayoutMetric(lineHeight),
			correction,
		};
		metrics.set(position, metric);
		if (level) {
			levelMetrics.set(level, metric);
		}
	}
	return {
		levelMetrics,
		metrics,
		visitedPositions,
	};
}

function cacheReadingHeadingMetrics(document: Document): void {
	const window = document.defaultView;
	const readingView = document.querySelector<HTMLElement>(
		'.markdown-reading-view',
	);
	if (!window || !readingView) {
		return;
	}
	const devicePixelRatio = window.devicePixelRatio || 1;
	const cached = new Map<number, HeadingMetric>();
	for (const level of HEADING_LEVELS) {
		const heading = Array.from(
			readingView.querySelectorAll<HTMLElement>(
				`h${level}`,
			),
		).find((element) =>
			!element.querySelector('.math, .math-inline, mjx-container'),
		);
		if (!heading) {
			continue;
		}
		const style = window.getComputedStyle(heading);
		const lineHeight = readNumericValue(style.lineHeight, 0);
		const rect = heading.getBoundingClientRect();
		if (lineHeight <= 0 || rect.height > lineHeight * 1.5) {
			continue;
		}
		const textRect = findFirstPlainTextRect(heading);
		if (!textRect) {
			continue;
		}
		cached.set(level, {
			blockSize: roundLayoutMetric(rect.height),
			correction: roundToDevicePixel(
				Math.max(0, rect.top - textRect.top),
				devicePixelRatio,
			),
		});
	}
	if (cached.size > 0) {
		READING_HEADING_METRICS.set(document, cached);
	} else {
		READING_HEADING_METRICS.delete(document);
	}
}

function getInitialHeadingMetrics(view: EditorView): Map<number, HeadingMetric> {
	const cached = READING_HEADING_METRICS.get(view.dom.ownerDocument);
	const metrics = new Map<number, HeadingMetric>();
	if (!cached || view.contentDOM.clientWidth <= 0) {
		return metrics;
	}
	const visited = new Set<number>();
	for (const range of view.visibleRanges) {
		let line = view.state.doc.lineAt(range.from);
		while (line.from <= range.to) {
			if (!visited.has(line.from)) {
				visited.add(line.from);
				const match = /^ {0,3}(#{1,6})(?:\s|$)/u.exec(line.text);
				const level = match?.[1]?.length;
				const metric = level ? cached.get(level) : undefined;
				if (
					metric &&
					!containsMathDelimiter(line.text) &&
					isLikelySingleLineHeading(
						view,
						line.text,
						metric,
					)
				) {
					metrics.set(line.from, metric);
				}
			}
			if (line.to >= view.state.doc.length) {
				break;
			}
			line = view.state.doc.line(line.number + 1);
		}
	}
	return metrics;
}

function isLikelySingleLineHeading(
	view: EditorView,
	text: string,
	metric: HeadingMetric,
): boolean {
	const content = text.replace(/^ {0,3}#{1,6}\s*/u, '').trim();
	if (content === '') {
		return true;
	}
	const conservativeWidth = content.length * metric.blockSize;
	return conservativeWidth <= view.contentDOM.clientWidth * 0.8;
}

function findFirstPlainTextRect(element: HTMLElement): DOMRect | null {
	const document = element.ownerDocument;
	const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
	let node = walker.nextNode();
	while (node) {
		if (
			node.textContent?.trim() &&
			!node.parentElement?.closest('.math, .math-inline, mjx-container')
		) {
			const range = document.createRange();
			range.selectNodeContents(node);
			const rect = range.getBoundingClientRect();
			if (rect.width > 0 && rect.height > 0) {
				return rect;
			}
		}
		node = walker.nextNode();
	}
	return null;
}

function findFirstQuoteContentRect(element: HTMLElement): DOMRect | null {
	const document = element.ownerDocument;
	const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
	let node = walker.nextNode();
	while (node) {
		const text = node.textContent?.trim();
		if (text && text !== '>') {
			const range = document.createRange();
			range.selectNodeContents(node);
			const rect = range.getBoundingClientRect();
			if (rect.width > 0 && rect.height > 0) {
				return rect;
			}
		}
		node = walker.nextNode();
	}
	return null;
}

function mergeHeadingMeasurement(
	current: Map<number, HeadingMetric>,
	measurement: HeadingMeasurement,
): Map<number, HeadingMetric> {
	const merged = new Map(current);
	for (const position of measurement.visitedPositions) {
		merged.delete(position);
	}
	for (const [position, metric] of measurement.metrics) {
		merged.set(position, metric);
	}
	return merged;
}

function headingMetricsEqual(
	left: Map<number, HeadingMetric>,
	right: Map<number, HeadingMetric>,
): boolean {
	if (left.size !== right.size) {
		return false;
	}
	for (const [position, metric] of left) {
		const other = right.get(position);
		if (
			!other ||
			other.blockSize !== metric.blockSize ||
			other.correction !== metric.correction
		) {
			return false;
		}
	}
	return true;
}

function mapHeadingMetrics(
	metrics: Map<number, HeadingMetric>,
	update: ViewUpdate,
): Map<number, HeadingMetric> {
	const mapped = new Map<number, HeadingMetric>();
	for (const [position, metric] of metrics) {
		mapped.set(update.changes.mapPos(position, 1), metric);
	}
	return mapped;
}

function headingContainsMath(view: EditorView, element: HTMLElement): boolean {
	if (element.querySelector('.math, .math-inline, .cm-math, mjx-container')) {
		return true;
	}
	try {
		const position = view.posAtDOM(element);
		return containsMathDelimiter(
			view.state.doc.lineAt(position).text,
		);
	} catch {
		return false;
	}
}

function containsMathDelimiter(text: string): boolean {
	let delimiters = 0;
	for (let index = 0; index < text.length; index += 1) {
		if (text[index] !== '$') {
			continue;
		}
		let escapes = 0;
		for (
			let cursor = index - 1;
			cursor >= 0 && text[cursor] === '\\';
			cursor -= 1
		) {
			escapes += 1;
		}
		if (escapes % 2 === 0) {
			delimiters += 1;
			if (delimiters >= 2) {
				return true;
			}
		}
	}
	return false;
}

function buildHeadingDecorations(
	view: EditorView,
	isEnabled: () => boolean,
	headingLevelMetrics: Map<number, HeadingMetric>,
	headingMetrics: Map<number, HeadingMetric>,
): DecorationSet {
	if (!isEnabled()) {
		return Decoration.none;
	}
	const decorations: Range<Decoration>[] = [];
	const visited = new Set<number>();
	const firstBodyLine = findFirstBodyLine(view);
	for (const range of view.visibleRanges) {
		let line = view.state.doc.lineAt(range.from);
		while (line.from <= range.to) {
			if (!visited.has(line.from) && HEADING_PATTERN.test(line.text)) {
				visited.add(line.from);
				const classes: string[] = [];
				const level = /^ {0,3}(#{1,6})(?:\s|$)/u.exec(
					line.text,
				)?.[1]?.length;
				const levelMetric = level
					? headingLevelMetrics.get(level)
					: undefined;
				const fallbackMetric = levelMetric &&
					isLikelySingleLineHeading(view, line.text, levelMetric)
					? levelMetric
					: undefined;
				const metric = containsMathDelimiter(line.text)
					? undefined
					: headingMetrics.get(line.from) ?? fallbackMetric;
				if (metric) {
					classes.push(NORMALIZED_HEADING_CLASS);
				}
				if (line.number === firstBodyLine) {
					classes.push('editing-suite-first-body-heading');
				}
				const previousBlank = line.number === 1 ||
					view.state.doc.line(line.number - 1).text.trim() === '';
				if (previousBlank) {
					classes.push('editing-suite-heading-no-before-gap');
				}
				if (line.number < view.state.doc.lines) {
					const nextText = view.state.doc.line(line.number + 1).text;
					if (nextText.trim() !== '' && !HEADING_PATTERN.test(nextText)) {
						classes.push('editing-suite-heading-after-gap');
					}
				}
				if (classes.length > 0) {
					const attributes = metric
						? {
							style: `${HEADING_CORRECTION_PROPERTY}: ` +
								`${metric.correction}px; ` +
								`${HEADING_BLOCK_SIZE_PROPERTY}: ` +
								`${metric.blockSize}px;`,
						}
						: undefined;
					decorations.push(
						Decoration.line({
							class: classes.join(' '),
							attributes,
						}).range(line.from),
					);
				}
			}
			if (line.to >= view.state.doc.length) {
				break;
			}
			line = view.state.doc.line(line.number + 1);
		}
	}
	return Decoration.set(decorations, true);
}

function findFirstBodyLine(view: EditorView): number | null {
	const document = view.state.doc;
	if (
		document.lines < 2 ||
		document.line(1).text.trim() !== FRONTMATTER_BOUNDARY
	) {
		return null;
	}
	let closingLine = 0;
	for (let lineNumber = 2; lineNumber <= document.lines; lineNumber += 1) {
		if (
			FRONTMATTER_END_BOUNDARIES.has(
				document.line(lineNumber).text.trim(),
			)
		) {
			closingLine = lineNumber;
			break;
		}
	}
	if (closingLine === 0) {
		return null;
	}
	for (
		let lineNumber = closingLine + 1;
		lineNumber <= document.lines;
		lineNumber += 1
	) {
		if (document.line(lineNumber).text.trim() !== '') {
			return lineNumber;
		}
	}
	return null;
}

function readNumericValue(value: string | undefined, fallback: number): number {
	const parsed = Number.parseFloat(value ?? '');
	return Number.isFinite(parsed) ? parsed : fallback;
}

function roundMetric(value: number): number {
	return Math.round(value * 100) / 100;
}

function roundLayoutMetric(value: number): number {
	return Math.round(value * 10000) / 10000;
}

function roundToDevicePixel(value: number, devicePixelRatio: number): number {
	const ratio = devicePixelRatio > 0 ? devicePixelRatio : 1;
	return Math.round(value * ratio) / ratio;
}
