# 🔧 故障排查指南

> 遇到问题？按照这个指南诊断和解决常见问题。

## 🚀 快速诊断

首先运行自动诊断脚本：

```bash
pnpm first-run      # 首次启动诊断 + 修复建议
pnpm doctor         # 深度系统诊断报告
pnpm doctor --fix   # 尝试自动修复
```

这会检查：
- ✅ Node.js / pnpm / Rust 工具链
- ✅ 系统依赖（Linux）
- ✅ 配置目录和日志
- ✅ TypeScript 编译
- ✅ 单元测试
- ✅ 本地 CI 状态

---

## 📋 按症状快速索引

### 启动相关

#### 问题：`Command not found: pnpm`
**症状：** 运行 `pnpm` 报错

**解决：**
```bash
# 推荐优先使用 corepack 拉起仓库固定版本
corepack enable
corepack pnpm --version
corepack pnpm bootstrap

# 如果必须全局安装，再手动安装 pnpm
npm install -g pnpm@10.11.0
```

#### 问题：`Cannot find module '...'`
**症状：** 启动时报依赖找不到

**解决：**
```bash
# 清理并重新安装
pnpm clean:full
pnpm install

# 如果还是不行，尝试清理锁文件
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

#### 问题：端口 1420 被占用
**症状：** `listen EADDRINUSE: address already in use :::1420`

**解决：**
```bash
# 查找进程（Linux/macOS）
lsof -i :1420
# 或杀死前一个进程
fuser -k 1420/tcp

# Windows
netstat -ano | findstr :1420
taskkill /PID <PID> /F
```

---

### 编译和构建

#### 问题：TypeScript 编译错误
**症状：** `pnpm check` 或 `pnpm start` 时出现类型错误

**解决：**
```bash
# 查看详细错误
pnpm check --listFilesOnly

# 清理所有编译缓存
pnpm clean:full

# 逐步检查
pnpm exec tsc --incremental false
```

**常见原因：**
- 合并冲突未完全解决（查看 /// <reference ... /> 注释）
- 新依赖缺少 @types（运行 `pnpm doctor` 检查）

#### 问题：Vite 构建失败
**症状：** `pnpm build` 或 `pnpm build:app` 出错

**解决：**
```bash
# 1. 先检查 TS 编译
pnpm check

# 2. 清理构建输出
rm -rf dist

# 3. 重新构建（带详细日志）
pnpm exec vite build --debug

# 4. 如果涉及 Tauri，检查 Rust 编译
cargo check --manifest-path src-tauri/Cargo.toml
```

**常见原因：**
- 缺少 Rust 工具链（Linux，见下文）
- 文件系统编码问题（Windows，尝试使用 Git Bash）

#### 问题：`cargo not found` 或 Rust 编译失败
**症状：** 构建时提示没有 Rust

**解决：**

如果你**只需要前端**，跳过 Rust：
```bash
pnpm start:fe      # 仅前端开发服务器
pnpm build         # 仅前端构建
```

如果你**需要完整的 Tauri 应用**，安装 Rust：
```bash
# macOS
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

# Linux
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
# 然后安装系统依赖（见下文）

# Windows
# 1. 下载 rustup-init.exe: https://rustup.rs
# 2. 运行安装程序
# 3. 验证: rustc --version
```

**Linux 系统依赖：**
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev

# Fedora / RHEL 系
sudo dnf install webkit2-gtk3-devel gtk3-devel libayatana-appindicator-devel librsvg2-devel

# Arch
sudo pacman -S webkit2gtk gtk3 libayatana-appindicator librsvg

# 验证
rustc --version        # 应该显示版本
cargo --version        # 应该显示版本
```

---

### 运行和测试

#### 问题：`pnpm start` 黑屏或无法连接
**症状：** 应用启动但空白页面或连接失败

**解决方案：**
```bash
# 1. 查看浏览器开发者工具（F12）
# 2. 检查网络标签中的错误请求
# 3. 查看控制台中的 JavaScript 错误

# 4. 尝试清理存储和重启
# Settings → 诊断 → 点击「导出诊断包」查看细节

# 5. 如果是 API 连接问题
pnpm doctor  # 查看诊断报告中的 API 连通性
```

#### 问题：测试失败或无法运行
**症状：** `pnpm test` 出错或某些测试失败

**解决：**
```bash
# 运行所有测试（详细输出）
pnpm test -- --reporter=verbose

# 运行特定文件
pnpm test -- src/__tests__/domain/actions.test.ts

# 运行并覆盖率报告
pnpm test:coverage

# 检查是否有新的文件系统问题
find src -name "*.test.ts" -exec echo {} \;
```

**常见原因：**
- Tauri 事件 mock 问题（查看 src/__tests__/setup.ts）
- 本地时间差导致时间戳相关测试失败
- 并发测试环境污染

---

### 开发环境问题

#### 问题：Git 预提交钩子失败
**症状：** `git commit` 被拒绝

**解决：**
```bash
# 1. 查看失败原因
# 输出会显示具体是 TypeScript、ESLint 还是其他

# 2. 按提示修复代码
# 通常是类型错误或 linting 问题

# 3. 重新 add 和 commit
git add .
git commit -m "修复: 类型/样式问题"

# 4. 如果需要强制跳过（不推荐）
git commit --no-verify
```

