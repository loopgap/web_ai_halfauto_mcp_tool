#!/usr/bin/env node
// ═══════════════════════════════════════════════
// doctor.mjs — 跨平台环境诊断脚本 (Linux/macOS/Windows)
// 无外部依赖，仅使用 Node.js 内置模块
// ═══════════════════════════════════════════════
import { execSync } from 'node:child_process';
import { existsSync, writeFileSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir, platform, arch, totalmem, freemem, cpus } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
process.chdir(ROOT);

const isWin = platform() === 'win32';
const report = [];
let warnings = 0, errors = 0, passed = 0;

function ok(msg)   { console.log(`  ✅ ${msg}`); report.push(`OK:   ${msg}`); passed++; }
function warn(msg) { console.log(`  ⚠️  ${msg}`); report.push(`WARN: ${msg}`); warnings++; }
function err(msg)  { console.log(`  ❌ ${msg}`); report.push(`ERR:  ${msg}`); errors++; }

function getVersion(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', timeout: 15000 }).trim(); }
  catch { return null; }
}

function dirSize(dir) {
  try {
    if (isWin) {
      const out = execSync(`powershell -Command "(Get-ChildItem -Path '${dir}' -Recurse -File | Measure-Object -Property Length -Sum).Sum"`,
        { encoding: 'utf8', timeout: 30000 }).trim();
      return parseInt(out, 10) || 0;
    }
    const out = execSync(`du -sb "${dir}" 2>/dev/null | cut -f1`, { encoding: 'utf8', timeout: 30000 }).trim();
    return parseInt(out, 10) || 0;
  } catch { return 0; }
}

function formatBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
  return `${(b / 1073741824).toFixed(2)} GB`;
}

// ── 参数 ──
const args = process.argv.slice(2);
const doReport = args.includes('--report') || args.includes('-r');
const doFix    = args.includes('--fix')    || args.includes('-x');

console.log('');
console.log('═══════════════════════════════════════');
console.log('  AI Workbench Doctor');
console.log(`  ${platform()} ${arch()} | Node ${process.version}`);
console.log('═══════════════════════════════════════');

// ── 1. 系统 ──
console.log('\n💻 系统信息:');
ok(`平台: ${platform()} ${arch()}`);
ok(`CPU: ${cpus().length} 核`);
const totalGB = totalmem() / 1073741824;
const freeGB = freemem() / 1073741824;
if (freeGB < 2) warn(`可用内存偏低: ${freeGB.toFixed(1)}/${totalGB.toFixed(1)} GB`);
else ok(`内存: ${freeGB.toFixed(1)}/${totalGB.toFixed(1)} GB 可用`);

// ── 2. 工具链 ──
console.log('\n🔧 工具链:');
const nodeVer = getVersion('node --version');
if (nodeVer) {
  const major = parseInt(nodeVer.replace('v', ''), 10);
  if (major >= 18) ok(`Node.js ${nodeVer}`);
  else warn(`Node.js ${nodeVer} (建议 ≥18)`);
} else err('Node.js 未安装');

const npmVer = getVersion('npm --version');
if (npmVer) ok(`npm ${npmVer}`); else err('npm 未安装');

const cargoVer = getVersion('cargo --version');
if (cargoVer) ok(cargoVer); else err('Cargo 未安装');

const rustcVer = getVersion('rustc --version');
if (rustcVer) ok(rustcVer); else err('rustc 未安装');

const gitVer = getVersion('git --version');
if (gitVer) ok(gitVer); else warn('Git 未安装');

// ── 3. 项目状态 ──
console.log('\n📦 项目状态:');
if (existsSync(resolve(ROOT, 'package.json'))) ok('package.json 存在');
else err('package.json 缺失');

if (existsSync(resolve(ROOT, 'package-lock.json'))) ok('package-lock.json 存在');
else warn('package-lock.json 缺失');

