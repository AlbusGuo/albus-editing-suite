import { App, PluginSettingTab } from 'obsidian';
import type EditingSuitePlugin from '../../main';
import type { SettingsTab } from '../../settings';
import { renderCodeSettings } from './code-settings';
import { renderDividerSettings } from './divider-settings';
import { renderEditorSettings } from './editor-settings';
import { renderFeatureSettings } from './feature-settings';
import { renderLinkSettings } from './link-settings';
import { renderMathSettings } from './math-settings';
import { renderTableSettings } from './table-settings';

export class EditingSuiteSettingTab extends PluginSettingTab {
	icon = 'pencil';
	contentEl!: HTMLElement;

	constructor(app: App, private readonly plugin: EditingSuitePlugin) {
		super(app, plugin);
	}

	display(): void {
		this.render();
	}

	update(): void {
		this.render();
	}

	private render(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass('editing-suite-settings-root');

		const tabs = containerEl.createDiv({
			cls: 'editing-suite-settings-tabs',
		});
		for (const tab of SETTINGS_TABS) {
			const tabElement = tabs.createDiv({
				cls: 'editing-suite-settings-tab',
			});
			if (this.plugin.settings.settingsTab === tab.id) {
				tabElement.classList.add('is-active');
			}
			tabElement.setText(tab.name);
			tabElement.addEventListener('click', () => {
				if (this.plugin.settings.settingsTab === tab.id) {
					return;
				}
				this.plugin.settings.settingsTab = tab.id;
				void this.plugin.saveSettings();
				this.update();
			});
		}

		const scrollElement = containerEl.createDiv({
			cls: 'editing-suite-settings-scroll',
		});
		this.contentEl = scrollElement.createDiv({
			cls: 'editing-suite-settings-content',
		});
		const activeTab = SETTINGS_TABS.find((tab) =>
			tab.id === this.plugin.settings.settingsTab,
		) ?? SETTINGS_TABS[0];
		if (!activeTab) {
			return;
		}
		activeTab.render(this.contentEl, this.plugin);
	}
}

interface SettingsTabDefinition {
	id: SettingsTab;
	name: string;
	render: (
		contentEl: HTMLElement,
		plugin: EditingSuitePlugin,
	) => void;
}

const SETTINGS_TABS: readonly SettingsTabDefinition[] = [
	{
		id: 'editor',
		name: '编辑器',
		render: (contentEl, plugin) => {
			renderEditorSettings(contentEl, plugin);
			renderTableSettings(contentEl, plugin);
			renderLinkSettings(contentEl, plugin);
			renderMathSettings(contentEl, plugin);
			renderCodeSettings(contentEl, plugin);
			renderDividerSettings(contentEl, plugin);
		},
	},
	{
		id: 'extensions',
		name: '拓展',
		render: renderFeatureSettings,
	},
];
