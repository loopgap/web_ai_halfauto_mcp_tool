# 📚 AI Workbench 文档中心

> 完整的使用、开发和运维文档

## 🚀 快速入门

**首次使用？** → 从这里开始：

1. [**QUICKSTART.md**](../QUICKSTART.md) — 5 分钟快速启动指南
   - 一键式安装和初始化
   - 启动应用的三种方式
   - 常见问题快速修复

2. [**WelcomePage.tsx**](../src/components/WelcomePage.tsx) — 应用内首次使用向导
   - 首次启动自动弹出
   - 3 步功能介绍
   - 可随时在 Settings 重新打开

---

## 📖 完整文档

### 用户指南

- **[GUIDE.md](./GUIDE.md)** — 完整使用指南（1500+ 行）
  - 项目概览、环境要求、安装启动
  - 功能详解（Dashboard、Dispatch、Skills、Workflows 等）
  - 配置文件详解（routes.yaml, skills.yaml, workflows.yaml）
  - 治理与合规框架
  - 测试和开发指南

- **[CONFIG.md](./CONFIG.md)** — 配置详解和示例
  - routes.yaml — 规则引擎和模型选择
  - skills.yaml — 技能定义模板
  - workflows.yaml — DAG 工作流示例
  - 配置优先级和环境变量

### 故障排查

- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** — 详细的故障排查指南（1000+ 行）
  - 🚀 **快速诊断** — 自动诊断脚本 `pnpm first-run` / `pnpm doctor`
  - 📋 **按症状索引** — 启动、编译、运行、测试等常见问题
  - 🔧 **平台特定** — Windows / Linux / macOS 的实际支持边界与手动处理方案
  - 🌐 **进阶诊断** — 调试模式、日志收集、性能分析
  - 📞 **获取帮助** — 如何有效地报告 Bug

### 性能优化

- **[PERFORMANCE.md](./PERFORMANCE.md)** — 性能优化和监控指南
  - ⚡ **性能基准** — 各阶段的目标和当前状态
  - 🚀 **启动优化** — 快速启动的 5 种方法
  - 🏗️ **构建优化** — 增量编译、并行构建、分离关键路径
  - 📈 **运行时优化** — 性能监控、虚拟化、Memoization
  - 📊 **分析工具** — Vite / DevTools / Tauri 分析方法
  - 🔍 **问题排查** — 常见性能问题根因和解决方案

### 脚本文档

- **[README-SCRIPTS.md](./README-SCRIPTS.md)** — 所有开发脚本详解
  - 开发脚本（bootstrap.mjs、dev.mjs、doctor.mjs 等）
  - 构建脚本（build.mjs、clean.mjs 等）
  - CI/CD 脚本（ci-local.mjs、ci-linux.mjs 等）
  - 发布脚本（release-tag.mjs、release-preflight.mjs 等）
  - 脚本间的依赖关系图

---

## 🛠️ 开发者资源

### 核心模块

| 模块 | 位置 | 用途 |
|------|------|------|
| **logging** | src/domain/logging.ts | 结构化日志，含 trace_id 和环缓冲 |
| **health-check** | src/domain/health-check.ts | 6 点运行时诊断（内存、API、DOM 等） |
| **workflow-engine** | src/domain/workflow-engine.ts | DAG 执行、补偿、暂停/恢复/取消 |
| **self-heal** | src/domain/self-heal.ts | 断路器、自愈策略、补偿逻辑 |
| **injection** | src/domain/injection.ts | 指令注入策略、互斥组、长度限制 |
| **feedback-learning** | src/domain/feedback-learning.ts | 反馈学习、权重调整、意图统计 |

### 测试套件

195+ 个单元测试覆盖：
- ✅ actions（52 个测试）— 质量门禁、注入、PII、速率限制
- ✅ workflow-engine（26 个测试）— DAG、执行、补偿、暂停/恢复
- ✅ self-heal（集成测试）— 断路器、治疗策略
- ✅ feedback-learning（集成测试）— 权重调整、统计
- ✅ 其他单元测试（130+）— coverage > 85%

运行测试：
```bash
pnpm test              # 运行所有测试
pnpm test:watch       # 监视模式
pnpm test:coverage    # 覆盖率报告
```

### 架构文档

项目遵循 **分层架构**：
```
View Layer (React Components)
    ↓
Store Layer (Redux-like Reducer)
    ↓
Domain Layer (业务逻辑模块)
    ↓
Data Layer (Tauri IPC / API)
```

