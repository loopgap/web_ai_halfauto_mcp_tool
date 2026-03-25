#!/usr/bin/env node
import {
  banner,
  capture,
  chdirRoot,
  currentGitBranch,
  gitRemoteUrl,
  run,
  section,
  shellJoin,
  stepErr,
  stepOk,
  stepWarn,
  STATUS_CODES,
} from "./lib/automation.mjs";

const argv = process.argv.slice(2);
const arg = (name) => {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : null;
};
const has = (name) => argv.includes(name);

const type = arg("--type") || "chore";
const scope = arg("--scope") || "workflow";
const description = arg("--message") || "ship bootstrap and automation workflow";
const noPush = has("--no-push");
const stageAll = has("--all");

const SAFE_PATTERNS = [
  /^\.npmrc$/,
  /^\.nvmrc$/,
  /^README\.md$/,
  /^QUICKSTART\.md$/,
  /^docs\//,
  /^scripts\//,
  /^package\.json$/,
  /^pnpm-lock\.yaml$/,
  /^\.githooks\//,
  /^\.github\/workflows\//,
];

function fail(message, code = STATUS_CODES["blocked-git"]) {
  stepErr(message);
  process.exit(code);
}

function parseStatusLines() {
  const result = capture("git status --porcelain=v1");
  if (!result.ok || !result.stdout) return [];
  return result.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const status = line.slice(0, 2);
      const rawPath = line.slice(3).trim();
      const path = rawPath.includes(" -> ") ? rawPath.split(" -> ")[1] : rawPath;
      return { status, path };
    });
}

function stagedFiles() {
  const result = capture("git diff --cached --name-only");
  if (!result.ok || !result.stdout) return [];
  return result.stdout.split(/\r?\n/).filter(Boolean);
}

function stageFiles(files) {
  if (files.length === 0) return;
  run(shellJoin(["git", "add", "--", ...files]));
}

chdirRoot();
banner("AI Workbench — Git Ship", [noPush ? "模式: commit only" : "模式: commit + push origin/main"]);

if (currentGitBranch() !== "main") {
  fail("当前分支不是 main，git:ship 默认只允许在 main 上执行。", STATUS_CODES["blocked-git"]);
}

const origin = gitRemoteUrl();
if (!origin || !origin.includes("github.com")) {
  fail("origin 远端不存在或不是 GitHub 仓库。", STATUS_CODES["blocked-git"]);
}

const statusLines = parseStatusLines();
if (statusLines.length === 0) {
  stepOk("工作树干净，没有需要提交的变更");
  process.exit(0);
}

const alreadyStaged = stagedFiles();
if (alreadyStaged.length > 0 && !stageAll) {
  const unsafeStaged = alreadyStaged.filter((file) => !SAFE_PATTERNS.some((pattern) => pattern.test(file)));
  if (unsafeStaged.length > 0) {
    fail(`已暂存非安全范围文件: ${unsafeStaged.join(", ")}。请先取消暂存或使用 --all。`, STATUS_CODES["blocked-git"]);
  }
}
if (alreadyStaged.length === 0) {
  const candidates = statusLines
    .map((entry) => entry.path)
    .filter((file, index, list) => list.indexOf(file) === index)
    .filter((file) => stageAll || SAFE_PATTERNS.some((pattern) => pattern.test(file)));

  if (candidates.length === 0) {
    fail("没有检测到可安全自动暂存的文件。请先手动 git add 目标文件，或使用 --all。", STATUS_CODES["blocked-git"]);
  }

  section("📥 暂存本次改造文件");
  stageFiles(candidates);
  candidates.forEach((file) => stepOk(file));
}

const finalStaged = stagedFiles();
if (finalStaged.length === 0) {
  fail("没有已暂存文件，终止提交。", STATUS_CODES["blocked-git"]);
}

const untouched = statusLines.map((entry) => entry.path).filter((file) => !finalStaged.includes(file));
if (untouched.length > 0) {
  section("📌 保留的未提交改动");
  untouched.forEach((file) => stepWarn(file));
}

section("🧪 运行完整门禁");
try {
  run("node scripts/ci-local.mjs");
  stepOk("本地完整门禁通过");
} catch {
  process.exit(STATUS_CODES["blocked-test-failure"]);
}

const commitMessage = `${type}${scope ? `(${scope})` : ""}: ${description}`;
section("📝 提交");
try {
  run(shellJoin(["git", "commit", "-m", commitMessage]));
  stepOk(commitMessage);
} catch {
  process.exit(STATUS_CODES["blocked-git"]);
}

if (noPush) {
  stepWarn("已跳过 push（--no-push）");
  process.exit(0);
}

section("🔐 远端认证检查");
const lsRemote = capture("git ls-remote --exit-code origin HEAD", { timeout: 30000 });
if (!lsRemote.ok) {
  fail("无法访问 origin。请先确认 GitHub 登录状态、Token 或网络，再重新运行 pnpm git:ship。", STATUS_CODES["blocked-git"]);
}
stepOk("origin 可访问");

section("🔄 同步 origin/main");
try {
  run("git fetch origin");
  stepOk("git fetch origin 完成");
} catch {
  fail("git fetch origin 失败。", STATUS_CODES["blocked-git"]);
}

const remoteHead = capture("git rev-parse origin/main");
const localHead = capture("git rev-parse HEAD");
const mergeBase = capture("git merge-base HEAD origin/main");
if (remoteHead.ok && localHead.ok && mergeBase.ok && mergeBase.stdout !== remoteHead.stdout) {
  stepWarn(`检测到 origin/main 已前进，开始 rebase 到 ${remoteHead.stdout.slice(0, 7)}`);
  try {
    run("git rebase origin/main");
    stepOk("rebase 完成");
  } catch {
    fail("rebase 失败。请解决冲突后重新运行验证与推送。", STATUS_CODES["blocked-git"]);
  }

  section("🧪 Rebase 后复验");
  try {
    run("node scripts/ci-local.mjs");
    stepOk("rebase 后完整门禁通过");
  } catch {
    process.exit(STATUS_CODES["blocked-test-failure"]);
  }
} else {
  stepOk("origin/main 未前进，无需 rebase");
}

section("🚀 推送到 origin/main");
try {
  run("git push origin main");
  stepOk("push 完成");
} catch {
  fail("push 失败。本地提交已保留，请检查认证或网络后手动 git push origin main。", STATUS_CODES["blocked-git"]);
}
