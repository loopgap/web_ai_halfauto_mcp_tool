# Enterprise Closed Loop v2 Standard

## 1. Scope

This standard is project-agnostic and applies to feature delivery, bugfixes, and reliability/security changes.

## 2. Maturity Levels

- `L1`: baseline closure (workflow connected, core tests, rollback ready).
- `L2`: stable closure (contract aligned, automation gates, resilience drills).
- `L3`: autonomous closure (risk prediction, policy auto-tuning, release guardrails).

Projects must pass L1 before applying L2, and pass L2 before applying L3.

## 3. Canonical lifecycle

`Demand -> Scope -> Design -> Build -> Verify -> Review -> Release -> Observe -> Improve`

Any phase can enter `Blocked`, but must include:

- root cause
- impact scope
- remediation action
- re-verification evidence

## 4. Hard gates (release blockers)

Release is blocked when any condition is true:

- unresolved `P0` or `P1` defects
- unresolved high severity security issue
- failed critical path E2E
- rollback procedure not validated

## 5. Scorecard

Dimensions (0-5 each):

- correctness
- stability
- performance
- UX consistency
- security
- maintainability
- observability

Decision:

- `>= 30`: `Go`
- `24-29`: `GoWithRisk`
- `< 24`: `NoGo`

## 6. Required artifacts per change

- `ChangeRecord`
- `QualityGateResult`
- `ReleaseDecision`
- rollback checklist evidence
- monitoring plan

## 7. AI Workbench profile

Workbench-specific controls required:

- preflight target checks
- two-phase submit
- capture to artifact with run/step linking
- dispatch trace logging
- fallback chain `GPU_FIRST -> NPU_IF_QUALIFIED -> CPU_FALLBACK`

## 8. Auditability

All records must include:

- `change_id`
- `run_id` (optional for non-run changes)
- `step_id` (optional)
- `trace_id`
- UTC timestamp
