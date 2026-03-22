#!/usr/bin/env bash
# ═══════════════════════════════════════════════
# build.sh — 高性能构建脚本 (Linux/macOS)
# ═══════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")/.."

MODE="${1:-release}"
JOBS="${2:-$(nproc 2>/dev/null || sysctl -n hw.logicalcpu 2>/dev/null || echo 2)}"

# 限制资源：最多使用 CPU 核心数的一半进行编译
MAX_JOBS=$(( JOBS > 1 ? JOBS / 2 : 1 ))

echo "═══════════════════════════════════════"
echo "  AI Workbench Build ($MODE)"
echo "  CPU cores: $JOBS, build jobs: $MAX_JOBS"
echo "═══════════════════════════════════════"

# ── 环境变量优化 ──
export CARGO_INCREMENTAL=1
export RUSTFLAGS="-C debuginfo=0"
export NODE_OPTIONS="--max-old-space-size=4096"

# ── 清理增量编译缓存（可选） ──
if [[ "${CLEAN:-}" == "1" ]]; then
  echo "🧹 清理构建缓存..."
  rm -rf dist src-tauri/target/debug/incremental node_modules/.cache
fi

# ── 前端构建 ──
echo ""
echo "📦 构建前端..."
START=$(date +%s)
npx tsc --noEmit
npx vite build
FE_TIME=$(( $(date +%s) - START ))
echo "✅ 前端构建完成 (${FE_TIME}s)"

# ── Rust 后端构建 ──
echo ""
echo "🦀 构建 Rust 后端 ($MODE)..."
START=$(date +%s)

if [[ "$MODE" == "release" ]]; then
  (cd src-tauri && cargo build --release --jobs "$MAX_JOBS")
else
  (cd src-tauri && cargo build --jobs "$MAX_JOBS")
fi

RS_TIME=$(( $(date +%s) - START ))
echo "✅ Rust 构建完成 (${RS_TIME}s)"

# ── 产物大小统计 ──
echo ""
echo "📊 构建产物:"
if [[ "$MODE" == "release" ]]; then
  BINARY=$(find src-tauri/target/release -maxdepth 1 -name "ai-workbench" -type f 2>/dev/null | head -1)
  if [ -n "$BINARY" ]; then
    SIZE=$(ls -lh "$BINARY" | awk '{print $5}')
    echo "   二进制: $SIZE"
  fi
fi

DIST_SIZE=$(du -sh dist 2>/dev/null | cut -f1 || echo "N/A")
echo "   前端dist: $DIST_SIZE"
echo ""
echo "═══════════════════════════════════════"
echo "  总用时: 前端 ${FE_TIME}s + Rust ${RS_TIME}s"
echo "═══════════════════════════════════════"
