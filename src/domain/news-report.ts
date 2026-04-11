import type { NewsItem, ReportDocument } from "../types";

function stableId(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return `n_${Math.abs(h)}`;
}

export function normalizeNewsItem(input: Omit<NewsItem, "id" | "fetched_at"> & Partial<Pick<NewsItem, "id" | "fetched_at">>): NewsItem {
  const title = input.title.trim();
  const content = input.content.trim();
  const source = input.source_id.trim();
  const publishedAt = Number.isFinite(input.published_at) ? input.published_at : Date.now();
  const idSeed = `${source}|${input.url ?? ""}|${title}`;
  return {
    ...input,
    id: input.id && input.id.trim().length > 0 ? input.id : stableId(idSeed),
    source_id: source,
    title,
    content,
    published_at: publishedAt,
    fetched_at: input.fetched_at ?? Date.now(),
  };
}

export function dedupeNewsItems(items: NewsItem[]): NewsItem[] {
  const byKey = new Map<string, NewsItem>();

  for (const item of items) {
    const key = item.url?.trim() || `${item.source_id}|${item.title.toLowerCase()}`;
    const prev = byKey.get(key);
    if (!prev || item.published_at > prev.published_at) {
      byKey.set(key, item);
    }
  }

  return Array.from(byKey.values()).sort((a, b) => b.published_at - a.published_at);
}

export function generateNewsMarkdownReport(title: string, items: NewsItem[]): string {
  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`> Generated at: ${new Date().toISOString()}`);
  lines.push(`> Total items: ${items.length}`);
  lines.push("");
  lines.push("## Overview");
  lines.push("");
  lines.push("| Time (UTC) | Source | Title | URL |");
  lines.push("|---|---|---|---|");

  for (const item of items) {
    const t = new Date(item.published_at).toISOString();
    const link = item.url ? `[link](${item.url})` : "-";
    lines.push(`| ${t} | ${item.source_name} | ${item.title.replace(/\|/g, "\\|")} | ${link} |`);
  }

  for (const item of items) {
    lines.push("");
    lines.push(`## ${item.title}`);
    lines.push("");
    lines.push(`- Source: ${item.source_name}`);
    lines.push(`- Published: ${new Date(item.published_at).toISOString()}`);
    if (item.url) lines.push(`- URL: ${item.url}`);
    if (item.keywords && item.keywords.length > 0) {
      lines.push(`- Keywords: ${item.keywords.join(", ")}`);
    }
    lines.push("");
    if (item.summary) {
      lines.push("### Summary");
      lines.push("");
      lines.push(item.summary);
      lines.push("");
    }
    lines.push("### Content");
    lines.push("");
    lines.push(item.content);
  }

  lines.push("");
  return lines.join("\n");
}

export function createReportDocument(
  title: string,
  items: NewsItem[],
  sourceIds: string[],
): ReportDocument {
  const content = generateNewsMarkdownReport(title, items);
  const idSeed = `${title}|${sourceIds.join(",")}|${items.length}`;
  const rid = stableId(idSeed).replace(/^n_/, "r_");
  return {
    id: rid,
    title,
    generated_at: Date.now(),
    format: "markdown",
    content,
    source_ids: [...sourceIds],
    item_ids: items.map((x) => x.id),
  };
}
