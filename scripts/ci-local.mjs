#!/usr/bin/env node
import { resolve } from "node:path";
import { STATUS_CODES, banner, capture, chdirRoot, classifyFailure, pnpmCommand, run, section, stepErr, stepOk } from "./lib/automation.mjs";

const args = new Set(process.argv.slice(2));
const isHook = args.has("--hook");
const doClean = args.has("--clean");
const isFast = args.has("--fast");

function output(command, options = {}) {
  const result = capture(command, options);
  if (!result.ok) {
    throw new Error(result.stderr || result.stdout || `${command} failed`);
  }
  return result.stdout;
}

function runStep(title, command, options = {}) {
  const startedAt = Date.now();
  section(`▶ ${title}`);
  try {
    run(command, options);
  } catch (error) {
    const output = `${error.stdout || ""}\n${error.stderr || ""}\n${String(error.message || "")}`;
    const status = classifyFailure(output);
    stepErr(`${title} 失败`);
    process.exit(STATUS_CODES[status]);
  }
  stepOk(`${title} (${((Date.now() - startedAt) / 1000).toFixed(1)}s)`);
}

chdirRoot();
banner(`AI Workbench — 本地 CI 预检${isHook ? " (hook)" : ""}`, [`模式: ${isFast ? "fast" : "full"}`]);

const rustHost = (() => {
  try {
    return output("rustc -vV", { cwd: resolve("src-tauri") })
      .split(/\r?\n/)
      .find((line) => line.startsWith("host:"))
      ?.split(":")[1]
      ?.trim() || "unknown";
  } catch {
    return "not-installed";
  }
})();
const hasRust = rustHost !== "not-installed";
const useRustTestFallback = process.platform === "win32" && rustHost.endsWith("windows-gnu");

if (doClean) {
  runStep("清理构建缓存", "node scripts/clean.mjs hard");
}
if (!isFast) {
  runStep("冻结锁文件安装", `${pnpmCommand()} install --frozen-lockfile`);
}
runStep("环境检查", "node scripts/check-environment.mjs");
runStep("TypeScript 检查", `${pnpmCommand()} exec tsc --noEmit`);
if (!isFast) {
  runStep("Vitest CI", `${pnpmCommand()} test:ci`);
  runStep("前端构建", `${pnpmCommand()} exec vite build`);
}
if (hasRust) {
  runStep("Rust cargo check", "cargo check --jobs 1", { cwd: resolve("src-tauri") });
  if (!isFast) {
    runStep("Rust clippy", "cargo clippy --jobs 1 -- -D warnings -A dead_code", { cwd: resolve("src-tauri") });
    if (useRustTestFallback) {
      runStep("Rust tests (check fallback)", "cargo check --tests --jobs 1", { cwd: resolve("src-tauri") });
    } else {
      runStep("Rust tests", "cargo test --jobs 1 -- --nocapture", { cwd: resolve("src-tauri") });
    }
  }
}
runStep("治理校验", "node scripts/validate-governance.mjs");
runStep("治理 API 合约测试", "node scripts/test-governance-api-contract.mjs");

banner(`✅ 本地 CI ${isFast ? "快速门禁" : "预检"}通过`, [hasRust ? `Rust host: ${rustHost}` : "Rust 未安装，已跳过 Rust 检查"]);
process.exit(0);
