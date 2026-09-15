import { Plugin } from 'obsidian';
import { registerEditorBasics } from './features/editor-basics';
import { registerCloze } from './features/cloze';
import { registerCodeBlocks } from './features/code-blocks';
import { registerColorHighlights } from './features/color-highlights';
import { registerColoredText } from './features/colored-text';
import type { FeatureController } from './features/controller';
import { registerCustomLists } from './features/custom-lists';
import { registerDividerStyles } from './features/dividers';
import { registerFocusIndicator } from './features/focus-indicator';
import { registerInlineCode } from './features/inline-code';
import { registerLinkStyles } from './features/links';
import { registerMathAdjustments } from './features/math';
import { registerNegativeHeadings } from './features/negative-headings';
import { registerNoteFonts } from './features/note-font';
import { registerSidenotes } from './features/sidenotes';
import { registerTableAdjustments } from './features/tables';
import {
	type DividerStyle,
	type EditingSuiteSettings,
	type LinkStyle,
	OBSIDIAN_DEFAULT_EDITOR_WIDTH,
	OBSIDIAN_DEFAULT_DISPLAY_MATH_MARGIN,
	type TableStyle,
	normalizeDisplayMathMargin,
	normalizeEditorWidth,
	normalizeSettings,
} from './settings';
import { EditingSuiteSettingTab } from './ui/settings/settings-tab';

export default class EditingSuitePlugin extends Plugin {
	settings!: EditingSuiteSettings;
	private dividerStyleController!: FeatureController;
	private editorBasicsController!: FeatureController;
	private featureControllers: FeatureController[] = [];
	private inlineCodeController!: FeatureController;
	private linkStyleController!: FeatureController;
	private mathController!: FeatureController;
	private settingsSaveTimer: number | null = null;
	private tableController!: FeatureController;

