#!/usr/bin/env node
/**
 * T-LM-2 (AGENT_TASKS_Ext_Lens_Modules.md) -- deterministic scorer:
 * resilience-lens-report.json vs gold/modules/resilience-lens/<pkg>.gold.json.
 * No LLM. Evaluation only.
 *
 * Same pattern as score-module-threat-signals.mjs (T-LM-0) -- the lane
 * file's own instruction was to reuse that gold+scorer template for the
 * first new lens, not invent a second shape. Matches on
 * `unitNameContains` (a stable substring of the real unit id) plus the two
 * boolean facts (hasRetry, hasTimeout) rather than the full unique-id or a
 * free-form category, since resilience-lens's findings are exactly two
 * booleans, not a STRIDE-shaped classification.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GOLD_DIR = path.join(__dirname, '..', 'gold', 'modules', 'resilience-lens');
const GENERATED_DIR = path.join(__dirname, '..', 'generated');

function parseArgs(argv) {
  const out = { all: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--all') out.all = true;
    else if (a === '--pkg') out.pkg = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function scorePackage(pkg) {
  const goldPath = path.join(GOLD_DIR, `${pkg}.gold.json`);
  if (!fs.existsSync(goldPath)) return { pkg, skipped: true, reason: 'no gold file' };
  const gold = JSON.parse(fs.readFileSync(goldPath, 'utf8'));

  const reportPath = path.join(GENERATED_DIR, pkg, 'modules', 'resilience-lens', 'resilience-lens-report.json');
  if (!fs.existsSync(reportPath)) {
    return { pkg, error: `no resilience-lens-report.json at ${reportPath} -- run generate-calm.mjs first` };
  }
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const actual = report.findings ?? [];

  // Every gold finding must be matched by exactly one real finding whose
  // unitId contains the gold's unitNameContains substring AND agrees on
  // both hasRetry/hasTimeout -- each real finding consumed at most once,
  // same double-count guard score-module-threat-signals.mjs already uses.
  const unmatched = [];
  const consumed = new Set();
  for (const expected of gold.findings) {
    const hit = actual.findIndex(
      (f, i) => !consumed.has(i) && f.unitId.includes(expected.unitNameContains) && f.hasRetry === expected.hasRetry && f.hasTimeout === expected.hasTimeout
    );
    if (hit === -1) unmatched.push(expected);
    else consumed.add(hit);
  }
  const unexpected = actual.filter((_, i) => !consumed.has(i));

  const pass = unmatched.length === 0 && unexpected.length === 0;
  return {
    pkg,
    pass,
    expectedCount: gold.findings.length,
    actualCount: actual.length,
    unmatched: unmatched.map((f) => `${f.unitNameContains} (retry=${f.hasRetry}, timeout=${f.hasTimeout})`),
    unexpected: unexpected.map((f) => `${f.unitId} (retry=${f.hasRetry}, timeout=${f.hasTimeout})`),
  };
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log('Usage: score-module-resilience-lens.mjs --all | --pkg <name>');
    process.exit(0);
  }

  const pkgs = args.all ? fs.readdirSync(GOLD_DIR).filter((f) => f.endsWith('.gold.json')).map((f) => f.replace('.gold.json', '')) : args.pkg ? [args.pkg] : [];

  if (pkgs.length === 0) {
    console.error('Nothing to score -- pass --all or --pkg <name>');
    process.exit(2);
  }

  const results = pkgs.map(scorePackage);
  let anyFail = false;
  console.log('| package | pass | expected | actual | detail |');
  console.log('|---|---|---|---|---|');
  for (const r of results) {
    if (r.skipped) {
      console.log(`| ${r.pkg} | SKIP | - | - | ${r.reason} |`);
      continue;
    }
    if (r.error) {
      console.log(`| ${r.pkg} | ERROR | - | - | ${r.error} |`);
      anyFail = true;
      continue;
    }
    if (!r.pass) anyFail = true;
    const detail = [...r.unmatched.map((s) => `MISSING: ${s}`), ...r.unexpected.map((s) => `UNEXPECTED: ${s}`)].join('; ') || '-';
    console.log(`| ${r.pkg} | ${r.pass ? 'true' : 'FALSE'} | ${r.expectedCount} | ${r.actualCount} | ${detail} |`);
  }
  console.log(anyFail ? '\nFAIL' : '\nALL PASS');
  process.exit(anyFail ? 1 : 0);
}

main();
