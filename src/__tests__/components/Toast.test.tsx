import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";
import { ToastProvider, useToast } from "../../components/Toast";

// 测试组件：包装 ToastProvider 并提供测试接口
function TestToastConsumer() {
  const { toast } = useToast();

  return (
    <div>
      <button data-testid="btn-success" onClick={() => toast("success", "操作成功")}>
        成功
      </button>
      <button data-testid="btn-error" onClick={() => toast("error", "操作失败")}>
        错误
      </button>
      <button data-testid="btn-info" onClick={() => toast("info", "信息提示")}>
        信息
      </button>
      <button data-testid="btn-warning" onClick={() => toast("warning", "警告信息")}>
        警告
      </button>
      <button
        data-testid="btn-custom-duration"
        onClick={() => toast("success", "自定义时长", 1000)}
      >
        自定义时长
      </button>
    </div>
  );
}

describe("Toast 组件", () => {
  // 使用 fake timers 来控制 setTimeout
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("基础渲染", () => {
    it("渲染 ToastProvider 而不崩溃", () => {
      render(
        <ToastProvider>
          <div>子内容</div>
        </ToastProvider>
      );
      expect(screen.getByText("子内容")).toBeTruthy();
    });

    it("初始状态不显示任何 toast", () => {
      render(
        <ToastProvider>
          <TestToastConsumer />
        </ToastProvider>
      );
      // 初始状态不应该有通知区域
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("Toast 显示", () => {
    it("点击成功按钮显示成功 toast", async () => {
      render(
        <ToastProvider>
          <TestToastConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId("btn-success"));

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      expect(screen.getByRole("alert")).toBeTruthy();
      expect(screen.getByText("操作成功")).toBeTruthy();
    });

    it("点击错误按钮显示错误 toast", async () => {
      render(
        <ToastProvider>
          <TestToastConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId("btn-error"));

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      expect(screen.getByRole("alert")).toBeTruthy();
      expect(screen.getByText("操作失败")).toBeTruthy();
    });

    it("点击信息按钮显示信息 toast", async () => {
      render(
        <ToastProvider>
          <TestToastConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId("btn-info"));

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      expect(screen.getByText("信息提示")).toBeTruthy();
    });

    it("点击警告按钮显示警告 toast", async () => {
      render(
        <ToastProvider>
          <TestToastConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId("btn-warning"));

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      expect(screen.getByText("警告信息")).toBeTruthy();
    });
  });

  describe("多个 Toast", () => {
    it("可以同时显示多个 toast", async () => {
      render(
        <ToastProvider>
          <TestToastConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId("btn-success"));
      fireEvent.click(screen.getByTestId("btn-error"));
      fireEvent.click(screen.getByTestId("btn-info"));

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      const alerts = screen.getAllByRole("alert");
      expect(alerts).toHaveLength(3);
      expect(screen.getByText("操作成功")).toBeTruthy();
      expect(screen.getByText("操作失败")).toBeTruthy();
      expect(screen.getByText("信息提示")).toBeTruthy();
    });
  });

  describe("Toast 自动关闭", () => {
    it("默认 4 秒后自动关闭 toast", async () => {
      render(
        <ToastProvider>
          <TestToastConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId("btn-success"));

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      expect(screen.getByText("操作成功")).toBeTruthy();

      // 4 秒后 toast 应该消失
      await act(async () => {
        vi.advanceTimersByTime(4000);
      });

      expect(screen.queryByText("操作成功")).toBeNull();
    });

    it("自定义时长后关闭 toast", async () => {
      render(
        <ToastProvider>
          <TestToastConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId("btn-custom-duration"));

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // toast 消息在 alert role 的容器内
      const alertContainer = screen.getByRole("alert");
      expect(alertContainer.textContent).toContain("自定义时长");

      // 1 秒后 toast 应该消失
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("duration 为 0 时不自动关闭", async () => {
      // 测试组件：提供 duration=0 的 toast 按钮
      function ZeroDurationToast() {
        const { toast } = useToast();
        return (
          <button onClick={() => toast("success", "不会自动关闭", 0)}>
            触发
          </button>
        );
      }

      render(
        <ToastProvider>
          <ZeroDurationToast />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText("触发"));

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // toast 应该显示
      expect(screen.queryByRole("alert")).toBeTruthy();

      // 5 秒后 toast 仍然应该显示（因为 duration=0）
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      expect(screen.queryByRole("alert")).toBeTruthy();
    });
  });

  describe("Toast 手动关闭", () => {
    it("点击关闭按钮手动移除 toast", async () => {
      render(
        <ToastProvider>
          <TestToastConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId("btn-success"));

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      expect(screen.getByText("操作成功")).toBeTruthy();

      // 点击关闭按钮
      const closeButton = screen.getByLabelText("关闭通知");
      fireEvent.click(closeButton);

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      expect(screen.queryByText("操作成功")).toBeNull();
    });
  });

  describe("无障碍访问", () => {
    it("toast 容器有正确的 aria 属性", () => {
      render(
        <ToastProvider>
          <TestToastConsumer />
        </ToastProvider>
      );

      const container = screen.getByRole("region", { name: "通知" });
      expect(container).toBeTruthy();
    });

    it("每个 toast 有 alert role", async () => {
      render(
        <ToastProvider>
          <TestToastConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId("btn-success"));

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // role="alert" 在 toast 消息上，而 aria-live="polite" 在容器上
      const alert = screen.getByRole("alert");
      expect(alert).toBeTruthy();
      // 检查 toast 容器有 aria-live="polite"
      const container = screen.getByRole("region", { name: "通知" });
      expect(container.getAttribute("aria-live")).toBe("polite");
    });

    it("关闭按钮有无障碍标签", async () => {
      render(
        <ToastProvider>
          <TestToastConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId("btn-success"));

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      const closeButton = screen.getByLabelText("关闭通知");
      expect(closeButton).toBeTruthy();
    });
  });

  describe("错误边界", () => {
    it("在非 ToastProvider 环境下使用 useToast 不崩溃", () => {
      // ToastContext 有默认值为 { toast: () => {} }，所以不会崩溃
      // 只是 toast 调用会是空操作
      function BrokenConsumer() {
        const { toast } = useToast();
        // 调用应该不崩溃，只是不会有效果
        toast("success", "测试消息");
        return <div>no toast rendered</div>;
      }

      // 这应该不崩溃，因为 ToastContext 有默认值
      render(<BrokenConsumer />);
      expect(screen.getByText("no toast rendered")).toBeTruthy();
    });
  });
});
