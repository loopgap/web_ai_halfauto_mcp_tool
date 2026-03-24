#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════
// release-tag.mjs — 自动化版本打标 & 推送
// 用法:
//   node scripts/release-tag.mjs          # 自动 patch 升级
//   node scripts/release-tag.mjs minor    # minor 升级
//   node scripts/release-tag.mjs major    # major 升级
//   node scripts/release-tag.mjs 1.2.3    # 指定版本
// ═══════════════════════════════════════════════════════════

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PKG_PATH = resolve(ROOT, "package.json");
const TAURI_CONF_PATH = resolve(ROOT, "src-tauri", "tauri.conf.json");
const CARGO_TOML_PATH = resolve(ROOT, "src-tauri", "Cargo.toml");

function run(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: "utf-8" }).trim();
}

function readJSON(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function writeJSON(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

function bumpVersion(current, level) {
  const [major, minor, patch] = current.split(".").map(Number);
  switch (level) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
    default:
      return `${major}.${minor}.${patch + 1}`;
  }
}

function isValidSemver(v) {
  return /^\d+\.\d+\.\d+(-[\w.]+)?$/.test(v);
}

// ── Main ──
const arg = process.argv[2] || "patch";
const pkg = readJSON(PKG_PATH);
const currentVersion = pkg.version;

let newVersion;
if (isValidSemver(arg)) {
  newVersion = arg;
} else if (["major", "minor", "patch"].includes(arg)) {
  newVersion = bumpVersion(currentVersion, arg);
} else {
  console.error(`❌ 无效参数: ${arg}`);
  console.error("用法: node scripts/release-tag.mjs [major|minor|patch|x.y.z]");
  process.exit(1);
}

console.log(`📦 版本: ${currentVersion} → ${newVersion}`);

// 1. 检查工作区干净
try {
  const status = run("git status --porcelain");
  if (status) {
    console.error("❌ 工作区不干净，请先 commit 或 stash 所有变更");
    console.error(status);
    process.exit(1);
  }
} catch {
  console.error("⚠️  无法检查 git 状态，继续...");
}

// 2. 更新 package.json
pkg.version = newVersion;
writeJSON(PKG_PATH, pkg);
console.log("✅ package.json 已更新");

// 3. 更新 tauri.conf.json (如果存在)
try {
  const tauriConf = readJSON(TAURI_CONF_PATH);
  if (tauriConf.version !== undefined) {
    tauriConf.version = newVersion;
    writeJSON(TAURI_CONF_PATH, tauriConf);
    console.log("✅ tauri.conf.json 已更新");
  }
} catch {
  // tauri.conf.json 可能没有 version 字段
}

// 4. 更新 Cargo.toml version
try {
  let cargo = readFileSync(CARGO_TOML_PATH, "utf-8");
  const versionRegex = /^version\s*=\s*"[^"]*"/m;
  if (versionRegex.test(cargo)) {
    cargo = cargo.replace(versionRegex, `version = "${newVersion}"`);
    writeFileSync(CARGO_TOML_PATH, cargo, "utf-8");
    console.log("✅ Cargo.toml 已更新");
  }
} catch {
  // Cargo.toml 可能不存在或格式不同
}

// 5. Git commit & tag
const tag = `v${newVersion}`;
try {
  run(`git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml`);
  run(`git commit -m "chore: release ${tag}"`);
  run(`git tag -a ${tag} -m "Release ${tag}"`);
  console.log(`✅ 已创建 tag: ${tag}`);
} catch (e) {
  console.error("❌ Git 操作失败:", e.message);
  process.exit(1);
}

// 6. 推送 (需要用户确认)
console.log("");
console.log(`🚀 准备推送到远程仓库:`);
console.log(`   git push origin main && git push origin ${tag}`);
console.log("");

if (process.argv.includes("--push")) {
  try {
    run("git push origin HEAD");
    run(`git push origin ${tag}`);
    console.log("✅ 推送完成! GitHub Actions Release 工作流将自动触发。");
  } catch (e) {
    console.error("❌ 推送失败:", e.message);
    process.exit(1);
  }
} else {
  console.log("💡 添加 --push 参数自动推送，或手动执行:");
  console.log(`   git push origin HEAD && git push origin ${tag}`);
}
