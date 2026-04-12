# 📚 AI Workbench 文档中心

> 完整的使用、开发和运维文档

## 🚀 快速入门

**首次使用？** → 从这里开始：

1. [**QUICKSTART.md**](./QUICKSTART.md) — 5 分钟快速启动指南
   - 一键式安装和初始化
   - 启动应用的三种方式
   - 常见问题快速修复

2. **首次启动向导** — 应用内首次使用向导
   - 首次启动自动弹出
   - 3 步功能介绍
   - 可随时在 Settings 重新打开

---

## 📖 完整文档

### 用户指南

- **[GUIDE.md](./GUIDE.md)** — 完整使用指南（750+ 行）
  - 项目概览、环境要求、安装启动
  - 功能详解（Dashboard、Dispatch、Skills、Workflows 等）
  - 配置文件详解（routes.yaml, skills.yaml, workflows.yaml）
  - 治理与合规框架
  - 测试和开发指南

### 故障排查

- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** — 详细的故障排查指南
  - 🚀 **快速诊断** — 自动诊断脚本 `pnpm doctor`
  - 📋 **按症状索引** — 启动、编译、运行、测试等常见问题
  - 🔧 **平台特定** — Windows / Linux / macOS 的实际支持边界
  - 🌐 **进阶诊断** — 调试模式、日志收集、性能分析
  - 📞 **获取帮助** — 如何有效地报告 Bug

### 脚本文档

- **[README-SCRIPTS.md](./README-SCRIPTS.md)** — 所有开发脚本详解
  - 开发脚本（dev, build, clean 等）
  - 构建脚本（doctor, check, test 等）
  - CI/CD 脚本（ci-local, ci 等）

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

**349 个测试**覆盖：
- ✅ api（58 个测试）— 所有 Tauri invoke 封装
- ✅ actions（52 个测试）— 质量门禁、注入、PII、速率限制
- ✅ workflow-engine（29 个测试）— DAG、执行、补偿、暂停/恢复
- ✅ self-heal（14 个测试）— 断路器、治疗策略
- ✅ 其他单元测试（196+）— coverage > 85%

运行测试：
```bash
pnpm test              # 运行所有测试
```

### 架构文档

项目遵循 **分层架构**：
```
View Layer (React Components)
    ↓
Store Layer (Zustand Reducer)
    ↓
Domain Layer (业务逻辑模块)
    ↓
Data Layer (Tauri IPC / API)
```

详见 [GUIDE.md](./GUIDE.md#4-项目结构) 的项目结构部分。

---

## 🎨 MiniMax AI 能力集成

项目集成了 MiniMax MCP 服务，支持 AI 图片生成能力：

### MiniMax-MCP (skills/minimax-mcp/)

**功能**：TTS、语音克隆、视频生成、图片生成、音乐生成

**环境配置**：
```bash
# 在 skills/minimax-mcp/.env 中设置
MINIMAX_API_KEY=your_api_key
MINIMAX_API_HOST=https://api.minimaxi.com
```

**可用工具**：
- `text_to_audio` — 文本转语音
- `list_voices` — 列出可用音色
- `voice_clone` — 语音克隆
- `generate_video` — 视频生成
- `text_to_image` — 图片生成
- `query_video_generation` — 查询视频生成状态
- `music_generation` — 音乐生成
- `voice_design` — 语音设计

详见：[skills/minimax-mcp/README_INTEGRATION.md](../skills/minimax-mcp/README_INTEGRATION.md)

### MiniMax-Coding-Plan-MCP (skills/minimax-coding-plan-mcp/)

**功能**：Web 搜索、图片理解

**环境配置**：
```bash
# 在 skills/minimax-coding-plan-mcp/.env 中设置
MINIMAX_API_KEY=your_api_key
MINIMAX_API_HOST=https://api.minimaxi.com
```

**可用工具**：
- `web_search` — Web 搜索
- `understand_image` — 图片理解

详见：[skills/minimax-coding-plan-mcp/README_INTEGRATION.md](../skills/minimax-coding-plan-mcp/README_INTEGRATION.md)

---

## 📊 诊断和监控

### 内置诊断工具

#### `pnpm doctor` — 环境诊断
快速检查环境、依赖、编译、测试：
```bash
pnpm doctor
```
检查项：
- ✅ Node.js / pnpm / Rust 版本
- ✅ Linux 系统依赖
- ✅ 配置目录初始化
- ✅ TypeScript 编译
- ✅ 前端构建
- ✅ 单元测试

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

const metrics = usePerformanceMonitor(3000);
```

---

## 🔄 CI/CD 流程

### 本地 CI

```bash
pnpm ci           # 完整 CI
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
# 1. 更新版本号并创建 tag
git tag v0.3.0

# 2. 推送（自动触发 CI + Release Actions）
git push && git push --tags
```

---

## 🎯 常见任务

| 任务 | 命令 |
|------|------|
| 启动应用 | `pnpm dev` |
| 诊断检查 | `pnpm doctor` |
| 运行测试 | `pnpm test` |
| 构建应用 | `pnpm build` |
| 本地 CI | `pnpm ci` |
| 查看性能 | Settings → Performance Panel |
| 查看日志 | `~/.ai-workbench/logs/` |
| 查看诊断 | `~/.ai-workbench/health/` |

---

## 📞 获取帮助

### 自动化诊断
首选快速诊断工具：
1. `pnpm doctor` — 诊断检查
2. Settings → 诊断 → 导出诊断包（获取完整信息）

### 查阅文档
1. [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) — 按症状快速查找
2. [GUIDE.md](./GUIDE.md) — 完整功能说明

### 报告 Bug
提供以下信息：
1. 诊断包：`pnpm doctor --report`
2. OS 版本：`uname -a` (Linux) / `sw_vers` (macOS)
3. Node 版本：`node --version`
4. pnpm 版本：`pnpm --version`
5. 复现步骤：详细说明

---

## 🗞️ 本文档版本

- **文档版本：** v0.3.0
- **最后更新：** 2026-04-12
- **维护者：** AI Workbench 团队

有任何文档改进建议？欢迎提出 Issue 或 PR！
