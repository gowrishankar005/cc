#!/usr/bin/env node
/**
 * T-LM-0 (AGENT_TASKS_Ext_Lens_Modules.md) -- deterministic scorer:
 * threat-signals-report.json vs gold/modules/threat-signals/<pkg>.gold.json.
 * No LLM. Evaluation only.
 *
 * threat-signals is the first module scored this way -- before this script,
 * every lens module (including threat-signals itself) shipped unmeasurable,
 * which the lane file's own pre-flight named as a blocking gap: an
 * unmeasured lens may inform but must never gate a governance decision
 * (BR-110).
 *
 * Matches on `unitNameContains` (a stable substring of the real unit id,
 * e.g. a class/file name) rather than the full unique-id, since unique-ids
 * are root-relative file paths that are correct but verbose and brittle to
 * match exactly -- same trade-off calm scoring already makes.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const GOLD_DIR = path.join(__dirname, '..', 'gold', 'modules', 'threat-signals');
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

  const reportPath = path.join(GENERATED_DIR, pkg, 'modules', 'threat-signals', 'threat-signals-report.json');
  if (!fs.existsSync(reportPath)) {
    return { pkg, error: `no threat-signals-report.json at ${reportPath} -- run generate-calm.mjs first` };
  }
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const actual = report.findings ?? [];

  // Every gold finding must be matched by exactly one real finding whose
  // unitId contains the gold's unitNameContains substring -- each real
  // finding consumed at most once, so two gold entries can't both match
  // the same real finding (a real, if currently unexercised, correctness
  // property: coincidental substring collisions must not silently double-count).
  const unmatched = [];
  const consumed = new Set();
  for (const expected of gold.findings) {
    const hit = actual.findIndex((f, i) => !consumed.has(i) && f.unitId.includes(expected.unitNameContains) && f.stride === expected.stride);
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
    unmatched: unmatched.map((f) => `${f.unitNameContains} (${f.stride})`),
    unexpected: unexpected.map((f) => `${f.unitId} (${f.stride})`),
  };
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log('Usage: score-module-threat-signals.mjs --all | --pkg <name>');
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
