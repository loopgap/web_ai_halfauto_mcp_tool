#!/usr/bin/env bash
# ═══════════════════════════════════════════════
# clean.sh — 清理构建缓存和临时文件
# ═══════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")/.."

LEVEL="${1:-soft}"

echo "🧹 清理模式: $LEVEL"

case "$LEVEL" in
  soft)
    # 仅清理增量缓存，保留编译产物
    echo "  清理增量编译缓存..."
    rm -rf node_modules/.cache
    rm -rf src-tauri/target/debug/incremental
    rm -rf src-tauri/target/release/incremental
    rm -rf dist
    rm -f *.tsbuildinfo
    rm -f doctor-report.txt
    echo "✅ 增量缓存已清理"
    ;;
  hard)
    # 清理所有构建产物
    echo "  清理所有构建产物..."
    rm -rf dist dist-ssr
    rm -rf src-tauri/target
    rm -rf node_modules/.cache
    rm -f *.tsbuildinfo
    rm -f doctor-report.txt
    echo "✅ 所有构建产物已清理"
    ;;
  full)
    # 完全重置
    echo "  完全重置（包括 node_modules）..."
    rm -rf dist dist-ssr
    rm -rf src-tauri/target
    rm -rf node_modules
    rm -f *.tsbuildinfo
    rm -f doctor-report.txt
    echo "✅ 完全重置完成 — 需运行 pnpm install"
    ;;
  *)
    echo "用法: clean.sh [soft|hard|full]"
    echo "  soft: 仅清理增量缓存 (默认)"
    echo "  hard: 清理所有构建产物"
    echo "  full: 完全重置（含 node_modules）"
    exit 1
    ;;
esac

# 显示磁盘空间节省
if [ -d "src-tauri/target" ]; then
  echo "📊 src-tauri/target: $(du -sh src-tauri/target | cut -f1)"
else
  echo "📊 src-tauri/target: 已清理"
fi
