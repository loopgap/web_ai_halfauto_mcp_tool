import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const govDir = path.join(projectRoot, "governance");

function readJson(relPath) {
  const file = path.join(projectRoot, relPath);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function assert(cond, msg) {
  if (!cond) {
    throw new Error(msg);
  }
}

function exists(relPath) {
  return fs.existsSync(path.join(projectRoot, relPath));
}

function calcDecision(score, go, goWithRiskMin) {
  if (score >= go) return "Go";
  if (score >= goWithRiskMin) return "GoWithRisk";
  return "NoGo";
}

try {
  assert(exists("governance/standard-v2.md"), "missing governance/standard-v2.md");
  assert(exists("governance/maturity-model.json"), "missing governance/maturity-model.json");
  assert(exists("governance/quality-gates.json"), "missing governance/quality-gates.json");

  const qualityCfg = readJson("governance/quality-gates.json");
  const exampleGate = readJson("governance/examples/quality-gate-result.example.json");
  const releaseDecision = readJson("governance/examples/release-decision.example.json");

  const requiredGateIds = qualityCfg.hard_gates.map((g) => g.id);
  for (const gateId of requiredGateIds) {
    assert(
      Object.prototype.hasOwnProperty.call(exampleGate.hard_gates, gateId),
      `hard gate result missing: ${gateId}`
    );
    assert(exampleGate.hard_gates[gateId] === true, `hard gate failed: ${gateId}`);
  }

  const dims = qualityCfg.scorecard.dimensions;
  const min = qualityCfg.scorecard.min_per_dimension;
  const max = qualityCfg.scorecard.max_per_dimension;
  let total = 0;
  for (const dim of dims) {
    const value = exampleGate.scorecard[dim];
    assert(typeof value === "number", `scorecard missing number: ${dim}`);
    assert(value >= min && value <= max, `scorecard out of range for ${dim}: ${value}`);
    total += value;
  }

  const expectedDecision = calcDecision(
    total,
    qualityCfg.scorecard.decision_thresholds.go,
    qualityCfg.scorecard.decision_thresholds.go_with_risk_min
  );
  assert(
    releaseDecision.decision === expectedDecision,
    `release decision mismatch: expected ${expectedDecision}, got ${releaseDecision.decision}`
  );

  const templateFiles = [
    "governance/templates/demand-template.md",
    "governance/templates/design-template.md",
    "governance/templates/test-template.md",
    "governance/templates/release-template.md",
    "governance/templates/incident-template.md",
    "governance/templates/capa-template.md",
    "governance/checklists/review-checklist.md",
    "governance/checklists/release-checklist.md"
  ];

  for (const file of templateFiles) {
    assert(exists(file), `missing required file: ${file}`);
  }

  console.log("governance validation passed");
  console.log(`score total: ${total}`);
  console.log(`release decision: ${expectedDecision}`);
} catch (err) {
  console.error(`governance validation failed: ${err.message}`);
  process.exit(1);
}
