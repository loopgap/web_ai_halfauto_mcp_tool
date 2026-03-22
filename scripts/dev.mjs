#!/usr/bin/env node
// ═══════════════════════════════════════════════
// dev.mjs — 跨平台开发服务器启动脚本 (Linux/macOS/Windows)
// 无外部依赖，仅使用 Node.js 内置模块
// ═══════════════════════════════════════════════
import { execSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
process.chdir(ROOT);

const isWin = process.platform === 'win32';

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: 'inherit', cwd: ROOT, shell: true, ...opts });
}

function which(name) {
  try {
    const cmd = isWin ? `where ${name}` : `command -v ${name}`;
    execSync(cmd, { stdio: 'ignore' });
    return true;
  } catch { return false; }
}

function getVersion(cmd) {
  try { return execSync(cmd, { encoding: 'utf8' }).trim(); }
  catch { return null; }
}

// ── 参数 ──
const args = process.argv.slice(2);
const frontendOnly = args.includes('--frontend') || args.includes('-f');
const buildMode    = args.includes('--build')    || args.includes('-b');
const checkOnly    = args.includes('--check')    || args.includes('-c');

// ── 环境检查 ──
console.log('');
console.log('═══════════════════════════════════════');
console.log('  AI Workbench — 开发环境');
console.log('═══════════════════════════════════════');
console.log('');

const nodeVer = getVersion('node --version');
const cargoVer = getVersion('cargo --version');

if (!nodeVer) { console.error('❌ Node.js 未安装'); process.exit(1); }
console.log(`  ✅ Node.js ${nodeVer}`);

if (!cargoVer) { console.error('❌ Cargo/Rust 未安装'); process.exit(1); }
console.log(`  ✅ ${cargoVer}`);

if (checkOnly) {
  console.log('\n  环境检查通过。');
  process.exit(0);
}

// ── 依赖安装 ──
if (!existsSync(resolve(ROOT, 'node_modules'))) {
  console.log('\n📦 安装 npm 依赖...');
  run('npm install --no-fund --no-audit');
}

// ── 构建 / 启动 ──
if (buildMode) {
  console.log('\n🏗️  构建生产版本...');
  run('npm run tauri build');
} else if (frontendOnly) {
  console.log('\n🚀 启动前端开发服务器 (http://localhost:1420)...');
  const child = spawn('npx', ['vite'], { stdio: 'inherit', cwd: ROOT, shell: true });
  child.on('exit', code => process.exit(code ?? 0));
} else {
  console.log('\n🚀 启动 Tauri 开发服务器...');
  const child = spawn('npx', ['tauri', 'dev'], { stdio: 'inherit', cwd: ROOT, shell: true });
  child.on('exit', code => process.exit(code ?? 0));
}
