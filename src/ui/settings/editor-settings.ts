import { SettingGroup, type SliderComponent } from 'obsidian';
import type EditingSuitePlugin from '../../main';
import {
	EDITOR_WIDTH_MAX,
	EDITOR_WIDTH_MIN,
	EDITOR_WIDTH_STEP,
	OBSIDIAN_DEFAULT_EDITOR_WIDTH,
} from '../../settings';

export function renderEditorSettings(
	contentEl: HTMLElement,
	plugin: EditingSuitePlugin,
): void {
	const group = new SettingGroup(contentEl);

	group.addSetting((setting) => {
		let sliderControl: SliderComponent | null = null;
		setting
			.setName('正文宽度')
			.setDesc('设置正文最大宽度, 按住 alt 并滚动可快速调整')
			.addExtraButton((button) => button
				.setIcon('reset')
				.setTooltip('恢复 Obsidian 默认宽度')
				.onClick(() => {
					plugin.resetEditorWidth();
					sliderControl?.setValue(OBSIDIAN_DEFAULT_EDITOR_WIDTH);
				}))
			.addSlider((slider) => {
				sliderControl = slider;
				slider
					.setLimits(
					EDITOR_WIDTH_MIN,
					EDITOR_WIDTH_MAX,
					EDITOR_WIDTH_STEP,
					)
					.setValue(plugin.settings.editorWidth)
					.setDynamicTooltip()
					.onChange((value) => {
						plugin.setEditorWidth(value);
					});
			});
	});

	group.addSetting((setting) => {
		setting
			.setName('折叠标题标记')
			.setDesc('编辑模式隐藏标题井号, 光标位于首个字符前时显示')
			.addToggle((toggle) => toggle
				.setValue(plugin.settings.collapseHeadingMarkers)
				.onChange((value) => {
					plugin.setCollapseHeadingMarkers(value);
				}));
	});

	group.addSetting((setting) => {
		setting
			.setName('折叠块 ID')
			.setDesc('隐藏段落末尾或紧贴块的 ^ID, 选择所属块时显示')
			.addToggle((toggle) => toggle
				.setValue(plugin.settings.collapseBlockIds)
				.onChange((value) => {
					plugin.setCollapseBlockIds(value);
				}));
	});

	group.addSetting((setting) => {
		setting
			.setName('编辑器焦点指示器')
			.setDesc(
				'突出当前行和嵌套列表层级, ' +
				'启用 Obsidian 行号时同步强调当前行号',
			)
			.addToggle((toggle) => toggle
				.setValue(plugin.settings.focusIndicator)
				.onChange((value) => {
					plugin.settings.focusIndicator = value;
					void plugin.saveSettings().then(() => {
						plugin.refreshFeatures();
					});
				}));
	});

	group.addSetting((setting) => {
		setting
			.setName('编辑与阅读模式对齐 (实验性)')
			.setDesc('统一实时预览与阅读模式的段落、标题和引用布局')
			.addToggle((toggle) => toggle
				.setValue(plugin.settings.seamlessTypography)
				.onChange((value) => {
					plugin.setSeamlessTypography(value);
				}));
	});
}
