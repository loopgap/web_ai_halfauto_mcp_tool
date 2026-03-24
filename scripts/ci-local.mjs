#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { platform } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
process.chdir(ROOT);

const args = new Set(process.argv.slice(2));
const isHook = args.has('--hook');
const doClean = args.has('--clean');
const isFast = args.has('--fast');
const isWindows = platform() === 'win32';

function output(command, options = {}) {
  return execSync(command, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
    env: {
      ...process.env,
      CARGO_TERM_COLOR: process.env.CARGO_TERM_COLOR || 'always',
      CARGO_INCREMENTAL: process.env.CARGO_INCREMENTAL || '0',
      RUSTFLAGS: process.env.RUSTFLAGS || '-C debuginfo=0',
      NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=4096',
    },
    ...options,
  }).trim();
}

function runStep(title, command, options = {}) {
  const startedAt = Date.now();
  console.log(`\n▶ ${title}`);
  execSync(command, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      CARGO_TERM_COLOR: process.env.CARGO_TERM_COLOR || 'always',
      CARGO_INCREMENTAL: process.env.CARGO_INCREMENTAL || '0',
      RUSTFLAGS: process.env.RUSTFLAGS || '-C debuginfo=0',
      NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=4096',
    },
    ...options,
  });
  console.log(`✓ ${title} (${((Date.now() - startedAt) / 1000).toFixed(1)}s)`);
}

console.log('');
console.log('═══════════════════════════════════════');
console.log(`  AI Workbench — 本地 CI 预检${isHook ? ' (hook)' : ''}`);
console.log(`  模式: ${isFast ? 'fast' : 'full'}`);
console.log('═══════════════════════════════════════');

const rustHost = (() => {
  try {
    return output('rustc -vV', { cwd: resolve(ROOT, 'src-tauri') })
      .split(/\r?\n/)
      .find((line) => line.startsWith('host:'))
      ?.split(':')[1]
      ?.trim() || 'unknown';
  } catch {
    return 'not-installed';
  }
})();
const hasRust = rustHost !== 'not-installed';
const useRustTestFallback = isWindows && rustHost.endsWith('windows-gnu');

if (!hasRust) {
  console.log('\nℹ Rust 工具链未安装，跳过 Rust 相关检查 (CI 将执行完整验证)');
}

if (doClean) {
  runStep('清理构建缓存', 'node scripts/clean.mjs hard');
}

if (!isFast) {
  runStep('冻结锁文件安装', 'pnpm install --frozen-lockfile');
}
runStep('TypeScript 检查', 'pnpm exec tsc --noEmit');
if (!isFast) {
  runStep('前端构建', 'pnpm exec vite build');
}
if (hasRust) {
  runStep('Rust cargo check', 'cargo check --jobs 1', { cwd: resolve(ROOT, 'src-tauri') });
  if (!isFast) {
    runStep('Rust clippy', 'cargo clippy --jobs 1 -- -D warnings -A dead_code', { cwd: resolve(ROOT, 'src-tauri') });
    if (useRustTestFallback) {
      console.log(`\nℹ 检测到本机 Rust host 为 ${rustHost}，跳过会在 Windows GNU 本机失真的 cargo test 运行，改为检查测试目标可编译。`);
      runStep('Rust tests (check fallback)', 'cargo check --tests --jobs 1', { cwd: resolve(ROOT, 'src-tauri') });
    } else {
      runStep('Rust tests', 'cargo test --jobs 1 -- --nocapture', { cwd: resolve(ROOT, 'src-tauri') });
    }
  }
}
runStep('环境检查', 'node scripts/check-environment.mjs');
runStep('治理校验', 'node scripts/validate-governance.mjs');
runStep('治理 API 合约测试', 'node scripts/test-governance-api-contract.mjs');

console.log('');
console.log('═══════════════════════════════════════');
console.log(`  ✅ 本地 CI ${isFast ? '快速门禁' : '预检'}通过`);
console.log('═══════════════════════════════════════');
console.log('');