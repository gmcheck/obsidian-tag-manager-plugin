import { App, TFile } from "obsidian";

/**
 * 提取 frontmatter 原始内容与正文
 */
function extractFrontMatter(content: string): {
  fmRaw: string | null;
  body: string;
} {
  const m = content.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { fmRaw: null, body: content };
  return { fmRaw: m[1], body: content.slice(m[0].length) };
}

/**
 * 从 raw frontmatter 文本解析 tags（支持 inline array、block list、single value）
 */
function parseTagsFromFrontMatterRaw(fmRaw: string | null): string[] {
  if (!fmRaw) return [];
  // inline array: tags: [a, b]
  const inline = fmRaw.match(/^\s*tags:\s*\[([^\]]*)\]/m);
  if (inline && inline[1]) {
    return inline[1]
      .split(",")
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
      .filter(Boolean);
  }
  // block list:
  const block = fmRaw.match(/^\s*tags:\s*\n((?:\s*-\s*.*\n?)*)/m);
  if (block && block[1]) {
    return block[1]
      .split("\n")
      .map((l) =>
        l
          .replace(/^\s*-\s*/, "")
          .trim()
          .replace(/^['"]|['"]$/g, "")
      )
      .filter(Boolean);
  }
  // single value: tags: value
  const single = fmRaw.match(/^\s*tags:\s*(.+)/m);
  if (single && single[1]) {
    return single[1]
      .trim()
      .replace(/^['"]|['"]$/g, "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * 序列化 tags 为 YAML 片段（返回可能多行，不含起止 ---）
 */
function serializeTagsToYaml(tags: string[]): string {
  if (!tags || tags.length === 0) return "";
  if (tags.length === 1) {
    const v = tags[0];
    const safe = /[\s:#[\]{}!,&*?|\-<>]/.test(v)
      ? `"${v.replace(/"/g, '\\"')}"`
      : v;
    return `tags: ${safe}\n`;
  }
  const lines: string[] = ["tags:"];
  for (const t of tags) {
    const safe = /[\s:#[\]{}!,&*?|\-<>]/.test(t)
      ? `"${t.replace(/"/g, '\\"')}"`
      : t;
    lines.push(`  - ${safe}`);
  }
  return lines.join("\n") + "\n";
}

/**
 * 读取文件并返回 tags 数组
 */
export async function getTagsFromFile(
  app: App,
  file: TFile
): Promise<string[]> {
  try {
    const content = await app.vault.read(file);
    const { fmRaw } = extractFrontMatter(content);
    return parseTagsFromFrontMatterRaw(fmRaw);
  } catch {
    return [];
  }
}

/**
 * 将 tags 写入文件 frontmatter（覆盖原有 tags）。
 * 如果 tags 为 [] -> 删除 tags 字段（如果没有其它 frontmatter 字段，则删除整个 frontmatter）。
 */
export async function saveTagsToFile(
  app: App,
  file: TFile,
  tags: string[]
): Promise<void> {
  await updateNoteMetadata(app, file, { tags });
}

/**
 * 更稳健的 frontmatter 更新器：按行识别并移除原有 tags 节，保留其它字段，最后插入新的 tags（如果有）。
 */
export async function updateNoteMetadata(
  app: App,
  file: TFile,
  metadata: Record<string, any>
): Promise<void> {
  const content = await app.vault.read(file);
  const { fmRaw, body } = extractFrontMatter(content);

  const preservedLines: string[] = [];

  if (fmRaw) {
    const lines = fmRaw.split("\n");
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      // match a top-level key like "key:" or "key: value"
      const keyMatch = line.match(/^\s*([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
      if (keyMatch) {
        const key = keyMatch[1];
        const rest = keyMatch[2];

        if (key === "tags") {
          // skip tags entry:
          // - inline array: tags: [a, b] -> already consumed by this line
          if (rest && rest.trim().startsWith("[")) {
            i++; // skip single line
            continue;
          }
          // - block list: tags: (no inline value) -> skip following "- " lines
          if (rest === "" || rest === undefined) {
            i++; // skip the "tags:" line itself
            // skip subsequent list items that start with '-' optionally indented
            while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
              i++;
            }
            continue;
          }
          // - single value: tags: value -> skip this single line
          i++;
          continue;
        } else {
          // not tags -> preserve this line and advance
          preservedLines.push(line);
          i++;
          continue;
        }
      } else {
        // line does not look like "key: ..." (could be continuation), preserve
        preservedLines.push(line);
        i++;
      }
    }
  }

  // 插入 metadata.tags（如果提供）
  if (metadata.hasOwnProperty("tags")) {
    const tags = Array.isArray(metadata.tags)
      ? metadata.tags
      : metadata.tags
      ? [String(metadata.tags)]
      : [];
    if (tags.length > 0) {
      const tagsYaml = serializeTagsToYaml(tags).trimEnd();
      preservedLines.push(...tagsYaml.split("\n"));
    } else {
      // tags为空数组 -> 不加入 tags（即删除）
    }
  }

  // 构建新的内容
  let newContent: string;
  // 如果 preservedLines 中没有任何内容则删除整个 frontmatter
  const trimmedPreserved = preservedLines
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (trimmedPreserved.length > 0) {
    // 保持原有行顺序（已移除 tags 部分），并确保格式正确
    const fmText = preservedLines
      .join("\n")
      .replace(/\n{3,}/g, "\n")
      .trim();
    newContent = `---\n${fmText}\n---\n${body}`;
  } else {
    newContent = body;
  }

  await app.vault.modify(file, newContent);
}

/**
 * 将目录名规范化为 Obsidian 标签的安全形式：
 * - 反斜杠转为正斜杠（支持嵌套标签）
 * - 空白转为短横线
 * - 删除不安全字符（保留字母、数字、_ - /）
 * - 合并连续分隔符，去除首尾斜杠
 * - 转为小写
 * 返回 null 表示无法生成合法标签（应跳过）
 */
export function sanitizeTag(tag: string): string | null {
  if (!tag) return null;
  let t = String(tag).trim();
  // turn backslashes into slashes
  t = t.replace(/\\/g, "/");
  // replace whitespace with hyphen
  t = t.replace(/\s+/g, "-");
  // remove characters except alnum, -, _, /
  t = t.replace(/[^A-Za-z0-9\-_/]/g, "");
  // collapse multiple slashes
  t = t.replace(/\/+/g, "/");
  // remove leading/trailing slashes or hyphens
  t = t.replace(/^[-\/]+|[-\/]+$/g, "");
  t = t.toLowerCase();
  if (!t) return null;
  return t;
}
