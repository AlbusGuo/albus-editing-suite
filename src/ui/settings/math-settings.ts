import { SettingGroup, type SliderComponent } from 'obsidian';
import type EditingSuitePlugin from '../../main';
import {
	DISPLAY_MATH_MARGIN_MAX,
	DISPLAY_MATH_MARGIN_MIN,
	DISPLAY_MATH_MARGIN_STEP,
	OBSIDIAN_DEFAULT_DISPLAY_MATH_MARGIN,
} from '../../settings';

export function renderMathSettings(
	contentEl: HTMLElement,
	plugin: EditingSuitePlugin,
): void {
	const group = new SettingGroup(contentEl).setHeading('数学公式');

	group.addSetting((setting) => {
		setting
			.setName('超宽公式滚动')
			.setDesc('允许行间公式在宽度不足时横向滚动')
			.addToggle((toggle) => toggle
				.setValue(plugin.settings.mathOverflowScroll)
				.onChange((value) => {
					plugin.setMathOverflowScroll(value);
				}));
	});

	group.addSetting((setting) => {
		let sliderControl: SliderComponent | null = null;
		setting
			.setName('行间公式边距')
			.setDesc('调整行间公式的上下边距')
			.addExtraButton((button) => button
				.setIcon('reset')
				.setTooltip('恢复 Obsidian 默认边距')
				.onClick(() => {
					plugin.resetMathDisplayMargin();
					sliderControl?.setValue(
						OBSIDIAN_DEFAULT_DISPLAY_MATH_MARGIN,
					);
				}))
			.addSlider((slider) => {
				sliderControl = slider;
				slider
					.setLimits(
					DISPLAY_MATH_MARGIN_MIN,
					DISPLAY_MATH_MARGIN_MAX,
					DISPLAY_MATH_MARGIN_STEP,
					)
					.setValue(plugin.settings.mathDisplayMargin)
					.setDynamicTooltip()
					.onChange((value) => {
						plugin.setMathDisplayMargin(value);
					});
			});
	});
}
