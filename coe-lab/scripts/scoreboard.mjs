#!/usr/bin/env node
// Print a table from coe-lab/eval-results/<pkg>/score.json
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'eval-results');
if (!fs.existsSync(root)) {
  console.error('No eval-results/ yet — run run-eval.sh first');
  process.exit(1);
}

const rows = [];
for (const dir of fs.readdirSync(root)) {
  const sp = path.join(root, dir, 'score.json');
  if (!fs.existsSync(sp)) continue;
  const j = JSON.parse(fs.readFileSync(sp, 'utf8'));
  rows.push({
    package: j.packageId || dir,
    tier: j.tier,
    pass: j.pass,
    nodeP: j.nodes?.precision,
    nodeR: j.nodes?.recall,
    ifaceR: j.interfaces?.recall,
    relR: j.relationships?.recall,
    ctrl: j.controls?.nodesWithControls ?? '—',
    viol: j.mustNotDetectViolations?.length ?? 0,
  });
}
rows.sort((a, b) => a.package.localeCompare(b.package));
// AREC Wave 3 T-A3 — `pass` here is a node/interface-recall (L1-style) gate
// (see score.json's own `gateMode: "report-only-node-metrics"`); `rel R`
// is relationship recall, the L2-style column — a package can show
// `pass: true` with `rel R` far below 1 and that is NOT an architecture-story
// pass. See coe-lab/docs/validation-approach-vnext.md for the full L0-L5
// layer definitions and docs/solution/Claim_Register.md for what a low
// `rel R` on a real (non-fixture) package usually means (R2 unbuilt).
console.log('L0/L1 gate: `pass` column. L2 (architecture story) proxy: `rel R` column — low rel R is NOT a failure of pass, read it separately.');
console.log('| package | tier | pass (L0/L1) | node P/R | iface R | rel R (L2 proxy) | ctrl# | viol |');
console.log('|---|---|---|---|---|---|---|---|');
for (const r of rows) {
  console.log(
    `| ${r.package} | ${r.tier} | ${r.pass} | ${r.nodeP}/${r.nodeR} | ${r.ifaceR} | ${r.relR} | ${r.ctrl} | ${r.viol} |`
  );
}
