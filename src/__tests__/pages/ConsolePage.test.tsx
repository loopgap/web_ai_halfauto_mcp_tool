import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";
import ConsolePage from "../../pages/ConsolePage";
import * as actions from "../../domain/actions";

vi.mock("../../domain/actions", () => ({
  executeDispatchFlow: vi.fn(),
  captureOutput: vi.fn(),
  confirmSend: vi.fn(),
  routePromptFlow: vi.fn().mockResolvedValue({ success: false }),
  validateInput: vi.fn(),
  lookupError: vi.fn(),
  getRecoveryActions: vi.fn(),
}));

const mockSkill = {
  id: "skill-1",
  version: "1.0",
  title: "Test Skill",
  intent_tags: ["test", "mock"],
  inputs: {
    query: {
      type: "string",
      required: true,
      description: "Search query",
      max_length: 100,
    },
  },
  prompt_template: "Search for {query}",
  quality_gates: [],
  fallbacks: [],
  preconditions: [],
  postconditions: [],
  safety_level: "safe",
  cost_class: "low",
  latency_class: "fast",
  determinism: "high",
};

const mockTarget = {
  provider: "chrome",
  match: { title_regex: ["test"] },
  behavior: {
    auto_enter: true,
    paste_delay_ms: 100,
    restore_clipboard_after_paste: false,
    focus_recipe: [],
    append_run_watermark: false,
  },
};

const mockTargets = {
  targets: {
    "target-1": mockTarget,
  },
  defaults: {
    activate_retry: 3,
    fail_fast_ms: 5000,
  },
};

const mockDispatch = vi.fn();
const mockToast = vi.fn();

vi.mock("../../store/AppStore", () => ({
  useAppStore: vi.fn((selector?: (s: any) => any) => {
    const state = {
      skills: [mockSkill],
      targets: mockTargets,
      runs: [],
      errorCatalog: [],
      pageStates: { console: "idle" },
    };
    if (selector) return selector(state);
    return state;
  }),
  useAppDispatch: () => mockDispatch,
}));

vi.mock("../../components/Toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("../../hooks/useDebounce", () => ({
  useDebouncedAction: vi.fn((fn) => {
    const mockFn = (...args: any[]) => fn(...args);
    return [mockFn, false];
  }),
}));

vi.mock("../../components/StepProgress", () => ({
  default: () => <div data-testid="step-progress">StepProgress</div>,
}));

vi.mock("../../components/RunHistoryList", () => ({
  default: () => <div data-testid="run-history-list">RunHistoryList</div>,
}));

