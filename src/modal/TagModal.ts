import { Modal, App } from "obsidian";

export class TagModal extends Modal {
  private input!: HTMLInputElement;
  private onSubmit?: (inputs: string[]) => void;

  constructor(app: App, onSubmit?: (inputs: string[]) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", {
      text: "Directory (leave empty = current file)",
    });

    // 单一输入：目录路径或空（代表当前文件）
    this.input = contentEl.createEl("input", {
      attr: {
        type: "text",
        placeholder:
          "Enter directory path (e.g. Folder/Subfolder) or leave empty",
      },
    }) as HTMLInputElement;

    const submitButton = contentEl.createEl("button", { text: "Submit" });
    submitButton.onclick = () => {
      const val = this.input.value.trim();
      const res = val ? [val] : [];
      if (this.onSubmit) this.onSubmit(res);
      this.close();
    };
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
