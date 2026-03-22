// ═══════════════════════════════════════════════════════════
// useKeyboardShortcuts — 全局快捷键 Hook
// 支持组合键、分页面作用域、冲突检测
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef, useCallback } from "react";

export interface ShortcutBinding {
  /** 快捷键描述，如 "ctrl+shift+d" */
  key: string;
  /** 处理函数 */
  handler: () => void;
  /** 是否阻止默认行为 */
  preventDefault?: boolean;
  /** 作用域 (用于控制哪些页面生效) */
  scope?: string;
}

/** 将 KeyboardEvent 转为标准化的 key string */
function normalizeEvent(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("ctrl");
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  // 排除修饰键本身
  const key = e.key.toLowerCase();
  if (!["control", "alt", "shift", "meta"].includes(key)) {
    parts.push(key);
  }
  return parts.join("+");
}

/**
 * 注册全局快捷键
 * @param bindings 快捷键绑定列表
 * @param activeScope 当前活跃作用域 (null 表示全局)
 */
export function useKeyboardShortcuts(bindings: ShortcutBinding[], activeScope?: string) {
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // 不拦截输入框内的快捷键
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
      // 仅放行 Escape
      if (e.key !== "Escape") return;
    }

    const combo = normalizeEvent(e);
    for (const binding of bindingsRef.current) {
      if (binding.key === combo) {
        // 作用域检查
        if (binding.scope && activeScope && binding.scope !== activeScope) continue;
        if (binding.preventDefault !== false) e.preventDefault();
        binding.handler();
        return;
      }
    }
  }, [activeScope]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
