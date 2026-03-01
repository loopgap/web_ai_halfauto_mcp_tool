import fs from "node:fs";
import path from "node:path";

const apiFile = path.resolve(process.cwd(), "src/api.ts");
const apiText = fs.readFileSync(apiFile, "utf8");

const libFile = path.resolve(process.cwd(), "src-tauri/src/lib.rs");
const libText = fs.readFileSync(libFile, "utf8");

let passed = 0;
let failed = 0;

function mustContain(text, snippet, label) {
  if (!text.includes(snippet)) {
    console.error(`FAIL: ${label} — missing "${snippet}"`);
    failed++;
  } else {
    passed++;
  }
}

function mustMatch(text, regex, label) {
  if (!regex.test(text)) {
    console.error(`FAIL: ${label} — regex ${regex} not matched`);
    failed++;
  } else {
    passed++;
  }
}

// Multiline-aware match (joins full file text)
function mustMatchML(text, regex, label) {
  // Apply regex with dotAll semantics already set in caller
  if (!regex.test(text)) {
    console.error(`FAIL: ${label} — regex ${regex} not matched`);
    failed++;
  } else {
    passed++;
  }
}

// ── 1. Frontend API function exports ──
mustContain(apiText, "export async function governanceValidate", "governanceValidate export");
mustContain(apiText, "export async function governanceEmitTelemetry", "governanceEmitTelemetry export");
mustContain(apiText, "export async function governanceLatest", "governanceLatest export");

// ── 2. Frontend invokes correct backend command names ──
mustContain(apiText, 'invokeSafe("governance_validate"', "governance_validate invoke");
mustContain(apiText, 'invokeSafe("governance_emit_telemetry"', "governance_emit_telemetry invoke");
mustContain(apiText, 'invokeSafe("governance_latest"', "governance_latest invoke");

// ── 3. Return type annotations present ──
mustMatch(apiText, /governanceValidate\(.*\):\s*Promise<GovernanceValidationReport>/, "governanceValidate return type");
mustMatch(apiText, /governanceEmitTelemetry\(.*\):\s*Promise<void>/, "governanceEmitTelemetry return type");
mustMatch(apiText, /governanceLatest\(.*\):\s*Promise<GovernanceSnapshot\s*\|\s*null>/, "governanceLatest return type");

// ── 4. Parameter structure: change_id passed correctly ──
mustMatchML(apiText, /governance_validate[\s\S]*?change_id:\s*changeId/, "governanceValidate passes change_id param");
mustMatchML(apiText, /governance_latest[\s\S]*?change_id:\s*changeId/, "governanceLatest passes change_id param");
mustMatch(apiText, /governance_emit_telemetry.*event/, "governanceEmitTelemetry passes event param");

// ── 5. Backend command handlers registered ──
mustMatch(libText, /fn\s+governance_validate\b/, "backend governance_validate handler exists");
mustMatch(libText, /fn\s+governance_emit_telemetry\b/, "backend governance_emit_telemetry handler exists");
mustMatch(libText, /fn\s+governance_latest\b/, "backend governance_latest handler exists");

// ── 6. Backend commands in invoke_handler ──
mustContain(libText, "governance_validate", "governance_validate in invoke_handler");
mustContain(libText, "governance_emit_telemetry", "governance_emit_telemetry in invoke_handler");
mustContain(libText, "governance_latest", "governance_latest in invoke_handler");

// ── 7. Error code contract: frontend recovery map keys match backend catalog ──
const actionsFile = path.resolve(process.cwd(), "src/domain/actions.ts");
const actionsText = fs.readFileSync(actionsFile, "utf8");
const configFile = path.resolve(process.cwd(), "src-tauri/src/config.rs");
const configText = fs.readFileSync(configFile, "utf8");

// Extract error codes from config.rs catalog
const catalogCodes = [...configText.matchAll(/code:\s*"([A-Z_]+)"/g)].map(m => m[1]);

// Extract recovery map keys from actions.ts
const recoveryKeys = [...actionsText.matchAll(/^\s{4}([A-Z_]+):\s*\[/gm)].map(m => m[1]);

// Every recovery key must exist in the catalog
for (const key of recoveryKeys) {
  if (catalogCodes.includes(key)) {
    passed++;
  } else {
    console.error(`FAIL: recovery key "${key}" not found in backend error catalog`);
    failed++;
  }
}

// ── Summary ──
console.log(`\ngovernance api contract test: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
