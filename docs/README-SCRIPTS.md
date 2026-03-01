# AI Workbench 自动化脚本说明

## 快速开始（三种方式任选其一）

### 方式 1：双击启动（推荐新手）
直接双击项目根目录下的 **`start.bat`**，自动完成环境检查 + 依赖安装 + 启动开发服务器。

### 方式 2：PowerShell 启动
```powershell
cd C:\Users\Administrator\Desktop\web_workflow\ai-workbench
.\scripts\dev.ps1
```

### 方式 3：npm 启动（需先确保 npm 在 PATH 中）
```powershell
npm run start
```

---

## 脚本一览

| 文件 | 类型 | 说明 |
|------|------|------|
| `start.bat` | 🖱️ 双击 | 一键启动开发服务器 |
| `setup.bat` | 🖱️ 双击 | 一键配置所有环境 |
| `doctor.bat` | 🖱️ 双击 | 一键运行环境诊断 |
| `build.bat` | 🖱️ 双击 | 一键构建生产版本 |
| `scripts/dev.ps1` | PowerShell | 开发服务器启动器 |
| `scripts/setup.ps1` | PowerShell | 环境自动配置脚本 |
| `scripts/doctor.ps1` | PowerShell | 环境自检诊断工具 |

---

## 详细说明

### 🔧 setup.ps1 — 环境自动配置

**功能：** 自动检测并安装/修复所有开发环境依赖。

```powershell
.\scripts\setup.ps1              # 完整安装（推荐）
.\scripts\setup.ps1 -SkipRust    # 跳过 Rust（仅前端开发）
.\scripts\setup.ps1 -Force       # 强制重新安装依赖
.\scripts\setup.ps1 -Verbose     # 详细输出
```

**自动处理的内容：**
- ✅ PATH 环境变量检测与修复
- ✅ Node.js 安装（支持 winget / scoop / choco 多种方案）
- ✅ Rust 工具链安装（rustup）
- ✅ npm 依赖安装
- ✅ Tauri CLI 检查
- ✅ WebView2 运行时检查
- ✅ Visual C++ Build Tools 检查
- ✅ 磁盘空间、内存检查
- ✅ PATH 持久化到 PowerShell Profile

**安装方案优先级：**
| 优先级 | Node.js | Rust |
|--------|---------|------|
| 1 | winget (推荐) | rustup (推荐) |
| 2 | scoop | winget |
| 3 | chocolatey | 手动安装 |
| 4 | 手动安装 | — |

---

### 🚀 dev.ps1 — 开发服务器启动器

**功能：** 一键启动 Tauri 开发服务器（自动修复环境问题）。

```powershell
.\scripts\dev.ps1                # 启动完整开发服务器（Vite + Tauri）
.\scripts\dev.ps1 -FrontendOnly  # 仅启动前端 (Vite on :1420)
.\scripts\dev.ps1 -Build         # 构建生产版本
.\scripts\dev.ps1 -Check         # 仅检查环境，不启动
.\scripts\dev.ps1 -SkipSetup     # 跳过环境检查（加速启动）
```

**启动流程：**
1. 自动修复 PATH
2. 快速检查环境（Node / npm / Cargo）
3. 如果环境不完整 → 自动调用 setup.ps1 修复
4. 如果 node_modules 不存在 → 自动 npm install
5. 启动开发服务器

---

### 🩺 doctor.ps1 — 环境诊断工具

**功能：** 全面检查开发环境状态，类似 `flutter doctor`。

```powershell
.\scripts\doctor.ps1             # 运行完整诊断
.\scripts\doctor.ps1 -Fix        # 诊断并尝试自动修复
.\scripts\doctor.ps1 -Report     # 生成诊断报告文件
```

**检查项目：**
- **系统环境：** 操作系统、架构、磁盘空间、内存、PowerShell 版本
- **开发工具：** Node.js、npm、Cargo、rustc、Git
- **PATH 变量：** 各工具路径是否正确配置
- **项目状态：** package.json、node_modules、Tauri CLI、TypeScript 编译
- **运行时：** WebView2、C++ Build Tools
- **端口状态：** 1420/1421 端口是否被占用

**输出示例：**
```
  ── 开发工具 ──
  ✅ Node.js : v24.14.0 (C:\Program Files\nodejs\node.exe)
  ✅ npm : v11.9.0
  ✅ Cargo : cargo 1.93.1
  ✅ rustc : rustc 1.93.1

  ════════════════════════════════════════════
  ✅ 诊断完成: 18/18 通过, 0 警告, 0 失败
```

---

### 🖱️ .bat 文件 — 双击启动

所有 `.bat` 文件都是对 PowerShell 脚本的简单封装，特点：
- **自动修复 PATH** — 无需手动配置
- **自动设置执行策略** — 绕过 PowerShell 脚本限制
- **优先使用 pwsh 7** — 自动回退到 PowerShell 5.1
- **双击即用** — 不需要打开终端

---

## npm 脚本

通过 npm 调用的便捷命令（需要 npm 已在 PATH 中）：

```bash
npm run start          # 启动 tauri dev
npm run start:fe       # 仅启动前端
npm run setup          # 运行环境配置
npm run doctor         # 运行环境诊断
npm run doctor:fix     # 诊断并修复
npm run doctor:report  # 生成诊断报告
npm run check          # TypeScript + Rust 检查
npm run check:ts       # 仅 TypeScript 检查
npm run check:rust     # 仅 Rust 检查
npm run test:all       # 运行所有测试
npm run clean          # 清理缓存
npm run clean:all      # 清理所有构建产物
```

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
