// ═══════════════════════════════════════════════════════════
// Governance Slice — governanceChanges, governanceQuality, governanceDecisions, governanceReports
// §3 前端闭环: Store 全局状态与 reducer
// ═══════════════════════════════════════════════════════════

import type {
  ChangeRecord,
  QualityGateResult,
  ReleaseDecisionRecord,
  GovernanceValidationReport,
} from "../../types";

// ───────── State ─────────

export interface GovSliceState {
  governanceChanges: ChangeRecord[];
  governanceQuality: QualityGateResult[];
  governanceDecisions: ReleaseDecisionRecord[];
  governanceReports: GovernanceValidationReport[];
}

const initialGovState: GovSliceState = {
  governanceChanges: [],
  governanceQuality: [],
  governanceDecisions: [],
  governanceReports: [],
};

// ───────── Full Slice Type (State + Actions) ─────────

export interface GovSlice extends GovSliceState {
  upsertGovChange: (change: ChangeRecord) => void;
  upsertGovQuality: (quality: QualityGateResult) => void;
  upsertGovDecision: (decision: ReleaseDecisionRecord) => void;
  addGovReport: (report: GovernanceValidationReport) => void;
}

// ───────── Slice Factory ─────────

type GovSet = (partial: Partial<GovSlice> | ((state: GovSlice) => Partial<GovSlice>)) => void;

export function createGovSlice(set: GovSet, _get: () => GovSlice): GovSlice {
  return {
    ...initialGovState,

    // ─── Governance Changes ───
    upsertGovChange: (change: ChangeRecord) =>
      set((state) => {
        // §P3-4 Use Map for atomic upsert - prevents concurrent overwrite
        const map = new Map(state.governanceChanges.map((x: ChangeRecord) => [x.change_id, x]));
        map.set(change.change_id, change);
        const arr = Array.from(map.values()).slice(0, 200);
        return { governanceChanges: arr };
      }),

    // ─── Governance Quality ───
    upsertGovQuality: (quality: QualityGateResult) =>
      set((state) => {
        // §P3-4 Use Map for atomic upsert - prevents concurrent overwrite
        const map = new Map(state.governanceQuality.map((x: QualityGateResult) => [x.change_id, x]));
        map.set(quality.change_id, quality);
        const arr = Array.from(map.values()).slice(0, 200);
        return { governanceQuality: arr };
      }),

    // ─── Governance Decisions ───
    upsertGovDecision: (decision: ReleaseDecisionRecord) =>
      set((state) => {
        // §P3-4 Use Map for atomic upsert - prevents concurrent overwrite
        const map = new Map(state.governanceDecisions.map((x: ReleaseDecisionRecord) => [x.change_id, x]));
        map.set(decision.change_id, decision);
        const arr = Array.from(map.values()).slice(0, 200);
        return { governanceDecisions: arr };
      }),

    // ─── Governance Reports ───
    addGovReport: (report: GovernanceValidationReport) =>
      set((state) => ({
        governanceReports: [report, ...state.governanceReports].slice(0, 100),
      })),
  };
}

// ───────── Selectors ─────────

export const selectGovernanceChanges = (state: GovSliceState): ChangeRecord[] => state.governanceChanges;
export const selectGovernanceQuality = (state: GovSliceState): QualityGateResult[] => state.governanceQuality;
export const selectGovernanceDecisions = (state: GovSliceState): ReleaseDecisionRecord[] => state.governanceDecisions;
export const selectGovernanceReports = (state: GovSliceState): GovernanceValidationReport[] => state.governanceReports;