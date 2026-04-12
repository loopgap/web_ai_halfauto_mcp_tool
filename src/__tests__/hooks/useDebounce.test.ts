// ═══════════════════════════════════════════════════════════
// useDebounce.test.ts — Debounce behavior tests
// ═══════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebouncedAction, useDebounce } from "../../hooks/useDebounce";

describe("useDebouncedAction", () => {
  let mockFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFn = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("basic debounce behavior", () => {
    it("debounce prevents second call within delay period", async () => {
      const { result } = renderHook(() => useDebouncedAction(mockFn, 300));
      const [debouncedFn] = result.current;

      await act(async () => {
        await debouncedFn();
        await new Promise((resolve) => setTimeout(resolve, 50));
        await debouncedFn();
        await new Promise((resolve) => setTimeout(resolve, 50));
        await debouncedFn();
      });

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("calls the function after delay", async () => {
      const { result } = renderHook(() => useDebouncedAction(mockFn, 300));
      const [debouncedFn] = result.current;

      await act(async () => {
        await debouncedFn();
        await new Promise((resolve) => setTimeout(resolve, 300));
      });

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("returns loading state as false initially", () => {
      const { result } = renderHook(() => useDebouncedAction(mockFn, 300));

      expect(result.current[1]).toBe(false);
    });

    it("prevents rapid successive calls within delay", async () => {
      const { result } = renderHook(() => useDebouncedAction(mockFn, 300));
      const [debouncedFn] = result.current;

      await act(async () => {
        await debouncedFn();
        await new Promise((resolve) => setTimeout(resolve, 100));
        await debouncedFn();
        await new Promise((resolve) => setTimeout(resolve, 100));
        await debouncedFn();
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("loading state dependency fix", () => {
    it("returns consistent debounced function reference", () => {
      const { result, rerender } = renderHook(() => useDebouncedAction(mockFn, 300));

      const firstFn = result.current[0];

      rerender();

      const secondFn = result.current[0];

      expect(firstFn).toBe(secondFn);
    });
  });

  describe("edge cases", () => {
    it("works with default delay of 300ms", async () => {
      const { result } = renderHook(() => useDebouncedAction(mockFn));
      const [debouncedFn] = result.current;

      await act(async () => {
        await debouncedFn();
        await new Promise((resolve) => setTimeout(resolve, 300));
      });

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("passes arguments to the debounced function", async () => {
      const { result } = renderHook(() => useDebouncedAction(mockFn, 300));
      const [debouncedFn] = result.current;

      await act(async () => {
        await debouncedFn("arg1", "arg2");
        await new Promise((resolve) => setTimeout(resolve, 300));
      });

      expect(mockFn).toHaveBeenCalledWith("arg1", "arg2");
    });
  });
});

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("value debouncing", () => {
    it("returns initial value immediately", () => {
      const { result } = renderHook(() => useDebounce("initial", 300));

      expect(result.current).toBe("initial");
    });

    it("returns debounced value after delay", () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: "initial", delay: 300 } }
      );

      rerender({ value: "updated", delay: 300 });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current).toBe("updated");
    });

    it("resets timer when value changes", () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: "initial", delay: 300 } }
      );

      rerender({ value: "updated1", delay: 300 });
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(result.current).toBe("initial");

      rerender({ value: "updated2", delay: 300 });
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(result.current).toBe("initial");

      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(result.current).toBe("updated2");
    });

    it("cleans up timer on unmount", () => {
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

      const { unmount } = renderHook(() => useDebounce("value", 300));
      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it("works with object values", () => {
      const objValue = { key: "value" };
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: objValue, delay: 300 } }
      );

      const newObj = { key: "newValue" };
      rerender({ value: newObj, delay: 300 });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current).toBe(newObj);
    });

    it("works with number values", () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 0, delay: 300 } }
      );

      rerender({ value: 42, delay: 300 });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current).toBe(42);
    });

    it("works with array values", () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: [] as number[], delay: 300 } }
      );

      rerender({ value: [1, 2, 3], delay: 300 });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current).toEqual([1, 2, 3]);
    });
  });
});
