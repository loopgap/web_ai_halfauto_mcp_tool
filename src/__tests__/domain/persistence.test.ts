// ═══════════════════════════════════════════════════════════
// persistence.ts 单元测试 — UI 状态持久化
// ═══════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  persistUIState,
  restoreUIState,
  clearPersistedState,
  createPersistMiddleware,
} from "../../domain/persistence";

// Mock localStorage
const store: Record<string, string> = {};
beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  vi.spyOn(Storage.prototype, "getItem").mockImplementation((key: string) => store[key] ?? null);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation((key: string, val: string) => { store[key] = val; });
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation((key: string) => { delete store[key]; });
});

describe("persistUIState", () => {
  it("写入 localStorage", () => {
    const state = {
      pageStates: { dashboard: "ready" as const, console: "idle" as const },
    } as never;
    persistUIState(state);
    expect(store["ai-workbench:ui-state"]).toBeDefined();
    const parsed = JSON.parse(store["ai-workbench:ui-state"]);
    expect(parsed._v).toBe(1);
    expect(parsed.pageStates.dashboard).toBe("ready");
  });
});

describe("restoreUIState", () => {
  it("无数据时返回空对象", () => {
    expect(restoreUIState()).toEqual({});
  });

  it("恢复已保存的状态", () => {
    store["ai-workbench:ui-state"] = JSON.stringify({
      _v: 1,
      pageStates: { dashboard: "ready" },
      lastRoute: "/console",
    });
    const result = restoreUIState();
    expect(result.pageStates?.dashboard).toBe("ready");
    expect(result.lastRoute).toBe("/console");
  });

  it("版本不匹配时清除并返回空", () => {
    store["ai-workbench:ui-state"] = JSON.stringify({
      _v: 999,
      pageStates: {},
    });
    const result = restoreUIState();
    expect(result).toEqual({});
    expect(store["ai-workbench:ui-state"]).toBeUndefined();
  });

  it("JSON 损坏时清除并返回空", () => {
    store["ai-workbench:ui-state"] = "not valid json";
    const result = restoreUIState();
    expect(result).toEqual({});
  });
});

describe("clearPersistedState", () => {
  it("清除存储", () => {
    store["ai-workbench:ui-state"] = "{}";
    clearPersistedState();
    expect(store["ai-workbench:ui-state"]).toBeUndefined();
  });
});

describe("createPersistMiddleware", () => {
  it("创建中间件函数", () => {
    const middleware = createPersistMiddleware(100);
    expect(typeof middleware).toBe("function");
  });

  it("节流调用", () => {
    vi.useFakeTimers();
    const middleware = createPersistMiddleware(500);
    const state = { pageStates: { dashboard: "ready" } } as never;
    const action = { type: "SET_INITIALIZED", payload: true } as never;

    middleware(state, action);
    middleware(state, action); // 第二次应被节流

    vi.advanceTimersByTime(600);

    // 只应写入一次
    expect(store["ai-workbench:ui-state"]).toBeDefined();
    vi.useRealTimers();
  });
});
