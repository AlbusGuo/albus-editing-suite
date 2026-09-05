import { SettingGroup } from 'obsidian';
import type EditingSuitePlugin from '../../main';

export function renderTableSettings(
	contentEl: HTMLElement,
	plugin: EditingSuitePlugin,
): void {
	const group = new SettingGroup(contentEl).setHeading('表格');

	group.addSetting((setting) => {
		setting
			.setName('表格全宽')
			.setDesc('让 Markdown 表格使用正文全部可用宽度')
			.addToggle((toggle) => toggle
				.setValue(plugin.settings.tableFullWidth)
				.onChange((value) => {
					plugin.setTableFullWidth(value);
				}));
	});

	group.addSetting((setting) => {
		setting
			.setName('表格居中')
			.setDesc('让非全宽表格在正文区域内水平居中')
			.addToggle((toggle) => toggle
				.setValue(plugin.settings.tableCentered)
				.onChange((value) => {
					plugin.setTableCentered(value);
				}));
	});

	group.addSetting((setting) => {
		setting
			.setName('表格样式')
			.setDesc('设置编辑模式与阅读模式中的表格外观')
			.addDropdown((dropdown) => dropdown
				.addOption('default', '默认')
				.addOption('rounded-grid', '圆角网格')
				.addOption('three-line', '三线表')
				.setValue(plugin.settings.tableStyle)
				.onChange((value) => {
					plugin.setTableStyle(
						value === 'rounded-grid' || value === 'three-line'
							? value
							: 'default',
					);
				}));
	});
}
