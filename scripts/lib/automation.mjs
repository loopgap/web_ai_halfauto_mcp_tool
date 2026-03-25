#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir, platform, arch, totalmem } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname, "..", "..");
export const PLATFORM = platform();
export const ARCH = arch();
export const IS_WINDOWS = PLATFORM === "win32";
export const IS_LINUX = PLATFORM === "linux";
export const IS_MACOS = PLATFORM === "darwin";

export const STATUS_CODES = {
  ready: 0,
  fixed: 10,
  "blocked-needs-admin": 20,
  "blocked-network": 21,
  "blocked-test-failure": 22,
  "blocked-git": 23,
};

export const LINUX_TAURI_PACKAGES = [
  "libwebkit2gtk-4.1-dev",
  "libgtk-3-dev",
  "libayatana-appindicator3-dev",
  "librsvg2-dev",
  "patchelf",
];

export function chdirRoot() {
  process.chdir(ROOT);
}

export function banner(title, lines = []) {
  console.log("");
  console.log("═══════════════════════════════════════");
  console.log(`  ${title}`);
  for (const line of lines) {
    console.log(`  ${line}`);
  }
  console.log("═══════════════════════════════════════");
}

export function section(title) {
  console.log(`\n${title}`);
}

export function stepOk(message) {
  console.log(`  ✅ ${message}`);
}

export function stepWarn(message) {
  console.log(`  ⚠️  ${message}`);
}

export function stepErr(message) {
  console.log(`  ❌ ${message}`);
}

