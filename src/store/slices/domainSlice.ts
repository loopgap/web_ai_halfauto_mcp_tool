// ═══════════════════════════════════════════════════════════
// Domain Slice — skills, workflows, targets, runs, errorCatalog
// §3 前端闭环: Store 全局状态与 reducer (Decoupled)
// ═══════════════════════════════════════════════════════════

import type {
  Skill,
  Workflow,
  TargetsConfig,
  TargetHealth,
  RouterRulesConfig,
  RunRecord,
  ErrorDefinition,
} from "../../types";

// ───────── State ─────────

export interface DomainSliceState {
  skills: Skill[];
  workflows: Workflow[];
  targets: TargetsConfig | null;
  health: TargetHealth[];
  routerRules: RouterRulesConfig | null;
  runs: RunRecord[];
  errorCatalog: ErrorDefinition[];
}

// ───────── Full Slice Type (State + Actions) ─────────

export interface DomainSlice extends DomainSliceState {
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

const initialDomainState: DomainSliceState = {
  skills: [],
  workflows: [],
  targets: null,
  health: [],
  routerRules: null,
  runs: [],
  errorCatalog: [],
};

// ───────── Slice Factory ─────────

export function createDomainSlice(set: (partial: Partial<DomainSlice>) => void, get: () => DomainSlice): DomainSlice {
  return {
    ...initialDomainState,

    // ─── Setters ───

    setSkills: (skills: Skill[]) => set({ skills }),

    setWorkflows: (workflows: Workflow[]) => set({ workflows }),

    setTargets: (targets: TargetsConfig) => set({ targets }),

    setHealth: (health: TargetHealth[]) => set({ health }),

    setRouterRules: (routerRules: RouterRulesConfig) => set({ routerRules }),

    setRuns: (runs: RunRecord[]) => set({ runs }),

    // ─── ADD_RUN: Decoupled from skill/target updates ───
    // §P3-4 lastUsedAt 更新通过事件总线解耦，不再直接修改其他 domain 状态
    addRun: (run: RunRecord) => {
      const state = get();
      const now = Date.now();
      // runs 数组淘汰机制：限制最大 200 条，清除超过 24 小时的条目
      const oneDayMs = 24 * 60 * 60 * 1000;
      const filteredRuns = state.runs
        .filter((r: RunRecord) => now - r.ts_start < oneDayMs)
        .slice(0, 199); // 预留一个新条目的空间
      set({ runs: [run, ...filteredRuns] });
    },

    // ─── UPDATE_RUN ───
    updateRun: (id: string, updates: Partial<RunRecord>) => {
      const state = get();
      const existing = state.runs.find((r: RunRecord) => r.id === id);
      if (existing && (existing.status === "done" || existing.status === "closed")) {
        if (updates.prompt && updates.prompt !== existing.prompt) {
          return;
        }
      }
      set({
        runs: state.runs.map((r: RunRecord) => (r.id === id ? { ...r, ...updates } : r)),
      });
    },

    setErrorCatalog: (errorCatalog: ErrorDefinition[]) => set({ errorCatalog }),
  };
}

// ───────── Selectors ─────────

export const selectSkills = (state: DomainSliceState): Skill[] => state.skills;
export const selectWorkflows = (state: DomainSliceState): Workflow[] => state.workflows;
export const selectTargets = (state: DomainSliceState): TargetsConfig | null => state.targets;
export const selectHealth = (state: DomainSliceState): TargetHealth[] => state.health;
export const selectRouterRules = (state: DomainSliceState): RouterRulesConfig | null => state.routerRules;
export const selectRuns = (state: DomainSliceState): RunRecord[] => state.runs;
export const selectErrorCatalog = (state: DomainSliceState): ErrorDefinition[] => state.errorCatalog;