#!/usr/bin/env node
import { execSync } from "node:child_process";
import {
  ROOT,
  banner,
  chdirRoot,
  ensureConfigDirectories,
  installNodeDependencies,
  memorySummary,
  printEnvironmentChecks,
  run,
  runCargoCheck,
  section,
  stepErr,
  stepOk,
  stepWarn,
  STATUS_CODES,
  inspectEnvironment,
} from "./lib/automation.mjs";

const args = new Set(process.argv.slice(2));
const skipCi = args.has("--skip-ci");
const ship = args.has("--ship");

function exitForStatus(status) {
  if (status === "ready" || status === "fixed") {
    process.exit(0);
  }
  process.exit(STATUS_CODES[status]);
}

function exitWithResult(result, message) {
  if (message) {
    stepErr(message);
  }
  process.exit(result.exitCode);
}

chdirRoot();
banner("AI Workbench — Bootstrap", [memorySummary(), "目标: 自动检测、安装、验证与可选推送"]);

const env = inspectEnvironment({ autoFix: true, includeGit: true });
printEnvironmentChecks(env.checks, { title: "🔧 工具链与系统依赖" });
if (env.status !== "ready" && env.status !== "fixed") {
  exitForStatus(env.status);
}

section("📦 项目依赖");
const installResult = installNodeDependencies({ frozenLockfile: true });
if (installResult.status === "ready" || installResult.status === "fixed") {
  stepOk(installResult.detail);
} else {
  exitWithResult(installResult);
}

section("📂 配置目录");
const created = ensureConfigDirectories();
if (created.error) {
  exitWithResult({ exitCode: STATUS_CODES["blocked-needs-admin"] }, `无法创建配置目录: ${created.base}`);
}
if (created.created.length === 0) {
  stepOk(`${created.base} 已就绪`);
} else {
  stepOk(`已创建 ${created.created.length} 个目录`);
}

section("🪝 Git Hooks");
try {
  run("node scripts/install-hooks.mjs");
} catch {
  stepWarn("Git hooks 安装失败，可稍后运行 pnpm hooks:install");
}

section("🦀 Rust 验证");
const cargoCheck = runCargoCheck();
if (cargoCheck.status === "ready" || cargoCheck.status === "fixed") {
  stepOk(cargoCheck.detail);
} else {
  exitWithResult(cargoCheck);
}

if (!skipCi) {
  section("🧪 本地完整门禁");
  try {
    run("node scripts/ci-local.mjs");
    stepOk("pnpm ci:local 通过");
  } catch {
    process.exit(STATUS_CODES["blocked-test-failure"]);
  }
} else {
  section("🧪 本地完整门禁");
  stepWarn("已跳过完整门禁（--skip-ci）");
}

if (ship) {
  section("🚀 Git Ship");
  try {
    execSync("node scripts/git-workflow.mjs", { cwd: ROOT, stdio: "inherit", shell: true });
  } catch {
    process.exit(STATUS_CODES["blocked-git"]);
  }
}

banner("Bootstrap 完成", [skipCi ? "已完成环境与依赖自举" : "环境、依赖与完整门禁均已通过", ship ? "git:ship 已执行" : "需要推送时运行 pnpm git:ship"]);
process.exit(0);
