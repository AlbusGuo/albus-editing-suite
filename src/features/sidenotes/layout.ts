import {
	resolveSidenotePositions,
	type SidenoteCollisionItem,
} from './collision';
import { setSidenotePopupMode } from './popup';
import type { SidenotePosition } from '../../settings';

const MIN_SIDENOTE_WIDTH = 120;
const MAX_SIDENOTE_WIDTH = 260;
const HORIZONTAL_GAP = 16;
const VERTICAL_GAP = 10;
const EDGE_PADDING = 8;
const FOCUS_INDICATOR_CLEARANCE_EM = 2.5;
const FOCUS_INDICATOR_BODY_CLASS =
	'editing-suite-focus-indicator-enabled';
const EXTRA_BOTTOM_PROPERTY = '--editing-suite-sidenote-extra-bottom';

interface LayoutEntry {
	anchor: HTMLElement;
	margin: HTMLElement;
}

interface HorizontalMeasurement extends LayoutEntry {
	left: number;
	popupOnly: boolean;
	width: number;
}

interface RootHorizontalMetrics {
	indicatorClearance: number;
	paneLeft: number;
	paneRight: number;
	textLeft: number;
	textRight: number;
}

interface VerticalMeasurement extends LayoutEntry, SidenoteCollisionItem {
	anchorTop: number;
	height: number;
	number: number;
	root: HTMLElement;
}

export class SidenoteLayoutController {
	private readonly entries = new Map<HTMLElement, LayoutEntry>();
	private readonly rootsWithExtraSpace = new Set<HTMLElement>();
	private disposed = false;
	private scheduled = false;
	private readonly resizeObserver = new ResizeObserver((entries) => {
		if (entries.some((entry) => {
			const margin = entry.target as HTMLElement;
			return !margin.closest(
				'.editing-suite-sidenote-anchor.is-popup-only',
			);
		})) {
			this.schedule();
		}
	});

	constructor(
		private readonly getPosition: () => SidenotePosition,
	) {}

	register(anchor: HTMLElement, margin: HTMLElement): () => void {
		this.entries.set(margin, { anchor, margin });
		this.resizeObserver.observe(margin);
		this.schedule();
		return () => {
			this.resizeObserver.unobserve(margin);
			this.entries.delete(margin);
		};
	}

	schedule(): void {
		if (this.scheduled || this.disposed) {
			return;
		}
		this.scheduled = true;
		queueMicrotask(() => {
			this.scheduled = false;
			if (this.disposed) {
				return;
			}
			this.applyLayout();
		});
	}

	dispose(): void {
		this.disposed = true;
		this.scheduled = false;
		this.resizeObserver.disconnect();
		this.entries.clear();
		for (const root of this.rootsWithExtraSpace) {
			root.style.removeProperty(EXTRA_BOTTOM_PROPERTY);
		}
		this.rootsWithExtraSpace.clear();
	}

	private applyLayout(): void {
		const position = this.getPosition();
		const measurements: HorizontalMeasurement[] = [];
		const rootMetrics = new Map<HTMLElement, RootHorizontalMetrics>();
		for (const entry of this.entries.values()) {
			if (!entry.anchor.isConnected || !entry.margin.isConnected) {
				continue;
			}
			const root = getLayoutRoot(entry.anchor);
			if (!root) {
				continue;
			}
			let metrics = rootMetrics.get(root);
			if (!metrics) {
				const paneRect = getPaneElement(root).getBoundingClientRect();
				const textBounds = getTextColumnBounds(root);
				if (!textBounds) {
					continue;
				}
				metrics = {
					indicatorClearance: getFocusIndicatorClearance(root),
					paneLeft: paneRect.left,
					paneRight: paneRect.right,
					textLeft: textBounds.left,
					textRight: textBounds.right,
				};
				rootMetrics.set(root, metrics);
			}
			const anchorRect = entry.anchor.getBoundingClientRect();
			const available = position === 'left'
				? metrics.textLeft - metrics.paneLeft -
					HORIZONTAL_GAP - metrics.indicatorClearance - EDGE_PADDING
				: metrics.paneRight - metrics.textRight -
					HORIZONTAL_GAP - metrics.indicatorClearance - EDGE_PADDING;
			const popupOnly = available < MIN_SIDENOTE_WIDTH;
			const width = Math.min(MAX_SIDENOTE_WIDTH, Math.max(0, available));
			const absoluteLeft = position === 'left'
				? metrics.textLeft - HORIZONTAL_GAP -
					metrics.indicatorClearance - width
				: metrics.textRight + HORIZONTAL_GAP +
					metrics.indicatorClearance;
			measurements.push({
				...entry,
				left: absoluteLeft - anchorRect.left,
				popupOnly,
				width,
			});
		}

		for (const item of measurements) {
			setSidenotePopupMode(item.anchor, item.popupOnly, true);
			if (!item.popupOnly) {
				item.anchor.classList.remove('is-popup-open');
			}
			if (item.popupOnly) {
				setCssProps(item.margin, {
					'--editing-suite-sidenote-shift': '0px',
				});
				item.margin.style.removeProperty('--editing-suite-sidenote-left');
				item.margin.style.removeProperty('--editing-suite-sidenote-width');
			} else {
				setCssProps(item.margin, {
					'--editing-suite-sidenote-left': `${Math.round(item.left)}px`,
					'--editing-suite-sidenote-width': `${Math.round(item.width)}px`,
				});
			}
		}

		const byRoot = new Map<HTMLElement, VerticalMeasurement[]>();
		for (const entry of this.entries.values()) {
			if (
				!entry.anchor.isConnected ||
				!entry.margin.isConnected ||
				entry.anchor.classList.contains('is-popup-only')
			) {
				continue;
			}
			const root = getLayoutRoot(entry.anchor);
			if (!root) {
				continue;
			}
			const anchorRect = entry.anchor.getBoundingClientRect();
			const marginRect = entry.margin.getBoundingClientRect();
			const items = byRoot.get(root) ?? [];
			items.push({
				...entry,
				anchorTop: anchorRect.top,
				height: marginRect.height,
				number: parseSidenoteNumber(entry.anchor),
				root,
			});
			byRoot.set(root, items);
		}

		const activeExtraSpaceRoots = new Set<HTMLElement>();
		for (const [root, items] of byRoot) {
			activeExtraSpaceRoots.add(root);
			items.sort(
				(left, right) =>
					left.anchorTop - right.anchorTop ||
					left.number - right.number,
			);
			const pane = getPaneElement(root);
			const paneRect = pane.getBoundingClientRect();
			const topBound = paneRect.top - pane.scrollTop + EDGE_PADDING;
			const positions = resolveSidenotePositions(
				items,
				topBound,
				VERTICAL_GAP,
			);
			let requiredBottom = Number.NEGATIVE_INFINITY;
			for (let index = 0; index < items.length; index++) {
				const item = items[index];
				const position = positions[index];
				if (!item || position === undefined) {
					continue;
				}
				if (item.anchor.classList.contains('is-popup-open')) {
					setSidenotePopupMode(item.anchor, false);
				}
				setCssProps(item.margin, {
					'--editing-suite-sidenote-shift': `${Math.round(position - item.anchorTop)}px`,
				});
				requiredBottom = Math.max(
					requiredBottom,
					position + item.height + EDGE_PADDING,
				);
			}
			if (setExtraBottomSpace(root, requiredBottom)) {
				this.rootsWithExtraSpace.add(root);
			} else {
				this.rootsWithExtraSpace.delete(root);
			}
		}
		for (const root of this.rootsWithExtraSpace) {
			if (!activeExtraSpaceRoots.has(root)) {
				root.style.removeProperty(EXTRA_BOTTOM_PROPERTY);
				this.rootsWithExtraSpace.delete(root);
			}
		}
	}
}