	async onload(): Promise<void> {
		this.settings = normalizeSettings(await this.loadData());

		this.editorBasicsController = registerEditorBasics(
			this,
			() => this.settings.editorWidthUsesDefault
				? null
				: this.settings.editorWidth,
			() => this.settings.seamlessTypography,
			(width) => this.setEditorWidth(width),
			() => this.settings.features.customLists,
			() => this.settings.collapseHeadingMarkers,
			() => this.settings.collapseBlockIds,
		);
		this.mathController = registerMathAdjustments(
			this,
			() => this.settings.mathDisplayMarginUsesDefault
				? null
				: this.settings.mathDisplayMargin,
			() => this.settings.mathOverflowScroll,
		);
		this.tableController = registerTableAdjustments(
			this,
			() => this.settings.tableFullWidth,
			() => this.settings.tableCentered,
			() => this.settings.tableStyle,
		);
		this.linkStyleController = registerLinkStyles(
			this,
			() => this.settings.linkStyle,
		);
		this.dividerStyleController = registerDividerStyles(
			this,
			() => this.settings.dividerStyle,
		);
		this.inlineCodeController = registerInlineCode(
			this,
			() => this.settings.features.inlineCode,
		);
		this.featureControllers = [
			this.editorBasicsController,
			registerNoteFonts(this),
			registerFocusIndicator(
				this,
				() => this.settings.focusIndicator,
			),
			registerCloze(
				this,
				() => this.settings.features.cloze,
			),
			registerColorHighlights(
				this,
				() => this.settings.features.colorHighlights,
				() => this.settings.colorHighlightWave,
			),
			registerColoredText(
				this,
				() => this.settings.features.coloredText,
				() => this.settings.coloredTextBold,
			),
			registerCustomLists(
				this,
				() => this.settings.features.customLists,
				() => this.settings.listMarkerColor,
			),
			registerNegativeHeadings(
				this,
				() => this.settings.features.negativeHeadings,
			),
			registerSidenotes(
				this,
				() => this.settings.features.sidenotes,
				() => this.settings.sidenotePosition,
			),
			this.mathController,
			this.tableController,
			this.linkStyleController,
			this.dividerStyleController,
			this.inlineCodeController,
			registerCodeBlocks(
				this,
				() => this.settings.features.codeBlocks,
			),
		];
		this.addSettingTab(new EditingSuiteSettingTab(this.app, this));
		this.register(() => {
			if (this.settingsSaveTimer !== null) {
				window.clearTimeout(this.settingsSaveTimer);
				this.settingsSaveTimer = null;
				void this.saveSettings();
			}
		});
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	setEditorWidth(value: number): void {
		const width = normalizeEditorWidth(value);
		if (
			width === this.settings.editorWidth &&
			!this.settings.editorWidthUsesDefault
		) {
			return;
		}
		this.settings.editorWidth = width;
		this.settings.editorWidthUsesDefault = false;
		this.editorBasicsController.refresh();
		this.scheduleSettingsSave();
	}

	resetEditorWidth(): void {
		this.settings.editorWidth = OBSIDIAN_DEFAULT_EDITOR_WIDTH;
		this.settings.editorWidthUsesDefault = true;
		this.editorBasicsController.refresh();
		this.scheduleSettingsSave();
	}

	setDividerStyle(value: DividerStyle): void {
		if (value === this.settings.dividerStyle) {
			return;
		}
		this.settings.dividerStyle = value;
		this.dividerStyleController.refresh();
		this.scheduleSettingsSave();
	}

	setCollapseHeadingMarkers(value: boolean): void {
		if (value === this.settings.collapseHeadingMarkers) {
			return;
		}
		this.settings.collapseHeadingMarkers = value;
		this.app.workspace.updateOptions();
		this.scheduleSettingsSave();
	}

	setCollapseBlockIds(value: boolean): void {
		if (value === this.settings.collapseBlockIds) {
			return;
		}
		this.settings.collapseBlockIds = value;
		this.app.workspace.updateOptions();
		this.scheduleSettingsSave();
	}

	setMathDisplayMargin(value: number): void {
		const margin = normalizeDisplayMathMargin(value);
		if (
			margin === this.settings.mathDisplayMargin &&
			!this.settings.mathDisplayMarginUsesDefault
		) {
			return;
		}
		this.settings.mathDisplayMargin = margin;
		this.settings.mathDisplayMarginUsesDefault = false;
		this.mathController.refresh();
		this.scheduleSettingsSave();
	}

	resetMathDisplayMargin(): void {
		this.settings.mathDisplayMargin =
			OBSIDIAN_DEFAULT_DISPLAY_MATH_MARGIN;
		this.settings.mathDisplayMarginUsesDefault = true;
		this.mathController.refresh();
		this.scheduleSettingsSave();
	}

	setLinkStyle(value: LinkStyle): void {
		if (value === this.settings.linkStyle) {
			return;
		}
		this.settings.linkStyle = value;
		this.linkStyleController.refresh();
		this.scheduleSettingsSave();
	}
	setInlineCodeEnabled(value: boolean): void {
		if (value === this.settings.features.inlineCode) {
			return;
		}
		this.settings.features.inlineCode = value;
		this.inlineCodeController.refresh();
		this.scheduleSettingsSave();
	}

	setSeamlessTypography(value: boolean): void {
		if (value === this.settings.seamlessTypography) {
			return;
		}
		this.settings.seamlessTypography = value;
		this.app.workspace.updateOptions();
		this.editorBasicsController.refresh();
		this.scheduleSettingsSave();
	}

	setMathOverflowScroll(value: boolean): void {
		if (value === this.settings.mathOverflowScroll) {
			return;
		}
		this.settings.mathOverflowScroll = value;
		this.mathController.refresh();
		this.scheduleSettingsSave();
	}

	setTableFullWidth(value: boolean): void {
		if (value === this.settings.tableFullWidth) {
			return;
		}
		this.settings.tableFullWidth = value;
		this.tableController.refresh();
		this.scheduleSettingsSave();
	}

	setTableCentered(value: boolean): void {
		if (value === this.settings.tableCentered) {
			return;
		}
		this.settings.tableCentered = value;
		this.tableController.refresh();
		this.scheduleSettingsSave();
	}

	setTableStyle(value: TableStyle): void {
		if (value === this.settings.tableStyle) {
			return;
		}
		this.settings.tableStyle = value;
		this.tableController.refresh();
		this.scheduleSettingsSave();
	}

	refreshFeatures(): void {
		for (const controller of this.featureControllers) {
			controller.refresh();
		}
	}

	private scheduleSettingsSave(): void {
		if (this.settingsSaveTimer !== null) {
			window.clearTimeout(this.settingsSaveTimer);
		}
		this.settingsSaveTimer = window.setTimeout(() => {
			this.settingsSaveTimer = null;
			void this.saveSettings();
		}, 180);
	}
}