if (existsSync(resolve(ROOT, 'node_modules'))) {
  ok('node_modules 已安装');
} else {
  warn('node_modules 不存在');
  if (doFix) {
    console.log('  🔧 正在修复: npm install...');
    try { execSync('npm install --no-fund --no-audit', { stdio: 'inherit', cwd: ROOT, shell: true }); ok('npm install 完成'); }
    catch { err('npm install 失败'); }
  }
}

// ── 4. TypeScript ──
console.log('\n📝 TypeScript:');
try {
  execSync('npx tsc --noEmit', { cwd: ROOT, stdio: 'ignore', shell: true, timeout: 60000 });
  ok('tsc --noEmit 通过');
} catch { warn('TypeScript 存在类型错误'); }

// ── 5. Cargo ──
console.log('\n🦀 Cargo:');
try {
  execSync('cargo check --jobs 2', { cwd: resolve(ROOT, 'src-tauri'), stdio: 'ignore', shell: true, timeout: 120000 });
  ok('cargo check 通过');
} catch { warn('cargo check 失败'); }

// ── 6. 配置目录 ──
console.log('\n📂 配置目录:');
const configBase = join(homedir(), '.ai-workbench');
if (existsSync(configBase)) {
  ok(`${configBase} 存在`);
  for (const sub of ['config', 'vault', 'vault/runs', 'vault/artifacts', 'vault/governance']) {
    const p = join(configBase, sub);
    if (existsSync(p)) ok(`  ${sub}/`);
    else {
      warn(`  ${sub}/ 不存在`);
      if (doFix) {
        const { mkdirSync } = await import('node:fs');
        mkdirSync(p, { recursive: true });
        ok(`  创建 ${sub}/`);
      }
    }
  }
} else {
  warn(`${configBase} 不存在`);
  if (doFix) {
    console.log('  🔧 运行 node scripts/setup.mjs 创建...');
  }
}

// ── 7. 磁盘占用 ──
console.log('\n💾 磁盘占用:');
const targetDir = resolve(ROOT, 'src-tauri', 'target');
if (existsSync(targetDir)) {
  const size = dirSize(targetDir);
  if (size > 5 * 1073741824) warn(`src-tauri/target: ${formatBytes(size)} (${'>'}5GB, 建议清理)`);
  else ok(`src-tauri/target: ${formatBytes(size)}`);
} else ok('src-tauri/target: 不存在（未编译）');

if (existsSync(resolve(ROOT, 'node_modules'))) {
  const size = dirSize(resolve(ROOT, 'node_modules'));
  ok(`node_modules: ${formatBytes(size)}`);
}

// ── 8. 端口 ──
console.log('\n🌐 端口状态:');
try {
  const cmd = isWin
    ? 'netstat -ano | findstr :1420'
    : 'lsof -i :1420 2>/dev/null || ss -tlnp 2>/dev/null | grep 1420';
  execSync(cmd, { stdio: 'ignore', shell: true });
  warn('端口 1420 已被占用');
} catch { ok('端口 1420 可用'); }

// ── 汇总 ──
const total = passed + warnings + errors;
console.log('');
console.log('═══════════════════════════════════════');
console.log(`  诊断完成: ${passed}/${total} 通过, ${warnings} 警告, ${errors} 失败`);
console.log('═══════════════════════════════════════');

// ── 报告 ──
if (doReport) {
  const reportPath = resolve(ROOT, 'doctor-report.txt');
  const content = [
    `AI Workbench Doctor Report — ${new Date().toISOString()}`,
    `Platform: ${platform()} ${arch()}`,
    `Node: ${process.version}`,
    `Result: ${passed}/${total} passed, ${warnings} warnings, ${errors} errors`,
    '',
    ...report,
  ].join('\n');
  writeFileSync(reportPath, content, 'utf8');
  console.log(`\n📄 报告已保存: ${reportPath}`);
}

process.exit(errors > 0 ? 1 : 0);