function setExtraBottomSpace(
	root: HTMLElement,
	requiredBottom: number,
): boolean {
	const content = root.querySelector<HTMLElement>(
		'.cm-content, .markdown-preview-sizer',
	);
	if (!content || !Number.isFinite(requiredBottom)) {
		root.style.removeProperty(EXTRA_BOTTOM_PROPERTY);
		return false;
	}
	const previousExtra = Number.parseFloat(
		root.style.getPropertyValue(EXTRA_BOTTOM_PROPERTY),
	) || 0;
	const contentRect = content.getBoundingClientRect();
	const naturalBottom = contentRect.top + content.scrollHeight - previousExtra;
	const extra = Math.max(0, Math.ceil(requiredBottom - naturalBottom));
	if (extra === 0) {
		root.style.removeProperty(EXTRA_BOTTOM_PROPERTY);
		return false;
	}
	root.style.setProperty(EXTRA_BOTTOM_PROPERTY, `${extra}px`);
	return true;
}

function getLayoutRoot(element: HTMLElement): HTMLElement | null {
	return element.closest<HTMLElement>(
		'.markdown-source-view, .markdown-reading-view',
	);
}

function getPaneElement(root: HTMLElement): HTMLElement {
	return root.querySelector<HTMLElement>('.cm-scroller, .markdown-preview-view') ?? root;
}

function getTextColumnBounds(
	root: HTMLElement,
): { left: number; right: number } | null {
	const content = root.querySelector<HTMLElement>(
		'.cm-content, .markdown-preview-sizer',
	);
	if (!content) {
		return null;
	}
	const rect = content.getBoundingClientRect();
	const style = content.ownerDocument.defaultView?.getComputedStyle(content);
	const paddingLeft = parseFloat(style?.paddingLeft ?? '') || 0;
	const paddingRight = parseFloat(style?.paddingRight ?? '') || 0;
	return {
		left: rect.left + paddingLeft,
		right: rect.right - paddingRight,
	};
}

function getFocusIndicatorClearance(root: HTMLElement): number {
	if (
		!root.ownerDocument.body.classList.contains(
			FOCUS_INDICATOR_BODY_CLASS,
		)
	) {
		return 0;
	}
	const style = root.ownerDocument.defaultView?.getComputedStyle(root);
	const configuredFontSize = Number.parseFloat(
		style?.getPropertyValue('--font-text-size') ?? '',
	);
	const inheritedFontSize = Number.parseFloat(style?.fontSize ?? '');
	const fontSize = Number.isFinite(configuredFontSize)
		? configuredFontSize
		: inheritedFontSize;
	return (Number.isFinite(fontSize) ? fontSize : 16) *
		FOCUS_INDICATOR_CLEARANCE_EM;
}

function parseSidenoteNumber(anchor: HTMLElement): number {
	const number = Number.parseInt(anchor.dataset.sidenoteNumber ?? '', 10);
	return Number.isFinite(number) ? number : Number.MAX_SAFE_INTEGER;
}
import { setCssProps } from './dom-utils';
