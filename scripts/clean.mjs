#!/usr/bin/env node
// ═══════════════════════════════════════════════
// clean.mjs — 跨平台清理脚本 (Linux/macOS/Windows)
// 无外部依赖，仅使用 Node.js 内置模块
// ═══════════════════════════════════════════════
import { existsSync, rmSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
process.chdir(ROOT);

function formatBytes(b) {
  if (b < 1048576) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
  return `${(b / 1073741824).toFixed(2)} GB`;
}

function safeRemove(relativePath) {
  const p = resolve(ROOT, relativePath);
  if (existsSync(p)) {
    rmSync(p, { recursive: true, force: true });
    console.log(`  🗑️  ${relativePath}`);
    return true;
  }
  return false;
}

const level = process.argv[2] || 'soft';

console.log(`\n🧹 清理模式: ${level}\n`);

switch (level) {
  case 'soft':
    safeRemove('dist');
    safeRemove('node_modules/.cache');
    safeRemove('src-tauri/target/debug/incremental');
    safeRemove('src-tauri/target/release/incremental');
    // glob for *.tsbuildinfo
    for (const f of readdirSync(ROOT)) {
      if (f.endsWith('.tsbuildinfo')) safeRemove(f);
    }
    safeRemove('doctor-report.txt');
    console.log('\n✅ 增量缓存已清理');
    break;

  case 'hard':
    safeRemove('dist');
    safeRemove('src-tauri/target');
    safeRemove('node_modules/.cache');
    for (const f of readdirSync(ROOT)) {
      if (f.endsWith('.tsbuildinfo')) safeRemove(f);
    }
    safeRemove('doctor-report.txt');
    console.log('\n✅ 所有构建产物已清理');
    break;

  case 'full':
    safeRemove('dist');
    safeRemove('src-tauri/target');
    safeRemove('node_modules');
    for (const f of readdirSync(ROOT)) {
      if (f.endsWith('.tsbuildinfo')) safeRemove(f);
    }
    safeRemove('doctor-report.txt');
    console.log('\n✅ 完全重置完成 — 需运行 npm install');
    break;

  default:
    console.log('用法: node scripts/clean.mjs [soft|hard|full]');
    console.log('  soft: 仅清理增量缓存 (默认)');
    console.log('  hard: 清理所有构建产物');
    console.log('  full: 完全重置（含 node_modules）');
    process.exit(1);
}

// 显示磁盘占用
const targetDir = resolve(ROOT, 'src-tauri', 'target');
if (existsSync(targetDir)) {
  console.log(`\n📊 src-tauri/target: 存在`);
} else {
  console.log('\n📊 src-tauri/target: 已清理');
}
