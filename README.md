# AI Workbench

本地优先、安全优先的 AI 工作台桌面应用。支持多模型网页端调度、规则引擎路由、Skill/Workflow 编排、全链路审计与治理闭环。

> 完整技术规格见 [route.md](route.md)（§1–§100）

---

## 📚 文档导航

### 🚀 快速开始（首选）
- **[QUICKSTART.md](QUICKSTART.md)** — 5 分钟快速启动（新手必读）
- **[docs/CONFIG.md](docs/CONFIG.md)** — 配置示例和模板

### 📖 完整指南
- **[docs/GUIDE.md](docs/GUIDE.md)** — 功能完整指南（1500+ 行）
- **[docs/README.md](docs/README.md)** — 文档目录和快速索引

### 🔧 故障排查与优化
- **[docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)** — 常见问题快速解决
- **[docs/PERFORMANCE.md](docs/PERFORMANCE.md)** — 性能优化和监控指南
- **构建优化说明** — 已切换至 `esbuild` 压缩，并限制了 CI 并行编译任务数以防止 OOM。

### 💻 开发资源
- **[docs/README-SCRIPTS.md](docs/README-SCRIPTS.md)** — 所有脚本详解
- **[CHANGELOG.md](CHANGELOG.md)** — 版本历史和更新日志

### 🩺 诊断工具
```bash
pnpm first-run      # 推荐首选：首次启动快速诊断
pnpm doctor         # 深度诊断和问题修复
pnpm start          # 启动应用后，Settings → 诊断查看实时状态
```

---

## 技术架构

```
┌────────────────────────────────────────────┐
│              Tauri v2 窗口                 │
│  ┌──────────────────────────────────────┐  │
│  │         React 19 + TypeScript 5.8   │  │
│  │  ┌──────┐ ┌────────┐ ┌──────────┐   │  │
│  │  │Pages │ │Components│ │  Hooks  │   │  │
│  │  └──┬───┘ └────┬───┘ └────┬─────┘   │  │
│  │     └──────┬───┘──────────┘          │  │
│  │         Store (AppStore)             │  │
│  │         Domain (业务逻辑)             │  │
│  └──────────────┬───────────────────────┘  │
│          Tauri IPC (invoke)                │
│  ┌──────────────┴───────────────────────┐  │
│  │         Rust 后端 (lib.rs)            │  │
│  │   config · vault · os-automation     │  │
│  └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

| 技术栈 | 版本 |
|--------|------|
| Tauri | v2.10+ |
| React | 19.1 |
| TypeScript | ~5.8 (strict) |
| Rust | 2021 edition |
| Vite | 7.x |
| Tailwind CSS | v4 |

---

## 项目结构

```
ai-workbench/
├── src/                        # 前端源码
│   ├── main.tsx                # 应用入口
│   ├── App.tsx                 # 路由定义
│   ├── api.ts                  # Tauri IPC 封装
│   ├── types.ts                # 全局 TypeScript 类型
│   ├── domain/                 # 业务逻辑层
│   │   ├── actions.ts          #   核心调度动作
│   │   ├── workflow-engine.ts  #   DAG 工作流引擎
│   │   ├── self-heal.ts        #   自愈引擎
│   │   ├── injection.ts        #   指令注入引擎
│   │   ├── slm.ts              #   本地 SLM 管理
│   │   ├── feedback-learning.ts#   路由反馈学习
│   │   ├── api-retry.ts        #   §96 IPC 重试退避
│   │   ├── persistence.ts      #   §97 UI 状态持久化
│   │   ├── config-export.ts    #   §93 配置导出/导入
│   │   ├── run-statistics.ts   #   §94 运行统计分析
│   │   └── dictionary.ts       #   UI 文案字典
│   ├── store/
│   │   └── AppStore.tsx        # 全局状态 (Context + Reducer)
│   ├── hooks/                  # React Hooks
│   │   ├── usePerformanceMonitor.ts  # §91 性能监控
│   │   ├── useKeyboardShortcuts.ts   # §92 全局快捷键
│   │   ├── useEventBus.ts            # Tauri 事件订阅
│   │   ├── useDebounce.ts            # 防抖
│   │   ├── useFocusTrap.ts           # 焦点锁定
│   │   ├── useVirtualScroll.ts       # 虚拟滚动
│   │   └── useThrottle.ts            # 节流
│   ├── components/             # 可复用组件
│   │   ├── Layout.tsx          #   主布局 + 导航 + 快捷键
│   │   ├── CommandPalette.tsx  #   Ctrl+K 命令面板
│   │   ├── PerformancePanel.tsx#   §91 性能面板
│   │   ├── ErrorBoundary.tsx   #   错误边界 (a11y)
│   │   └── ...
│   └── pages/                  # 页面组件
│       ├── Dashboard.tsx       #   仪表盘
│       ├── TargetsPage.tsx     #   目标管理
│       ├── SkillsPage.tsx      #   技能管理
│       ├── WorkflowsPage.tsx   #   工作流编排
│       ├── ConsolePage.tsx     #   调度控制台
│       ├── ArchivePage.tsx     #   历史归档 + 统计
│       └── SettingsPage.tsx    #   设置 + 配置导出 + Vault
├── src-tauri/                  # Rust 后端
│   ├── src/
│   │   ├── lib.rs              #   Tauri 命令 (~2400 行)
│   │   ├── config.rs           #   配置管理 (~2200 行)
│   │   └── main.rs             #   入口
│   ├── Cargo.toml              #   Rust 依赖
│   └── tauri.conf.json         #   Tauri 配置
├── scripts/                    # 跨平台脚本 (Node.js .mjs)
│   ├── dev.mjs                 #   §99 开发服务器
│   ├── setup.mjs               #   §99 环境初始化
│   ├── doctor.mjs              #   §99 环境诊断
│   ├── build.mjs               #   §99 构建
│   └── clean.mjs               #   §99 清理
├── governance/                 # 治理规范 v2
│   ├── standard-v2.md
│   ├── quality-gates.json
│   ├── maturity-model.json
│   ├── checklists/
│   ├── templates/
│   └── examples/
├── docs/                       # 文档
│   ├── GUIDE.md                #   完整使用指南
│   └── README-SCRIPTS.md       #   脚本说明
└── .github/workflows/          # CI/CD
    ├── ci.yml                  #   持续集成
    ├── governance.yml          #   治理验证
    └── release.yml             #   §99 标准发布流程
