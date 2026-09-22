import { SettingGroup } from 'obsidian';
import type EditingSuitePlugin from '../../main';
import type {
	ListMarkerColor,
	SidenotePosition,
} from '../../settings';

export function renderFeatureSettings(
	contentEl: HTMLElement,
	plugin: EditingSuitePlugin,
): void {
	const syntaxGroup = new SettingGroup(contentEl);

		syntaxGroup.addSetting((setting) => {
		setting
			.setName('彩色文本')
			.setDesc('启用 **圆形 emoji 文本** 彩色文本、色块交互和对应命令')
			.addToggle((toggle) => toggle
				.setValue(plugin.settings.features.coloredText)
				.onChange((value) => {
					plugin.settings.features.coloredText = value;
					void plugin.saveSettings().then(() => {
						plugin.refreshFeatures();
					});
				}));
	});

	syntaxGroup.addSetting((setting) => {
		setting
			.setName('保留粗体')
			.setDesc('彩色文本继续使用粗体字重')
			.addToggle((toggle) => toggle
				.setValue(plugin.settings.coloredTextBold)
				.onChange((value) => {
					plugin.settings.coloredTextBold = value;
					void plugin.saveSettings().then(() => {
						plugin.refreshFeatures();
					});
				}));
	});

	syntaxGroup.addSetting((setting) => {
		setting
			.setName('彩色高亮')
			.setDesc('启用圆形 emoji 彩色高亮、官方色块交互和对应命令')
			.addToggle((toggle) => toggle
				.setValue(plugin.settings.features.colorHighlights)
				.onChange((value) => {
					plugin.settings.features.colorHighlights = value;
					void plugin.saveSettings().then(() => {
						plugin.refreshFeatures();
					});
				}));
	});

	syntaxGroup.addSetting((setting) => {
		setting
			.setName('显示高亮波浪线')
			.setDesc('在彩色高亮下方显示波浪线')
			.addToggle((toggle) => toggle
				.setValue(plugin.settings.colorHighlightWave)
				.onChange((value) => {
					plugin.settings.colorHighlightWave = value;
					void plugin.saveSettings().then(() => {
						plugin.refreshFeatures();
					});
				}));
	});

	syntaxGroup.addSetting((setting) => {
		setting
			.setName('挖空')
			.setDesc('启用 ==⚫文本== 挖空语法和对应命令')
			.addToggle((toggle) => toggle
				.setValue(plugin.settings.features.cloze)
				.onChange((value) => {
					plugin.settings.features.cloze = value;
					void plugin.saveSettings().then(() => {
						plugin.refreshFeatures();
					});
				}));
	});

	syntaxGroup.addSetting((setting) => {
		setting
			.setName('负标题')
			.setDesc('启用 -# 负标题语法')
			.addToggle((toggle) => toggle
				.setValue(plugin.settings.features.negativeHeadings)
				.onChange((value) => {
					plugin.settings.features.negativeHeadings = value;
					void plugin.saveSettings().then(() => {
						plugin.refreshFeatures();
					});
				}));
	});

	const sidenoteGroup = new SettingGroup(contentEl).setHeading('侧边标注');

	sidenoteGroup.addSetting((setting) => {
		setting
			.setName('启用侧边标注')
			.setDesc('启用 {{📝内容}} 侧边标注语法')
			.addToggle((toggle) => toggle
				.setValue(plugin.settings.features.sidenotes)
				.onChange((value) => {
					plugin.settings.features.sidenotes = value;
					void plugin.saveSettings().then(() => {
						plugin.refreshFeatures();
					});
				}));
	});

	sidenoteGroup.addSetting((setting) => {
		setting
			.setName('边注位置')
			.setDesc('选择 sidenote 显示在正文左侧还是右侧')
			.addDropdown((dropdown) => dropdown
				.addOption('left', '左侧')
				.addOption('right', '右侧')
				.setValue(plugin.settings.sidenotePosition)
				.onChange((value) => {
					plugin.settings.sidenotePosition =
						value as SidenotePosition;
					void plugin.saveSettings().then(() => {
						plugin.refreshFeatures();
					});
				}));
	});

	const listGroup = new SettingGroup(contentEl).setHeading('自定义列表');

	listGroup.addSetting((setting) => {
		setting
			.setName('启用自定义列表')
			.setDesc('启用 {a)}、{I.}、{第 3 条} 等有序列表标记')
			.addToggle((toggle) => toggle
				.setValue(plugin.settings.features.customLists)
				.onChange((value) => {
					plugin.settings.features.customLists = value;
					void plugin.saveSettings().then(() => {
						plugin.refreshFeatures();
					});
				}));
	});

	listGroup.addSetting((setting) => {
		setting
			.setName('列表标记颜色')
			.setDesc('设置全部有序和无序列表标记的颜色')
			.addDropdown((dropdown) => dropdown
				.addOption('default', '默认')
				.addOption('text', '正文')
				.setValue(plugin.settings.listMarkerColor)
				.onChange((value) => {
					plugin.settings.listMarkerColor = value as ListMarkerColor;
					void plugin.saveSettings().then(() => {
						plugin.refreshFeatures();
					});
				}));
	});
}
