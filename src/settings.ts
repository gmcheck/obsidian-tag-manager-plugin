import { PluginSettingTab, App, Setting } from 'obsidian';

export interface TagSettings {
    defaultTag: string;
    enableAutoTagging: boolean;
}

export const DEFAULT_SETTINGS: TagSettings = {
    defaultTag: '',
    enableAutoTagging: false,
};

export class TagSettingTab extends PluginSettingTab {
    private plugin: any;

    constructor(app: App, plugin: any) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();
        containerEl.createEl('h2', { text: 'Tag Manager Settings' });

        new Setting(containerEl)
            .setName('Default Tag')
            .setDesc('The default tag to apply when adding tags.')
            .addText(text => text
                .setPlaceholder('Enter default tag')
                .setValue(this.plugin.settings.defaultTag)
                .onChange(async (value) => {
                    this.plugin.settings.defaultTag = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Enable Auto Tagging')
            .setDesc('Automatically apply tags based on directory structure.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableAutoTagging)
                .onChange(async (value) => {
                    this.plugin.settings.enableAutoTagging = value;
                    await this.plugin.saveSettings();
                }));
    }
}