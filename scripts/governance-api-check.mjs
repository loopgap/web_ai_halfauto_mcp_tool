import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const samples = [
  'governance/examples/change-record.example.json',
  'governance/examples/quality-gate-result.example.json',
  'governance/examples/release-decision.example.json',
];

let failed = false;
for (const rel of samples) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    console.error(`Missing sample: ${rel}`);
    failed = true;
    continue;
  }
  try {
    JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (e) {
    console.error(`Invalid JSON in ${rel}: ${String(e)}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log('Governance API sample contracts look valid.');
