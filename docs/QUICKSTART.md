# AI Workbench Quickstart

## 首选入口

```bash
git clone https://github.com/loopgap/web_ai_halfauto_mcp_tool.git
cd web_ai_halfauto_mcp_tool/ai-workbench

# 已有 pnpm 时：
pnpm bootstrap

# 若系统还没有 pnpm，先让 corepack 拉起固定版本
corepack enable
corepack pnpm bootstrap

# 需要自动提交并推送到 origin/main
pnpm git:ship -- --message "ship bootstrap automation"
```

## `pnpm bootstrap` 会做什么

- 自动检测 `Node.js`、`pnpm`、`cargo`、`rustc`、`git`
- Linux `apt` 系统上自动检查并尽量安装 Tauri 系统包
- 自动执行 `pnpm install --frozen-lockfile`
- 自动创建 `~/.ai-workbench/` 配置目录
- 自动安装 `.githooks`
- 自动执行 `cargo check`
- 自动执行 `pnpm ci:local`
- 任何未自动修复的问题都会立即停止并给出下一步命令

## 日常命令

```bash
pnpm env:check     # 只检查环境
pnpm env:fix       # 尝试修复环境问题
pnpm doctor        # 诊断环境和关键测试
pnpm doctor -- --fix
pnpm ci:local      # 完整本地门禁
pnpm ci:local -- --fast
pnpm start         # 启动 Tauri 全栈
pnpm start:fe      # 仅前端
```

## 自动提交与推送

```bash
# 默认只自动暂存 docs/scripts/package/.githooks/.github 等安全范围文件
pnpm git:ship

# 自定义 conventional commit message
pnpm git:ship -- --type chore --scope workflow --message "unify bootstrap and CI automation"

# 仅提交，不推送
pnpm git:ship -- --no-push
```

约束：
- 当前分支必须是 `main`
- 远端必须存在 `origin` 且指向 GitHub
- 提交前必须通过完整 `pnpm ci:local`
- push 失败不会回滚本地提交

## 当前支持范围

- Linux：正式支持 `apt` 系发行版的自动系统包安装
- Windows：正式支持工具链检测、引导和项目依赖闭环
- macOS：保留手动支持，但本次不纳入自动化闭环

## 常见阻断

```bash
# Linux 缺管理员权限时，脚本会输出类似命令
sudo apt-get update && sudo apt-get install -y \
  libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev patchelf

# pnpm 缺失时，用 corepack 引导固定版本
corepack enable
corepack pnpm bootstrap
```