#### 问题：代码不热更新（开发时）
**症状：** 修改文件后页面没有自动刷新

**解决：**
```bash
# 1. 检查 Vite 开发服务器是否运行
ps aux | grep vite

# 2. 重启开发服务器
pnpm start:fe

# 3. 如果是特定文件不更新，检查文件名大小写
# （Windows 文件系统大小写不敏感，但 Git 敏感）

# 4. 查看 vite.config.ts 中的 watch 配置
```

---

### 性能问题

#### 问题：启动或构建缓慢
**症状：** `pnpm start` 或 `pnpm build` 耗时超过 30 秒

**解决：**
```bash
# 1. 分析构建时间
pnpm start --debug 2>&1 | grep -E "^\[.*\]"

# 2. 检查是否有文件系统延迟（特别是 WSL2）
# WSL2 → 使用 WSL 内部路径（/home/...）而不是 /mnt/c/...

# 3. 禁用某些功能获得性能提升
pnpm ci:local:fast  # 跳过某些检查

# 4. 如果是 Rust 编译慢，使用发布构建缓存
cargo build --release --manifest-path src-tauri/Cargo.toml
```

#### 问题：内存占用过高
**症状：** 开发时内存占用 > 2GB

**解决：**
```bash
# 1. 关闭不需要的进程
pnpm clean  # 清空构建输出

# 2. 分离前后端开发
pnpm start:fe   # 仅前端（内存用量 <300MB）

# 3. 减少同时运行的编译器
# 修改 vite.config.ts 中的 workers 数量
```

---

### 多平台特定问题

#### Windows 特定问题

**问题：路径长度超过 260 字符**
```bash
# 启用长路径支持（需要管理员）
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1
```

**问题：`npm ERR! code ENOENT`**
```bash
# 确保使用 pnpm 而不是 npm
pnpm install
pnpm start
```

#### Linux 特定问题

**问题：Tauri 应用无法启动（黑屏）**
```bash
# 运行诊断
pnpm doctor

# 检查 GTK 依赖
ldd ~/.ai-workbench/dist/ai-workbench 2>&1 | grep "not found"

# 安装缺失的库
sudo apt-get install libgtk-3-0 libwebkit2gtk-4.1-0
```

**问题：高 DPI 显示器缩放问题**
```bash
# 编辑 src-tauri/tauri.conf.json，添加:
"scale": {
  "scaleFactor": 1.5
}
```

#### macOS 特定问题

说明：macOS 当前保留手动支持，但不在自动化闭环与发布矩阵中；遇到系统依赖问题时需要手动补齐本机环境。

**问题：`Command not found: rustc` (M1/M2 Mac)**
```bash
# 确保安装了 ARM64 版本的 Rust
rustup default stable-aarch64-apple-darwin

# 或完全重新安装
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

**问题：代码签名错误**
```bash
# 构建时跳过签名验证（开发用）
# 修改 src-tauri/tauri.conf.json:
"bundle": {
  "macos": {
    "signingIdentity": null
  }
}
```

---

## 📊 诊断输出解读

运行 `pnpm doctor` 后，查看输出中的关键部分：

### 红色（❌）— 需要立即修复
- `Node.js`: 版本过旧（需 ≥18.16）
- `pnpm`: 未安装或版本不匹配
- `缺少 Rust` 且需要 Tauri 应用

### 黄色（⚠️）— 非关键（通常可忽略）
- `Rust`: 仅在不构建 Tauri 应用时可选
- `Linux GTK 库`: 部分库已有替代品
- `磁盘空间`: 警告但不立即失败

### 绿色（✅）— 一切正常
- 所有工具链就位
- 依赖已安装
- 可以构建和运行

---

## 🆘 进阶诊断

### 收集诊断信息用于报告 Bug

```bash
# 1. 生成完整诊断包
pnpm doctor --report

# 2. 导出应用日志
# 打开 Settings → 诊断 → 导出诊断包

# 3. 查看原始日志文件
cat ~/.ai-workbench/health/first-run-*.json   # 启动诊断
cat ~/.ai-workbench/logs/*.log                 # 应用日志

# 4. 如果是 Rust 相关
cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture
```

### 启用调试模式

```bash
# 前端调试输出
DEBUG=* pnpm start:fe

# Tauri 调试
TAURI_DEBUG=1 pnpm start

# 复合调试（所有日志）
DEBUG=* TAURI_DEBUG=1 pnpm start
```

---

## 📞 获取帮助

1. **首先尝试自动化修复**
   ```bash
   pnpm doctor --fix
   ```

2. **查看完整文档**
   - [GUIDE.md](./GUIDE.md) — 完整功能指南
   - [CONFIG.md](./CONFIG.md) — 配置详解
   - [QUICKSTART.md](../QUICKSTART.md) — 快速开始

3. **查看项目日志**
   ```bash
   ~/.ai-workbench/logs/
   ~/.ai-workbench/health/
   ```

4. **报告 Bug**
   - 收集上述诊断包
   - 提供 OS 版本和 Node.js 版本
   - 说明最后一次工作时的版本（如适用）

---

**最后更新：2025 Q1 | 版本：0.4.0+**
