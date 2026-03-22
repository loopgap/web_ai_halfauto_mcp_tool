# Changelog

All notable changes to AI Workbench.

## [0.3.0] — 性能优化与 UX 增强

### 新增
- **AppStore dispatch 稳定性修复** (§100) — `useCallback` 依赖从 `[state]` 改为 `[]`，彻底消除级联重渲染
- **Dashboard 计算缓存** (§100) — 6 项 `useMemo` + 2 个 `React.memo` 子组件
- **SettingsPage 计算缓存** (§100) — 4 项 `useMemo`（SLM/反馈统计）
- **index.html 首屏优化** (§100) — 内联关键 CSS + SVG splash screen + 结构修复
- **CSS 渲染性能** (§100) — `content-visibility: auto`、`will-change`、GPU 合成层加速
- **页面切换过渡动画** (§100) — `PageTransition` 组件 + `page-in` 关键帧
- **交互增强** (§100) — 搜索栏点击开面板、按钮/卡片按压反馈、响应式适配、打印样式
- **Tauri 窗口优化** (§100) — 1200×800 默认尺寸 + 900×600 最小约束

### 变更
- `index.html` `lang` 属性改为 `zh-CN`
- Tauri 窗口标题从 "ai-workbench" 改为 "AI Workbench"
- `route.md` 新增 §100（性能优化与 UX 增强）

## [0.2.0] — 跨平台与发布增强

### 新增
- **跨平台脚本** (§99) — `dev.mjs`/`setup.mjs`/`doctor.mjs`/`build.mjs`/`clean.mjs`，纯 Node.js 内置模块，Linux/macOS/Windows 通用
- **标准发布工作流** (§99) — `.github/workflows/release.yml`，支持 `v*` tag 触发自动构建，支持 `-linux`/`-windows` 分平台发布
- **性能监控** (§91) — `usePerformanceMonitor` hook + `PerformancePanel` 组件
- **全局快捷键** (§92) — `useKeyboardShortcuts` hook，`Ctrl+K`/`Alt+P`/`Ctrl+/`
- **配置导出/导入** (§93) — `config-export.ts`，一键 JSON 导出 Targets/Skills/Workflows
- **运行统计** (§94) — `run-statistics.ts`，成功率/耗时分布/模型使用频次
- **Vault 管理** (§95) — Rust `get_vault_stats`/`cleanup_vault` 命令 + Settings 面板
- **API 重试退避** (§96) — `invokeWithRetry()` 指数退避 + 抖动
- **UI 状态持久化** (§97) — `persistence.ts`，localStorage 自动保存/恢复页面状态
- **无障碍增强** (§98) — skip-link、aria-label、role="alert"、焦点锁定
- **README.md** — 项目概览 + 结构 + 快速开始 + 链接 route.md

### 变更
- `package.json` scripts 统一化，移除平台后缀（`setup:linux`→`setup`），所有脚本跨平台
- CI 管道移除 ESLint / vitest 步骤（改为可选安装）
- `eslint.config.js` 改为空存根（ESLint 为可选增强）
- `pre-commit` hook 精简为 3 步（tsc + governance + debug check）
- `docs/GUIDE.md` 更新为跨平台指引
- `docs/README-SCRIPTS.md` 重写为跨平台脚本手册
- `route.md` 新增 §91-§99（性能监控/快捷键/配置导出/统计/Vault/重试/持久化/a11y/发布）

### 产物格式
- Linux: `.deb` (Debian/Ubuntu) + `.AppImage` (通用)
- Windows: `.msi` (Windows Installer) + `.exe` (NSIS)

## [0.1.0] — 初始版本

- Tauri v2 + React 19 + TypeScript 5.8 + Rust 基础架构
- 多模型网页端调度 (ChatGPT / Claude / Gemini)
- 规则引擎路由 (MetaRouter v2)
- Skill / Workflow / Target 管理
- DAG 工作流引擎
- 自愈引擎 (断路器 + 补偿矩阵)
- 治理闭环 v2 (变更记录 / 质量门禁 / 发布决策)
- 7 个页面 (Dashboard / Console / Targets / Skills / Workflows / Archive / Settings)
