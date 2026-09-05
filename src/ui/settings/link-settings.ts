import { SettingGroup } from 'obsidian';
import type EditingSuitePlugin from '../../main';

export function renderLinkSettings(
	contentEl: HTMLElement,
	plugin: EditingSuitePlugin,
): void {
	const group = new SettingGroup(contentEl).setHeading('链接');

	group.addSetting((setting) => {
		setting
			.setName('链接样式')
			.setDesc('设置编辑模式与阅读模式中的链接外观')
			.addDropdown((dropdown) => dropdown
				.addOption('default', '默认')
				.addOption('red-outline', '红色线框')
				.setValue(plugin.settings.linkStyle)
				.onChange((value) => {
					plugin.setLinkStyle(
						value === 'red-outline'
							? 'red-outline'
							: 'default',
					);
				}));
	});
}
