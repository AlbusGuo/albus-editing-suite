import { MarkdownView, type Plugin } from 'obsidian';
import { getAppDocuments } from '../../utils/app-documents';
import type { FeatureController } from '../controller';
import {
	clearTaggedMathSpacing,
	markTaggedMathSpacing,
} from './tagged-spacing';

const ENABLED_BODY_CLASS = 'editing-suite-math-enabled';
const OVERFLOW_BODY_CLASS = 'editing-suite-math-overflow-enabled';
const DISPLAY_MARGIN_PROPERTY = '--editing-suite-display-math-margin';

export function registerMathAdjustments(
	plugin: Plugin,
	getDisplayMargin: () => number,
	getOverflowScroll: () => boolean,
): FeatureController {
	const applyState = (): void => {
		for (const document of getAppDocuments(plugin.app)) {
			document.body.classList.add(ENABLED_BODY_CLASS);
			document.body.classList.toggle(
				OVERFLOW_BODY_CLASS,
				getOverflowScroll(),
			);
			document.body.style.setProperty(
				DISPLAY_MARGIN_PROPERTY,
				`${getDisplayMargin()}em`,
			);
		}
	};

	plugin.registerEvent(plugin.app.workspace.on('window-open', () => {
		applyState();
	}));
	plugin.registerMarkdownPostProcessor(async (element, context) => {
		const info = context.getSectionInfo(element);
		if (!info?.text.includes('\\tag')) {
			return;
		}
		const openSource = getOpenMarkdownSource(plugin, context.sourcePath);
		if (openSource !== null) {
			markTaggedMathSpacing(element, info, openSource);
			return;
		}
		const file = plugin.app.vault.getFileByPath(context.sourcePath);
		if (!file) {
			return;
		}
		markTaggedMathSpacing(
			element,
			info,
			await plugin.app.vault.cachedRead(file),
		);
	});
	plugin.app.workspace.onLayoutReady(() => {
		applyState();
	});
	plugin.register(() => {
		for (const document of getAppDocuments(plugin.app)) {
			clearTaggedMathSpacing(document);
			document.body.classList.remove(
				ENABLED_BODY_CLASS,
				OVERFLOW_BODY_CLASS,
			);
			document.body.style.removeProperty(DISPLAY_MARGIN_PROPERTY);
		}
	});
	applyState();

	return { refresh: applyState };
}

function getOpenMarkdownSource(
	plugin: Plugin,
	sourcePath: string,
): string | null {
	let source: string | null = null;
	plugin.app.workspace.iterateAllLeaves((leaf) => {
		if (
			source === null &&
			leaf.view instanceof MarkdownView &&
			leaf.view.file?.path === sourcePath
		) {
			source = leaf.view.getViewData();
		}
	});
	return source;
}
