#!/usr/bin/env node
import { chmodSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { banner, capture, chdirRoot, run, stepErr, stepOk } from "./lib/automation.mjs";

chdirRoot();
banner("AI Workbench — 安装 Git Hooks");

const gitVersion = capture("git --version");
if (!gitVersion.ok) {
  stepErr("Git 未安装，无法启用 hooks");
  process.exit(1);
}

stepOk(gitVersion.stdout);
run("git config core.hooksPath .githooks");
stepOk("core.hooksPath = .githooks");

for (const hookName of ["pre-commit", "commit-msg", "pre-push", "post-commit"]) {
  const hookPath = resolve(".githooks", hookName);
  if (existsSync(hookPath)) {
    try {
      chmodSync(hookPath, 0o755);
    } catch {
    }
    try {
      run(`git update-index --chmod=+x .githooks/${hookName}`);
    } catch {
    }
    stepOk(`${hookName} 已启用`);
  }
}

stepOk("pre-commit: 快速门禁");
stepOk("pre-push: 完整 CI 门禁");
