#!/usr/bin/env node
/**
 * Shared harness for module-output scorers (T-LM-0's threat-signals scorer,
 * T-LM-2's resilience-lens scorer, and any future lens scorer). Extracted
 * after code review flagged score-module-resilience-lens.mjs as a
 * near-verbatim copy of score-module-threat-signals.mjs's arg parsing, CLI
 * resolution, markdown table, and exit-code convention -- only the
 * match/describe predicates genuinely differ per module. No LLM. Evaluation
 * only, same as every script in this directory.
 */
import fs from 'fs';
import path from 'path';

export function parseScorerArgs(argv) {
  const out = { all: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--all') out.all = true;
    else if (a === '--pkg') out.pkg = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

/**
 * Scores one package's real module output against its hand-authored gold
 * file. `matchFn(actualFinding, expectedGoldEntry)` decides whether one real
 * finding satisfies one gold entry -- every real finding consumed at most
 * once (a real, if currently unexercised, correctness property: coincidental
 * matches must not silently double-count, same discipline T-LM-0 shipped
 * with). `describeExpected`/`describeActual` format one gold/real entry for
 * the MISSING/UNEXPECTED detail column -- their shapes genuinely differ
 * (gold entries carry a stable substring key like `unitNameContains`; real
 * findings carry the full `unitId`), so this stays two functions, not one.
 */
export function scorePackage({ pkg, goldDir, generatedDir, reportRelPath, matchFn, describeExpected, describeActual }) {
  const goldPath = path.join(goldDir, `${pkg}.gold.json`);
  if (!fs.existsSync(goldPath)) return { pkg, skipped: true, reason: 'no gold file' };
  const gold = JSON.parse(fs.readFileSync(goldPath, 'utf8'));

  const reportPath = path.join(generatedDir, pkg, ...reportRelPath);
  if (!fs.existsSync(reportPath)) {
    return { pkg, error: `no report at ${reportPath} -- run generate-calm.mjs first` };
  }
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const actual = report.findings ?? [];

  const unmatched = [];
  const consumed = new Set();
  for (const expected of gold.findings) {
    const hit = actual.findIndex((f, i) => !consumed.has(i) && matchFn(f, expected));
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
    unmatched: unmatched.map(describeExpected),
    unexpected: unexpected.map(describeActual),
  };
}

/** Full CLI: arg parsing, --all/--pkg resolution, markdown table, exit-code convention (0 = ALL PASS, 1 = FAIL, 2 = nothing to score). */
export function runScorerCli({ goldDir, generatedDir, reportRelPath, matchFn, describeExpected, describeActual, usage }) {
  const args = parseScorerArgs(process.argv);
  if (args.help) {
    console.log(usage);
    process.exit(0);
  }

  const pkgs = args.all
    ? fs.readdirSync(goldDir).filter((f) => f.endsWith('.gold.json')).map((f) => f.replace('.gold.json', ''))
    : args.pkg
      ? [args.pkg]
      : [];

  if (pkgs.length === 0) {
    console.error('Nothing to score -- pass --all or --pkg <name>');
    process.exit(2);
  }

  const results = pkgs.map((pkg) => scorePackage({ pkg, goldDir, generatedDir, reportRelPath, matchFn, describeExpected, describeActual }));
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
