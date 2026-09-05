import type { Plugin } from 'obsidian';
import type { DividerStyle } from '../../settings';
import { getAppDocuments } from '../../utils/app-documents';
import type { FeatureController } from '../controller';

const DIAMOND_GRADIENT_BODY_CLASS =
	'editing-suite-divider-style-diamond-gradient';

export function registerDividerStyles(
	plugin: Plugin,
	getStyle: () => DividerStyle,
): FeatureController {
	const applyState = (): void => {
		const isDiamondGradient = getStyle() === 'diamond-gradient';
		for (const document of getAppDocuments(plugin.app)) {
			document.body.classList.toggle(
				DIAMOND_GRADIENT_BODY_CLASS,
				isDiamondGradient,
			);
		}
	};

	plugin.registerEvent(plugin.app.workspace.on('window-open', applyState));
	plugin.app.workspace.onLayoutReady(applyState);
	plugin.register(() => {
		for (const document of getAppDocuments(plugin.app)) {
			document.body.classList.remove(DIAMOND_GRADIENT_BODY_CLASS);
		}
	});
	applyState();

	return { refresh: applyState };
}
