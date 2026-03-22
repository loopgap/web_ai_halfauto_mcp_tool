#!/usr/bin/env bash
# ═══════════════════════════════════════════════
# setup.sh — 环境初始化脚本 (Linux/macOS)
# ═══════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")/.."

echo "═══════════════════════════════════════"
echo "  AI Workbench — 环境初始化"
echo "═══════════════════════════════════════"

# ── 检查必要工具 ──
MISSING=()
command -v node   >/dev/null 2>&1 || MISSING+=("node")
command -v pnpm   >/dev/null 2>&1 || MISSING+=("pnpm")
command -v cargo  >/dev/null 2>&1 || MISSING+=("cargo")
command -v rustc  >/dev/null 2>&1 || MISSING+=("rustc")

if [ ${#MISSING[@]} -gt 0 ]; then
  echo "❌ 缺少以下工具: ${MISSING[*]}"
  echo "   请安装 Node.js (≥18) 和 Rust toolchain"
  exit 1
fi

echo "✅ Node.js $(node --version)"
echo "✅ pnpm $(pnpm --version)"
echo "✅ Rust $(rustc --version)"
echo "✅ Cargo $(cargo --version)"

# ── 检查系统依赖 (Linux) ──
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  echo ""
  echo "🔍 检查 Linux 系统依赖..."
  PKGS=("libwebkit2gtk-4.1-dev" "libgtk-3-dev" "libayatana-appindicator3-dev" "librsvg2-dev")
  MISSING_PKGS=()
  for pkg in "${PKGS[@]}"; do
    if ! dpkg -s "$pkg" >/dev/null 2>&1; then
      MISSING_PKGS+=("$pkg")
    fi
  done
  if [ ${#MISSING_PKGS[@]} -gt 0 ]; then
    echo "⚠️  缺少系统包: ${MISSING_PKGS[*]}"
    echo "   运行: sudo apt-get install -y ${MISSING_PKGS[*]}"
  else
    echo "✅ 系统依赖完整"
  fi
fi

# ── 安装 pnpm 依赖 ──
echo ""
echo "📦 安装 pnpm 依赖..."
pnpm install

# ── 检查 Rust 编译 ──
echo ""
echo "🦀 检查 Rust 编译..."
cd src-tauri
cargo check --jobs 2 2>&1 || echo "⚠️  Cargo check 出现警告（可能缺少系统依赖）"
cd ..

# ── 确保配置目录 ──
echo ""
echo "📂 初始化配置目录..."
mkdir -p ~/.ai-workbench/{config,vault/{runs,artifacts,governance,events,traces},health}

echo ""
echo "═══════════════════════════════════════"
echo "  ✅ 初始化完成！"
echo "  运行 'pnpm dev' 启动前端"
echo "  运行 'pnpm start' 启动 Tauri 应用"
echo "═══════════════════════════════════════"
