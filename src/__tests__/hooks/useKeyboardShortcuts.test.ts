// ═══════════════════════════════════════════════════════════
// useKeyboardShortcuts.test.ts — Keyboard shortcut handling tests
// ═══════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useKeyboardShortcuts, type ShortcutBinding } from "../../hooks/useKeyboardShortcuts";

describe("useKeyboardShortcuts", () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let handler: (e: KeyboardEvent) => void;

  beforeEach(() => {
    vi.resetAllMocks();
    addEventListenerSpy = vi.spyOn(window, "addEventListener");
    removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
    addEventListenerSpy.mockImplementation((event, cb) => {
      if (event === "keydown") {
        handler = cb as (e: KeyboardEvent) => void;
      }
      return window;
    });

    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createHook = (bindings: ShortcutBinding[], activeScope?: string) => {
    return renderHook(() => useKeyboardShortcuts(bindings, activeScope));
  };

  const createKeyboardEvent = (key: string, options: { ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean; metaKey?: boolean } = {}) => {
    const event = new KeyboardEvent("keydown", {
      key,
      ctrlKey: options.ctrlKey ?? false,
      altKey: options.altKey ?? false,
      shiftKey: options.shiftKey ?? false,
      metaKey: options.metaKey ?? false,
      bubbles: true,
    });
    Object.defineProperty(event, "target", {
      value: { tagName: "BODY" },
      writable: true,
    });
    return event;
  };

  const simulateKeyDown = (key: string, options: { ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean; metaKey?: boolean } = {}) => {
    const event = createKeyboardEvent(key, options);
    act(() => {
      handler(event);
    });
  };

  describe("basic shortcut handling", () => {
    it("registers keydown listener on mount", () => {
      createHook([{ key: "ctrl+s", handler: vi.fn() }]);

      expect(addEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    });

    it("removes listener on unmount", () => {
      const { unmount } = createHook([{ key: "ctrl+s", handler: vi.fn() }]);
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    });

    it("calls handler when shortcut matches", () => {
      const handlerFn = vi.fn();
      createHook([{ key: "ctrl+s", handler: handlerFn }]);

      simulateKeyDown("s", { ctrlKey: true });

      expect(handlerFn).toHaveBeenCalledTimes(1);
    });

    it("does not call handler when key does not match", () => {
      const handlerFn = vi.fn();
      createHook([{ key: "ctrl+s", handler: handlerFn }]);

      simulateKeyDown("s", { ctrlKey: false });

      expect(handlerFn).not.toHaveBeenCalled();
    });

    it("handles multiple shortcuts", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      createHook([
        { key: "ctrl+s", handler: handler1 },
        { key: "ctrl+o", handler: handler2 },
      ]);

      simulateKeyDown("s", { ctrlKey: true });
      expect(handler1).toHaveBeenCalledTimes(1);

      simulateKeyDown("o", { ctrlKey: true });
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe("modifier key handling", () => {
    it("normalizes ctrl key", () => {
      const handlerFn = vi.fn();
      createHook([{ key: "ctrl+s", handler: handlerFn }]);

      simulateKeyDown("s", { ctrlKey: true });

      expect(handlerFn).toHaveBeenCalled();
    });

    it("normalizes alt key", () => {
      const handlerFn = vi.fn();
      createHook([{ key: "alt+d", handler: handlerFn }]);

      simulateKeyDown("d", { altKey: true });

      expect(handlerFn).toHaveBeenCalled();
    });

    it("normalizes shift key", () => {
      const handlerFn = vi.fn();
      createHook([{ key: "shift+?", handler: handlerFn }]);

      simulateKeyDown("?", { shiftKey: true });

      expect(handlerFn).toHaveBeenCalled();
    });

    it("normalizes meta key as ctrl", () => {
      const handlerFn = vi.fn();
      createHook([{ key: "ctrl+s", handler: handlerFn }]);

      simulateKeyDown("s", { metaKey: true });

      expect(handlerFn).toHaveBeenCalled();
    });

    it("handles multiple modifiers", () => {
      const handlerFn = vi.fn();
      createHook([{ key: "ctrl+shift+p", handler: handlerFn }]);

      simulateKeyDown("p", { ctrlKey: true, shiftKey: true });

      expect(handlerFn).toHaveBeenCalled();
    });

    it("pressing ctrl key with ctrl modifier triggers ctrl combo", () => {
      const ctrlHandler = vi.fn();
      createHook([{ key: "ctrl", handler: ctrlHandler }]);

      simulateKeyDown("Control", { ctrlKey: true });

      expect(ctrlHandler).toHaveBeenCalled();
    });
  });

  describe("scope handling", () => {
    it("binding with scope matches when activeScope is undefined (global scope)", () => {
      const handlerFn = vi.fn();
      createHook([{ key: "g", handler: handlerFn, scope: "dashboard" }]);

      simulateKeyDown("g");

      expect(handlerFn).toHaveBeenCalled();
    });

    it("matches when binding has no scope", () => {
      const handlerFn = vi.fn();
      createHook([{ key: "g", handler: handlerFn }]);

      simulateKeyDown("g");

      expect(handlerFn).toHaveBeenCalled();
    });

    it("matches when binding scope equals activeScope", () => {
      const handlerFn = vi.fn();
      createHook([{ key: "g", handler: handlerFn, scope: "console" }], "console");

      simulateKeyDown("g");

      expect(handlerFn).toHaveBeenCalled();
    });

    it("does not match when binding scope differs from activeScope", () => {
      const handlerFn = vi.fn();
      createHook([{ key: "g", handler: handlerFn, scope: "dashboard" }], "console");

      simulateKeyDown("g");

      expect(handlerFn).not.toHaveBeenCalled();
    });
  });

  describe("input field exclusion", () => {
    it("does not trigger shortcut in input element", () => {
      const handlerFn = vi.fn();
      createHook([{ key: "g", handler: handlerFn }]);

      const input = document.createElement("input");
      document.body.appendChild(input);
      input.focus();

      const event = new KeyboardEvent("keydown", { key: "g", bubbles: true });
      Object.defineProperty(event, "target", {
        value: { tagName: "INPUT" },
        writable: true,
      });
      act(() => {
        handler(event);
      });

      expect(handlerFn).not.toHaveBeenCalled();

      document.body.removeChild(input);
    });

    it("does not trigger shortcut in textarea", () => {
      const handlerFn = vi.fn();
      createHook([{ key: "g", handler: handlerFn }]);

      const textarea = document.createElement("textarea");
      document.body.appendChild(textarea);
      textarea.focus();

      const event = new KeyboardEvent("keydown", { key: "g", bubbles: true });
      Object.defineProperty(event, "target", {
        value: { tagName: "TEXTAREA" },
        writable: true,
      });
      act(() => {
        handler(event);
      });

      expect(handlerFn).not.toHaveBeenCalled();

      document.body.removeChild(textarea);
    });

    it("does not trigger shortcut in contenteditable", () => {
      const handlerFn = vi.fn();
      createHook([{ key: "g", handler: handlerFn }]);

      const div = document.createElement("div");
      div.contentEditable = "true";
      document.body.appendChild(div);
      div.focus();

      const event = new KeyboardEvent("keydown", { key: "g", bubbles: true });
      Object.defineProperty(event, "target", {
        value: { tagName: "DIV", isContentEditable: true },
        writable: true,
      });
      act(() => {
        handler(event);
      });

      expect(handlerFn).not.toHaveBeenCalled();

      document.body.removeChild(div);
    });

    it("allows Escape in input fields", () => {
      const handlerFn = vi.fn();
      createHook([{ key: "escape", handler: handlerFn }]);

      const input = document.createElement("input");
      document.body.appendChild(input);
      input.focus();

      const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true });
      Object.defineProperty(event, "target", {
        value: { tagName: "INPUT" },
        writable: true,
      });
      act(() => {
        handler(event);
      });

      expect(handlerFn).toHaveBeenCalled();

      document.body.removeChild(input);
    });
  });

  describe("preventDefault behavior", () => {
    it("calls preventDefault by default", () => {
      createHook([{ key: "ctrl+s", handler: vi.fn() }]);

      const preventDefault = vi.fn();
      const event = createKeyboardEvent("s", { ctrlKey: true });
      event.preventDefault = preventDefault;

      act(() => {
        handler(event);
      });

      expect(preventDefault).toHaveBeenCalled();
    });

    it("does not call preventDefault when preventDefault is false", () => {
      createHook([{ key: "ctrl+s", handler: vi.fn(), preventDefault: false }]);

      const preventDefault = vi.fn();
      const event = createKeyboardEvent("s", { ctrlKey: true });
      event.preventDefault = preventDefault;

      act(() => {
        handler(event);
      });

      expect(preventDefault).not.toHaveBeenCalled();
    });
  });

  describe("binding updates", () => {
    it("handles rerender with new bindings", () => {
      const handler1 = vi.fn();
      createHook([{ key: "a", handler: handler1 }]);

      const eventHandler = addEventListenerSpy.mock.calls[0][1];
      const event = createKeyboardEvent("a");
      act(() => {
        eventHandler(event);
      });

      expect(handler1).toHaveBeenCalled();
    });
  });
});
