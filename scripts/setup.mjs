#!/usr/bin/env node
// ═══════════════════════════════════════════════
// setup.mjs — 跨平台环境初始化脚本 (Linux/macOS/Windows)
// 无外部依赖，仅使用 Node.js 内置模块
// ═══════════════════════════════════════════════
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir, platform, arch, totalmem } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
process.chdir(ROOT);

const isWin = platform() === 'win32';
const isLinux = platform() === 'linux';

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: 'inherit', cwd: ROOT, shell: true, ...opts });
}

function getVersion(cmd) {
  try { return execSync(cmd, { encoding: 'utf8' }).trim(); }
  catch { return null; }
}

console.log('');
console.log('═══════════════════════════════════════');
console.log('  AI Workbench — 环境初始化');
console.log(`  平台: ${platform()} / ${arch()}`);
console.log(`  内存: ${(totalmem() / 1073741824).toFixed(1)} GB`);
console.log('═══════════════════════════════════════');
console.log('');

// ── 1. 检查必要工具 ──
console.log('🔧 工具链检查:');
const tools = [
  { name: 'node',  cmd: 'node --version' },
  { name: 'pnpm',  cmd: 'pnpm --version' },
  { name: 'cargo', cmd: 'cargo --version' },
  { name: 'rustc', cmd: 'rustc --version' },
];

const missing = [];
for (const t of tools) {
  const ver = getVersion(t.cmd);
  if (ver) {
    console.log(`  ✅ ${t.name}: ${ver}`);
  } else {
    console.log(`  ❌ ${t.name}: 未找到`);
    missing.push(t.name);
  }
}

if (missing.length > 0) {
  console.error(`\n❌ 缺少工具: ${missing.join(', ')}`);
  console.error('   请安装 Node.js (≥18): https://nodejs.org');
  console.error('   请安装 Rust: https://rustup.rs');
  process.exit(1);
}

// ── 2. Linux 系统依赖检查 ──
if (isLinux) {
  console.log('\n🐧 Linux 系统依赖:');
  const pkgs = [
    'libwebkit2gtk-4.1-dev',
    'libgtk-3-dev',
    'libayatana-appindicator3-dev',
    'librsvg2-dev',
  ];
  const missingPkgs = [];
  for (const pkg of pkgs) {
    try {
      execSync(`dpkg -s ${pkg}`, { stdio: 'ignore' });
      console.log(`  ✅ ${pkg}`);
    } catch {
      console.log(`  ❌ ${pkg}`);
      missingPkgs.push(pkg);
    }
  }
  if (missingPkgs.length > 0) {
    console.log(`\n⚠️  缺少系统包，请运行:`);
    console.log(`   sudo apt-get install -y ${missingPkgs.join(' ')}`);
  }
}

// ── 3. pnpm 依赖 ──
console.log('\n📦 安装 pnpm 依赖...');
run('pnpm install --frozen-lockfile');

// ── 4. Git hooks ──
console.log('\n🪝 安装 Git hooks...');
try {
  run('node scripts/install-hooks.mjs');
  console.log('  ✅ Git hooks 已启用');
} catch {
  console.log('  ⚠️  Git hooks 安装失败（可手动运行 pnpm hooks:install）');
}

// ── 5. Cargo check ──
console.log('\n🦀 检查 Rust 编译...');
try {
  run('cargo check --jobs 2', { cwd: resolve(ROOT, 'src-tauri') });
  console.log('  ✅ Cargo check 通过');
} catch {
  console.log('  ⚠️  Cargo check 出现问题（可能缺少系统依赖）');
}

// ── 6. 初始化配置目录 ──
console.log('\n📂 初始化配置目录...');
const configBase = join(homedir(), '.ai-workbench');
const dirs = [
  configBase,
  join(configBase, 'config'),
  join(configBase, 'vault'),
  join(configBase, 'vault', 'runs'),
  join(configBase, 'vault', 'artifacts'),
  join(configBase, 'vault', 'governance'),
  join(configBase, 'vault', 'events'),
  join(configBase, 'vault', 'traces'),
  join(configBase, 'health'),
];
for (const dir of dirs) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    console.log(`  📁 创建 ${dir}`);
  }
}
console.log('  ✅ 配置目录就绪');

console.log('');
console.log('═══════════════════════════════════════');
console.log('  ✅ 初始化完成！');
console.log('  运行 node scripts/dev.mjs           启动开发服务器');
console.log('  运行 node scripts/dev.mjs --frontend 仅启动前端');
console.log('  运行 node scripts/dev.mjs --build    构建发布版');
console.log('  运行 pnpm ci:local                  本地完整 CI 预检');
console.log('  运行 pnpm release:preflight         发布前预检');
console.log('═══════════════════════════════════════');
