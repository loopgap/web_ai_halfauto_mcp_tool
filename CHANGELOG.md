# Changelog
## [0.4.0] — 安全补全与防御性设计优化

### 修复与加固
- **原子配置保存** (§101) — 引入 `atomic_write` 机制，所有配置保存均采用“写临时文件+重命名”模式，杜绝并发导致的文件损坏风险。
- **ReDoS 攻击防御** (§101) — 对窗口标题正则表达式增加 200 字符长度限制，防止恶意正则耗尽 CPU 资源。
- **审计日志可靠性** (§101) — `write_audit` 增加错误捕获与 stderr 输出，不再静默忽略磁盘满或权限不足等关键故障。
- **内存泄漏核验** (§101) — 确认 `CONFIRM_GUARD` 已具备容量控制逻辑，无需额外修改。


All notable changes to AI Workbench.

## [0.4.0] — 可靠性、可观测性与开箱即用增强

### 新增
- **结构化日志** (§102) — `logging.ts` 模块：`createLogger(module)` 工厂 + trace_id + localStorage 环形缓冲区 (200 条) + `exportLogs()` 诊断导出
- **运行时健康检查** (§101) — `health-check.ts`：一键诊断 6 项指标（localStorage / 内存 / DOM / 后端连通 / 日志系统 / 自愈引擎）
- **Settings 诊断面板** — 运行时诊断集成到 Settings 页面，含状态指示、一键复制诊断报告
- **工作流补偿执行** (§67) — `getCompensationPlan()` 逆拓扑序回滚 + `markCompensating()` 标记 + `pauseExecution/resumeExecution/cancelExecution` 生命周期控制
- **工作流进度追踪** — `getExecutionProgress()` 返回 total/completed/failed/running/pending/percent
- **DAG 校验增强** — `validateWorkflowDag()` 循环检测、缺少补偿/重试策略警告
- **Actions 结构化日志集成** — dispatch_start、rate_limit、PII、injection 关键控制点日志
- **自动化发布脚本** — `scripts/release-tag.mjs`：版本同步 (package.json + tauri.conf.json + Cargo.toml) → git tag → 可选 `--push` 触发 CI
- **CI 单元测试** — `ci.yml` 新增 vitest 步骤 + JUnit 报告上传
- **Doctor 脚本增强** — `doctor.mjs` 新增 vitest 检测与自动运行

### 测试
- 8 个新测试套件，覆盖原无测试模块：
  - `actions.test.ts` — 安全检查、限流、状态转换 (13 组)
  - `self-heal.test.ts` — 熔断器、策略匹配、补偿矩阵
  - `injection.test.ts` — 注入策略、优先级、mutex、长度限制
  - `feedback-learning.test.ts` — 意图统计、权重自适应
  - `slm.test.ts` — 设备选择、CPU 安全模式、质量基线
  - `logging.test.ts` — 日志工厂、缓冲区、级别过滤
  - `persistence.test.ts` — 状态持久化与恢复、节流中间件
  - `dictionary.test.ts` — UI 字典完整性
  - `health-check.test.ts` — 运行时诊断与导出
- `workflow-engine.test.ts` 扩展：新增 12 个 describe 块 (getReadySteps / advanceStep / canRetryStep / 补偿 / 暂停恢复取消 / 进度 / DAG 校验 / mergeResults)

### 变更
- `package.json` 新增 devDependencies: vitest ^3.2.1, @testing-library/react, @vitest/coverage-v8, jsdom
- `package.json` 新增 scripts: test / test:watch / test:coverage / test:ci / release:tag

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
