import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SchedulerPage from "../../pages/SchedulerPage";

describe("SchedulerPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("creates schedule successfully", () => {
    render(<SchedulerPage />);

    fireEvent.change(screen.getByDisplayValue("wf-default"), {
      target: { value: "wf-daily" },
    });

    fireEvent.click(screen.getByRole("button", { name: "创建定时任务" }));

    expect(screen.getByText(/已配置任务 \(1\)/)).toBeTruthy();
    expect(screen.getByText(/wf-daily/)).toBeTruthy();
  });

  it("shows error when invalid daily trigger", () => {
    render(<SchedulerPage />);

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "daily" },
    });

    fireEvent.change(screen.getByPlaceholderText("09:00"), {
      target: { value: "99:99" },
    });

    fireEvent.click(screen.getByRole("button", { name: "创建定时任务" }));

    expect(screen.getByText(/daily_utc_hm must be HH:mm/)).toBeTruthy();
  });

  it("deletes created schedule", () => {
    render(<SchedulerPage />);

    fireEvent.click(screen.getByRole("button", { name: "创建定时任务" }));
    expect(screen.getByText(/已配置任务 \(1\)/)).toBeTruthy();

    const deleteBtn = screen.getByRole("button", { name: /删除 sch-/ });
    fireEvent.click(deleteBtn);

    expect(screen.getByText(/已配置任务 \(0\)/)).toBeTruthy();
  });
});
