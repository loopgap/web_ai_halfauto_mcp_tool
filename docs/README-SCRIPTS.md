# AI Workbench 脚本入口

## 推荐入口

```bash
pnpm bootstrap   # 新机器首选：自检 + 安装 + 完整门禁
pnpm doctor      # 诊断环境和关键测试
pnpm env:fix     # 仅修复环境问题
pnpm ci:local    # 本地完整门禁
pnpm git:ship    # 测试全绿后自动 commit + push origin/main
```

## 命令说明

| 命令 | 说明 |
|------|------|
| `pnpm bootstrap` | 自动检测工具链、安装依赖、初始化配置、安装 hooks、跑完整门禁 |
| `pnpm setup` | `pnpm bootstrap` 的兼容别名 |
| `pnpm env:check` | 只检查环境状态，不做修改 |
| `pnpm env:fix` | 尝试修复环境问题并补齐配置目录 |
| `pnpm doctor` | 诊断环境、hooks、TypeScript、Vitest、Cargo、governance |
| `pnpm doctor -- --fix` | 修复环境问题后继续做诊断 |
| `pnpm ci:local` | 执行本地完整 CI：env check、tsc、vitest、vite build、cargo、governance |
| `pnpm ci:local -- --fast` | 执行快速门禁：env check、tsc、核心治理检查 |
| `pnpm first-run` | 首次启动时的引导入口，内部委托 `env:fix` + `bootstrap` |
| `pnpm git:ship` | 只暂存安全范围文件，跑完整门禁，通过后 commit 并 push `origin/main` |
| `pnpm hooks:install` | 启用 `.githooks` |

## 自动化行为

### `pnpm bootstrap`

阶段固定为：
- 环境与系统依赖检测
- 自动修复可修复项
- `pnpm install --frozen-lockfile`
- `~/.ai-workbench/` 目录初始化
- Git hooks 安装
- `cargo check`
- `pnpm ci:local`

阻断策略：
- 缺管理员权限：停止并输出精确命令
- 网络失败：停止并保留已完成阶段
- 测试失败：停止，不继续 commit 或 push

### `pnpm git:ship`

默认行为：
- 当前分支必须是 `main`
- 远端必须是 GitHub `origin`
- 如果没有已暂存文件，只自动暂存 `README/QUICKSTART/docs/scripts/package/.githooks/.github` 范围
- 运行完整 `pnpm ci:local`
- 生成 conventional commit message
- `git push origin main`

常用参数：

```bash
pnpm git:ship -- --type chore --scope workflow --message "unify bootstrap automation"
pnpm git:ship -- --no-push
pnpm git:ship -- --all
```

## Hooks

- `pre-commit`：运行 `pnpm ci:local -- --fast`
- `pre-push`：运行 `pnpm ci:local`
- `commit-msg`：校验 conventional commits

## 兼容与范围

- Linux 自动安装当前只正式支持 `apt`
- Windows 自动化当前聚焦工具链检测、引导和项目依赖闭环
- macOS 当前仅保留手动支持，不纳入本轮自动化闭环
