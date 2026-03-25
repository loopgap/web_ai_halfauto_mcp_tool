#!/usr/bin/env node
import { banner, chdirRoot, memorySummary, run, section, stepOk, stepWarn } from "./lib/automation.mjs";

const args = new Set(process.argv.slice(2));
const skipCi = args.has("--no-ci");

chdirRoot();
banner("AI Workbench — First Run", [memorySummary(), "首次启动快速诊断与热身"]);

section("1️⃣ 环境修复");
run("node scripts/check-environment.mjs --fix");
stepOk("环境检查与修复完成");

section("2️⃣ 首次自举");
run(`node scripts/bootstrap.mjs ${skipCi ? "--skip-ci" : ""}`.trim());
stepOk("bootstrap 完成");

section("3️⃣ 建议动作");
stepWarn(skipCi ? "你跳过了完整门禁，建议随后运行 pnpm ci:local" : "需要推送时运行 pnpm git:ship");
stepOk("可运行 pnpm start 或 pnpm start:fe 启动应用");
