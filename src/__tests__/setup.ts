// Vitest global setup — mock Tauri APIs + DOM environment

import { vi } from "vitest";

// ── Mock @tauri-apps/api/core ──
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockRejectedValue(new Error("invoke() not mocked for this test")),
  transformCallback: vi.fn().mockReturnValue(0),
}));

// ── Mock @tauri-apps/api/event ──
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
  once: vi.fn().mockResolvedValue(() => {}),
}));

// ── Mock @tauri-apps/plugin-notification ──
vi.mock("@tauri-apps/plugin-notification", () => ({
  sendNotification: vi.fn(),
}));

// ── Mock @tauri-apps/plugin-opener ──
vi.mock("@tauri-apps/plugin-opener", () => ({
  open: vi.fn(),
}));

// ── Mock matchMedia (used by some components) ──
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ── Mock performance.memory (Chromium-only API) ──
Object.defineProperty(performance, "memory", {
  writable: true,
  value: {
    usedJSHeapSize: 10_000_000,
    totalJSHeapSize: 50_000_000,
    jsHeapSizeLimit: 2_000_000_000,
  },
});
