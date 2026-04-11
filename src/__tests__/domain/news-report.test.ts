import { describe, expect, it } from "vitest";
import {
  createReportDocument,
  dedupeNewsItems,
  generateNewsMarkdownReport,
  normalizeNewsItem,
} from "../../domain/news-report";

describe("normalizeNewsItem", () => {
  it("fills id and fetched_at when absent", () => {
    const item = normalizeNewsItem({
      source_id: "src-a",
      source_name: "Source A",
      title: " Hello ",
      content: " Content ",
      published_at: 100,
    });

    expect(item.id.startsWith("n_")).toBe(true);
    expect(item.fetched_at).toBeGreaterThan(0);
    expect(item.title).toBe("Hello");
    expect(item.content).toBe("Content");
  });
});

describe("dedupeNewsItems", () => {
  it("deduplicates by url and keeps latest", () => {
    const out = dedupeNewsItems([
      {
        id: "1",
        source_id: "src-a",
        source_name: "A",
        title: "T",
        content: "C1",
        url: "https://x.dev/1",
        published_at: 10,
        fetched_at: 1,
      },
      {
        id: "2",
        source_id: "src-a",
        source_name: "A",
        title: "T",
        content: "C2",
        url: "https://x.dev/1",
        published_at: 20,
        fetched_at: 2,
      },
    ]);

    expect(out).toHaveLength(1);
    expect(out[0].content).toBe("C2");
  });
});

describe("generateNewsMarkdownReport", () => {
  it("renders markdown sections", () => {
    const md = generateNewsMarkdownReport("Daily Brief", [
      {
        id: "1",
        source_id: "rss-1",
        source_name: "Tech Feed",
        title: "New Release",
        content: "Long text",
        url: "https://example.com/news",
        published_at: Date.UTC(2026, 3, 11, 8, 0, 0, 0),
        fetched_at: Date.UTC(2026, 3, 11, 8, 1, 0, 0),
        summary: "Summary line",
        keywords: ["release", "ai"],
      },
    ]);

    expect(md).toContain("# Daily Brief");
    expect(md).toContain("## New Release");
    expect(md).toContain("Summary line");
  });
});

describe("createReportDocument", () => {
  it("creates markdown report document", () => {
    const report = createReportDocument(
      "Daily",
      [
        {
          id: "n-1",
          source_id: "rss-1",
          source_name: "Feed",
          title: "Headline",
          content: "Body",
          published_at: 10,
          fetched_at: 12,
        },
      ],
      ["rss-1"],
    );

    expect(report.id.startsWith("r_")).toBe(true);
    expect(report.format).toBe("markdown");
    expect(report.item_ids).toEqual(["n-1"]);
    expect(report.content).toContain("Headline");
  });
});
