import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { BrowserRouter } from "react-router-dom";
import Layout from "../../components/Layout";
import * as AppStore from "../../store/AppStore";
import * as actions from "../../domain/actions";

vi.mock("../../domain/actions", () => ({
  initializeApp: vi.fn(),
}));

vi.mock("../../hooks/useKeyboardShortcuts", () => ({
  useKeyboardShortcuts: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: "/" }),
  };
});

const mockDispatch = vi.fn();

function renderLayout() {
  vi.spyOn(AppStore, "useAppStore").mockReturnValue({
    initialized: true,
    pageStates: { dashboard: "idle" },
    skills: [],
    targets: { targets: {}, defaults: {} },
    runs: [],
    errorCatalog: [],
  });

  vi.spyOn(AppStore, "useAppDispatch").mockReturnValue(mockDispatch);

  return render(
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}

describe("Layout 组件", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("基础渲染", () => {
    it("渲染导航栏", () => {
      renderLayout();
      const nav = document.querySelector('[aria-label="主导航"]');
      expect(nav).toBeTruthy();
    });

    it("渲染导航项数量正确", () => {
      renderLayout();
      const navLinks = document.querySelectorAll("nav a");
      expect(navLinks.length).toBeGreaterThan(5);
    });
  });
});
