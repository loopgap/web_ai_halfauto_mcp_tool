# Web AI Half-Auto MCP Tool 

欢迎来到 **Web AI Half-Auto MCP Tool** 项目维基。这是一个基于 React + Tauri + Rust 构建的跨平台桌面应用，旨在通过 FFI (Foreign Function Interface) 实现对浏览器窗口的高效、自动化操作。

## 🚀 项目入口 (Main Entries)

*   **[快速开始 (Quickstart)](docs/QUICKSTART.md)** - 环境准备与 5 分钟上手。
*   **[用户指南 (User Guide)](docs/GUIDE.md)** - 详细的功能操作与界面说明。
*   **[开发者指南 (Developer Wiki)](#开发者指南)** - 深入了解架构、开发流程与治理规范。

---

## 🛠️ 开发者指南 (Developer Wiki)

### 1. 架构概览 (Architecture)

项目采用前后端分离架构，通过 Tauri 桥接：

*   **Frontend (React + Zustand)**: 
    *   `src/store/AppStore.tsx`: 使用 Zustand 管理原子化状态，解决全局重渲染性能问题。
    *   `src/domain/`: 核心业务逻辑（状态机、工作流引擎）。
*   **Backend (Rust + Workspace)**:
    *   `src-tauri/src/lib.rs`: Tauri 指令处理器。
    *   `crates/core`: **[NEW]** 核心领域模型与通用工具。
    *   `crates/os-win`: Windows 平台底层的窗口、剪贴板与模拟输入实现。
*   **Automation (Go)**:
    *   `task.go`: 统一的跨平台任务编排引擎。

### 2. 标准化开发流程 (Development Workflow)

项目所有的日常任务均由 `task.go` 驱动，不再使用分散的 `.bat` 或 `.sh`。

*   **环境初始化**: `npm run setup` (调用 `go run task.go setup`)
*   **启动开发服务器**: `npm run dev`
*   **代码规范检查**: `npm run check` (包含全量 Lint 与类型检查)
*   **运行全量测试**: `npm run test` (包含 Vitest 与 Cargo test)
*   **清理构建缓存**: `npm run clean`

### 3. 项目文档索引 (Documentation Index)

*   **[架构优化方案](docs/architecture_optimization_plan.md)** - 记录了项目重构与性能调优的完整计划。
*   **[自动化脚本说明](docs/README-SCRIPTS.md)** - 关于 `task.go` 的设计与命令详情。
*   **[故障排除 (Troubleshooting)](docs/TROUBLESHOOTING.md)** - 常见编译错误与运行问题的解决方法。
*   **[项目变更日志 (Changelog)](CHANGELOG.md)** - 版本迭代记录。
*   **[技术路线图 (Route)](docs/route.md)** - 详细的开发路线与技术细则。

### 4. 项目治理与质量门禁 (Governance)

项目遵循严格的代码质量标准，详情参考：
*   `governance/quality-gates.json`: 定义了全量通过测试、Lint 无告警等硬性指标。
*   `governance/maturity-model.json`: 架构成熟度评估模型。

---

## 🗺️ 待办事项与进度 (Roadmap)

- [x] **Phase 1.1**: 前端状态管理解耦 (Zustand)。
- [x] **Phase 1.2**: 后端 Rust 模块化解耦 (提取 `crates/core`)。
- [x] **Phase 2.1**: 前端长列表性能调优 (Virtual Scroll)。
- [x] **Phase 2.2**: 运行时 AOP 监控注入。
- [x] **Phase 3.1**: 归类整理工作区杂乱文件。
- [ ] **Phase 3.2**: 闭环测试与 Git Hooks 自动化。