```

---

## 快速开始

### 前置条件

| 工具 | 最低版本 | 安装 |
|------|----------|------|
| Node.js | ≥18 | https://nodejs.org |
| Rust | ≥1.70 | https://rustup.rs |
| Linux 系统依赖 | — | `sudo apt-get install -y libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev` |

### 安装与运行

```bash
# 克隆项目
cd ai-workbench

# 一键自检 + 安装 + 完整门禁
pnpm bootstrap

# 如果当前机器还没有 pnpm，可先用 corepack 引导
corepack enable
corepack pnpm bootstrap

# 兼容别名仍可用
pnpm setup

# 启动开发服务器 (Tauri 全栈)
pnpm start

# 仅前端开发 (http://localhost:1420)
pnpm start:fe

# 构建发布版
pnpm build:app

# 本地完整 CI 预检
pnpm ci:local

# 自动提交并推送到 origin/main
pnpm git:ship

# Linux 预演（优先真实执行器，否则静态一致性检查）
pnpm ci:linux

# 发布前预检（当前平台）
pnpm release:preflight
```

### 环境诊断

```bash
pnpm env:check           # 只检查环境
pnpm env:fix             # 尝试自动修复环境
pnpm doctor              # 运行诊断
pnpm doctor -- --fix     # 诊断并自动修复
pnpm doctor -- --report  # 生成诊断报告
pnpm hooks:install       # 安装并启用 Git hooks
```

---

## pnpm 脚本速查

| 命令 | 说明 |
|------|------|
| `pnpm start` | 启动 Tauri 全栈开发 |
| `pnpm start:fe` | 仅前端 (Vite) |
| `pnpm build:app` | 构建 Release 版 |
| `pnpm build:app -- --debug` | 构建 Debug 版 |
| `pnpm bootstrap` | 自检、安装依赖、初始化配置并跑完整门禁 |
| `pnpm setup` | `pnpm bootstrap` 的兼容别名 |
| `pnpm hooks:install` | 安装并启用 Git hooks |
| `pnpm doctor` | 环境诊断 |
| `pnpm check` | TypeScript 类型检查 |
| `pnpm check:all` | TypeScript + Rust 检查 |
| `pnpm check:clippy` | Rust Clippy 严格检查 |
| `pnpm ci:local:fast` | 本地快速门禁（pre-commit 同款） |
| `pnpm ci:local` | 本地完整 CI 预检（env check、tsc、vitest、vite、cargo、governance） |
| `pnpm git:ship` | 通过完整门禁后自动 commit 并 push `origin/main` |
| `pnpm ci:local:clean` | 清理后运行本地完整 CI |
| `pnpm ci:linux` | Linux 预演（优先真实执行器，否则静态一致性检查） |
| `pnpm release:preflight` | 当前平台发布前预检 |
| `pnpm clean` | 清理增量缓存 |
| `pnpm clean:hard` | 清理所有构建产物 |
| `pnpm test:all` | TS + Governance + Rust 全部测试 |

---

## 平台支持矩阵

| 平台 | 当前状态 | 说明 |
|------|----------|------|
| Linux (apt) | 自动化闭环 | 可自动检查并尽量安装 Tauri 系统依赖 |
| Linux (非 apt) | 手工系统依赖 | 继续支持项目依赖与门禁，但系统包需手动安装 |
| Windows | 自动化闭环 | 工具链检测、依赖安装、本地门禁与发布闭环 |
| macOS | 手动支持 | 不提供自动系统依赖修复，也不在本轮发布闭环内 |

## 发布

使用 Git tag 触发 GitHub Actions 自动构建和发布：

```bash
# 发布所有平台
git tag v0.1.0
git push origin v0.1.0

# 仅发布 Linux
git tag v0.1.0-linux
git push origin v0.1.0-linux

# 仅发布 Windows
git tag v0.1.0-windows
git push origin v0.1.0-windows
```

产物格式：
- **Linux**: `.deb` (Debian/Ubuntu) + `.AppImage` (通用)
- **Windows**: `.msi` (Windows Installer) + `.exe` (NSIS)

详见 [release.yml](../.github/workflows/release.yml)。

---

## 文档

| 文档 | 说明 |
|------|------|
| [route.md](../route.md) | 完整技术路线 (§1–§99)，包含类型定义、状态机、API 设计 |
| [docs/GUIDE.md](docs/GUIDE.md) | 使用指南 |
| [docs/README-SCRIPTS.md](docs/README-SCRIPTS.md) | 脚本使用说明 |
| [governance/README.md](governance/README.md) | 治理规范说明 |
| [CHANGELOG.md](CHANGELOG.md) | 变更日志 |

---

## 许可证

Private — 内部使用。
