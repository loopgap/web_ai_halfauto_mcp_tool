# Governance Assets

This folder implements the "Enterprise Closed Loop v2" as executable assets.

## What is included

- `standard-v2.md`: operating standard and phase gates.
- `maturity-model.json`: L1/L2/L3 definitions and graduation rules.
- `quality-gates.json`: hard gates and scorecard thresholds.
- `templates/`: demand/design/test/release/incident/CAPA templates.
- `checklists/`: review and release checklists.
- `examples/`: example records for local dry-run.

## Commands

- Environment baseline check:
  - `pnpm env:check`
- Validate governance assets:
  - `pnpm governance:validate`
- Generate an evidence package from JSON inputs:
  - `pnpm governance:evidence`

## Integration rule

Every feature/change must provide:

1. `ChangeRecord`
2. `QualityGateResult`
3. `ReleaseDecision`
4. At least one executable test evidence reference
5. Rollback checklist confirmation
