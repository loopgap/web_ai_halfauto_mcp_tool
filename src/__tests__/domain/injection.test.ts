// ═══════════════════════════════════════════════════════════
// injection.ts 单元测试 — 注入块合并、冲突检测、prompt 构建
// ═══════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import {
  defaultInjectionPolicy,
  resolveInjectionBlocks,
  buildFinalPrompt,
  promptChecksum,
  type InjectionBlock,
  type InjectionPolicy,
} from "../../domain/injection";

function makeBlock(overrides: Partial<InjectionBlock> = {}): InjectionBlock {
  return {
    block_id: "test-block",
    source: "workflow",
    priority: 3,
    content: "Test instruction.",
    dismissible: true,
    ...overrides,
  };
}

describe("defaultInjectionPolicy", () => {
  it("返回启用状态的默认策略", () => {
    const policy = defaultInjectionPolicy();
    expect(policy.enabled).toBe(true);
    expect(policy.mode).toBe("balanced");
    expect(policy.safety_blocks.length).toBeGreaterThan(0);
    expect(policy.max_injection_length).toBeGreaterThan(0);
  });
});

describe("resolveInjectionBlocks", () => {
  it("策略禁用时返回空", () => {
    const policy: InjectionPolicy = { ...defaultInjectionPolicy(), enabled: false };
    const result = resolveInjectionBlocks(policy, [makeBlock()]);
    expect(result.applied).toEqual([]);
    expect(result.dropped).toEqual([]);
  });

  it("按优先级排序 (低数字=高优先级)", () => {
    const policy = defaultInjectionPolicy();
    const blocks = [
      makeBlock({ block_id: "b3", priority: 3 }),
      makeBlock({ block_id: "b1", priority: 1 }),
      makeBlock({ block_id: "b5", priority: 5 }),
    ];
    const result = resolveInjectionBlocks(policy, blocks);
    // safety_blocks (priority=1) + b1 (priority=1) + b3 (priority=3) + b5 (priority=5)
    const priorities = result.applied.map((b) => b.priority);
    for (let i = 0; i < priorities.length - 1; i++) {
      expect(priorities[i]).toBeLessThanOrEqual(priorities[i + 1]);
    }
  });

  it("相同 block_id 去重 (保留高优先级)", () => {
    const policy = defaultInjectionPolicy();
    const blocks = [
      makeBlock({ block_id: "dup", priority: 3, content: "first" }),
    ];
    const skillBlocks = [
      makeBlock({ block_id: "dup", priority: 5, content: "second" }),
    ];
    const result = resolveInjectionBlocks(policy, blocks, skillBlocks);
    const dupBlocks = result.applied.filter((b) => b.block_id === "dup");
    expect(dupBlocks).toHaveLength(1);
    expect(result.dropped.some((b) => b.block_id === "dup")).toBe(true);
  });

  it("互斥组只保留最高优先级", () => {
    const policy = defaultInjectionPolicy();
    const blocks = [
      makeBlock({ block_id: "a", priority: 2, mutex_group: "format" }),
      makeBlock({ block_id: "b", priority: 4, mutex_group: "format" }),
    ];
    const result = resolveInjectionBlocks(policy, blocks);
    const formatBlocks = result.applied.filter((b) => b.mutex_group === "format");
    expect(formatBlocks).toHaveLength(1);
    expect(formatBlocks[0].block_id).toBe("a");
    expect(result.conflicts.some((c) => c.includes("互斥冲突"))).toBe(true);
  });

  it("超过长度限制的块被截断丢弃", () => {
    const policy = { ...defaultInjectionPolicy(), max_injection_length: 50 };
    const blocks = [
      makeBlock({ block_id: "long", content: "a".repeat(100) }),
    ];
    const result = resolveInjectionBlocks(policy, blocks);
    // safety block fits, long block doesn't
    expect(result.dropped.some((b) => b.block_id === "long")).toBe(true);
    expect(result.conflicts.some((c) => c.includes("注入长度超限"))).toBe(true);
  });
});

describe("buildFinalPrompt", () => {
  it("无注入块时返回原始 prompt", () => {
    expect(buildFinalPrompt("Hello", [])).toBe("Hello");
  });

  it("注入块前置于 prompt", () => {
    const blocks = [
      makeBlock({ content: "Rule 1" }),
      makeBlock({ block_id: "b2", content: "Rule 2" }),
    ];
    const result = buildFinalPrompt("User prompt", blocks);
    expect(result).toContain("Rule 1");
    expect(result).toContain("Rule 2");
    expect(result).toContain("User prompt");
    // 注入内容在前
    expect(result.indexOf("Rule 1")).toBeLessThan(result.indexOf("User prompt"));
  });
});

describe("promptChecksum", () => {
  it("相同输入产生相同校验和", () => {
    const a = promptChecksum("hello world");
    const b = promptChecksum("hello world");
    expect(a).toBe(b);
  });

  it("不同输入产生不同校验和", () => {
    const a = promptChecksum("hello");
    const b = promptChecksum("world");
    expect(a).not.toBe(b);
  });

  it("返回 ck- 前缀", () => {
    expect(promptChecksum("test")).toMatch(/^ck-[0-9a-f]+$/);
  });
});
