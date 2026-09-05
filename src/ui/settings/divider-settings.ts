import { SettingGroup } from 'obsidian';
import type EditingSuitePlugin from '../../main';

export function renderDividerSettings(
	contentEl: HTMLElement,
	plugin: EditingSuitePlugin,
): void {
	const group = new SettingGroup(contentEl).setHeading('分隔线');

	group.addSetting((setting) => {
		setting
			.setName('分隔线样式')
			.setDesc('设置编辑模式与阅读模式中的分隔线外观')
			.addDropdown((dropdown) => dropdown
				.addOption('default', '默认')
				.addOption('diamond-gradient', '菱光渐变')
				.setValue(plugin.settings.dividerStyle)
				.onChange((value) => {
					plugin.setDividerStyle(
						value === 'diamond-gradient'
							? 'diamond-gradient'
							: 'default',
					);
				}));
	});
}
