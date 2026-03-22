// ═══════════════════════════════════════════════════════════
// AppStore reducer 单元测试
// ═══════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { AppStoreProvider, useAppState, useAppDispatch } from "../../store/AppStore";
import type { ReactNode } from "react";

function wrapper({ children }: { children: ReactNode }) {
  return <AppStoreProvider>{children}</AppStoreProvider>;
}

describe("AppStore", () => {
  it("初始状态正确", () => {
    const { result } = renderHook(() => useAppState(), { wrapper });
    expect(result.current.initialized).toBe(false);
    expect(result.current.skills).toEqual([]);
    expect(result.current.runs).toEqual([]);
    expect(result.current.pageStates.dashboard).toBe("idle");
    expect(result.current.lastError).toBeNull();
  });

  it("SET_SKILLS 更新技能列表", () => {
    const { result } = renderHook(
      () => ({ state: useAppState(), dispatch: useAppDispatch() }),
      { wrapper }
    );

    const skills = [{ id: "s1", title: "Test", prompt_template: "" } as never];
    act(() => {
      result.current.dispatch({ type: "SET_SKILLS", payload: skills });
    });
    expect(result.current.state.skills).toHaveLength(1);
  });

  it("SET_PAGE_STATE 合法转换被记录到 stateHistory", () => {
    const { result } = renderHook(
      () => ({ state: useAppState(), dispatch: useAppDispatch() }),
      { wrapper }
    );

    act(() => {
      result.current.dispatch({
        type: "SET_PAGE_STATE",
        payload: { page: "dashboard", state: "loading" },
      });
    });

    expect(result.current.state.pageStates.dashboard).toBe("loading");
    expect(result.current.state.stateHistory).toHaveLength(1);
    expect(result.current.state.stateHistory[0]).toMatchObject({
      from: "idle",
      to: "loading",
      action: "dashboard",
    });
  });

  it("SET_PAGE_STATE 非法转换也能执行但有 warn", () => {
    const { result } = renderHook(
      () => ({ state: useAppState(), dispatch: useAppDispatch() }),
      { wrapper }
    );

    // idle → archived 不是合法转换
    act(() => {
      result.current.dispatch({
        type: "SET_PAGE_STATE",
        payload: { page: "console", state: "archived" },
      });
    });
    // 依然应用 (warn only)
    expect(result.current.state.pageStates.console).toBe("archived");
  });

  it("ADD_RUN 插入到头部", () => {
    const { result } = renderHook(
      () => ({ state: useAppState(), dispatch: useAppDispatch() }),
      { wrapper }
    );

    const run1 = { id: "r1", ts_start: 1000, skill_id: "s1", target_id: "t1", provider: "p", prompt: "p1", status: "done", trace_id: "tr1" };
    const run2 = { id: "r2", ts_start: 2000, skill_id: "s1", target_id: "t1", provider: "p", prompt: "p2", status: "pending", trace_id: "tr2" };

    act(() => {
      result.current.dispatch({ type: "ADD_RUN", payload: run1 as never });
      result.current.dispatch({ type: "ADD_RUN", payload: run2 as never });
    });

    expect(result.current.state.runs).toHaveLength(2);
    expect(result.current.state.runs[0].id).toBe("r2"); // 最新在前
  });

  it("UPDATE_RUN 禁止修改已完成 run 的 prompt", () => {
    const { result } = renderHook(
      () => ({ state: useAppState(), dispatch: useAppDispatch() }),
      { wrapper }
    );

    const run = { id: "r1", ts_start: 1, skill_id: "s", target_id: "t", provider: "p", prompt: "original", status: "done", trace_id: "tr" };
    act(() => {
      result.current.dispatch({ type: "ADD_RUN", payload: run as never });
    });

    act(() => {
      result.current.dispatch({
        type: "UPDATE_RUN",
        payload: { id: "r1", updates: { prompt: "modified" } },
      });
    });
    // prompt 不应被修改
    expect(result.current.state.runs[0].prompt).toBe("original");
  });

  it("SET_ERROR 和清除", () => {
    const { result } = renderHook(
      () => ({ state: useAppState(), dispatch: useAppDispatch() }),
      { wrapper }
    );

    act(() => {
      result.current.dispatch({
        type: "SET_ERROR",
        payload: { code: "E001", message: "Test error", trace_id: "t1" },
      });
    });
    expect(result.current.state.lastError).not.toBeNull();
    expect(result.current.state.lastError!.code).toBe("E001");

    act(() => {
      result.current.dispatch({ type: "SET_ERROR", payload: null });
    });
    expect(result.current.state.lastError).toBeNull();
  });

  it("SET_INITIALIZED 标记初始化完成", () => {
    const { result } = renderHook(
      () => ({ state: useAppState(), dispatch: useAppDispatch() }),
      { wrapper }
    );

    act(() => {
      result.current.dispatch({ type: "SET_INITIALIZED", payload: true });
    });
    expect(result.current.state.initialized).toBe(true);
  });

  it("stateHistory 最多保留 100 条", () => {
    const { result } = renderHook(
      () => ({ state: useAppState(), dispatch: useAppDispatch() }),
      { wrapper }
    );

    act(() => {
      for (let i = 0; i < 110; i++) {
        result.current.dispatch({
          type: "SET_PAGE_STATE",
          payload: { page: "skills", state: i % 2 === 0 ? "loading" : "ready" },
        });
      }
    });
    expect(result.current.state.stateHistory.length).toBeLessThanOrEqual(100);
  });
});
