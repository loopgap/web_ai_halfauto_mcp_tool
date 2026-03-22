#!/usr/bin/env bash
# ═══════════════════════════════════════════════
# doctor.sh — 环境诊断脚本 (Linux/macOS)
# ═══════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")/.."

REPORT=""
WARNINGS=0
ERRORS=0

log_ok()   { echo "  ✅ $1"; REPORT+="OK: $1\n"; }
log_warn() { echo "  ⚠️  $1"; WARNINGS=$((WARNINGS+1)); REPORT+="WARN: $1\n"; }
log_err()  { echo "  ❌ $1"; ERRORS=$((ERRORS+1)); REPORT+="ERR: $1\n"; }

echo "═══════════════════════════════════════"
echo "  AI Workbench Doctor"
echo "═══════════════════════════════════════"
echo ""

# ── 工具链 ──
echo "🔧 工具链检查:"
if command -v node >/dev/null 2>&1; then
  NODE_VER=$(node --version | tr -d 'v')
  MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
  if [ "$MAJOR" -ge 18 ]; then
    log_ok "Node.js v$NODE_VER"
  else
    log_warn "Node.js v$NODE_VER (建议 ≥18)"
  fi
else
  log_err "Node.js 未安装"
fi

if command -v cargo >/dev/null 2>&1; then
  log_ok "Cargo $(cargo --version | cut -d' ' -f2)"
else
  log_err "Cargo/Rust 未安装"
fi

if command -v rustc >/dev/null 2>&1; then
  log_ok "Rust $(rustc --version | cut -d' ' -f2)"
else
  log_err "rustc 未安装"
fi

# ── 依赖 ──
echo ""
echo "📦 依赖检查:"
if [ -d "node_modules" ]; then
  log_ok "node_modules 已安装"
else
  log_warn "node_modules 不存在 — 运行 npm install"
fi

if [ -f "package-lock.json" ]; then
  log_ok "package-lock.json 存在"
else
  log_warn "package-lock.json 缺失"
fi

# ── TypeScript ──
echo ""
echo "📝 TypeScript 检查:"
if npx tsc --noEmit 2>/dev/null; then
  log_ok "TypeScript 无类型错误"
else
  log_warn "TypeScript 存在类型错误"
fi

# ── Cargo ──
echo ""
echo "🦀 Cargo 检查:"
if (cd src-tauri && cargo check --jobs 2 2>/dev/null); then
  log_ok "Cargo check 通过"
else
  log_warn "Cargo check 失败（可能缺少系统依赖）"
fi

# ── 配置目录 ──
echo ""
echo "📂 配置目录:"
CONFIG_DIR="$HOME/.ai-workbench"
if [ -d "$CONFIG_DIR" ]; then
  log_ok "配置目录 $CONFIG_DIR 存在"
  for sub in config vault vault/runs vault/artifacts vault/governance; do
    if [ -d "$CONFIG_DIR/$sub" ]; then
      log_ok "  $sub/"
    else
      log_warn "  $sub/ 不存在"
    fi
  done
else
  log_warn "配置目录不存在 — 运行 setup.sh"
fi

# ── 磁盘空间 ──
echo ""
echo "💾 磁盘空间:"
if [ -d "src-tauri/target" ]; then
  TARGET_SIZE=$(du -sh src-tauri/target 2>/dev/null | cut -f1)
  log_ok "src-tauri/target: $TARGET_SIZE"
else
  log_ok "src-tauri/target: 未构建"
fi

# ── 报告 ──
echo ""
echo "═══════════════════════════════════════"
echo "  诊断完成: $ERRORS 错误, $WARNINGS 警告"
echo "═══════════════════════════════════════"

# 导出报告
if [[ "${1:-}" == "--report" ]]; then
  echo -e "$REPORT" > doctor-report.txt
  echo "📄 报告已保存到 doctor-report.txt"
fi

exit $ERRORS