export function shellJoin(parts) {
  return parts
    .map((part) => {
      if (/^[A-Za-z0-9_./:=+-]+$/.test(part)) return part;
      return `'${part.replace(/'/g, `'\\''`)}'`;
    })
    .join(" ");
}

export function run(command, options = {}) {
  return execSync(command, {
    cwd: ROOT,
    stdio: "inherit",
    shell: true,
    env: defaultEnv(),
    ...options,
  });
}

export function capture(command, options = {}) {
  try {
    const stdout = execSync(command, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
      env: defaultEnv(),
      ...options,
    }).trim();
    return { ok: true, stdout, status: 0 };
  } catch (error) {
    return {
      ok: false,
      status: typeof error.status === "number" ? error.status : 1,
      stdout: error.stdout?.toString?.().trim?.() || "",
      stderr: error.stderr?.toString?.().trim?.() || "",
      error,
    };
  }
}

export function defaultEnv() {
  const pathParts = [
    join(homedir(), ".cargo", "bin"),
    process.env.PATH || "",
  ].filter(Boolean);

  return {
    ...process.env,
    PATH: pathParts.join(IS_WINDOWS ? ";" : ":"),
    CARGO_TERM_COLOR: process.env.CARGO_TERM_COLOR || "always",
    CARGO_INCREMENTAL: process.env.CARGO_INCREMENTAL || "0",
    RUSTFLAGS: process.env.RUSTFLAGS || "-C debuginfo=0",
    NODE_OPTIONS: process.env.NODE_OPTIONS || "--max-old-space-size=4096",
  };
}

export function loadPackageJson() {
  return JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
}

export function getPinnedPnpmVersion() {
  const packageManager = loadPackageJson().packageManager || "";
  const match = packageManager.match(/^pnpm@(.+)$/);
  return match ? match[1] : null;
}

export function pnpmCommand() {
  if (toolPath("pnpm")) return "pnpm";
  const viaCorepack = capture("corepack pnpm --version 2>&1");
  if (viaCorepack.ok) return "corepack pnpm";
  return "pnpm";
}

export function parseNodeMajor(versionLine) {
  const match = versionLine.match(/v?(\d+)/);
  return match ? Number(match[1]) : null;
}

export function classifyFailure(output = "") {
  const normalized = output.toLowerCase();
  if (
    normalized.includes("eai_again") ||
    normalized.includes("timed out") ||
    normalized.includes("temporary failure") ||
    normalized.includes("network") ||
    normalized.includes("could not resolve") ||
    normalized.includes("dns") ||
    normalized.includes("failed to download") ||
    normalized.includes("connection refused")
  ) {
    return "blocked-network";
  }
  if (
    normalized.includes("permission denied") ||
    normalized.includes("sudo") ||
    normalized.includes("administrator") ||
    normalized.includes("access is denied")
  ) {
    return "blocked-needs-admin";
  }
  return "blocked-test-failure";
}

export function buildStatus(status, detail, extra = {}) {
  return {
    status,
    exitCode: STATUS_CODES[status],
    detail,
    ...extra,
  };
}

export function detectTool(command) {
  const result = capture(command);
  return result.ok ? result.stdout.split(/\r?\n/)[0] : null;
}

export function toolPath(name) {
  const command = IS_WINDOWS ? `where ${name}` : `command -v ${name}`;
  const result = capture(command);
  return result.ok ? result.stdout.split(/\r?\n/)[0] : null;
}

export function hasAdminPrivileges() {
  if (IS_WINDOWS) {
    const result = capture("net session");
    return result.ok;
  }
  const result = capture("id -u");
  return result.ok && result.stdout === "0";
}

export function hasSudoWithoutPrompt() {
  if (IS_WINDOWS) return false;
  return capture("sudo -n true").ok;
}

export function ensureConfigDirectories() {
  const base = join(homedir(), ".ai-workbench");
  const dirs = [
    base,
    join(base, "config"),
    join(base, "vault"),
    join(base, "vault", "runs"),
    join(base, "vault", "artifacts"),
    join(base, "vault", "governance"),
    join(base, "vault", "events"),
    join(base, "vault", "traces"),
    join(base, "health"),
  ];

  const created = [];
  for (const dir of dirs) {
    try {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        created.push(dir);
      }
    } catch (error) {
      return { base, created, error };
    }
  }
  return { base, created };
}

export function detectLinuxPackageManager() {
  if (!IS_LINUX) return null;
  if (toolPath("apt-get") && toolPath("dpkg")) return "apt";
  return null;
}

export function getMissingLinuxPackages(packages = LINUX_TAURI_PACKAGES) {
  if (!IS_LINUX || detectLinuxPackageManager() !== "apt") {
    return { supported: false, missing: [] };
  }

  const missing = [];
  for (const pkg of packages) {
    if (!capture(`dpkg -s ${pkg}`).ok) {
      missing.push(pkg);
    }
  }
  return { supported: true, missing };
}

export function ensurePnpmAvailable({ autoFix = false } = {}) {
  const existing = detectTool("pnpm --version");
  if (existing) {
    return buildStatus("ready", `pnpm ${existing}`, { version: existing });
  }

  const corepackPnpm = capture("corepack pnpm --version 2>&1");
  if (corepackPnpm.ok) {
    return buildStatus("fixed", "pnpm 已可通过 corepack 运行", { version: corepackPnpm.stdout });
  }

  if (!autoFix) {
    return buildStatus("blocked-test-failure", "pnpm 未安装，且未启用自动修复。");
  }

  const node = detectTool("node --version");
  if (!node) {
    return buildStatus("blocked-test-failure", "Node.js 未安装，无法通过 corepack 引导 pnpm。");
  }

  const corepack = toolPath("corepack");
  if (!corepack) {
    return buildStatus(
      "blocked-test-failure",
      "pnpm 缺失且 corepack 不可用。请安装 Node.js 18+ 或手动安装 pnpm。"
    );
  }

  const pinnedVersion = getPinnedPnpmVersion();

  try {
    run("corepack enable");
    if (pinnedVersion) {
      run(`corepack prepare pnpm@${pinnedVersion} --activate`);
    }
  } catch (error) {
    const output = `${error.stdout || ""}\n${error.stderr || ""}\n${String(error.message || "")}`;
    const status = classifyFailure(output);
    return buildStatus(
      status,
      status === "blocked-network"
        ? "corepack 无法下载 pnpm，请检查网络后重试。"
        : "corepack 启用 pnpm 失败，请手动安装 pnpm。"
    );
  }

  const repaired = detectTool("pnpm --version");
  if (!repaired) {
    return buildStatus("blocked-test-failure", "已尝试启用 pnpm，但仍未检测到 pnpm。");
  }

  return buildStatus("fixed", `pnpm ${repaired}`, { version: repaired });
}

export function inspectEnvironment({ autoFix = false, includeGit = true } = {}) {
  chdirRoot();
  const checks = [];
  let highestStatus = "ready";

  const pushStatus = (result) => {
    checks.push(result);
    if (STATUS_CODES[result.status] > STATUS_CODES[highestStatus]) {
      highestStatus = result.status;
    }
  };

  const nodeVersion = detectTool("node --version");
  if (!nodeVersion) {
    pushStatus(buildStatus("blocked-test-failure", "Node.js 未安装。"));
  } else {
    const major = parseNodeMajor(nodeVersion);
    if (major !== null && major < 18) {
      pushStatus(buildStatus("blocked-test-failure", `Node.js ${nodeVersion} 版本过低，要求 >= 18。`));
    } else {
      pushStatus(buildStatus("ready", `${nodeVersion} (${toolPath("node") || "unknown path"})`));
    }
  }

  pushStatus(ensurePnpmAvailable({ autoFix }));

  const cargoVersion = detectTool("cargo --version");
  pushStatus(
    cargoVersion
      ? buildStatus("ready", cargoVersion)
      : buildStatus("blocked-test-failure", "Cargo 未安装。")
  );

  const rustcVersion = detectTool("rustc --version");
  pushStatus(
    rustcVersion
      ? buildStatus("ready", rustcVersion)
      : buildStatus("blocked-test-failure", "rustc 未安装。")
  );

  if (includeGit) {
    const gitVersion = detectTool("git --version");
    pushStatus(
      gitVersion
        ? buildStatus("ready", gitVersion)
        : buildStatus("blocked-git", "Git 未安装。")
    );
  }

  if (IS_LINUX) {
    const linuxPackageManager = detectLinuxPackageManager();
    const pkgState = getMissingLinuxPackages();
    if (!pkgState.supported) {
      pushStatus(
        buildStatus(
          "ready",
          linuxPackageManager
            ? `检测到 Linux 包管理器 ${linuxPackageManager}，当前仅对 apt 系提供自动系统包安装；如需 Tauri 桌面构建，请手动安装 WebKit/GTK 前置依赖。`
            : "当前 Linux 发行版未实现自动系统包安装；如需 Tauri 桌面构建，请手动安装 WebKit/GTK 前置依赖。"
        )
      );
    } else if (pkgState.missing.length === 0) {
      pushStatus(buildStatus("ready", "Linux Tauri 系统包齐全。"));
    } else if (!autoFix) {
      pushStatus(
        buildStatus(
          "blocked-needs-admin",
          `缺少 Linux 系统包: ${pkgState.missing.join(", ")}。`
        )
      );
    } else if (hasAdminPrivileges() || hasSudoWithoutPrompt()) {
      const installer = hasAdminPrivileges() ? "" : "sudo ";
      const installCommand = `${installer}apt-get update && ${installer}apt-get install -y ${pkgState.missing.join(" ")}`;
      try {
        run(installCommand);
        pushStatus(buildStatus("fixed", `已安装 Linux 系统包: ${pkgState.missing.join(", ")}`));
      } catch (error) {
        const output = `${error.stdout || ""}\n${error.stderr || ""}\n${String(error.message || "")}`;
        pushStatus(
          buildStatus(
            classifyFailure(output),
            `自动安装 Linux 系统包失败。请手动执行: ${installCommand}`
          )
        );
      }
    } else {
      const installCommand = `sudo apt-get update && sudo apt-get install -y ${pkgState.missing.join(" ")}`;
      pushStatus(
        buildStatus(
          "blocked-needs-admin",
          `缺少管理员权限自动安装 Linux 系统包。请执行: ${installCommand}`
        )
      );
    }
  }

  if (IS_WINDOWS) {
    const webview = toolPath("WebView2Loader.dll");
    pushStatus(
      buildStatus(
        "ready",
        webview
          ? "Windows 运行时前置检测已完成。"
          : "Windows 运行时前置检测已完成（如打包时报 WebView2 问题，请安装 WebView2 Runtime）。"
      )
    );
  }

  if (IS_MACOS) {
    pushStatus(
      buildStatus(
        "ready",
        "macOS 当前提供手动支持，不包含自动系统依赖修复或发布闭环；请先手动安装 Xcode Command Line Tools 与 Tauri 前置依赖。"
      )
    );
  }

  return {
    status: highestStatus,
    exitCode: STATUS_CODES[highestStatus],
    checks,
  };
}

export function printEnvironmentChecks(checks, { title = "🔧 环境检测" } = {}) {
  section(title);
  for (const check of checks) {
    if (check.status === "ready") stepOk(check.detail);
    else if (check.status === "fixed") stepOk(`${check.detail} (自动修复)`);
    else if (check.status === "blocked-needs-admin") stepWarn(check.detail);
    else stepErr(check.detail);
  }
}

export function installNodeDependencies({ frozenLockfile = true } = {}) {
  const command = frozenLockfile ? `${pnpmCommand()} install --frozen-lockfile` : `${pnpmCommand()} install`;
  try {
    run(command);
    return buildStatus("fixed", `已执行 ${command}`);
  } catch (error) {
    const output = `${error.stdout || ""}\n${error.stderr || ""}\n${String(error.message || "")}`;
    const status = classifyFailure(output);
    return buildStatus(
      status,
      `${command} 失败。${status === "blocked-network" ? "请检查网络。" : "请检查依赖或锁文件。"}`
    );
  }
}

export function runCargoCheck() {
  try {
    run("cargo check --jobs 2", { cwd: resolve(ROOT, "src-tauri") });
    return buildStatus("ready", "cargo check 通过。");
  } catch (error) {
    const output = `${error.stdout || ""}\n${error.stderr || ""}\n${String(error.message || "")}`;
    return buildStatus(classifyFailure(output), "cargo check 失败。");
  }
}

export function repoPathExists(relativePath) {
  return existsSync(resolve(ROOT, relativePath));
}

export function memorySummary() {
  return `${PLATFORM} / ${ARCH} | 内存 ${(totalmem() / 1073741824).toFixed(1)} GB`;
}

export function currentGitBranch() {
  const result = capture("git branch --show-current");
  return result.ok ? result.stdout.trim() : "";
}

export function gitRemoteUrl(name = "origin") {
  const result = capture(`git remote get-url ${name}`);
  return result.ok ? result.stdout.trim() : "";
}