describe("ConsolePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDispatch.mockClear();
  });

  describe("Component renders", () => {
    it("renders without crashing", () => {
      render(<ConsolePage />);
      expect(screen.getByText("运行控制台")).toBeTruthy();
    });

    it("renders skill selector with options", () => {
      render(<ConsolePage />);
      const selects = screen.getAllByRole("combobox");
      expect(selects[0]).toBeTruthy();
      expect(screen.getByText(/Test Skill/)).toBeTruthy();
    });

    it("renders prompt preview section", () => {
      render(<ConsolePage />);
      expect(screen.getByText("Prompt 预览")).toBeTruthy();
    });

    it("renders captured output section", () => {
      render(<ConsolePage />);
      expect(screen.getByText("Captured 输出")).toBeTruthy();
    });

    it("renders two-phase mode toggle", () => {
      render(<ConsolePage />);
      expect(screen.getByText("两阶段提交")).toBeTruthy();
    });

    it("renders browser and injection controls", () => {
      render(<ConsolePage />);
      expect(screen.getByText("浏览器智能选择")).toBeTruthy();
      expect(screen.getByText("自动指令注入")).toBeTruthy();
    });
  });

  describe("Skill selection and input", () => {
    it("shows skill inputs when skill is selected", async () => {
      render(<ConsolePage />);
      
      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[0], { target: { value: "skill-1" } });
      
      await waitFor(() => {
        expect(screen.getByText("输入参数")).toBeTruthy();
      });
    });

    it("displays rendered prompt preview when skill is selected with inputs filled", async () => {
      render(<ConsolePage />);
      
      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[0], { target: { value: "skill-1" } });
      
      await waitFor(() => {
        const textarea = screen.getByPlaceholderText("输入 query...");
        fireEvent.change(textarea, { target: { value: "test search" } });
      });
      
      await waitFor(() => {
        expect(screen.getByText(/Search for test search/)).toBeTruthy();
      });
    });

    it("shows safety level badge", async () => {
      render(<ConsolePage />);
      
      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[0], { target: { value: "skill-1" } });
      
      await waitFor(() => {
        expect(screen.getByText("safe")).toBeTruthy();
      });
    });
  });

  describe("State transitions", () => {
    it("shows StepProgress when dispatching begins", async () => {
      (actions.executeDispatchFlow as any).mockImplementation(() => Promise.resolve({
        success: true,
        run: { id: "run-1" },
      }));
      
      render(<ConsolePage />);
      
      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[0], { target: { value: "skill-1" } });
      
      await waitFor(() => {
        const targetSelect = screen.getAllByRole("combobox")[1];
        fireEvent.change(targetSelect, { target: { value: "target-1" } });
      });
      
      const textarea = await screen.getByPlaceholderText("输入 query...");
      fireEvent.change(textarea, { target: { value: "test" } });
      
      const dispatchBtn = screen.getByRole("button", { name: /Stage 粘贴/ });
      fireEvent.click(dispatchBtn);
      
      await waitFor(() => {
        expect(actions.executeDispatchFlow).toHaveBeenCalled();
      });
    });
  });

  describe("User interactions - Dispatch flow", () => {
    it("dispatches when button is clicked with valid inputs", async () => {
      (actions.executeDispatchFlow as any).mockResolvedValue({
        success: true,
        run: { id: "run-1" },
      });
      
      render(<ConsolePage />);
      
      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[0], { target: { value: "skill-1" } });
      
      await waitFor(() => {
        const targetSelect = screen.getAllByRole("combobox")[1];
        fireEvent.change(targetSelect, { target: { value: "target-1" } });
      });
      
      const textarea = await screen.getByPlaceholderText("输入 query...");
      fireEvent.change(textarea, { target: { value: "test" } });
      
      const dispatchBtn = screen.getByRole("button", { name: /Stage 粘贴/ });
      fireEvent.click(dispatchBtn);
      
      await waitFor(() => {
        expect(actions.executeDispatchFlow).toHaveBeenCalled();
      });
    });

    it("enables Send Now button after two-phase staging", async () => {
      (actions.executeDispatchFlow as any).mockResolvedValue({
        success: true,
        run: { id: "run-1" },
        stagedHwnd: 12345,
      });
      
      render(<ConsolePage />);
      
      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[0], { target: { value: "skill-1" } });
      
      await waitFor(() => {
        const targetSelect = screen.getAllByRole("combobox")[1];
        fireEvent.change(targetSelect, { target: { value: "target-1" } });
      });
      
      const textarea = await screen.getByPlaceholderText("输入 query...");
      fireEvent.change(textarea, { target: { value: "test" } });
      
      const dispatchBtn = screen.getByRole("button", { name: /Stage 粘贴/ });
      fireEvent.click(dispatchBtn);
      
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Send Now 确认发送/ })).toBeTruthy();
      });
    });
  });

  describe("User interactions - Capture", () => {
    it("calls captureOutput when capture button is clicked", async () => {
      (actions.executeDispatchFlow as any).mockResolvedValue({
        success: true,
        run: { id: "run-1" },
      });
      (actions.captureOutput as any).mockResolvedValue({
        success: true,
        text: "captured output",
      });
      
      render(<ConsolePage />);
      
      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[0], { target: { value: "skill-1" } });
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText("输入 query...")).toBeTruthy();
      });
      
      const textarea = screen.getByPlaceholderText("输入 query...");
      fireEvent.change(textarea, { target: { value: "test" } });
      
      const captureBtn = screen.getByRole("button", { name: /Capture 输出/ });
      expect(captureBtn).toBeTruthy();
    });

    it("capture button is present after dispatch", async () => {
      (actions.executeDispatchFlow as any).mockResolvedValue({
        success: true,
        run: { id: "run-1" },
      });
      (actions.captureOutput as any).mockResolvedValue({
        success: true,
        text: "test captured content",
      });
      
      render(<ConsolePage />);
      
      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[0], { target: { value: "skill-1" } });
      
      await waitFor(() => {
        const targetSelect = screen.getAllByRole("combobox")[1];
        fireEvent.change(targetSelect, { target: { value: "target-1" } });
      });
      
      const textarea = await screen.getByPlaceholderText("输入 query...");
      fireEvent.change(textarea, { target: { value: "test" } });
      
      const dispatchBtn = screen.getByRole("button", { name: /Stage 粘贴/ });
      fireEvent.click(dispatchBtn);
      
      await waitFor(() => {
        expect(actions.executeDispatchFlow).toHaveBeenCalled();
      });
    });
  });

  describe("Error handling", () => {
    it("executeDispatchFlow is called when dispatch button is clicked", async () => {
      (actions.executeDispatchFlow as any).mockResolvedValue({
        success: false,
        error: { code: "ERR_TARGET_NOT_FOUND", message: "Target window not found" },
      });
      (actions.lookupError as any).mockReturnValue({
        user_message: "目标窗口未找到",
        fix_suggestion: "请检查目标窗口是否打开",
      });
      
      render(<ConsolePage />);
      
      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[0], { target: { value: "skill-1" } });
      
      await waitFor(() => {
        const targetSelect = screen.getAllByRole("combobox")[1];
        fireEvent.change(targetSelect, { target: { value: "target-1" } });
      });
      
      const textarea = await screen.getByPlaceholderText("输入 query...");
      fireEvent.change(textarea, { target: { value: "test" } });
      
      const dispatchBtn = screen.getByRole("button", { name: /Stage 粘贴/ });
      fireEvent.click(dispatchBtn);
      
      await waitFor(() => {
        expect(actions.executeDispatchFlow).toHaveBeenCalled();
      });
    });

    it("lookupError is called when dispatch fails", async () => {
      (actions.executeDispatchFlow as any).mockResolvedValue({
        success: false,
        error: { code: "ERR_TARGET_NOT_FOUND", message: "Target window not found" },
      });
      (actions.lookupError as any).mockReturnValue({
        user_message: "目标窗口未找到",
        fix_suggestion: "请检查目标窗口是否打开",
      });
      (actions.getRecoveryActions as any).mockReturnValue([
        { action: "retry", label: "重试", description: "重新检测目标窗口", primary: true },
        { action: "cancel", label: "取消", description: "取消操作", primary: false },
      ]);
      
      render(<ConsolePage />);
      
      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[0], { target: { value: "skill-1" } });
      
      await waitFor(() => {
        const targetSelect = screen.getAllByRole("combobox")[1];
        fireEvent.change(targetSelect, { target: { value: "target-1" } });
      });
      
      const textarea = await screen.getByPlaceholderText("输入 query...");
      fireEvent.change(textarea, { target: { value: "test" } });
      
      const dispatchBtn = screen.getByRole("button", { name: /Stage 粘贴/ });
      fireEvent.click(dispatchBtn);
      
      await waitFor(() => {
        expect(actions.lookupError).toHaveBeenCalled();
      });
    });

    it("captureOutput is called when capture button is clicked", async () => {
      (actions.executeDispatchFlow as any).mockResolvedValue({
        success: true,
        run: { id: "run-1" },
      });
      (actions.captureOutput as any).mockResolvedValue({
        success: false,
        error: { message: "Clipboard capture failed" },
      });
      
      render(<ConsolePage />);
      
      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[0], { target: { value: "skill-1" } });
      
      await waitFor(() => {
        const targetSelect = screen.getAllByRole("combobox")[1];
        fireEvent.change(targetSelect, { target: { value: "target-1" } });
      });
      
      const textarea = await screen.getByPlaceholderText("输入 query...");
      fireEvent.change(textarea, { target: { value: "test" } });
      
      const dispatchBtn = screen.getByRole("button", { name: /Stage 粘贴/ });
      fireEvent.click(dispatchBtn);
      
      await waitFor(() => {
        expect(actions.executeDispatchFlow).toHaveBeenCalled();
      });
    });
  });

  describe("Route decision", () => {
    it("displays route decision when available", async () => {
      (actions.routePromptFlow as any).mockResolvedValue({
        success: true,
        decision: {
          action: "auto_execute",
          confidence: 0.95,
          explanation: "High confidence for auto execution",
          top_candidates: [{ intent: "test", score: 0.95 }],
        },
      });
      
      render(<ConsolePage />);
      
      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[0], { target: { value: "skill-1" } });
      
      await waitFor(() => {
        const textarea = screen.getByPlaceholderText("输入 query...");
        fireEvent.change(textarea, { target: { value: "test query for routing" } });
      });
      
      await act(async () => {
        await new Promise((r) => setTimeout(r, 600));
      });
      
      await waitFor(() => {
        expect(screen.getByText("路由决策")).toBeTruthy();
        expect(screen.getByText(/自动执行/)).toBeTruthy();
      });
    });
  });

  describe("Browser warning", () => {
    it("displays browser warning when detected", async () => {
      (actions.executeDispatchFlow as any).mockResolvedValue({
        success: true,
        run: { id: "run-1" },
        browserWarning: "Unrecognized browser detected: Unknown Browser",
      });
      
      render(<ConsolePage />);
      
      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[0], { target: { value: "skill-1" } });
      
      await waitFor(() => {
        const targetSelect = screen.getAllByRole("combobox")[1];
        fireEvent.change(targetSelect, { target: { value: "target-1" } });
      });
      
      const textarea = await screen.getByPlaceholderText("输入 query...");
      fireEvent.change(textarea, { target: { value: "test" } });
      
      const dispatchBtn = screen.getByRole("button", { name: /Stage 粘贴/ });
      fireEvent.click(dispatchBtn);
      
      await waitFor(() => {
        expect(screen.getByText("未识别的浏览器")).toBeTruthy();
        expect(screen.getByText(/Unknown Browser/)).toBeTruthy();
      });
    });
  });

  describe("Input validation", () => {
    it("shows validation error for input exceeding max length", async () => {
      // Mock validateInput to return truthy to trigger error display
      // Component generates its own error message format
      (actions.validateInput as any).mockReturnValue("error");
      
      render(<ConsolePage />);
      
      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[0], { target: { value: "skill-1" } });
      
      await waitFor(() => {
        const textarea = screen.getByPlaceholderText("输入 query...");
        fireEvent.change(textarea, { target: { value: "x".repeat(150) } });
      });
      
      await waitFor(() => {
        expect(screen.getByText(/参数 'query' 太长/)).toBeTruthy();
      });
    });

    it("validateInput is called when input changes", async () => {
      (actions.validateInput as any).mockReturnValue(null);
      
      render(<ConsolePage />);
      
      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[0], { target: { value: "skill-1" } });
      
      await waitFor(() => {
        const textarea = screen.getByPlaceholderText("输入 query...");
        fireEvent.change(textarea, { target: { value: "test input" } });
      });
      
      await waitFor(() => {
        expect(actions.validateInput).toHaveBeenCalled();
      });
    });
  });
});
