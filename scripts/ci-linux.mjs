#!/usr/bin/env node
import { platform } from "node:os";
import { banner, capture, chdirRoot, run, section, stepOk, stepWarn } from "./lib/automation.mjs";

function tryOutput(command, options = {}) {
  const result = capture(command, options);
  return result.ok ? result.stdout : null;
}

function runStep(title, command, options = {}) {
  const startedAt = Date.now();
  section(`▶ ${title}`);
  run(command, options);
  stepOk(`${title} (${((Date.now() - startedAt) / 1000).toFixed(1)}s)`);
}

chdirRoot();
banner("AI Workbench — Linux 预演", [`当前主机: ${platform()}`]);

const dockerVersion = tryOutput("docker --version");
const wslStatus = tryOutput("wsl --status");
const wslList = tryOutput("wsl --list --quiet");
const actVersion = tryOutput("act --version");
const hasWslDistro = Boolean(wslList && wslList.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).length > 0);

runStep(
  "校验 CI 工作流与 pnpm/Linux 闭环一致",
  "node -e \"const fs=require('node:fs');const text=fs.readFileSync('.github/workflows/ci.yml','utf8');const checks=['frontend-check:','backend-check:','build-release:','cache: pnpm','pnpm install --frozen-lockfile','ubuntu-22.04'];if(checks.some((item)=>!text.includes(item))) process.exit(1);\""
);
runStep(
  "校验 Release 工作流与 Linux 发布一致",
  "node -e \"const fs=require('node:fs');const text=fs.readFileSync('.github/workflows/release.yml','utf8');const checks=['build-tauri-linux:','build-tauri-windows:','cache: pnpm','pnpm install --frozen-lockfile','patchelf'];if(checks.some((item)=>!text.includes(item))) process.exit(1);\""
);
runStep(
  "校验 Rust Linux 目标依赖声明",
  "node -e \"const fs=require('node:fs');const text=fs.readFileSync('src-tauri/Cargo.toml','utf8');if(!text.includes('[package]')) process.exit(1);\""
);

if (dockerVersion) {
  stepWarn(`检测到 Docker: ${dockerVersion}`);
  stepWarn("当前仓库未定义独立 Linux 容器镜像脚本，本次只做工作流静态一致性检查。");
} else if (actVersion) {
  stepWarn(`检测到 act: ${actVersion}`);
  stepWarn("当前仓库未定义 act 专用映射，本次只做工作流静态一致性检查。");
} else if (wslStatus && hasWslDistro) {
  stepWarn("检测到可用 WSL 发行版，但当前仓库未提供 WSL 专用引导脚本，本次只做静态一致性检查。");
} else if (wslStatus) {
  stepWarn("检测到 WSL 已启用但无发行版，本次只做静态一致性检查。");
} else {
  stepWarn("未检测到 Docker / act / 可用 WSL 发行版，本次只做静态一致性检查。");
}

banner("✅ Linux 预演完成（静态一致性检查通过）");
