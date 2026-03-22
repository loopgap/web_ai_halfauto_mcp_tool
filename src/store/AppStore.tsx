// ═══════════════════════════════════════════════════════════
// Global Store — route.md §3 前端闭环: Store 全局状态与 reducer
// ═══════════════════════════════════════════════════════════

import { createContext, useContext, useReducer, useCallback, useRef, useEffect, type Dispatch, type ReactNode } from "react";
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

// ───────── State ─────────

export interface AppState {
  skills: Skill[];
  workflows: Workflow[];
  targets: TargetsConfig | null;
  health: TargetHealth[];
  routerRules: RouterRulesConfig | null;
  runs: RunRecord[];
  errorCatalog: ErrorDefinition[];
  // 页面状态机
  pageStates: Record<string, PageState>;
  stateHistory: StateTransition[];
  // 全局错误
  lastError: ApiError | null;
  // 加载标记
  initialized: boolean;
  governanceChanges: ChangeRecord[];
  governanceQuality: QualityGateResult[];
  governanceDecisions: ReleaseDecisionRecord[];
  governanceReports: GovernanceValidationReport[];
}

const defaultPageStates: Record<string, PageState> = {
  dashboard: "idle",
  skills: "idle",
  workflows: "idle",
  console: "idle",
  archive: "idle",
  targets: "idle",
  settings: "idle",
};

// 从 localStorage 恢复 UI 状态
const restored = restoreUIState();

const initialState: AppState = {
  skills: [],
  workflows: [],
  targets: null,
  health: [],
  routerRules: null,
  runs: [],
  errorCatalog: [],
  pageStates: { ...defaultPageStates, ...restored.pageStates },
  stateHistory: [],
  lastError: null,
  initialized: false,
  governanceChanges: [],
  governanceQuality: [],
  governanceDecisions: [],
  governanceReports: [],
};

// 持久化中间件
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

// ───────── Reducer ─────────

// §3 + §10: 页面状态机合法转换表
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

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_SKILLS":
      return { ...state, skills: action.payload };
    case "SET_WORKFLOWS":
      return { ...state, workflows: action.payload };
    case "SET_TARGETS":
      return { ...state, targets: action.payload };
    case "SET_HEALTH":
      return { ...state, health: action.payload };
    case "SET_ROUTER_RULES":
      return { ...state, routerRules: action.payload };
    case "SET_RUNS":
      return { ...state, runs: action.payload };
    case "ADD_RUN":
      return { ...state, runs: [action.payload, ...state.runs] };
    case "UPDATE_RUN": {
      // §10: 状态约束 — done/closed 后禁止改正文
      const existing = state.runs.find((r) => r.id === action.payload.id);
      if (existing && (existing.status === "done" || existing.status === "closed")) {
        if (action.payload.updates.prompt && action.payload.updates.prompt !== existing.prompt) {
          console.warn("[§10] 已完成 Run 禁止修改 prompt:", existing.id);
          return state;
        }
      }
      return {
        ...state,
        runs: state.runs.map((r) =>
          r.id === action.payload.id ? { ...r, ...action.payload.updates } : r
        ),
      };
    }
    case "SET_ERROR_CATALOG":
      return { ...state, errorCatalog: action.payload };
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
    case "ADD_GOV_REPORT":
      return { ...state, governanceReports: [action.payload, ...state.governanceReports].slice(0, 100) };
    case "SET_PAGE_STATE": {
      const prevState = state.pageStates[action.payload.page] || "idle";
      // §3 + §10: 状态迁移校验 (warn but allow for flexibility)
      if (prevState !== action.payload.state && !isValidPageTransition(prevState, action.payload.state)) {
        console.warn(`[§10] 非标准页面转换: ${action.payload.page} ${prevState} → ${action.payload.state}`);
      }
      const transition: StateTransition = {
        from: prevState,
        to: action.payload.state,
        action: action.payload.page,
        timestamp: Date.now(),
      };
      return {
        ...state,
        pageStates: {
          ...state.pageStates,
          [action.payload.page]: action.payload.state,
        },
        stateHistory: [...state.stateHistory.slice(-99), transition],
      };
    }
    case "SET_ERROR":
      return { ...state, lastError: action.payload };
    case "SET_INITIALIZED":
      return { ...state, initialized: action.payload };
    default:
      return state;
  }
}

// ───────── Context ─────────

const AppStateContext = createContext<AppState>(initialState);
const AppDispatchContext = createContext<Dispatch<AppAction>>(() => {});

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(appReducer, initialState);

  // §100 性能优化: dispatch 稳定引用，不依赖 state，避免级联重渲染
  const dispatch: Dispatch<AppAction> = useCallback((action: AppAction) => {
    rawDispatch(action);
  }, []);

  // 持久化: 通过 useEffect + useRef 节流写入，不影响 dispatch 稳定性
  const stateRef = useRef(state);
  stateRef.current = state;
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    persistMiddleware(state, { type: "SET_INITIALIZED", payload: state.initialized });
  }, [state]);

  // §38 订阅后端 workbench-event 事件
  useEventBus(dispatch);
  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>
        {children}
      </AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  return useContext(AppStateContext);
}

export function useAppDispatch() {
  return useContext(AppDispatchContext);
}
