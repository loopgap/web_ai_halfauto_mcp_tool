# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Governance Closed Loop v2

- Check local environment:
  - `npm run env:check`
- Windows one-shot bootstrap:
  - `powershell -ExecutionPolicy Bypass -File scripts/bootstrap-environment.ps1`
- Validate governance assets:
  - `npm run governance:validate`
- Governance API contract test:
  - `npm run test:governance:api`
- Governance Rust test:
  - `npm run test:governance:rust`
- Generate example evidence pack:
  - `npm run governance:evidence:example`
- Run CI-equivalent governance pipeline locally:
  - `npm run ci:governance`

Assets are under `governance/`.

Environment template: copy from `.env.example` if needed.
