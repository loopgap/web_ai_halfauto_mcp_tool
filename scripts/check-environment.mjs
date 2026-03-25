#!/usr/bin/env node
import {
  STATUS_CODES,
  banner,
  chdirRoot,
  ensureConfigDirectories,
  memorySummary,
  printEnvironmentChecks,
  section,
  stepErr,
  stepOk,
  inspectEnvironment,
} from "./lib/automation.mjs";

const args = new Set(process.argv.slice(2));
const autoFix = args.has("--fix");

chdirRoot();
banner("AI Workbench — Environment Check", [memorySummary(), autoFix ? "模式: fix" : "模式: check"]);

const result = inspectEnvironment({ autoFix, includeGit: true });
printEnvironmentChecks(result.checks);

if (autoFix) {
  section("📂 配置目录");
  const created = ensureConfigDirectories();
  if (created.error) {
    stepErr(`无法创建配置目录: ${created.base}`);
    process.exit(STATUS_CODES["blocked-needs-admin"]);
  }
  stepOk(created.created.length === 0 ? `${created.base} 已就绪` : `已创建 ${created.created.length} 个目录`);
}

if (result.status === "ready" || result.status === "fixed") {
  banner("环境检查通过", [autoFix ? "可继续执行 pnpm bootstrap 或 pnpm ci:local" : "可继续执行 pnpm ci:local"]);
  process.exit(0);
}

process.exit(STATUS_CODES[result.status]);
