# Changelog

All notable changes to this project are documented in this file.

## [Unreleased] - 2026-04-12

### Added
- Added scheduler and reports workflow, including `SchedulerPage`, `ReportsPage`, schedule storage, schedule engine, news report generation, and related API wiring.
- Added governance validation and API check scripts, plus corresponding CI and task runner integration.
- Added focused test coverage for scheduler, reports, news reports, config export, and schedule persistence flows.
- Added Linux platform workspace crate `src-tauri/crates/os-linux/` to continue cross-platform backend separation work.

### Changed
- Optimized local CI gates with incremental check and full CI modes.
- Tightened CI/CD and build performance by standardizing pnpm setup, lowering Rust build concurrency on constrained runners, and removing redundant environment checks from governance jobs.

### Fixed
- Removed dead backend configuration code and other technical debt to keep the Rust workspace warning-free under stricter clippy checks.
- Improved Linux compatibility around platform-specific backend code paths and CI validation.
- Fixed hooks to skip gracefully when local tools are missing instead of failing.

### Other
- Cleaned up unused dependencies (js-yaml, @tauri-apps/plugin-opener) and removed broken governance:evidence workflow.

## [0.4.0] - 2026-03-24

### Added
- Added structured runtime logging with trace IDs and an in-memory ring buffer via `src/domain/logging.ts`.
- Added runtime health diagnostics with first-run and deep-check flows.
- Added workflow compensation, pause, resume, cancel, and progress handling in the workflow engine.
- Added release tagging automation and stronger CI reporting, including JUnit artifact upload.
- Added broad domain test coverage, bringing the validated suite to 195 tests.

### Changed
- Updated settings and diagnostics UX to surface health status and operational telemetry.
- Hardened local CI scripts and release workflow behavior across mixed frontend and Rust environments.
- Expanded developer documentation and guidance around diagnostics and release flow.

### Fixed
- Fixed Tauri event mocking in tests and several CI/runtime edge cases that previously made automation less reliable.

## [0.3.0] - 2026-03-22

### Added
- Added API retry utilities, config export, persistence helpers, run statistics, keyboard shortcuts, throttle/performance hooks, and performance instrumentation UI.
- Added `CommandPalette` interactions, page transition effects, press feedback, responsive polish, print styles, and startup splash improvements.
- Added development scripts for setup, dev, build, clean, and doctor flows, together with Vitest configuration and test suites for store and domain modules.
- Added documentation for the route plan, scripts usage, and updated onboarding materials.

### Changed
- Improved first-screen performance with memoization, rendering optimizations, critical CSS, and GPU-friendly transitions.
- Adjusted Tauri window defaults and minimum constraints for a more stable desktop layout.
- Strengthened git hooks and repo hygiene for environments with missing local tooling.

### Fixed
- Fixed AppStore dispatch stability issues and several UI structure problems affecting startup and navigation behavior.

## [0.2.0] - 2026-03-01

### Added
- Added 7 new skills, agent-oriented workflows, and router intent coverage for code, security, translation, data, and agent tasks.
- Added prompt injection checks, PII detection, input sanitization, frontend rate limiting, and closed-loop execution safety checks.
- Added new security, agent, and closed-loop error codes plus related recovery actions.

### Changed
- Rebuilt multiple UI surfaces to fix Chinese text corruption and align the application on a more consistent glass-card design language.
- Expanded backend configuration and action orchestration to support the new safety and workflow capabilities.

### Fixed
- Fixed severe mojibake issues in the console and related interaction flows.

## [0.1.0] - 2026-03-01

### Added
- Initial project import for AI Workbench / Web AI Half-Auto MCP Tool.
- Baseline React + Tauri + Rust desktop application structure.
