#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platform } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
process.chdir(ROOT);

const args = new Set(process.argv.slice(2));
const debug = args.has('--debug');

function runStep(title, command) {
  const startedAt = Date.now();
  console.log(`\n▶ ${title}`);
  execSync(command, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=4096',
      CARGO_TERM_COLOR: process.env.CARGO_TERM_COLOR || 'always',
      CARGO_INCREMENTAL: process.env.CARGO_INCREMENTAL || '0',
      RUSTFLAGS: process.env.RUSTFLAGS || '-C debuginfo=0',
    },
  });
  console.log(`✓ ${title} (${((Date.now() - startedAt) / 1000).toFixed(1)}s)`);
}

console.log('');
console.log('═══════════════════════════════════════');
console.log('  AI Workbench — 发布前预检');
console.log(`  平台: ${platform()} | 模式: ${debug ? 'debug' : 'release'}`);
console.log('═══════════════════════════════════════');

runStep('本地完整 CI 预检', 'node scripts/ci-local.mjs');
runStep('当前平台 Tauri bundle 构建', debug ? 'pnpm tauri build --debug' : 'pnpm tauri build');

console.log('');
console.log('═══════════════════════════════════════');
console.log('  ✅ 发布前预检通过');
console.log('═══════════════════════════════════════');
console.log('');