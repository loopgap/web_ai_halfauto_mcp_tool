#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
process.chdir(ROOT);

function run(cmd, options = {}) {
  return execSync(cmd, { cwd: ROOT, stdio: 'inherit', shell: true, ...options });
}

function output(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8', shell: true }).trim();
  } catch {
    return null;
  }
}

console.log('');
console.log('═══════════════════════════════════════');
console.log('  AI Workbench — 安装 Git Hooks');
console.log('═══════════════════════════════════════');

const gitVersion = output('git --version');
if (!gitVersion) {
  console.error('\n❌ Git 未安装，无法启用 hooks');
  process.exit(1);
}

console.log(`\n🔧 ${gitVersion}`);
run('git config core.hooksPath .githooks');
console.log('  ✅ core.hooksPath = .githooks');

for (const hookName of ['pre-commit', 'commit-msg', 'pre-push', 'post-commit']) {
  try {
    run(`git update-index --chmod=+x .githooks/${hookName}`, { stdio: 'ignore' });
  } catch {
  }
  console.log(`  ✅ ${hookName}`);
}

console.log('\n✅ Git hooks 已启用');
console.log('   pre-commit : 快速检查');
console.log('   pre-push   : 本地完整 CI 预检');
console.log('');