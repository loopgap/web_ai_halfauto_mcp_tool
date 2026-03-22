#!/usr/bin/env bash
# ═══════════════════════════════════════════════
# dev.sh — 开发环境启动脚本 (Linux/macOS)
# ═══════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")/.."

echo "🔍 检查环境..."
command -v node >/dev/null 2>&1 || { echo "❌ 未找到 Node.js"; exit 1; }
command -v cargo >/dev/null 2>&1 || { echo "❌ 未找到 Cargo/Rust"; exit 1; }

# 安装依赖（如果 node_modules 不存在）
if [ ! -d "node_modules" ]; then
  echo "📦 安装 npm 依赖..."
  npm install
fi

echo "🚀 启动开发服务器..."
exec npm run start:fe
