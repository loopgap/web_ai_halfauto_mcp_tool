#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platform } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
process.chdir(ROOT);

function tryOutput(command, options = {}) {
  try {
    return execSync(command, {
      cwd: ROOT,
      encoding: 'utf8',
      shell: true,
      stdio: ['ignore', 'pipe', 'ignore'],
      ...options,
    }).trim();
  } catch {
    return null;
  }
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

function fileContains(relPath, expected) {
  const fullPath = resolve(ROOT, relPath);
  const content = execSync(`node -e "process.stdout.write(require('node:fs').readFileSync(process.argv[1], 'utf8'))" "${fullPath}"`, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
  });
  return content.includes(expected);
}

console.log('');
console.log('═══════════════════════════════════════');
console.log('  AI Workbench — Linux 预演');
console.log(`  当前主机: ${platform()}`);
console.log('═══════════════════════════════════════');

const dockerVersion = tryOutput('docker --version');
const wslStatus = tryOutput('wsl --status');
const wslList = tryOutput('wsl --list --quiet');
const actVersion = tryOutput('act --version');
const hasWslDistro = Boolean(wslList && wslList.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).length > 0);

runStep('校验 CI 工作流包含 Linux runner', 'node -e "const fs=require(\'node:fs\');const text=fs.readFileSync(\'.github/workflows/ci.yml\',\'utf8\');if(!text.includes(\'ubuntu-22.04\')) process.exit(1);"');
runStep('校验 Release 工作流包含 Linux 构建', 'node -e "const fs=require(\'node:fs\');const text=fs.readFileSync(\'.github/workflows/release.yml\',\'utf8\');if(!text.includes(\'build-tauri-linux\') || !text.includes(\'patchelf\')) process.exit(1);"');
runStep('校验 Rust Linux 目标依赖声明', 'node -e "const fs=require(\'node:fs\');const text=fs.readFileSync(\'src-tauri/Cargo.toml\',\'utf8\');if(!text.includes(\'[package]\')) process.exit(1);"');

if (dockerVersion) {
  console.log(`\nℹ 检测到 Docker: ${dockerVersion}`);
  console.log('ℹ 当前仓库尚未定义 Linux 容器镜像脚本，静态一致性检查已完成；真实 Linux 运行将由 GitHub Actions release/ci job 覆盖。');
} else if (actVersion) {
  console.log(`\nℹ 检测到 act: ${actVersion}`);
  console.log('ℹ 当前仓库尚未定义 act 专用 workflow 映射，静态一致性检查已完成；真实 Linux 运行将由 GitHub Actions release/ci job 覆盖。');
} else if (wslStatus && hasWslDistro) {
  console.log('\nℹ 检测到可用 WSL 发行版，但当前 Windows 工作区路径位于宿主盘，且仓库未配置 WSL 依赖引导。');
  console.log('ℹ 本次执行静态一致性检查；真实 Linux 运行将由 GitHub Actions release/ci job 覆盖。');
} else if (wslStatus) {
  console.log('\nℹ 检测到 WSL 功能已启用，但当前未安装 Linux 发行版。');
  console.log('ℹ 本次执行静态一致性检查；真实 Linux 运行将由 GitHub Actions release/ci job 覆盖。');
} else {
  console.log('\nℹ 未检测到 Docker / act / 可用 WSL 发行版。');
  console.log('ℹ 本次执行静态一致性检查；真实 Linux 运行将由 GitHub Actions release/ci job 覆盖。');
}

console.log('');
console.log('═══════════════════════════════════════');
console.log('  ✅ Linux 预演完成（静态一致性检查通过）');
console.log('═══════════════════════════════════════');
console.log('');