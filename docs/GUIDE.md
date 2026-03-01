# AI Workbench 完整使用指南

> 版本 v0.3.0 · 最后更新 2026-03-01

---

## 目录

1. [项目概览](#1-项目概览)
2. [环境要求](#2-环境要求)
3. [安装与启动](#3-安装与启动)
4. [项目结构](#4-项目结构)
5. [核心概念](#5-核心概念)
6. [页面功能详解](#6-页面功能详解)
7. [配置文件](#7-配置文件)
8. [治理与合规](#8-治理与合规)
9. [测试](#9-测试)
10. [开发指南](#10-开发指南)
11. [常见问题](#11-常见问题)

---

## 1. 项目概览

AI Workbench 是一个 **本地优先、安全优先** 的 AI 工作台桌面应用，基于：

| 技术栈 | 版本 |
|--------|------|
| Tauri | v2.10+ |
| React | 19.1 |
| TypeScript | ~5.8 |
| Rust | 1.93+ |
| Tailwind CSS | v4 |
| Vite | 6.x |

**核心能力：**

- **多模型网页端调度** — 通过 OS 层自动化（剪切板粘贴）向 ChatGPT / Claude / Gemini 等网页端发送指令
- **规则引擎路由** — 关键词 + 正则 + 置信度打分自动选模型/Provider
- **Skill / Workflow 编排** — 声明式技能定义 + DAG 工作流
- **前端状态机驱动** — 每个页面有明确的状态转换路径
- **全链路审计** — 治理闭环 v2，含变更记录、质量门禁、发布决策

---

## 2. 环境要求

### 必须安装

| 工具 | 最低版本 | 安装方式 |
|------|----------|----------|
| **Node.js** | v18+ | https://nodejs.org |
| **Rust** | 1.70+ | https://rustup.rs |
| **系统** | Windows 10/11 x64 | — |

### 推荐安装

| 工具 | 用途 |
|------|------|
| VS Code | 编辑器 |
| Tauri VS Code 扩展 | 调试支持 |
| rust-analyzer 扩展 | Rust 代码补全 |
| PowerShell 7 | 更好的终端体验 |

### 快速检查环境

```powershell
cd ai-workbench
npm run env:check
```

如果检查不通过，可执行一键引导脚本：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/bootstrap-environment.ps1
```

---

## 3. 安装与启动

### 3.1 克隆 & 安装依赖

```powershell
cd C:\Users\Administrator\Desktop\web_workflow\ai-workbench

# 安装前端依赖
npm install

# Rust 依赖会在首次 build 时自动下载
```

### 3.2 开发模式运行

```powershell
# 方式一：仅前端 (Vite dev server，浏览器中查看 UI)
npm run dev
# 访问 http://localhost:1420

# 方式二：完整 Tauri 桌面应用 (包含 Rust 后端)
npm run tauri dev
```

> **说明：** `npm run dev` 只启动前端开发服务器，Tauri invoke 调用会失败（无后端）。  
> 完整功能需要 `npm run tauri dev` 启动 Tauri 应用。

### 3.3 构建生产版本

```powershell
npm run tauri build
```

生成的安装包在 `src-tauri/target/release/bundle/` 目录下。

---

## 4. 项目结构

```
ai-workbench/
├── src/                        # 前端源码 (React + TypeScript)
│   ├── main.tsx                # 入口
│   ├── App.tsx                 # 路由定义
│   ├── types.ts                # 全局类型 (563 行，所有 TS 类型定义)
│   ├── api.ts                  # Tauri invoke 封装 (29 个命令)
│   ├── index.css               # Tailwind 入口样式
│   ├── domain/                 # 业务逻辑层
│   │   ├── actions.ts          # 核心业务动作 (dispatch flow, capture, route)
│   │   ├── dictionary.ts       # UI 文案字典
│   │   ├── injection.ts        # 指令注入引擎
│   │   ├── workflow-engine.ts  # §7 DAG 执行引擎
│   │   ├── self-heal.ts        # §8 自愈引擎 (断路器 + 补偿矩阵)
│   │   ├── slm.ts              # §4 本地 SLM 管理框架
│   │   └── feedback-learning.ts # §5 路由反馈学习
│   ├── store/
│   │   └── AppStore.tsx        # 全局状态 (React Context + 17 个 actions)
│   ├── hooks/
│   │   ├── useEventBus.ts      # Tauri 事件订阅
│   │   ├── useDebounce.ts      # §71 按钮防抖
│   │   ├── useFocusTrap.ts     # 弹窗焦点锁定
│   │   └── useVirtualScroll.ts # §3 虚拟滚动
│   ├── components/             # 可复用组件
│   │   ├── Layout.tsx          # 主布局 + 侧边栏导航
│   │   ├── CommandPalette.tsx  # §74 Ctrl+K 命令面板
│   │   ├── FocusRecipeEditor.tsx # §9.7 Focus Recipe 拖拽编辑
│   │   ├── TargetWizard.tsx    # §9.2 目标验证向导
│   │   ├── StepProgress.tsx    # §45 工作流步进条
│   │   ├── Toast.tsx           # 通知系统
│   │   ├── ErrorBoundary.tsx   # 错误边界
│   │   ├── Skeleton.tsx        # 骨架屏
│   │   └── EmptyState.tsx      # 空态模板
│   └── pages/                  # 页面组件
│       ├── Dashboard.tsx       # 仪表盘总览
│       ├── ConsolePage.tsx     # 运行控制台 (核心)
│       ├── TargetsPage.tsx     # 目标管理
│       ├── SkillsPage.tsx      # 技能库浏览
│       ├── WorkflowsPage.tsx   # 工作流管理 (DAG 可视化)
│       ├── ArchivePage.tsx     # 运行归档 (虚拟滚动)
│       └── SettingsPage.tsx    # 设置 (路由规则 / SLM / 治理)
│
├── src-tauri/                  # Rust 后端
│   ├── src/
│   │   ├── main.rs             # Tauri 入口
│   │   ├── lib.rs              # 29 个 Tauri 命令实现
│   │   └── config.rs           # 所有 Rust 结构体/枚举 + YAML 解析 + 持久化
│   ├── tests/
│   │   ├── config_tests.rs     # 27 个配置/序列化测试
│   │   └── os_win_tests.rs     # 12 个 Windows OS 自动化测试
│   ├── Cargo.toml
│   └── tauri.conf.json         # Tauri 配置
│
├── governance/                 # 治理合规资产
│   ├── standard-v2.md          # 运营标准
│   ├── maturity-model.json     # 成熟度 L1/L2/L3
│   ├── quality-gates.json      # 质量门禁
│   ├── templates/              # 需求/设计/测试/发布/事故/CAPA 模板
│   ├── checklists/             # 评审/发布检查清单
│   └── examples/               # 示例记录
│
├── scripts/                    # 工具脚本
│   ├── check-environment.mjs   # 环境检查
│   ├── validate-governance.mjs # 治理资产校验
│   ├── test-governance-api-contract.mjs  # 治理 API 合约测试 (32 条)
│   ├── build-evidence-pack.mjs # 证据包生成
│   └── bootstrap-environment.ps1 # 一键环境引导
│
└── route.md                    # 技术路线蓝图 (90 节, 1824 行)
```

---

## 5. 核心概念

### 5.1 Skill（技能）

一个 Skill 是一个声明式的 AI 任务定义，配置在 `config/skills.yaml` 中：

```yaml
- id: "translate-en-zh"
  title: "英翻中"
  version: "1.0.0"
  safety_level: "safe"           # safe | caution | dangerous
  latency_class: "fast"          # fast | medium | slow
  cost_class: "free"
  determinism: "variable"
  intent_tags: ["translate"]
  prompt_template: "请将以下英文翻译为中文：\n{text}"
  inputs:
    text: { type: "string", required: true, max_length: 5000 }
  quality_gates:
    - { min_length: 10 }
  dispatch:
    mode: "single"
    prefer_providers: ["chatgpt", "claude"]
    timeout_ms: 30000
    retry_count: 1
```

### 5.2 Target（目标）

Target 定义了一个浏览器窗口端点（如 ChatGPT 网页标签页）。系统通过窗口标题匹配找到目标：

```yaml
targets:
  chatgpt-main:
    provider: "chatgpt"
    match:
      title_contains: "ChatGPT"
      exe_name: "chrome.exe"
```

### 5.3 Workflow（工作流）

Workflow 是 Skill 的有向无环图（DAG）编排：

```yaml
- id: "research-pipeline"
  title: "调研流水线"
  steps:
    - id: "search"
      skill_id: "web-search"
      depends_on: []
    - id: "summarize"
      skill_id: "summarize"
      depends_on: ["search"]
    - id: "translate"
      skill_id: "translate-en-zh"
      depends_on: ["summarize"]
```

### 5.4 Router（路由规则）

MetaRouter v2 根据用户输入的 prompt 自动匹配最佳 intent + provider：

- **关键词匹配** — 预设关键词列表
- **正则匹配** — 高级模式匹配
- **置信度打分** — 综合关键词命中数、pattern 匹配、权重 boost
- **阈值决策** — 高置信度自动路由，中间值弹确认，低值拒绝

### 5.5 Dispatch Flow（投递流程）

```
用户选择 Skill + Target + 填写参数
    ↓
路由推荐 (auto-route)
    ↓
输入校验 → 通过 → Stage (粘贴到窗口，不发送)
    ↓
用户确认 → Send Now (按回车)
    ↓
等待 → Capture 回收输出
    ↓
Quality Gate 校验 → 归档到 Vault
```

### 5.6 自愈引擎（§8）

当执行失败时，系统根据错误码自动查找修复策略：

- 重试（retry_dispatch）
- 切换 target（switch_target）
- 回退 provider（fallback_provider）
- 重启浏览器（restart_browser）
- 带**断路器**保护，防止无限重试

### 5.7 SLM 本地小模型（§4）

支持加载本地小模型用于：

| 角色 | 用途 | 推荐模型 |
|------|------|----------|
| router_slm | 意图识别 | 1.5B INT4 |
| qa_slm | 质量检查 | 1.5B~3B INT4 |
| planner_slm | 参数补全 | 3B INT8 |
| coder_slm | 代码修复 | 3B~7B INT8 |

---

## 6. 页面功能详解

### 6.1 仪表盘 (Dashboard)

**路径：** `/` (首页)

显示系统总览：
- 4 张统计卡片：Skills 数、Workflows 数、Targets 数、在线窗口数
- SLM 引擎状态（加载模型数、推理次数、延迟、CPU安全模式）
- 自愈引擎状态
- 路由反馈统计
- Target 健康状态列表
- 已注册 Skills 一览
- 最近运行列表

### 6.2 运行控制台 (Console)

**路径：** `/console`

这是核心操作页面：

1. **选择 Skill** — 从下拉列表选择要执行的技能
2. **填写参数** — 根据 Skill 定义的 inputs 动态生成表单
3. **选择 Target** — 选择目标浏览器窗口
4. **查看路由推荐** — 显示 MetaRouter 的意图识别结果和置信度
5. **配置选项** — 两阶段提交开关、自动浏览器选择、注入模式
6. **投递** — 点击 "Stage 粘贴" 将内容粘贴到目标窗口
7. **确认发送** — 点击 "Send Now" 确认发送（两阶段模式）
8. **回收输出** — 点击 "Capture 输出" 回收 AI 网页的回复

> 所有关键按钮都有 §71 防抖保护，防止重复点击。

### 6.3 目标管理 (Targets)

**路径：** `/targets`

- 查看已配置的 target 列表
- 每个 target 显示匹配状态（就绪 / 缺失 / 模糊 / 错误）
- **验证向导（§9.2）**：
  1. 列出所有可见窗口
  2. 选择一个窗口
  3. 发送 UUID 测试文本
  4. 用户确认是否在窗口中看到该文本
  5. 验证通过则存入配置

### 6.4 技能库 (Skills)

**路径：** `/skills`

- 浏览所有已注册的 Skill
- 展开查看详情：意图标签、输入参数、Prompt 模板、Quality Gates、Fallbacks、分发策略、可观测性配置

### 6.5 工作流 (Workflows)

**路径：** `/workflows`

- 查看所有工作流定义
- **DAG 拓扑分析**：展开后显示拓扑层次图、并行步骤、验证问题
- 图策略信息（graph_policy）
- 每个步骤的拓扑层级和后继步骤

### 6.6 归档 (Archive)

**路径：** `/archive`

- 查看所有历史运行记录
- 搜索过滤（按 skill、target、provider、trace_id）
- **虚拟滚动**：大量记录时自动虚拟化渲染
- 导出 Markdown 文件
- 每条记录显示：状态、prompt、输出、路由决策

### 6.7 设置 (Settings)

**路径：** `/settings`

包含多个面板：

- **治理闭环 v2** — 运行治理校验、加载快照、发送遥测
- **MetaRouter 路由规则** — 查看所有 intent 的关键词/正则/置信度配置
- **安全默认值** — auto_enter、fanout、阈值配置
- **NPU/小模型状态** — 设备状态
- **SLM 配置（§4）** — 加载模型数、CPU安全模式、推荐模型列表
- **路由反馈学习（§5）** — 反馈统计面板
- **Focus Recipe 编辑器（§9.7）** — 拖拽编排窗口聚焦步骤
- **自愈引擎状态（§8）** — 策略数和运行状态
- **错误码目录** — 统一错误码分类浏览
- **自愈策略注册表** — 查看所有修复策略
- **状态转换历史** — 查看全局状态机历史

### 6.8 命令面板 (Ctrl+K)

在任何页面按 `Ctrl+K`（macOS 为 `Cmd+K`）打开命令面板：

- 快速跳转到任意页面
- 搜索命令
- 键盘上下选择，回车执行

---

## 7. 配置文件

配置文件位于 `config/` 目录（YAML 格式），由 Rust 后端加载：

| 文件 | 内容 |
|------|------|
| `skills.yaml` | Skill 技能定义 |
| `workflows.yaml` | Workflow 工作流定义 |
| `targets.yaml` | Target 目标窗口配置 |
| `router-rules.yaml` | MetaRouter 路由规则 |
| `error-catalog.yaml` | 统一错误码目录 |
| `self-heal.yaml` | 自愈策略注册表 |

### Tauri 配置

- `src-tauri/tauri.conf.json` — Tauri 应用配置（窗口尺寸、标题、构建路径等）
- `src-tauri/capabilities/default.json` — Tauri v2 权限配置

### 环境变量

复制 `.env.example` 为 `.env` 并填入所需配置。

---

## 8. 治理与合规

项目内置完整的企业级治理闭环 v2：

### 8.1 运行治理命令

```powershell
# 检查环境
npm run env:check

# 校验治理资产
npm run governance:validate

# 运行治理 API 合约测试
npm run test:governance:api

# 运行 Rust 治理测试
npm run test:governance:rust

# 生成证据包
npm run governance:evidence:example

# 完整 CI 治理流水线
npm run ci:governance
```

### 8.2 治理资产

所有治理资产在 `governance/` 目录：

- **standard-v2.md** — 运营标准与阶段门禁
- **maturity-model.json** — 成熟度定义 (L1/L2/L3)
- **quality-gates.json** — 质量门禁阈值
- **templates/** — 6 种模板（需求/设计/测试/发布/事故/CAPA）
- **checklists/** — 评审与发布检查清单
- **examples/** — 示例变更记录、质量门禁结果、发布决策

### 8.3 每次变更要求

每个 feature/change 必须提供：

1. `ChangeRecord` — 变更记录
2. `QualityGateResult` — 质量门禁结果
3. `ReleaseDecision` — 发布决策
4. 至少一条可执行的测试证据引用
5. 回滚检查清单确认

---

## 9. 测试

### 9.1 TypeScript 类型检查

```powershell
npx tsc --noEmit
```

期望输出：无错误。

### 9.2 Rust 单元测试

```powershell
cd src-tauri
cargo test
```

期望输出：41/41 通过（27 配置 + 12 OS + 2 治理）。

### 9.3 治理合约测试

```powershell
node scripts/test-governance-api-contract.mjs
```

期望输出：32/32 通过。

### 9.4 一键全量测试

```powershell
# 在 ai-workbench 目录下
npx tsc --noEmit; cd src-tauri; cargo test; cd ..; node scripts/test-governance-api-contract.mjs
```

---

## 10. 开发指南

### 10.1 添加新 Skill

1. 在 `config/skills.yaml` 添加 Skill 定义
2. TypeScript 类型已有 `Skill` 接口（见 `types.ts`）
3. 前端会自动加载显示

### 10.2 添加新 Tauri 命令

1. 在 `src-tauri/src/lib.rs` 添加 `#[tauri::command]` 函数
2. 在 `invoke_handler` 中注册
3. 在 `src/api.ts` 中添加 TypeScript 包装
4. 运行 `cargo test` + `npx tsc --noEmit` 验证

### 10.3 添加新页面

1. 在 `src/pages/` 创建新页面组件
2. 在 `src/App.tsx` 添加路由
3. 在 `src/components/Layout.tsx` 侧边栏添加导航项
4. 在 `src/components/CommandPalette.tsx` 添加命令项

### 10.4 领域逻辑架构原则

```
View (pages/components)
  ↓ 调用
Domain (domain/*.ts)
  ↓ 调用
API (api.ts → Tauri invoke)
  ↓
Rust Backend (lib.rs / config.rs)
```

- **组件不直接调用 Tauri 命令**
- 所有动作走 `precheck → execute → verify → persist → feedback`
- 所有错误映射到统一错误码 + trace_id

### 10.5 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+K` | 打开命令面板 |
| `↑ / ↓` | 命令面板中上下选择 |
| `Enter` | 执行选中命令 |
| `Escape` | 关闭命令面板/弹窗 |

---

## 11. 常见问题

### Q: `npm run tauri dev` 启动失败？

确保：
1. Rust 已安装：`rustc --version`
2. Node.js 已安装：`node --version`
3. 依赖已安装：`npm install`
4. Windows WebView2 已安装（Win 10/11 通常自带）

### Q: 找不到 cargo 或 node 命令？

设置 PATH：

```powershell
$env:Path = "C:\Program Files\nodejs;$env:USERPROFILE\.cargo\bin;$env:APPDATA\npm;$env:Path"
```

### Q: Target 显示"未找到窗口"？

1. 确保目标浏览器窗口已打开（如 ChatGPT 页面）
2. 窗口标题需包含配置中的 `title_contains` 字符串
3. 在 Targets 页面使用"验证向导"测试粘贴是否可用

### Q: 两阶段投递是什么？

§9.4 两阶段提交：
- **Stage**：将 prompt 粘贴到目标窗口的输入框，但不按回车
- **Send Now**：用户确认内容无误后，再按回车发送
- 这样可以在发送前预览和修改

### Q: 如何只运行前端（不需要 Tauri）？

```powershell
npm run dev
```

但 Tauri invoke 调用会报错，仅适合 UI 开发/调试。

### Q: 如何添加新的错误码？

在 `config/error-catalog.yaml` 中添加，格式：

```yaml
- code: "DISPATCH_1007"
  category: "dispatch"
  user_message: "目标窗口无响应"
  fix_suggestion: "检查浏览器是否正常运行"
  alert_level: "error"
  auto_fix_strategy: "restart_browser"
```

### Q: config/ 目录在哪？

配置文件目录由 Tauri 在首次运行时创建，位于应用数据目录。开发时可在 `src-tauri/` 旁通过 `.env` 指定自定义路径。

---

## 技术路线图

完整技术路线详见项目根目录的 [route.md](../../route.md)，共 90 个章节、1824 行，涵盖：

- §1-§3: 目标/架构/前端闭环
- §4: 本地 SLM 体系
- §5: 路由反馈学习
- §7: DAG 工作流引擎
- §8: 自愈引擎
- §9: Dispatch 流程
- §10-§90: 安全/审计/性能/测试/发布 等全方位规范
