// ═══════════════════════════════════════════════════════════
// UI Slice — pageStates, stateHistory, lastError, initialized
// §3 前端闭环: Store 全局状态与 reducer
// ═══════════════════════════════════════════════════════════

import type { PageState, StateTransition, ApiError } from "../../types";
import { restoreUIState } from "../../domain/persistence";

// ───────── State ─────────

export interface UISliceState {
  pageStates: Record<string, PageState>;
  stateHistory: StateTransition[];
  lastError: ApiError | null;
  initialized: boolean;
}

const defaultPageStates: Record<string, PageState> = {
  dashboard: "idle",
  skills: "idle",
  workflows: "idle",
  console: "idle",
  archive: "idle",
  scheduler: "idle",
  reports: "idle",
  targets: "idle",
  settings: "idle",
};

const restored = restoreUIState();

const initialUIState: UISliceState = {
  pageStates: { ...defaultPageStates, ...restored.pageStates },
  stateHistory: [],
  lastError: null,
  initialized: false,
};

// ───────── Valid Transitions ─────────

const VALID_PAGE_TRANSITIONS: Record<string, string[]> = {
  idle: ["loading", "validating", "editing"],
  loading: ["ready", "error"],
  ready: ["editing", "loading", "validating", "idle"],
  editing: ["saving", "ready", "error"],
  saving: ["ready", "error"],
  validating: ["dispatching", "error", "ready"],
  dispatching: ["waiting_capture", "error"],
  waiting_capture: ["archived", "error", "dispatching"],
  archived: ["idle", "ready"],
  error: ["idle", "loading", "ready", "validating", "editing"],
};

function isValidPageTransition(from: string, to: string): boolean {
  return (VALID_PAGE_TRANSITIONS[from] ?? []).includes(to);
}

// ───────── Full Slice Type (State + Actions) ─────────

export interface UISlice extends UISliceState {
  setPageState: (page: string, pageState: PageState) => void;
  setError: (error: ApiError | null) => void;
  setInitialized: (initialized: boolean) => void;
}

// ───────── Slice Factory ─────────

type UISet = (partial: Partial<UISlice> | ((state: UISlice) => Partial<UISlice>)) => void;

export function createUISlice(set: UISet, _get: () => UISlice): UISlice {
  return {
    ...initialUIState,

    // ─── Page State ───
    setPageState: (page: string, pageState: PageState) =>
      set((state) => {
        const prevState = state.pageStates[page] || "idle";
        if (prevState !== pageState && !isValidPageTransition(prevState, pageState)) {
          console.warn(`[§10] 非标准页面转换: ${page} ${prevState} → ${pageState}`);
        }
        const transition: StateTransition = {
          from: prevState,
          to: pageState,
          action: page,
          timestamp: Date.now(),
        };
        return {
          pageStates: { ...state.pageStates, [page]: pageState },
          stateHistory: [...state.stateHistory.slice(-99), transition],
        };
      }),

    // ─── Error ───
    setError: (error: ApiError | null) => set({ lastError: error }),

    // ─── Initialized ───
    setInitialized: (initialized: boolean) => set({ initialized }),
  };
}

// ───────── Selectors ─────────

export const selectPageStates = (state: UISliceState): Record<string, PageState> => state.pageStates;
export const selectStateHistory = (state: UISliceState): StateTransition[] => state.stateHistory;
export const selectLastError = (state: UISliceState): ApiError | null => state.lastError;
export const selectInitialized = (state: UISliceState): boolean => state.initialized;

export const selectPageState = (page: string) => (state: UISliceState): PageState =>
  state.pageStates[page] ?? "idle";