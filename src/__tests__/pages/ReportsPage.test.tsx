import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ReportsPage from "../../pages/ReportsPage";

describe("ReportsPage", () => {
  it("adds news item and updates preview", () => {
    render(<ReportsPage />);

    fireEvent.change(screen.getByPlaceholderText("New release"), {
      target: { value: "Ubuntu 24.04 AI Update" },
    });
    fireEvent.change(screen.getByPlaceholderText("Paste latest information..."), {
      target: { value: "New MCP integration and scheduler optimization." },
    });

    fireEvent.click(screen.getByRole("button", { name: "添加资讯" }));

    expect(screen.getByText(/资讯条目 \(1\)/)).toBeTruthy();
    expect(screen.getByText("Ubuntu 24.04 AI Update")).toBeTruthy();
    expect(screen.getByText(/Daily Intelligence Brief/)).toBeTruthy();
  });
});
