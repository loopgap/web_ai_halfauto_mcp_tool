// ═══════════════════════════════════════════════════════════
// State Persistence — 轻量级 UI 状态持久化 (localStorage)
// 防止刷新/重启后丢失用户偏好和页面上下文
// ═══════════════════════════════════════════════════════════

import type { AppState, AppAction } from "../store/AppStore";
import type { PageState } from "../types";

const STORAGE_KEY = "ai-workbench:ui-state";
const VERSION = 1;

/** 持久化的数据子集 (不含大对象如 runs[]、skills[]) */
interface PersistedState {
  _v: number;
  pageStates: Record<string, PageState>;
  lastRoute: string;
}

/** 序列化当前需要保存的 UI 状态到 localStorage */
export function persistUIState(state: AppState): void {
  try {
    const data: PersistedState = {
      _v: VERSION,
      pageStates: state.pageStates,
      lastRoute: window.location.hash.replace("#", "") || "/",
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage 可能满了或 Safari 隐私模式，忽略
  }
}

/** 从 localStorage 恢复 UI 状态 */
export function restoreUIState(): Partial<Pick<AppState, "pageStates">> & { lastRoute?: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as PersistedState;
    if (data._v !== VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      return {};
    }
    return {
      pageStates: data.pageStates,
      lastRoute: data.lastRoute,
    };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return {};
  }
}

/** 清除持久化数据 */
export function clearPersistedState(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * 创建一个 reducer 增强器：在每次 dispatch 后自动持久化 UI 状态。
 * 使用节流避免频繁写入 (默认 2 秒)。
 */
export function createPersistMiddleware(throttleMs = 2000) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return function onDispatch(state: AppState, _action: AppAction): void {
    if (timer) return;
    timer = setTimeout(() => {
      persistUIState(state);
      timer = null;
    }, throttleMs);
  };
}
