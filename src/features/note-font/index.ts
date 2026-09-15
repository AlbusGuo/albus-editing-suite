import { MarkdownView, type Plugin } from 'obsidian';
import type { FeatureController } from '../controller';
import { formatCssFontFamily } from './font';
import { registerFontPropertySuggestions } from './property-suggest';

const ROOT_CLASS = 'editing-suite-note-font-enabled';
const FONT_PROPERTY = '--editing-suite-note-font-family';
const OVERRIDDEN_PROPERTIES = [
	FONT_PROPERTY,
	'--font-interface',
	'--font-monospace',
	'--font-text',
	'font-family',
] as const;

interface StyleValue {
	priority: string;
	value: string;
}

interface RootStyleSnapshot {
	baseFontFamily: string;
	baseInterfaceFont: string;
	baseMonospaceFont: string;
	baseTextFont: string;
	inlineValues: Map<string, StyleValue>;
}

export function registerNoteFonts(plugin: Plugin): FeatureController {
	const snapshots = new Map<HTMLElement, RootStyleSnapshot>();
	let refreshQueued = false;
	const cleanupPropertySuggestions = registerFontPropertySuggestions(plugin);

	const restoreRoot = (root: HTMLElement): void => {
		const snapshot = snapshots.get(root);
		if (!snapshot) {
			return;
		}
		for (const property of OVERRIDDEN_PROPERTIES) {
			const original = snapshot.inlineValues.get(property);
			if (original?.value) {
				root.style.setProperty(
					property,
					original.value,
					original.priority,
				);
			} else {
				root.style.removeProperty(property);
			}
		}
		root.classList.remove(ROOT_CLASS);
		snapshots.delete(root);
	};

	const applyRoot = (root: HTMLElement, rawFontFamily: string): void => {
		const fontFamily = formatCssFontFamily(rawFontFamily);
		if (!fontFamily) {
			restoreRoot(root);
			return;
		}
		let snapshot = snapshots.get(root);
		if (!snapshot) {
			const style = root.ownerDocument.defaultView?.getComputedStyle(root);
			const fallback = style?.fontFamily || 'sans-serif';
			snapshot = {
				baseFontFamily: fallback,
				baseInterfaceFont:
					style?.getPropertyValue('--font-interface').trim() || fallback,
				baseMonospaceFont:
					style?.getPropertyValue('--font-monospace').trim() || fallback,
				baseTextFont:
					style?.getPropertyValue('--font-text').trim() || fallback,
				inlineValues: new Map(OVERRIDDEN_PROPERTIES.map((property) => [
					property,
					{
						priority: root.style.getPropertyPriority(property),
						value: root.style.getPropertyValue(property),
					},
				])),
			};
			snapshots.set(root, snapshot);
		}
		root.classList.add(ROOT_CLASS);
		root.style.setProperty(FONT_PROPERTY, fontFamily);
		root.style.setProperty(
			'--font-interface',
			`${fontFamily}, ${snapshot.baseInterfaceFont}`,
		);
		root.style.setProperty(
			'--font-monospace',
			`${fontFamily}, ${snapshot.baseMonospaceFont}`,
		);
		root.style.setProperty(
			'--font-text',
			`${fontFamily}, ${snapshot.baseTextFont}`,
		);
		root.style.setProperty(
			'font-family',
			`${fontFamily}, ${snapshot.baseFontFamily}`,
		);
	};

	const refresh = (): void => {
		refreshQueued = false;
		const liveRoots = new Set<HTMLElement>();
		plugin.app.workspace.iterateAllLeaves((leaf) => {
			if (!(leaf.view instanceof MarkdownView)) {
				return;
			}
			const fontFamily = getNoteFontFamily(
				plugin,
				leaf.view,
			);
			leaf.view.containerEl
				.querySelectorAll<HTMLElement>(
					'.markdown-source-view, .markdown-reading-view',
				)
				.forEach((root) => {
					liveRoots.add(root);
					if (fontFamily) {
						applyRoot(root, fontFamily);
					} else {
						restoreRoot(root);
					}
				});
		});
		for (const root of snapshots.keys()) {
			if (!liveRoots.has(root) || !root.isConnected) {
				restoreRoot(root);
			}
		}
	};

	const scheduleRefresh = (): void => {
		if (refreshQueued) {
			return;
		}
		refreshQueued = true;
		queueMicrotask(refresh);
	};

	plugin.registerEvent(plugin.app.metadataCache.on('changed', () => {
		scheduleRefresh();
	}));
	plugin.registerEvent(plugin.app.workspace.on('file-open', scheduleRefresh));
	plugin.registerEvent(plugin.app.workspace.on('active-leaf-change', scheduleRefresh));
	plugin.registerEvent(plugin.app.workspace.on('layout-change', scheduleRefresh));
	plugin.registerEvent(plugin.app.workspace.on('window-open', scheduleRefresh));
	plugin.registerEvent(plugin.app.workspace.on('css-change', () => {
		for (const root of Array.from(snapshots.keys())) {
			restoreRoot(root);
		}
		scheduleRefresh();
	}));
	plugin.app.workspace.onLayoutReady(scheduleRefresh);
	plugin.register(() => {
		cleanupPropertySuggestions();
		for (const root of Array.from(snapshots.keys())) {
			restoreRoot(root);
		}
	});
	scheduleRefresh();

	return { refresh: scheduleRefresh };
}

function getNoteFontFamily(
	plugin: Plugin,
	view: MarkdownView,
): string {
	const file = view.file;
	if (!file) {
		return '';
	}
	const frontmatter = plugin.app.metadataCache.getFileCache(file)
		?.frontmatter as unknown;
	if (!isRecord(frontmatter)) {
		return '';
	}
	for (const key of ['font', '字体'] as const) {
		const value = frontmatter[key];
		if (typeof value === 'string' && value.trim()) {
			return value.trim();
		}
	}
	return '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
