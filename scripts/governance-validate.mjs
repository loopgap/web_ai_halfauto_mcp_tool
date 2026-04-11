import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = [
  'governance/quality-gates.json',
  'governance/maturity-model.json',
  'governance/README.md',
  'governance/templates/release-template.md',
];

let failed = false;
for (const rel of files) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    console.error(`Missing required governance file: ${rel}`);
    failed = true;
  }
}

if (!failed) {
  const qg = JSON.parse(fs.readFileSync(path.join(root, 'governance/quality-gates.json'), 'utf8'));
  const mm = JSON.parse(fs.readFileSync(path.join(root, 'governance/maturity-model.json'), 'utf8'));

  if (!Array.isArray(qg.hard_gates) || qg.hard_gates.length === 0) {
    console.error('quality-gates.json hard_gates is empty');
    failed = true;
  }

  if (!qg.scorecard || !Array.isArray(qg.scorecard.dimensions)) {
    console.error('quality-gates.json scorecard.dimensions missing');
    failed = true;
  }

  if (!Array.isArray(mm.levels) || mm.levels.length === 0) {
    console.error('maturity-model.json levels is empty');
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log('Governance validation passed.');
