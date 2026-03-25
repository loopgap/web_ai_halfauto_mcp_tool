#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  STATUS_CODES,
  banner,
  capture,
  chdirRoot,
  ensureConfigDirectories,
  installNodeDependencies,
  memorySummary,
  printEnvironmentChecks,
  repoPathExists,
  run,
  runCargoCheck,
  section,
  stepErr,
  stepOk,
  stepWarn,
  inspectEnvironment,
  pnpmCommand,
} from "./lib/automation.mjs";

const args = new Set(process.argv.slice(2));
const doFix = args.has("--fix") || args.has("-x");
const doReport = args.has("--report") || args.has("-r");
const report = [];
let highestExit = 0;

function mark(code, line) {
  report.push(line);
  highestExit = Math.max(highestExit, code);
}

function pass(line) {
  stepOk(line);
  mark(0, `OK: ${line}`);
}

function warn(line) {
  stepWarn(line);
  mark(STATUS_CODES["blocked-needs-admin"], `WARN: ${line}`);
}

function fail(line, code = STATUS_CODES["blocked-test-failure"]) {
  stepErr(line);
  mark(code, `ERR: ${line}`);
}

function runCheck(title, command, code = STATUS_CODES["blocked-test-failure"]) {
  section(title);
  const result = capture(command, { timeout: 180000 });
  if (result.ok) {
    pass(`${command} 通过`);
    return true;
  }
  fail(`${command} 失败`, code);
  return false;
}

chdirRoot();
banner("AI Workbench Doctor", [memorySummary(), doFix ? "模式: fix" : "模式: report"]);

const env = inspectEnvironment({ autoFix: doFix, includeGit: true });
printEnvironmentChecks(env.checks, { title: "🔧 环境与系统依赖" });
for (const check of env.checks) {
  const prefix = check.status === "ready" || check.status === "fixed" ? "OK" : check.status === "blocked-needs-admin" ? "WARN" : "ERR";
  mark(check.exitCode, `${prefix}: ${check.detail}`);
}
if (env.status !== "ready" && env.status !== "fixed") {
  if (doReport) {
    const reportPath = resolve("doctor-report.txt");
    writeFileSync(reportPath, report.join("\n") + "\n", "utf8");
    stepOk(`报告已保存: ${reportPath}`);
  }
  process.exit(env.exitCode);
}

section("📦 项目状态");
if (repoPathExists("package.json")) pass("package.json 存在"); else fail("package.json 缺失");
if (repoPathExists("pnpm-lock.yaml")) pass("pnpm-lock.yaml 存在"); else fail("pnpm-lock.yaml 缺失");
if (repoPathExists("node_modules")) pass("node_modules 已安装");
else if (doFix) {
  const install = installNodeDependencies({ frozenLockfile: true });
  if (install.status === "ready" || install.status === "fixed") pass(install.detail); else fail(install.detail, install.exitCode);
} else {
  warn("node_modules 不存在，可运行 pnpm bootstrap 自动安装");
}

section("📂 配置目录");
const created = ensureConfigDirectories();
if (created.error) fail(`无法创建配置目录: ${created.base}`, STATUS_CODES["blocked-needs-admin"]);
else pass(created.created.length === 0 ? `${created.base} 已就绪` : `已创建 ${created.created.length} 个目录`);

section("🪝 Git Hooks");
const hooksPath = capture("git config --get core.hooksPath");
if (hooksPath.ok && hooksPath.stdout === ".githooks") {
  pass("core.hooksPath = .githooks");
} else if (doFix) {
  try {
    run("node scripts/install-hooks.mjs");
    pass("Git hooks 已安装");
  } catch {
    fail("Git hooks 安装失败", STATUS_CODES["blocked-git"]);
  }
} else {
  warn("Git hooks 未启用，可运行 pnpm hooks:install");
}

runCheck("📝 TypeScript", `${pnpmCommand()} exec tsc --noEmit`);
runCheck("🧪 Vitest", `${pnpmCommand()} test:ci`);
section("🦀 Cargo");
const cargoCheck = runCargoCheck();
if (cargoCheck.status === "ready" || cargoCheck.status === "fixed") pass(cargoCheck.detail); else fail(cargoCheck.detail, cargoCheck.exitCode);
runCheck("🏛️ Governance Validate", "node scripts/validate-governance.mjs");
runCheck("🔌 Governance API Contract", "node scripts/test-governance-api-contract.mjs");

if (doReport) {
  const reportPath = resolve("doctor-report.txt");
  writeFileSync(reportPath, report.join("\n") + "\n", "utf8");
  stepOk(`报告已保存: ${reportPath}`);
}

if (highestExit !== 0) {
  process.exit(highestExit);
}

banner("Doctor 完成", ["环境与关键测试均已通过"]);
process.exit(0);
