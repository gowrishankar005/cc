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
console.log('| package | tier | pass | node P/R | iface R | rel R | ctrl# | viol |');
console.log('|---|---|---|---|---|---|---|---|');
for (const r of rows) {
  console.log(
    `| ${r.package} | ${r.tier} | ${r.pass} | ${r.nodeP}/${r.nodeR} | ${r.ifaceR} | ${r.relR} | ${r.ctrl} | ${r.viol} |`
  );
}
