#!/usr/bin/env node
import { platform } from "node:os";
import { banner, chdirRoot, ensurePnpmAvailable, pnpmCommand, run, section, stepErr, stepOk } from "./lib/automation.mjs";

const args = new Set(process.argv.slice(2));
const debug = args.has("--debug");

function runStep(title, command) {
  const startedAt = Date.now();
  section(`▶ ${title}`);
  run(command);
  stepOk(`${title} (${((Date.now() - startedAt) / 1000).toFixed(1)}s)`);
}

chdirRoot();
banner("AI Workbench — 发布前预检", [`平台: ${platform()} | 模式: ${debug ? "debug" : "release"}`]);

const pnpmStatus = ensurePnpmAvailable({ autoFix: true });
if (pnpmStatus.status !== "ready" && pnpmStatus.status !== "fixed") {
  stepErr(pnpmStatus.detail);
  process.exit(pnpmStatus.exitCode);
}
stepOk(pnpmStatus.status === "fixed" ? `${pnpmStatus.detail} (自动修复)` : pnpmStatus.detail);

runStep("本地完整 CI 预检", "node scripts/ci-local.mjs");
runStep("当前平台 Tauri bundle 构建", debug ? `${pnpmCommand()} tauri build --debug` : `${pnpmCommand()} tauri build`);

banner("✅ 发布前预检通过");
