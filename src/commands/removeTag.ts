import { App, TFile, Notice } from "obsidian";
import { getTagsFromFile, saveTagsToFile, sanitizeTag } from "../utils/tags";

/**
 * removeTagCommand
 * - directory: optional. 如果提供，则对目录下所有 .md 文件删除对应目录标签；否则仅对当前活动文件删除。
 * 删除项：仅删除每个文件的“该文件所在目录名”这个 tag（若存在），保留其它 tags。
 */
export async function removeTagCommand(
  app: App,
  directory?: string | null
): Promise<void> {
  if (!app) return;

  let removed = 0;
  let skipped = 0;
  let errored = 0;

  async function removeTagFromFile(file: TFile) {
    try {
      const parts = file.path.split("/");
      const rawDirName = parts.length > 1 ? parts[parts.length - 2] : "";
      const dirName = sanitizeTag(rawDirName);
      if (!dirName) {
        skipped++;
        return;
      }

      const existing = (await getTagsFromFile(app, file)) || [];
      // 仅移除与规范化目录名相等的项，保留其它原始标签
      const updated = existing.filter(
        (t) => sanitizeTag(String(t)) !== dirName
      );

      // 如果没有变化则跳过
      if (updated.length === (existing || []).length) {
        skipped++;
        return;
      }

      await saveTagsToFile(app, file, updated);
      removed++;
    } catch {
      errored++;
    }
  }

  if (directory && directory.trim()) {
    let prefix = directory.trim();
    if (!prefix.endsWith("/")) prefix = prefix + "/";

    const files = app.vault
      .getFiles()
      .filter((f) => f.path.startsWith(prefix) && f.path.endsWith(".md"));
    for (const f of files) {
      if (!(f instanceof TFile)) continue;
      await removeTagFromFile(f);
    }
  } else {
    const active = app.workspace.getActiveFile();
    if (!active || !(active instanceof TFile)) {
      new Notice("No active file to remove tag");
      return;
    }
    if (!active.path.endsWith(".md")) {
      new Notice("Active file is not a markdown file");
      return;
    }
    await removeTagFromFile(active);
  }

  const parts: string[] = [];
  if (removed) parts.push(`Removed tag from ${removed} file(s)`);
  if (skipped)
    parts.push(
      `Skipped ${skipped} file(s) (no matching directory tag or no dir)`
    );
  if (errored) parts.push(`Failed on ${errored} file(s)`);
  const msg = parts.length ? parts.join("; ") : "No files changed";
  new Notice(msg);
}
