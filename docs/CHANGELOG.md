# Changelog

## [0.5.0] — 2026-04-10
### 架构与性能全方位优化 (Architecture & Performance)

#### 🚀 核心变更 (Core)
- **后端模块化解耦**: 剥离 `src-tauri/src/lib.rs` 中的核心领域逻辑至独立 Crate `crates/core`。
- **任务引擎统一**: 引入跨平台 `task.go` 接管所有日常开发、构建、检查与测试任务，彻底废弃冗余的脚本目录和批处理文件。
- **依赖对齐与精简**: 对齐 `windows-rs` 版本至 0.61，优化 `Cargo.toml` 编译配置（开启 LTO、剥离符号表、优化 Profile），显著减小二进制体积并解决 Windows GNU 链接器溢出问题。

#### ⚡ 前端优化 (Frontend)
- **状态管理重构**: 将原有 React Context God-Store 迁移至 **Zustand**，实现状态的细粒度订阅，消除不必要的全局重渲染。
- **虚拟滚动列表**: 针对 `RunHistoryList.tsx` 引入虚拟滚动技术，在大数据量运行记录下保持极高的帧率与交互响应。
- **AOP 监控增强**: 在 `workflow-engine.ts` 中注入无侵入式遥测 (Telemetry) 钩子，并与 `PerformancePanel` 实时联动，全链路追踪执行状态。

#### 🛠️ 文档与工程化 (Engineering)
- **Wiki 式文档体系**: 重构根目录 `README.md` 为 Wiki 导航入口，修复历史编码导致的中文乱码。
- **双系统兼容适配**: 针对 `os-win` 模块增加平台条件编译保护，确保项目在非 Windows 环境下依然能够顺利编译通过。
- **测试闭环**: 修复并加固了 `AppStore.test.tsx` 和 `run-statistics.test.ts` 中的不稳定用例，确保 CI 管道 100% 通过。

## [0.4.0] — 安全补全与防御性设计优化
... (保持原有内容)
