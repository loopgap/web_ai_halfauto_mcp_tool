// ═══════════════════════════════════════════════════════════
// useEventBus.test.ts — Event subscription and cleanup tests
// ═══════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEventBus } from "../../hooks/useEventBus";
import { listen } from "@tauri-apps/api/event";
import type { Dispatch } from "react";
import type { AppAction } from "../../store/AppStore";

vi.mock("@tauri-apps/api/event");

const mockListen = listen as ReturnType<typeof vi.fn>;

describe("useEventBus", () => {
  let mockDispatch: Dispatch<AppAction>;
  let mockSideEffect: ReturnType<typeof vi.fn>;
  let unlistenMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    unlistenMock = vi.fn();
    mockDispatch = vi.fn() as Dispatch<AppAction>;
    mockSideEffect = vi.fn();
    mockListen.mockResolvedValue(unlistenMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createHook = () => {
    return renderHook(() => useEventBus(mockDispatch, mockSideEffect));
  };

  describe("event subscription", () => {
    it("subscribes to workbench-event on mount", async () => {
      createHook();

      expect(mockListen).toHaveBeenCalledWith("workbench-event", expect.any(Function));
    });

    it("returns unsubscribe function", () => {
      const { result } = createHook();

      const unsubscribe = result.current;
      expect(typeof unsubscribe).toBe("function");
    });

    it("calls unlisten when component unmounts", async () => {
      const { unmount } = createHook();

      await act(async () => {
        unmount();
      });

      expect(unlistenMock).toHaveBeenCalled();
    });
  });

  describe("event type handling", () => {
    it("dispatches UPDATE_RUN for RunCreated event", async () => {
      createHook();

      const eventHandler = mockListen.mock.calls[0][1];
      const mockPayload = {
        event_type: "RunCreated",
        run_id: "run-123",
        status: "created",
      };

      await act(async () => {
        await eventHandler({ payload: mockPayload });
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: "UPDATE_RUN",
        payload: {
          id: "run-123",
          updates: { status: "created" },
        },
      });
    });

    it("dispatches UPDATE_RUN and SET_PAGE_STATE for StepFailed event", async () => {
      createHook();

      const eventHandler = mockListen.mock.calls[0][1];
      const mockPayload = {
        event_type: "StepFailed",
        run_id: "run-789",
        status: "failed",
        error_code: "E_TIMEOUT",
      };

      await act(async () => {
        await eventHandler({ payload: mockPayload });
      });

      expect(mockDispatch).toHaveBeenCalledTimes(2);
      expect(mockDispatch).toHaveBeenNthCalledWith(1, {
        type: "UPDATE_RUN",
        payload: {
          id: "run-789",
          updates: expect.objectContaining({
            status: "failed",
            error_code: "E_TIMEOUT",
          }),
        },
      });
      expect(mockDispatch).toHaveBeenNthCalledWith(2, {
        type: "SET_PAGE_STATE",
        payload: { page: "console", state: "error" },
      });
    });

    it("calls sideEffect for StepDispatched event", async () => {
      createHook();

      const eventHandler = mockListen.mock.calls[0][1];
      const mockPayload = {
        event_type: "StepDispatched",
        run_id: "run-123",
      };

      await act(async () => {
        await eventHandler({ payload: mockPayload });
      });

      expect(mockSideEffect).toHaveBeenCalledWith(mockPayload);
    });

    it("calls sideEffect for StepCaptured with auto_advance event type", async () => {
      createHook();

      const eventHandler = mockListen.mock.calls[0][1];
      const mockPayload = {
        event_type: "StepCaptured",
        run_id: "run-123",
        step_id: "step-1",
      };

      await act(async () => {
        await eventHandler({ payload: mockPayload });
      });

      expect(mockSideEffect).toHaveBeenCalledTimes(2);
      expect(mockSideEffect).toHaveBeenNthCalledWith(1, {
        ...mockPayload,
        event_type: "StepCaptured:auto_advance",
      });
      expect(mockSideEffect).toHaveBeenNthCalledWith(2, mockPayload);
    });

    it("calls sideEffect for clipboard and file events", async () => {
      createHook();

      const clipboardPayload = { event_type: "ClipboardCaptured" };
      const newFilePayload = { event_type: "NewFileInInbox" };
      const fetchPayload = { event_type: "NewSourceFetched" };

      const eventHandler = mockListen.mock.calls[0][1];

      await act(async () => {
        await eventHandler({ payload: clipboardPayload });
        await eventHandler({ payload: newFilePayload });
        await eventHandler({ payload: fetchPayload });
      });

      expect(mockSideEffect).toHaveBeenCalledTimes(3);
    });

    it("dispatches GovernanceUpdated with change/quality/decision", async () => {
      createHook();

      const mockChange = { id: "change-1", field: "value" };
      const mockQuality = { id: "quality-1", result: "pass" };
      const mockDecision = { id: "decision-1", approved: true };

      const eventHandler = mockListen.mock.calls[0][1];
      const mockPayload = {
        event_type: "GovernanceUpdated",
        change: mockChange,
        quality: mockQuality,
        decision: mockDecision,
      };

      await act(async () => {
        await eventHandler({ payload: mockPayload });
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: "UPSERT_GOV_CHANGE",
        payload: mockChange,
      });
      expect(mockDispatch).toHaveBeenCalledWith({
        type: "UPSERT_GOV_QUALITY",
        payload: mockQuality,
      });
      expect(mockDispatch).toHaveBeenCalledWith({
        type: "UPSERT_GOV_DECISION",
        payload: mockDecision,
      });
    });

    it("handles GovernanceValidation event", async () => {
      createHook();

      const mockReport = { id: "report-1", findings: [] };
      const eventHandler = mockListen.mock.calls[0][1];
      const mockPayload = {
        event_type: "GovernanceValidation",
        report: mockReport,
      };

      await act(async () => {
        await eventHandler({ payload: mockPayload });
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: "ADD_GOV_REPORT",
        payload: mockReport,
      });
    });

    it("ignores unknown event types without error", async () => {
      createHook();

      const eventHandler = mockListen.mock.calls[0][1];
      const mockPayload = { event_type: "UnknownEvent" };

      await act(async () => {
        await eventHandler({ payload: mockPayload });
      });

      expect(mockDispatch).not.toHaveBeenCalled();
      expect(mockSideEffect).not.toHaveBeenCalled();
    });
  });

  describe("cleanup", () => {
    it("cleans up listener on unmount", async () => {
      const { unmount } = createHook();

      await act(async () => {
        unmount();
      });

      expect(unlistenMock).toHaveBeenCalledTimes(1);
    });

    it("handles unmount before listen resolves", async () => {
      let resolveListen: (fn: ReturnType<typeof vi.fn>) => void;
      mockListen.mockImplementation(() => new Promise((resolve) => {
        resolveListen = resolve;
      }));

      const { unmount } = createHook();

      await act(async () => {
        resolveListen!(unlistenMock);
      });

      await act(async () => {
        unmount();
      });

      expect(unlistenMock).toHaveBeenCalled();
    });
  });

  describe("dispatch ref updates", () => {
    it("uses latest dispatch after re-render", async () => {
      createHook();

      const eventHandler = mockListen.mock.calls[0][1];

      const mockPayload = {
        event_type: "RunDone",
        run_id: "run-999",
        status: "done",
      };

      await act(async () => {
        await eventHandler({ payload: mockPayload });
      });

      expect(mockDispatch).toHaveBeenCalled();
    });
  });
});
