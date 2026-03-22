#!/usr/bin/env node
// ═══════════════════════════════════════════════
// build.mjs — 跨平台构建脚本 (Linux/macOS/Windows)
// 无外部依赖，仅使用 Node.js 内置模块
// ═══════════════════════════════════════════════
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cpus, platform } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
process.chdir(ROOT);

const isWin = platform() === 'win32';

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: 'inherit', cwd: ROOT, shell: true, ...opts });
}

function formatBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
  return `${(b / 1073741824).toFixed(2)} GB`;
}

// ── 参数 ──
const args = process.argv.slice(2);
const mode = args.includes('--debug') || args.includes('-d') ? 'debug' : 'release';
const clean = args.includes('--clean') || args.includes('-c');

const totalCores = cpus().length;
const jobs = Math.max(1, Math.floor(totalCores / 2));

console.log('');
console.log('═══════════════════════════════════════');
console.log(`  AI Workbench Build (${mode})`);
console.log(`  平台: ${platform()} | CPU: ${totalCores} 核, 并行: ${jobs}`);
console.log('═══════════════════════════════════════');

// ── 清理 ──
if (clean) {
  console.log('\n🧹 清理构建缓存...');
  const removals = ['dist', 'node_modules/.cache'];
  for (const r of removals) {
    const p = resolve(ROOT, r);
    if (existsSync(p)) {
      if (isWin) run(`rmdir /s /q "${p}"`, { stdio: 'ignore' });
      else run(`rm -rf "${p}"`, { stdio: 'ignore' });
    }
  }
}

// ── 环境变量 ──
process.env.CARGO_INCREMENTAL = '1';
process.env.RUSTFLAGS = process.env.RUSTFLAGS || '-C debuginfo=0';
process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || '--max-old-space-size=4096';

// ── 前端构建 ──
console.log('\n📦 构建前端...');
const feStart = Date.now();
run('npx tsc --noEmit');
run('npx vite build');
const feTime = ((Date.now() - feStart) / 1000).toFixed(1);
console.log(`  ✅ 前端构建完成 (${feTime}s)`);

// ── Rust 后端构建 ──
console.log(`\n🦀 构建 Rust 后端 (${mode})...`);
const rsStart = Date.now();
const cargoCmd = mode === 'release'
  ? `cargo build --release --jobs ${jobs}`
  : `cargo build --jobs ${jobs}`;
run(cargoCmd, { cwd: resolve(ROOT, 'src-tauri') });
const rsTime = ((Date.now() - rsStart) / 1000).toFixed(1);
console.log(`  ✅ Rust 构建完成 (${rsTime}s)`);

// ── 产物统计 ──
console.log('\n📊 构建产物:');
const distDir = resolve(ROOT, 'dist');
if (existsSync(distDir)) {
  let totalSize = 0;
  const walk = (dir) => {
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      const fp = resolve(dir, f.name);
      if (f.isDirectory()) walk(fp);
      else totalSize += statSync(fp).size;
    }
  };
  walk(distDir);
  console.log(`  前端 dist: ${formatBytes(totalSize)}`);
}

const binaryName = isWin ? 'ai-workbench.exe' : 'ai-workbench';
const binaryDir = mode === 'release' ? 'release' : 'debug';
const binaryPath = resolve(ROOT, 'src-tauri', 'target', binaryDir, binaryName);
if (existsSync(binaryPath)) {
  console.log(`  二进制: ${formatBytes(statSync(binaryPath).size)}`);
}

console.log('');
console.log('═══════════════════════════════════════');
console.log(`  总用时: 前端 ${feTime}s + Rust ${rsTime}s`);
console.log('═══════════════════════════════════════');
