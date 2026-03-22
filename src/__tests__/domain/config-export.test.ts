// ═══════════════════════════════════════════════════════════
// config-export.ts 单元测试
// ═══════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import {
  exportConfigBundle,
  serializeBundle,
  validateConfigBundle,
} from "../../domain/config-export";

describe("exportConfigBundle", () => {
  it("生成正确结构", () => {
    const bundle = exportConfigBundle(null, [], [], null);
    expect(bundle.version).toBe("1.0.0");
    expect(bundle.exported_at).toBeDefined();
    expect(bundle.skills).toEqual([]);
    expect(bundle.workflows).toEqual([]);
    expect(bundle.targets).toBeNull();
    expect(bundle.routerRules).toBeNull();
  });

  it("保留传入的数据引用", () => {
    const skills = [{ id: "s1" }] as never[];
    const bundle = exportConfigBundle(null, skills, [], null);
    expect(bundle.skills).toBe(skills);
  });
});

describe("serializeBundle", () => {
  it("输出有效 JSON", () => {
    const bundle = exportConfigBundle(null, [], [], null);
    const json = serializeBundle(bundle);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe("1.0.0");
    expect(parsed.skills).toEqual([]);
  });
});

describe("validateConfigBundle", () => {
  it("有效 bundle 通过验证", () => {
    const data = {
      version: "1.0.0",
      exported_at: new Date().toISOString(),
      targets: null,
      skills: [],
      workflows: [],
      routerRules: null,
    };
    const result = validateConfigBundle(data);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("null 输入失败", () => {
    const result = validateConfigBundle(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("无效的 JSON 对象");
  });

  it("缺少 version 报错", () => {
    const result = validateConfigBundle({ skills: [], workflows: [] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("缺少 version 字段");
  });

  it("skills 非数组报错", () => {
    const result = validateConfigBundle({ version: "1", skills: "x", workflows: [] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("skills 必须为数组");
  });

  it("workflows 非数组报错", () => {
    const result = validateConfigBundle({ version: "1", skills: [], workflows: {} });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("workflows 必须为数组");
  });
});
