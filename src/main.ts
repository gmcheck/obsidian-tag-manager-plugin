import { Plugin } from "obsidian";
import { addTagCommand } from "./commands/addTag";
import { removeTagCommand } from "./commands/removeTag";
import { TagModal } from "./modal/TagModal";
import { TagSettings } from "./types";

export default class TagManagerPlugin extends Plugin {
  private settings: TagSettings = {} as TagSettings;

  async onload() {
    this.settings = await this.loadSettings();

    this.addCommand({
      id: "add-tag",
      name: "Add Tag",
      callback: () => {
        const modal = new TagModal(this.app, async (inputs) => {
          // TagModal 返回 string[]（逗号分隔的输入），我们把第一个作为目录（可为空）
          const directory =
            Array.isArray(inputs) && inputs.length > 0 ? inputs[0].trim() : "";
          try {
            await addTagCommand(this.app, directory || undefined);
          } catch (e) {
            // 忽略或记录错误
          }
        });
        modal.open();
      },
    });

    this.addCommand({
      id: "remove-tag",
      name: "Remove Tag",
      callback: () => {
        const modal = new TagModal(this.app, async (inputs) => {
          const directory =
            Array.isArray(inputs) && inputs.length > 0 ? inputs[0].trim() : "";
          if (directory === "") {
            // 若为空则对当前文件操作（无需提前返回）
          }
          try {
            await removeTagCommand(this.app, directory || undefined);
          } catch (e) {
            // 忽略或记录错误
          }
        });
        modal.open();
      },
    });
  }

  async loadSettings(): Promise<TagSettings> {
    const data = (await this.loadData()) as Partial<TagSettings> | undefined;
    return { ...(this.settings || {}), ...(data || {}) } as TagSettings;
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  onunload() {
    // Cleanup if necessary
  }
}
