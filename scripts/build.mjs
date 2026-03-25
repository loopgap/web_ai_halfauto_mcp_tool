#!/usr/bin/env node
import { existsSync, readdirSync, statSync } from "node:fs";
import { cpus, platform } from "node:os";
import { resolve } from "node:path";
import { ROOT, banner, chdirRoot, ensurePnpmAvailable, pnpmCommand, run, stepErr, stepOk, stepWarn } from "./lib/automation.mjs";

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

const args = process.argv.slice(2);
const mode = args.includes("--debug") || args.includes("-d") ? "debug" : "release";
const clean = args.includes("--clean") || args.includes("-c");
const isWin = platform() === "win32";
const totalCores = cpus().length;
const jobs = Math.max(1, Math.floor(totalCores / 2));

chdirRoot();
banner(`AI Workbench Build (${mode})`, [`平台: ${platform()} | CPU: ${totalCores} 核, 并行: ${jobs}`]);

const pnpmStatus = ensurePnpmAvailable({ autoFix: true });
if (pnpmStatus.status !== "ready" && pnpmStatus.status !== "fixed") {
  stepErr(pnpmStatus.detail);
  process.exit(pnpmStatus.exitCode);
}
stepOk(pnpmStatus.status === "fixed" ? `${pnpmStatus.detail} (自动修复)` : pnpmStatus.detail);

if (clean) {
  console.log("\n🧹 清理构建缓存...");
  for (const relative of ["dist", "node_modules/.cache"]) {
    const target = resolve(ROOT, relative);
    if (!existsSync(target)) continue;
    if (isWin) run(`rmdir /s /q "${target}"`, { stdio: "ignore" });
    else run(`rm -rf "${target}"`, { stdio: "ignore" });
  }
}

process.env.CARGO_INCREMENTAL = "1";
process.env.RUSTFLAGS = process.env.RUSTFLAGS || "-C debuginfo=0";
process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || "--max-old-space-size=4096";

console.log("\n📦 构建前端...");
const feStart = Date.now();
run(`${pnpmCommand()} exec tsc --noEmit`);
run(`${pnpmCommand()} exec vite build`);
const feTime = ((Date.now() - feStart) / 1000).toFixed(1);
stepOk(`前端构建完成 (${feTime}s)`);

console.log(`\n🦀 构建 Rust 后端 (${mode})...`);
const rsStart = Date.now();
const cargoCmd = mode === "release" ? `cargo build --release --jobs ${jobs}` : `cargo build --jobs ${jobs}`;
run(cargoCmd, { cwd: resolve(ROOT, "src-tauri") });
const rsTime = ((Date.now() - rsStart) / 1000).toFixed(1);
stepOk(`Rust 构建完成 (${rsTime}s)`);

console.log("\n📊 构建产物:");
const distDir = resolve(ROOT, "dist");
if (existsSync(distDir)) {
  let totalSize = 0;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = resolve(dir, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else totalSize += statSync(fullPath).size;
    }
  };
  walk(distDir);
  stepOk(`前端 dist: ${formatBytes(totalSize)}`);
}

const binaryName = isWin ? "ai-workbench.exe" : "ai-workbench";
const binaryDir = mode === "release" ? "release" : "debug";
const binaryPath = resolve(ROOT, "src-tauri", "target", binaryDir, binaryName);
if (existsSync(binaryPath)) {
  stepOk(`二进制: ${formatBytes(statSync(binaryPath).size)}`);
}

stepWarn(`总用时: 前端 ${feTime}s + Rust ${rsTime}s`);
