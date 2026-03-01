import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const argMap = {};
for (let i = 0; i < args.length; i += 2) {
  const key = args[i];
  const value = args[i + 1];
  if (!key || !value) continue;
  argMap[key.replace(/^--/, "")] = value;
}

function must(name) {
  if (!argMap[name]) {
    throw new Error(`missing argument --${name}`);
  }
  return argMap[name];
}

function loadJson(rel) {
  const file = path.resolve(process.cwd(), rel);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function scoreTotal(scorecard) {
  return Object.values(scorecard).reduce((sum, value) => sum + Number(value || 0), 0);
}

try {
  const changePath = must("change");
  const qualityPath = must("quality");
  const releasePath = must("release");
  const outputPath = must("output");

  const change = loadJson(changePath);
  const quality = loadJson(qualityPath);
  const release = loadJson(releasePath);

  const total = scoreTotal(quality.scorecard || {});
  const lines = [];
  lines.push("# Evidence Pack");
  lines.push("");
  lines.push("## Change");
  lines.push(`- change_id: ${change.change_id}`);
  lines.push(`- title: ${change.title}`);
  lines.push(`- owner: ${change.owner}`);
  lines.push(`- risk_level: ${change.risk_level}`);
  lines.push(`- run_id: ${change.run_id || "-"}`);
  lines.push(`- step_id: ${change.step_id || "-"}`);
  lines.push(`- trace_id: ${change.trace_id || "-"}`);
  lines.push("");
  lines.push("## Hard Gates");
  for (const [gate, ok] of Object.entries(quality.hard_gates || {})) {
    lines.push(`- ${gate}: ${ok ? "PASS" : "FAIL"}`);
  }
  lines.push("");
  lines.push("## Scorecard");
  for (const [dim, score] of Object.entries(quality.scorecard || {})) {
    lines.push(`- ${dim}: ${score}`);
  }
  lines.push(`- total: ${total}`);
  lines.push("");
  lines.push("## Release Decision");
  lines.push(`- decision: ${release.decision}`);
  lines.push(`- approver: ${release.approver}`);
  lines.push(`- timestamp_utc: ${release.timestamp_utc}`);
  lines.push("");
  lines.push("## Evidence References");
  for (const ev of release.evidence || []) {
    lines.push(`- ${ev}`);
  }
  lines.push("");
  lines.push("## Rollback Plan");
  lines.push(`- ${change.rollback_plan || "N/A"}`);
  lines.push("");

  const outputAbs = path.resolve(process.cwd(), outputPath);
  fs.mkdirSync(path.dirname(outputAbs), { recursive: true });
  fs.writeFileSync(outputAbs, `${lines.join("\n")}\n`, "utf8");
  console.log(`evidence pack generated: ${outputPath}`);
} catch (err) {
  console.error(`failed to build evidence pack: ${err.message}`);
  process.exit(1);
}
