# 完整工作区优化与架构规范化闭环方案 (Updated)

**Objective**: 对项目（React + Tauri 架构）进行深度的无损优化与架构规范化，增强现有代码库的拓展性与性能，实现严格的治理（Governance）标准闭环，最终通过自动化测试与远端 CI/CD。

**已完成工作 (Completed)**:
1. **[DONE]** 制定初始架构优化方案。
2. **[DONE]** Phase 1.1: 前端状态管理解耦 (迁移至 Zustand `useAppStore`，解决全局重渲染问题，清理旧 Context 引用)。
3. **[DONE]** (附加约束) 将所有零散的脚本 (`scripts/`, `*.bat`, `*.sh`, `*.ps1`) 统一整合为单一的跨平台 Go 脚本 `task.go`，并更新 `package.json` 的 scripts 映射。

**待执行的详细截断计划 (Remaining Execution Plan)**:

## Phase 1.2: 后端 Rust 模块化解耦 (当前焦点)
- **目标**: 将 `src-tauri/src/lib.rs` 中的核心领域逻辑抽离到独立的局部 Crates（如 `crates/core`, `crates/domain`）。
- **具体步骤**:
  1. 审查 `src-tauri/src/` 下的代码结构，特别是 `lib.rs` 和 `main.rs`。
  2. 提取公共的业务逻辑或系统调用到现有的 `crates/os-win` 或新建的 `crates/core` 中。
  3. 规范前后端交互（FFI）边界的数据和错误处理标准，统一通过结构化的 Error 类型（参考 `crates/os-win/src/error.rs` 和 `error.txt`）序列化返回给前端。
  4. 运行 `go run task.go check` (封装了 `cargo check` 和 `cargo clippy`) 确保 Rust 代码重构后无编译错误和警告。
- **委派子代理**: `sys_architect` / `embedded_expert` (视底层 API 复杂度而定)

## Phase 2: 性能调优与功能拓展 (Performance & Extension)
### Phase 2.1: 前端长列表性能调优
- **目标**: 优化 `RunHistoryList.tsx` 和 `ConsolePage.tsx` 中的长列表渲染。
- **具体步骤**:
  1. 引入并深度应用现有的 `useVirtualScroll.ts` hook。
  2. 配合 `useDebounce.ts` / `useThrottle.ts` 优化高频状态更新。
  3. 确保在大量历史运行记录或高频日志输出时，DOM 节点数量维持在一个健康的窗口内，避免深层树的无意义 diff。
- **委派子代理**: `performance_tuner`, `fullstack_dev`

### Phase 2.2: 运行时拓展点注入 (AOP 监控)
- **目标**: 为工作流引擎实现无侵入式的遥测 (Telemetry) 与性能监控。
- **具体步骤**:
  1. 在 `src/domain/workflow-engine.ts` 中引入 AOP（面向切面编程）的思维。
  2. 结合现有的 `usePerformanceMonitor.ts`，为核心执行步骤注入指标 Hook。
  3. 为未来接入第三方大盘监控提供扩展接口。
- **委派子代理**: `sys_architect`, `fullstack_dev`

## Phase 3: 治理、自动化与闭环测试 (Governance & CI/CD)
### Phase 3.1: 闭环测试编写与修复
- **目标**: 确保重构带来的变更具有完善的测试用例覆盖。
- **具体步骤**:
  1. 为 Rust `crates/` 下抽离的独立模块编写/补充 Unit Tests（执行 `go run task.go test`）。
  2. 补充前端 Zustand 解耦后相关的业务逻辑测试 (`src/__tests__/store/AppStore.test.tsx` 及其他域测试)。
  3. 修复任何潜在的不稳定测试 (Flaky tests)。
- **委派子代理**: `test_architect`, `quality_guard`

### Phase 3.2: 深度自动化工作流集成
- **目标**: 将本地环境与质量门禁脚本强制应用到 Git Hooks。
- **具体步骤**:
  1. 将 `.githooks/` 目录下的 Hook (`pre-commit`, `pre-push`, `commit-msg`) 与 `task.go` 进行挂载和集成。
  2. 对照 `governance/quality-gates.json`，在 `pre-push` 阶段执行强制门禁（代码格式化、Lint、全量测试通过率）。
- **委派子代理**: `quality_guard`

## Phase 4: 本地校验与远程提交 (Verification & Commit)
- **目标**: 跑通整个闭环，验证全量质量后提交远端。
- **具体步骤**:
  1. 运行全局本地校验：`go run task.go doctor`, `go run task.go check`, `go run task.go test`。
  2. 执行 `go run task.go build` 确保前端及 Tauri 打包完全成功。
  3. 生成一份符合治理规范的 Release/Commit 决定（参考 `governance/examples/release-decision.example.json`）。
  4. 将变更提交到当前 Feature Branch 并 Push 至远端仓库。
  5. 监控 GitHub Actions (`ci.yml`) 执行情况，确认最终 CI/CD 流程通过。
- **委派子代理**: 主协调者 (Generalist)

## Verification & Rollback Strategy
- 每一小节重构完成后，立即执行对应的局部或全局测试（依赖 `task.go` 工具链）。
- 如果遇到破坏性修改导致编译/测试彻底失败，立即用 Git 回滚并交由 `debug_medic` 排查。
