#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import {
  ROOT,
  banner,
  capture,
  chdirRoot,
  ensurePnpmAvailable,
  installNodeDependencies,
  memorySummary,
  pnpmCommand,
  stepErr,
  stepOk,
  stepWarn,
} from "./lib/automation.mjs";

const args = new Set(process.argv.slice(2));
const frontendOnly = args.has("--frontend") || args.has("-f");
const buildMode = args.has("--build") || args.has("-b");
const checkOnly = args.has("--check") || args.has("-c");

function spawnCommand(command, commandArgs) {
  const child = spawn(command, commandArgs, { stdio: "inherit", cwd: ROOT, shell: true });
  child.on("exit", (code) => process.exit(code ?? 0));
}

chdirRoot();
banner("AI Workbench — 开发环境", [memorySummary(), frontendOnly ? "模式: frontend" : buildMode ? "模式: build" : "模式: tauri"]);

const nodeVersion = capture("node --version");
if (!nodeVersion.ok) {
  stepErr("Node.js 未安装。");
  process.exit(1);
}
stepOk(`Node.js ${nodeVersion.stdout}`);

const pnpmStatus = ensurePnpmAvailable({ autoFix: true });
if (pnpmStatus.status !== "ready" && pnpmStatus.status !== "fixed") {
  stepErr(pnpmStatus.detail);
  process.exit(pnpmStatus.exitCode);
}
stepOk(pnpmStatus.status === "fixed" ? `${pnpmStatus.detail} (自动修复)` : pnpmStatus.detail);

if (!frontendOnly || buildMode) {
  const cargoVersion = capture("cargo --version");
  if (!cargoVersion.ok) {
    stepErr("Cargo/Rust 未安装。");
    process.exit(1);
  }
  stepOk(cargoVersion.stdout);
} else {
  stepWarn("frontend 模式跳过 Rust 工具链校验");
}

if (checkOnly) {
  process.exit(0);
}

if (!existsSync(resolve(ROOT, "node_modules"))) {
  stepWarn("node_modules 不存在，开始安装依赖");
  const install = installNodeDependencies({ frozenLockfile: true });
  if (install.status !== "ready" && install.status !== "fixed") {
    stepErr(install.detail);
    process.exit(install.exitCode);
  }
  stepOk(install.detail);
}

if (buildMode) {
  stepWarn("转交给 pnpm tauri build");
  if (pnpmCommand() === "pnpm") spawnCommand("pnpm", ["tauri", "build"]);
  else spawnCommand("corepack", ["pnpm", "tauri", "build"]);
} else if (frontendOnly) {
  stepWarn("启动前端开发服务器 http://localhost:1420");
  if (pnpmCommand() === "pnpm") spawnCommand("pnpm", ["exec", "vite"]);
  else spawnCommand("corepack", ["pnpm", "exec", "vite"]);
} else {
  stepWarn("启动 Tauri 开发服务器");
  if (pnpmCommand() === "pnpm") spawnCommand("pnpm", ["tauri", "dev"]);
  else spawnCommand("corepack", ["pnpm", "tauri", "dev"]);
}
