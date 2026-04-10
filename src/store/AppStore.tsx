// ═══════════════════════════════════════════════════════════
// Global Store — route.md §3 前端闭环: Store 全局状态与 reducer (Decoupled)
// ═══════════════════════════════════════════════════════════

import { useEffect, type ReactNode } from "react";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { useEventBus } from "../hooks/useEventBus";
import { restoreUIState, createPersistMiddleware } from "../domain/persistence";
import type {
  Skill,
  Workflow,
  TargetsConfig,
  TargetHealth,
  RouterRulesConfig,
  RunRecord,
  ErrorDefinition,
  PageState,
  StateTransition,
  ApiError,
  ChangeRecord,
  QualityGateResult,
  ReleaseDecisionRecord,
  GovernanceValidationReport,
} from "../types";

// ───────── State Slices ─────────

export interface DomainState {
  skills: Skill[];
  workflows: Workflow[];
  targets: TargetsConfig | null;
  health: TargetHealth[];
  routerRules: RouterRulesConfig | null;
  runs: RunRecord[];
  errorCatalog: ErrorDefinition[];
}

export interface UIState {
  pageStates: Record<string, PageState>;
  stateHistory: StateTransition[];
  lastError: ApiError | null;
  initialized: boolean;
}

export interface GovState {
  governanceChanges: ChangeRecord[];
  governanceQuality: QualityGateResult[];
  governanceDecisions: ReleaseDecisionRecord[];
  governanceReports: GovernanceValidationReport[];
}

export type AppState = DomainState & UIState & GovState;

const defaultPageStates: Record<string, PageState> = {
  dashboard: "idle",
  skills: "idle",
  workflows: "idle",
  console: "idle",
  archive: "idle",
  targets: "idle",
  settings: "idle",
};

const restored = restoreUIState();

const initialDomainState: DomainState = {
  skills: [],
  workflows: [],
  targets: null,
  health: [],
  routerRules: null,
  runs: [],
  errorCatalog: [],
};

const initialUIState: UIState = {
  pageStates: { ...defaultPageStates, ...restored.pageStates },
  stateHistory: [],
  lastError: null,
  initialized: false,
};

const initialGovState: GovState = {
  governanceChanges: [],
  governanceQuality: [],
  governanceDecisions: [],
  governanceReports: [],
};

const persistMiddleware = createPersistMiddleware(2000);

// ───────── Actions ─────────

export type AppAction =
  | { type: "SET_SKILLS"; payload: Skill[] }
  | { type: "SET_WORKFLOWS"; payload: Workflow[] }
  | { type: "SET_TARGETS"; payload: TargetsConfig }
  | { type: "SET_HEALTH"; payload: TargetHealth[] }
  | { type: "SET_ROUTER_RULES"; payload: RouterRulesConfig }
  | { type: "SET_RUNS"; payload: RunRecord[] }
  | { type: "ADD_RUN"; payload: RunRecord }
  | { type: "UPDATE_RUN"; payload: { id: string; updates: Partial<RunRecord> } }
  | { type: "SET_ERROR_CATALOG"; payload: ErrorDefinition[] }
  | { type: "UPSERT_GOV_CHANGE"; payload: ChangeRecord }
  | { type: "UPSERT_GOV_QUALITY"; payload: QualityGateResult }
  | { type: "UPSERT_GOV_DECISION"; payload: ReleaseDecisionRecord }
  | { type: "ADD_GOV_REPORT"; payload: GovernanceValidationReport }
  | { type: "SET_PAGE_STATE"; payload: { page: string; state: PageState } }
  | { type: "SET_ERROR"; payload: ApiError | null }
  | { type: "SET_INITIALIZED"; payload: boolean };

// ───────── Reducers ─────────

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

function domainReducer(state: DomainState, action: AppAction): DomainState {
  switch (action.type) {
    case "SET_SKILLS": return { ...state, skills: action.payload };
    case "SET_WORKFLOWS": return { ...state, workflows: action.payload };
    case "SET_TARGETS": return { ...state, targets: action.payload };
    case "SET_HEALTH": return { ...state, health: action.payload };
    case "SET_ROUTER_RULES": return { ...state, routerRules: action.payload };
    case "SET_RUNS": return { ...state, runs: action.payload };
    case "ADD_RUN": return { ...state, runs: [action.payload, ...state.runs] };
    case "UPDATE_RUN": {
      const existing = state.runs.find((r) => r.id === action.payload.id);
      if (existing && (existing.status === "done" || existing.status === "closed")) {
        if (action.payload.updates.prompt && action.payload.updates.prompt !== existing.prompt) {
          return state;
        }
      }
      return {
        ...state,
        runs: state.runs.map((r) => r.id === action.payload.id ? { ...r, ...action.payload.updates } : r),
      };
    }
    case "SET_ERROR_CATALOG": return { ...state, errorCatalog: action.payload };
    default: return state;
  }
}

function uiReducer(state: UIState, action: AppAction): UIState {
  switch (action.type) {
    case "SET_PAGE_STATE": {
      const prevState = state.pageStates[action.payload.page] || "idle";
      if (prevState !== action.payload.state && !isValidPageTransition(prevState, action.payload.state)) {
        console.warn(`[§10] 非标准页面转换: ${action.payload.page} ${prevState} → ${action.payload.state}`);
      }
      const transition: StateTransition = { from: prevState, to: action.payload.state, action: action.payload.page, timestamp: Date.now() };
      return {
        ...state,
        pageStates: { ...state.pageStates, [action.payload.page]: action.payload.state },
        stateHistory: [...state.stateHistory.slice(-99), transition],
      };
    }
    case "SET_ERROR": return { ...state, lastError: action.payload };
    case "SET_INITIALIZED": return { ...state, initialized: action.payload };
    default: return state;
  }
}

function govReducer(state: GovState, action: AppAction): GovState {
  switch (action.type) {
    case "UPSERT_GOV_CHANGE": {
      const next = state.governanceChanges.filter((x) => x.change_id !== action.payload.change_id);
      return { ...state, governanceChanges: [action.payload, ...next].slice(0, 200) };
    }
    case "UPSERT_GOV_QUALITY": {
      const next = state.governanceQuality.filter((x) => x.change_id !== action.payload.change_id);
      return { ...state, governanceQuality: [action.payload, ...next].slice(0, 200) };
    }
    case "UPSERT_GOV_DECISION": {
      const next = state.governanceDecisions.filter((x) => x.change_id !== action.payload.change_id);
      return { ...state, governanceDecisions: [action.payload, ...next].slice(0, 200) };
    }
    case "ADD_GOV_REPORT": return { ...state, governanceReports: [action.payload, ...state.governanceReports].slice(0, 100) };
    default: return state;
  }
}

// ───────── Zustand Store ─────────

export const useAppStore = create<AppState & { dispatch: (action: AppAction) => void }>()(
  subscribeWithSelector((set) => ({
    ...initialDomainState,
    ...initialUIState,
    ...initialGovState,
    dispatch: (action) =>
      set((state) => {
        const s1 = domainReducer(state, action);
        const s2 = uiReducer(s1 as any, action);
        const s3 = govReducer(s2 as any, action);
        return s3 as any;
      }),
  }))
);

// ───────── Provider & Hooks ─────────

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppStore((s) => s.dispatch);

  useEffect(() => {
    const unsub = useAppStore.subscribe(
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

export function useDomainState() {
  return useAppStore();
}

export function useUIState() {
  return useAppStore();
}

export function useGovState() {
  return useAppStore();
}

export function useAppDispatch() {
  return useAppStore((s) => s.dispatch);
}

export function useAppState() {
  return useAppStore();
}
