import { SettingGroup } from 'obsidian';
import type EditingSuitePlugin from '../../main';

export function renderCodeSettings(
	contentEl: HTMLElement,
	plugin: EditingSuitePlugin,
): void {
	const group = new SettingGroup(contentEl).setHeading('代码');

	group.addSetting((setting) => {
		setting
			.setName('行内代码优化')
			.setDesc('优化行内代码样式, 点击行内代码可复制内容')
			.addToggle((toggle) => toggle
				.setValue(plugin.settings.features.inlineCode)
				.onChange((value) => {
					plugin.setInlineCodeEnabled(value);
				}));
	});

	group.addSetting((setting) => {
		setting
			.setName('代码块优化')
			.setDesc('启用代码块标题栏、语言信息和实时行号')
			.addToggle((toggle) => toggle
				.setValue(plugin.settings.features.codeBlocks)
				.onChange((value) => {
					plugin.settings.features.codeBlocks = value;
					void plugin.saveSettings().then(() => {
						plugin.refreshFeatures();
					});
				}));
	});
}
