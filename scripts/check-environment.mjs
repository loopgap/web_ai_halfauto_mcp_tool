import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function checkNode() {
  const execPath = process.execPath;
  const ok = Boolean(execPath && fs.existsSync(execPath));
  return {
    ok,
    name: "node",
    required: true,
    line: ok ? `${process.version} (${execPath})` : "node runtime is unavailable",
  };
}

function checkPnpm() {
  const result = spawnSync("pnpm", ["--version"], { encoding: "utf8", shell: true });
  const ok = result.status === 0;
  return {
    ok,
    name: "pnpm",
    required: true,
    line: ok ? `version ${result.stdout.trim()}` : "pnpm runtime is unavailable",
  };
}

function checkOptional(name, filePath) {
  const ok = fs.existsSync(filePath);
  return {
    ok,
    name,
    required: false,
    line: ok ? `detected at ${filePath}` : "optional tool not found",
  };
}

const user = process.env.USERPROFILE || "C:\\Users\\Administrator";
const checks = [
  checkNode(),
  checkPnpm(),
  checkOptional("cargo", path.join(user, ".cargo", "bin", "cargo.exe")),
  checkOptional("rustc", path.join(user, ".cargo", "bin", "rustc.exe")),
];

let failed = false;
for (const c of checks) {
  if (c.ok) {
    console.log(`[env] ${c.name}: ${c.line}`);
  } else {
    console.log(`[env] ${c.name}: missing`);
    if (c.required) failed = true;
  }
}

if (failed) {
  console.error("[env] required tools are missing");
  process.exit(1);
}

console.log("[env] check passed");
