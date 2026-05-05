import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import RunHistoryList from "../../components/RunHistoryList";
import type { RunRecord } from "../../types";

// Mock useVirtualScroll
vi.mock("../../hooks/useVirtualScroll", () => ({
  useVirtualScroll: vi.fn(() => ({
    visibleRange: { start: 0, end: 10 },
    totalHeight: 520,
    offsetTop: 0,
    containerRef: { current: null },
    onScroll: vi.fn(),
  })),
}));

const mockRuns: RunRecord[] = [
  {
    id: "run-1",
    ts_start: 1700000000000,
    skill_id: "translate.english",
    target_id: "chrome-main",
    provider: "chrome",
    prompt: "翻译这段话",
    status: "dispatched",
    trace_id: "trace-abc123",
  },
  {
    id: "run-2",
    ts_start: 1700000100000,
    skill_id: "analyze.tech",
    target_id: "firefox-main",
    provider: "firefox",
    prompt: "分析架构",
    status: "captured",
    trace_id: "trace-def456",
    error_code: undefined,
  },
  {
    id: "run-3",
    ts_start: 1700000200000,
    skill_id: "write.summary",
    target_id: "edge-main",
    provider: "edge",
    prompt: "写摘要",
    status: "failed",
    error_code: "TIMEOUT_EXCEEDED",
  },
];

describe("RunHistoryList 组件", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("基础渲染", () => {
    it("空数组时不渲染任何内容", () => {
      const { container } = render(<RunHistoryList runs={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it("有数据时渲染列表", () => {
      render(<RunHistoryList runs={mockRuns} />);
      expect(document.querySelector("h3")?.textContent).toBe("运行记录");
    });

    it("显示运行记录数量", () => {
      render(<RunHistoryList runs={mockRuns} />);
      // 组件显示 "显示  3  条记录 · 已启用虚拟滚动" (注意双空格)
      expect(document.body.textContent).toMatch(/显示\s+3\s+条记录/);
    });
  });

  describe("数据展示", () => {
    it("显示 skill_id", () => {
      render(<RunHistoryList runs={mockRuns} />);
      expect(document.body.textContent).toContain("translate.english");
    });

    it("显示状态指示器", () => {
      render(<RunHistoryList runs={mockRuns} />);
      const statusIndicators = document.querySelectorAll('[role="status"]');
      expect(statusIndicators.length).toBeGreaterThan(0);
    });
  });

  describe("错误状态", () => {
    it("显示错误代码", () => {
      render(<RunHistoryList runs={mockRuns} />);
      expect(document.body.textContent).toContain("TIMEOUT_EXCEEDED");
    });
  });

  describe("边界情况", () => {
    it("大量数据时正确处理", () => {
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        ...mockRuns[0],
        id: `run-${i}`,
        skill_id: `skill.${i}`,
        ts_start: 1700000000000 + i * 1000,
      }));

      render(<RunHistoryList runs={largeDataset} />);
      expect(document.body.textContent).toMatch(/显示\s+100\s+条记录/);
    });
  });
});
