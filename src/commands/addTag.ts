import { App, TFile, Notice } from "obsidian";
import { getTagsFromFile, saveTagsToFile, sanitizeTag } from "../utils/tags";

/**
 * addTagCommand
 * - directory: optional. 如果提供，则对目录下所有 .md 文件添加标签；否则仅对当前活动文件添加。
 * 标签值：每个文件添加该文件所在目录的名字（上一级目录名），若文件位于 vault 根则跳过。
 * 行为：保留并合并已有 tags，去重后写回 frontmatter。若目录标签已存在则跳过该文件并统计。
 */
export async function addTagCommand(
  app: App,
  directory?: string | null
): Promise<void> {
  if (!app) return;

  let added = 0;
  let skipped = 0;
  let errored = 0;

  // helper: 给单个文件添加目录标签（上一级目录名）
  async function addTagToFile(file: TFile) {
    try {
      const parts = file.path.split("/");
      const rawDirName = parts.length > 1 ? parts[parts.length - 2] : "";
      const dirName = sanitizeTag(rawDirName);
      if (!dirName) {
        skipped++;
        return;
      }

      const existing = (await getTagsFromFile(app, file)) || [];
      // 判断是否已存在相同规范化值
      const exists = existing.some((t) => sanitizeTag(String(t)) === dirName);
      if (exists) {
        skipped++;
        return;
      }

      const set = new Set(existing.map((t) => String(t)));
      set.add(dirName);
      const final = Array.from(set);
      await saveTagsToFile(app, file, final);
      added++;
    } catch {
      errored++;
    }
  }

  if (directory && directory.trim()) {
    // normalize prefix
    let prefix = directory.trim();
    if (!prefix.endsWith("/")) prefix = prefix + "/";

    const files = app.vault
      .getFiles()
      .filter((f) => f.path.startsWith(prefix) && f.path.endsWith(".md"));
    for (const f of files) {
      if (!(f instanceof TFile)) continue;
      // 对目录下每个 markdown 文件执行
      await addTagToFile(f);
    }
  } else {
    // only current file
    const active = app.workspace.getActiveFile();
    if (!active || !(active instanceof TFile)) {
      new Notice("No active file to add tag");
      return;
    }
    if (!active.path.endsWith(".md")) {
      new Notice("Active file is not a markdown file");
      return;
    }
    await addTagToFile(active);
  }

  // 汇总提示
  const parts: string[] = [];
  if (added) parts.push(`Added tag to ${added} file(s)`);
  if (skipped)
    parts.push(`Skipped ${skipped} file(s) (already had tag or no dir)`);
  if (errored) parts.push(`Failed on ${errored} file(s)`);
  const msg = parts.length ? parts.join("; ") : "No files changed";
  new Notice(msg);
}
