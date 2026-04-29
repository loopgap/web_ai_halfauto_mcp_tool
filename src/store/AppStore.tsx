// ═══════════════════════════════════════════════════════════
// AppStore — Legacy API Wrapper for Zustand Slices
// §3 前端闭环: Store 全局状态与 reducer (Slices Pattern)
// ═══════════════════════════════════════════════════════════
//
// 此文件是向后兼容的封装层。所有实际逻辑已迁移到 slices/ 目录。
// 新代码应直接从 useBoundStore 导入所需内容。
// ═══════════════════════════════════════════════════════════

import { useEffect, type ReactNode } from "react";
import { useBoundStore } from "./useBoundStore";
import { useEventBus } from "../hooks/useEventBus";
import { createPersistMiddleware } from "../domain/persistence";

// ───────── Re-export everything from useBoundStore ─────────

export {
  useBoundStore,
  useSkills,
  useWorkflows,
  useTargets,
  useRuns,
  useErrorCatalog,
  usePageStates,
  useLastError,
  useInitialized,
  usePageState,
  useGovernanceChanges,
  useGovernanceQuality,
  useGovernanceDecisions,
  useGovernanceReports,
} from "./useBoundStore";

export type { AppState, DomainState, UIState, GovState, AppAction } from "./useBoundStore";

// ───────── Backward Compatibility Aliases ─────────

/** @deprecated Use useBoundStore instead */
export const useAppStore = useBoundStore;

/** @deprecated Use individual selectors instead */
export function useDomainState() {
  return useBoundStore();
}

/** @deprecated Use individual selectors instead */
export function useUIState() {
  return useBoundStore();
}

/** @deprecated Use individual selectors instead */
export function useGovState() {
  return useBoundStore();
}

/** @deprecated Use useBoundStore((s) => s.dispatch) instead */
export function useAppDispatch() {
  return useBoundStore((s) => s.dispatch);
}

/** @deprecated Use useBoundStore() or individual selectors instead */
export function useAppState() {
  return useBoundStore();
}

// ───────── Provider & Hooks ─────────

const persistMiddleware = createPersistMiddleware(2000);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const dispatch = useBoundStore((s) => s.dispatch);

  useEffect(() => {
    const unsub = useBoundStore.subscribe(
      (state) => state,
      (state) => {
        persistMiddleware(state, { type: "SET_INITIALIZED", payload: state.initialized });
      },
      { fireImmediately: false }
    );
    return unsub;
  }, []);

  useEventBus(dispatch);

  return <>{children}</>;
}