# AI Workbench 自动化脚本说明

## 快速开始

```bash
# 一键初始化（Linux / macOS / Windows 通用）
node scripts/setup.mjs

# 启动 Tauri 全栈开发
npm run start

# 仅前端开发 (http://localhost:1420)
npm run start:fe

# 构建发布版
npm run build:app

# 环境诊断
npm run doctor
```

---

## 跨平台脚本 (.mjs)

所有核心脚本均使用 Node.js `.mjs` 编写，仅依赖 Node.js 内置模块，**无需额外安装任何依赖**，Linux / macOS / Windows 通用。

| 脚本 | npm alias | 说明 |
|------|-----------|------|
| `scripts/dev.mjs` | `npm run start` | 开发服务器启动 |
| `scripts/setup.mjs` | `npm run setup` | 环境初始化 |
| `scripts/doctor.mjs` | `npm run doctor` | 环境诊断 |
| `scripts/build.mjs` | `npm run build:app` | 构建前端 + Rust |
| `scripts/clean.mjs` | `npm run clean` | 清理构建缓存 |

### dev.mjs — 开发服务器

```bash
node scripts/dev.mjs              # 启动 Tauri 全栈
node scripts/dev.mjs --frontend   # 仅前端 (Vite :1420)
node scripts/dev.mjs --build      # 构建发布版
node scripts/dev.mjs --check      # 仅检查环境
```

### setup.mjs — 环境初始化

```bash
node scripts/setup.mjs
```

自动执行：
- ✅ 检查 Node.js / npm / Cargo / Rust 工具链
- ✅ Linux 系统包检查 (libwebkit2gtk 等)
- ✅ npm install
- ✅ cargo check
- ✅ 创建 `~/.ai-workbench/` 配置目录层级

### doctor.mjs — 环境诊断

```bash
node scripts/doctor.mjs            # 运行诊断
node scripts/doctor.mjs --fix      # 诊断并自动修复
node scripts/doctor.mjs --report   # 生成 doctor-report.txt
```

检查项：
- 💻 系统信息（平台/架构/内存）
- 🔧 工具链（Node.js/npm/Cargo/Rust/Git）
- 📦 项目状态（package.json/node_modules/lock file）
- 📝 TypeScript（tsc --noEmit）
- 🦀 Cargo（cargo check）
- 📂 配置目录完整性
- 💾 磁盘占用
- 🌐 端口 1420 可用性

### build.mjs — 构建

```bash
node scripts/build.mjs             # 发布构建 (Release)
node scripts/build.mjs --debug     # 调试构建
node scripts/build.mjs --clean     # 清理后构建
```

自动检测 CPU 核心数并优化并行编译 (使用核心数的一半)。

### clean.mjs — 清理

```bash
node scripts/clean.mjs soft        # 仅增量缓存 (默认)
node scripts/clean.mjs hard        # 所有构建产物 (含 target)
node scripts/clean.mjs full        # 完全重置 (含 node_modules)
```

---

## Windows .bat 文件（双击启动）

Windows 用户仍可使用根目录下的 `.bat` 文件双击启动（通过 PowerShell 脚本）：

| 文件 | 说明 |
|------|------|
| `start.bat` | 交互式菜单，包含启动/构建/诊断 |
| `setup.bat` | 调用 `scripts/setup.ps1` |
| `doctor.bat` | 调用 `scripts/doctor.ps1` |
| `build.bat` | 调用 `scripts/dev.ps1 -Build` |

---

## npm 脚本速查

```bash
# ── 开发 ──
npm run start                # Tauri 全栈开发
npm run start:fe             # 仅前端 (Vite)
npm run start:build          # 构建发布版
npm run dev                  # Vite dev server (裸)

# ── 环境 ──
npm run setup                # 环境初始化
npm run doctor               # 环境诊断
npm run doctor:report        # 生成诊断报告
npm run doctor:fix           # 诊断并自动修复

# ── 构建 ──
npm run build:app            # Release 构建
npm run build:app:debug      # Debug 构建
npm run build:app:clean      # 清理后构建
npm run build                # tsc + vite build (仅前端)

# ── 清理 ──
npm run clean                # 增量缓存
npm run clean:hard           # 所有构建产物
npm run clean:full           # 完全重置

# ── 检查 ──
npm run check                # TypeScript 类型检查
npm run check:rust           # Cargo check
npm run check:all            # TS + Rust

# ── 测试 ──
npm run test:governance:api  # 治理 API 合约
npm run test:governance:rust # Rust 治理测试
npm run test:all             # TS + Governance + Rust

# ── 治理 ──
npm run env:check            # 环境检查
npm run governance:validate  # 治理资产校验
npm run governance:evidence  # 证据包生成
npm run ci:governance        # CI 治理流水线
```

---

## 发布

使用 Git tag 触发 GitHub Actions 自动构建：

```bash
# 发布所有平台
git tag v0.1.0 && git push origin v0.1.0

# 仅 Linux
git tag v0.1.0-linux && git push origin v0.1.0-linux

# 仅 Windows
git tag v0.1.0-windows && git push origin v0.1.0-windows
```

产物：Linux (.deb / .AppImage)、Windows (.msi / .exe NSIS)。
详见 `.github/workflows/release.yml`。

---

## 常见问题

### Q: 双击 start.bat 没反应 / 闪退
1. 右键 → "以管理员身份运行"
2. 或在命令提示符中手动运行：`start.bat`

### Q: "npm 不是内部命令"
运行 `setup.bat` 或手动安装 Node.js: https://nodejs.org

### Q: TypeScript 编译错误
```powershell
npx tsc --noEmit  # 查看具体错误
```

### Q: Rust 编译错误
```powershell
cd src-tauri
cargo check       # 查看具体错误
cargo clean       # 清理后重新编译
```

### Q: 端口 1420 被占用
```powershell
# 查找占用进程
netstat -aon | findstr :1420
# 终止进程 (替换 PID)
taskkill /PID <PID> /F
```

### Q: WebView2 窗口白屏
安装最新 WebView2 运行时: https://developer.microsoft.com/en-us/microsoft-edge/webview2/

### Q: 如何获取完整诊断报告？
```powershell
.\scripts\doctor.ps1 -Report
# 报告保存在项目根目录 doctor-report.txt
```
