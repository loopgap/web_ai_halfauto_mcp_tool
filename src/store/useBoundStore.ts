// ═══════════════════════════════════════════════════════════
// Bound Store — Combined Zustand Store with Slices Pattern
// §3 前端闭环: Store 全局状态与 reducer (Slices Pattern)
// ═══════════════════════════════════════════════════════════

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";

import type {
  Skill,
  Workflow,
  TargetsConfig,
  TargetHealth,
  RouterRulesConfig,
  RunRecord,
  ErrorDefinition,
  PageState,
  ApiError,
  ChangeRecord,
  QualityGateResult,
  ReleaseDecisionRecord,
  GovernanceValidationReport,
} from "../types";
import { createDomainSlice, selectSkills, selectWorkflows, selectTargets, selectRuns, selectErrorCatalog } from "./slices/domainSlice";
import { createUISlice, selectPageStates, selectLastError, selectInitialized, selectPageState } from "./slices/uiSlice";
import { createGovSlice, selectGovernanceChanges, selectGovernanceQuality, selectGovernanceDecisions, selectGovernanceReports } from "./slices/govSlice";

// ───────── Combined State Types ─────────

export interface DomainState {
  // State
  skills: Skill[];
  workflows: Workflow[];
  targets: TargetsConfig | null;
  health: TargetHealth[];
  routerRules: RouterRulesConfig | null;
  runs: RunRecord[];
  errorCatalog: ErrorDefinition[];
  // Actions
  setSkills: (skills: Skill[]) => void;
  setWorkflows: (workflows: Workflow[]) => void;
  setTargets: (targets: TargetsConfig) => void;
  setHealth: (health: TargetHealth[]) => void;
  setRouterRules: (routerRules: RouterRulesConfig) => void;
  setRuns: (runs: RunRecord[]) => void;
  addRun: (run: RunRecord) => void;
  updateRun: (id: string, updates: Partial<RunRecord>) => void;
  setErrorCatalog: (errorCatalog: ErrorDefinition[]) => void;
}

export interface UIState {
  // State
  pageStates: Record<string, PageState>;
  stateHistory: import("../types").StateTransition[];
  lastError: ApiError | null;
  initialized: boolean;
  // Actions
  setPageState: (page: string, pageState: PageState) => void;
  setError: (error: ApiError | null) => void;
  setInitialized: (initialized: boolean) => void;
}

export interface GovState {
  // State
  governanceChanges: ChangeRecord[];
  governanceQuality: QualityGateResult[];
  governanceDecisions: ReleaseDecisionRecord[];
  governanceReports: GovernanceValidationReport[];
  // Actions
  upsertGovChange: (change: ChangeRecord) => void;
  upsertGovQuality: (quality: QualityGateResult) => void;
  upsertGovDecision: (decision: ReleaseDecisionRecord) => void;
  addGovReport: (report: GovernanceValidationReport) => void;
}

export type AppState = DomainState & UIState & GovState;

// ───────── Legacy Action Types (Backward Compatibility) ─────────

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

// ───────── Store Factory ─────────

type StoreType = AppState & { dispatch: (action: AppAction) => void };

export const useBoundStore = create<StoreType>()(
  subscribeWithSelector((set, get) => {
    // Create slices with combined set/get
    // Cast get to the expected slice type - each slice only accesses its own state
    const domainSlice = createDomainSlice(set, get as () => import("./slices/domainSlice").DomainSlice);
    const uiSlice = createUISlice(set, get as () => import("./slices/uiSlice").UISlice);
    const govSlice = createGovSlice(set, get as () => import("./slices/govSlice").GovSlice);

    return {
      ...domainSlice,
      ...uiSlice,
      ...govSlice,

      // ─── dispatch: Maps legacy actions to slice methods ───
      dispatch: (action: AppAction) => {
        switch (action.type) {
          case "SET_SKILLS":
            domainSlice.setSkills(action.payload);
            break;
          case "SET_WORKFLOWS":
            domainSlice.setWorkflows(action.payload);
            break;
          case "SET_TARGETS":
            domainSlice.setTargets(action.payload);
            break;
          case "SET_HEALTH":
            domainSlice.setHealth(action.payload);
            break;
          case "SET_ROUTER_RULES":
            domainSlice.setRouterRules(action.payload);
            break;
          case "SET_RUNS":
            domainSlice.setRuns(action.payload);
            break;
          case "ADD_RUN":
            domainSlice.addRun(action.payload);
            break;
          case "UPDATE_RUN":
            domainSlice.updateRun(action.payload.id, action.payload.updates);
            break;
          case "SET_ERROR_CATALOG":
            domainSlice.setErrorCatalog(action.payload);
            break;
          case "UPSERT_GOV_CHANGE":
            govSlice.upsertGovChange(action.payload);
            break;
          case "UPSERT_GOV_QUALITY":
            govSlice.upsertGovQuality(action.payload);
            break;
          case "UPSERT_GOV_DECISION":
            govSlice.upsertGovDecision(action.payload);
            break;
          case "ADD_GOV_REPORT":
            govSlice.addGovReport(action.payload);
            break;
          case "SET_PAGE_STATE":
            uiSlice.setPageState(action.payload.page, action.payload.state);
            break;
          case "SET_ERROR":
            uiSlice.setError(action.payload);
            break;
          case "SET_INITIALIZED":
            uiSlice.setInitialized(action.payload);
            break;
        }
      },
    };
  })
);

// ───────── Typed Selectors with useShallow ─────────

/** Skills selector - returns Skill[] */
export function useSkills(): Skill[] {
  return useBoundStore(selectSkills);
}

/** Workflows selector - returns Workflow[] */
export function useWorkflows(): Workflow[] {
  return useBoundStore(selectWorkflows);
}

/** Targets selector - returns TargetsConfig | null */
export function useTargets(): TargetsConfig | null {
  return useBoundStore(selectTargets);
}

/** Runs selector - returns RunRecord[] */
export function useRuns(): RunRecord[] {
  return useBoundStore(selectRuns);
}

/** Error catalog selector - returns ErrorDefinition[] */
export function useErrorCatalog(): ErrorDefinition[] {
  return useBoundStore(selectErrorCatalog);
}

/** Page states selector - returns Record<string, PageState> */
export function usePageStates(): Record<string, PageState> {
  return useBoundStore(useShallow(selectPageStates));
}

/** Last error selector - returns ApiError | null */
export function useLastError(): ApiError | null {
  return useBoundStore(selectLastError);
}

/** Initialized selector - returns boolean */
export function useInitialized(): boolean {
  return useBoundStore(selectInitialized);
}

/** Page state for specific page - returns PageState */
export function usePageState(page: string): PageState {
  return useBoundStore(selectPageState(page));
}

/** Governance changes selector */
export function useGovernanceChanges(): ChangeRecord[] {
  return useBoundStore(useShallow(selectGovernanceChanges));
}

/** Governance quality selector */
export function useGovernanceQuality(): QualityGateResult[] {
  return useBoundStore(useShallow(selectGovernanceQuality));
}

/** Governance decisions selector */
export function useGovernanceDecisions(): ReleaseDecisionRecord[] {
  return useBoundStore(useShallow(selectGovernanceDecisions));
}

/** Governance reports selector */
export function useGovernanceReports(): GovernanceValidationReport[] {
  return useBoundStore(useShallow(selectGovernanceReports));
}