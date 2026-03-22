// ═══════════════════════════════════════════════════════════
// api-retry.ts 单元测试
// ═══════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from "vitest";
import { invokeWithRetry } from "../../domain/api-retry";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  mockInvoke.mockReset();
});

describe("invokeWithRetry", () => {
  it("成功时直接返回", async () => {
    mockInvoke.mockResolvedValueOnce("ok");
    const result = await invokeWithRetry<string>("test_cmd");
    expect(result).toBe("ok");
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it("不可重试错误直接抛出", async () => {
    mockInvoke.mockRejectedValueOnce({
      code: "INVALID_INPUT",
      message: "bad request",
      trace_id: "t1",
    });

    await expect(invokeWithRetry("test_cmd")).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it("可重试错误自动重试直到成功", async () => {
    mockInvoke
      .mockRejectedValueOnce({ code: "CLIPBOARD_BUSY", message: "busy", trace_id: "t1" })
      .mockRejectedValueOnce({ code: "CLIPBOARD_BUSY", message: "busy retry", trace_id: "t2" })
      .mockResolvedValueOnce("success");

    const result = await invokeWithRetry<string>("test_cmd", undefined, {
      baseDelayMs: 10,
      maxRetries: 3,
    });
    expect(result).toBe("success");
    expect(mockInvoke).toHaveBeenCalledTimes(3);
  });

  it("超过 maxRetries 后抛出最后一个错误", async () => {
    mockInvoke.mockRejectedValue({ code: "CLIPBOARD_BUSY", message: "still busy", trace_id: "t" });

    await expect(
      invokeWithRetry("test_cmd", undefined, { maxRetries: 2, baseDelayMs: 10 })
    ).rejects.toMatchObject({ code: "CLIPBOARD_BUSY" });
    expect(mockInvoke).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it("onRetry 回调被调用", async () => {
    const onRetry = vi.fn();
    mockInvoke
      .mockRejectedValueOnce({ code: "TIMEOUT", message: "timeout", trace_id: "t" })
      .mockResolvedValueOnce("done");

    await invokeWithRetry("test_cmd", undefined, {
      baseDelayMs: 10,
      onRetry,
    });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.objectContaining({ code: "TIMEOUT" }), expect.any(Number));
  });

  it("自定义 isRetryable", async () => {
    mockInvoke.mockRejectedValue({
      code: "CUSTOM_ERROR",
      message: "custom",
      trace_id: "t",
    });

    await expect(
      invokeWithRetry("cmd", undefined, {
        maxRetries: 1,
        baseDelayMs: 10,
        isRetryable: (e) => e.code === "CUSTOM_ERROR",
      })
    ).rejects.toMatchObject({ code: "CUSTOM_ERROR" });

    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });
});