详见 [GUIDE.md](./GUIDE.md#4-项目结构) 的项目结构部分。

---

## 📊 诊断和监控

### 内置诊断工具

#### `pnpm first-run` — 首次启动诊断
快速检查环境、依赖、编译、测试：
```bash
pnpm first-run
```
检查项：
- ✅ Node.js / pnpm / Rust 版本
- ✅ Linux 系统依赖（apt 系自动修复，其他发行版给出手工提示）
- ✅ 配置目录初始化
- ✅ TypeScript 编译
- ✅ 前端构建
- ✅ 单元测试
- ✅ 本地 CI 预检

#### `pnpm doctor` — 深度诊断
生成详细诊断报告：
```bash
pnpm doctor              # 打印到控制台
pnpm doctor --report    # 保存文本报告
pnpm doctor --fix       # 尝试自动修复
```

#### Settings 内置诊断
应用 Settings → 诊断面板：
- 一键运行健康检查
- 查看 6 点诊断结果
- 导出诊断数据包
- 复制日志用于支持

### 性能监控

- **性能面板** — Settings → Performance Panel
  - 首屏性能指标（FCP, LCP, CLS）
  - DOM 更新监控（Layout Thrashing）
  - 内存使用趋势
  - API 延迟分布

- **自定义监控**
```typescript
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';

usePerformanceMonitor('ComponentName', {
  threshold: 500,  // 警告阈值（ms）
  logLevel: 'warn' // 记录级别
});
```

---

## 🔄 CI/CD 流程

### 本地 CI

```bash
pnpm ci:local       # 完整 CI（13-15s）
pnpm ci:local:fast  # 快速检查（8-10s，跳过 Rust）
```

检查项：
- TypeScript 编译（no-emit）
- 单元测试（vitest）
- 治理验证（30+ API 合约）
- Rust clippy（可选）

### 自动化工作流

GitHub Actions 工作流（见 .github/workflows/）：
- **ci.yml** — 每次 commit 自动运行
- **release.yml** — 推送 tag 时发布
- **governance.yml** — 治理闭环检查

### 发布流程

```bash
# 1. 创建发布版本（自动更新版本号）
pnpm release:tag minor     # 0.3.0 → 0.4.0
pnpm release:tag patch     # 0.3.0 → 0.3.1
pnpm release:tag 1.0.0     # 显式版本

# 2. 预检（可选）
pnpm release:preflight

# 3. 推送（自动触发 CI + Release Actions）
git push && git push --tags
```

---

## 📈 版本历史

- **v0.4.0**（当前）
  - ✨ 新增：logging 模块、health-check 诊断、workflow 补偿
  - 🧪 新增：195 个单元测试
  - 📖 新增：快速启动指南、故障排查、性能优化文档
  - 🛠️ 新增：first-run 诊断、doctor 深度诊断、release-tag 自动版本

- **v0.3.0**
  - 初始版本

详见 [CHANGELOG.md](../CHANGELOG.md)。

---

## 🎯 常见任务

| 任务 | 命令 |
|------|------|
| 启动应用 | `pnpm start` / `pnpm start:fe` |
| 首次诊断 | `pnpm first-run` |
| 深度诊断 | `pnpm doctor` |
| 运行测试 | `pnpm test` / `pnpm test:coverage` |
| 构建应用 | `pnpm build:app` |
| 本地 CI | `pnpm ci:local` |
| 发布版本 | `pnpm release:tag [版本]` |
| 查看性能 | Settings → Performance Panel |
| 查看日志 | `~/.ai-workbench/logs/` |
| 查看诊断 | `~/.ai-workbench/health/` |

---

## 📞 获取帮助

### 自动化诊断
首选快速诊断工具（按顺序）：
1. `pnpm first-run` — 快速检查（2-3 分钟）
2. `pnpm doctor` — 深度诊断（3-5 分钟）
3. Settings → 诊断 → 导出诊断包（获取完整信息）

### 查阅文档
1. [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) — 按症状快速查找
2. [GUIDE.md](./GUIDE.md) — 完整功能说明
3. [CONFIG.md](./CONFIG.md) — 配置示例

### 查看日志
```bash
# 应用日志
tail -f ~/.ai-workbench/logs/*.log

# 首次启动诊断
cat ~/.ai-workbench/health/first-run-*.json

# 完整诊断报告
cat ~/.ai-workbench/health/doctor-*.json
```

### 报告 Bug
提供以下信息：
1. 诊断包：`pnpm doctor --report`
2. OS 版本：`uname -a` (Linux) / `sw_vers` (macOS)
3. Node 版本：`node --version`
4. pnpm 版本：`pnpm --version`
5. 复现步骤：详细说明

---

## 🗞️ 本文档版本

- **文档版本：** v0.4.0
- **最后更新：** 2025 Q1
- **维护者：** AI Workbench 团队

有任何文档改进建议？欢迎提出 Issue 或 PR！
