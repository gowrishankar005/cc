#!/usr/bin/env node
/**
 * T-L1-3 — expected-fail harness.
 *
 * Some hand-authored gold packages have a REAL, honest L2 residual (e.g.
 * fineract-charge: the real source has no static API->entity one-hop chain,
 * so a non-fabricating platform correctly cannot produce that edge). That is
 * not a bug — but a plain CI gate on validate-calm-pair.mjs's exit code would
 * either (a) never gate L2 at all (--require-l2 off, the current default), or
 * (b) go permanently red the moment someone turns --require-l2 on, with no
 * way to distinguish "expected, honest residual" from "real regression."
 *
 * This script closes that gap WITHOUT changing validate-calm-pair.mjs's own
 * semantics: it shells out to the existing script per listed package, reads
 * its printed L0/L1/L2 status lines, and applies expected-fail exit-code
 * logic on top:
 *   - L0 or L1 not PASS  -> FAIL (a real regression, expected-fail only
 *     covers L2, never gives L0/L1 a pass)
 *   - L2 FAIL            -> PASS (this is the expected, honest residual)
 *   - L2 PASS            -> FAIL ("unexpectedly PASSed" — the exam moved;
 *     update expected-fail-exams.json + standing-disconfirming-exams.md
 *     deliberately, don't let this silently go green)
 *   - L2 N/A              -> FAIL (ambiguous — an expected-fail package
 *     should always assert an L2 claim; if it stops, that's worth a look,
 *     not a silent pass)
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LAB = path.join(__dirname, '..');
const MANIFEST = path.join(LAB, 'docs/expected-fail-exams.json');

function main() {
  if (!fs.existsSync(MANIFEST)) {
    console.error(`missing manifest: ${MANIFEST}`);
    process.exit(2);
  }
  const { packages } = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  let allOk = true;

  for (const { pkg, examId, reason } of packages) {
    const generatedPath = path.join(LAB, 'generated', pkg, 'architecture.calm.json');
    if (!fs.existsSync(generatedPath)) {
      console.log(`\n=== ${pkg} (${examId}) ===`);
      console.log(`SKIP — no generated CALM at ${generatedPath} (run-slice this package first)`);
      continue;
    }

    const r = spawnSync(
      process.execPath,
      [path.join(__dirname, 'validate-calm-pair.mjs'), '--package', pkg, '--require-l2'],
      { encoding: 'utf8', cwd: LAB }
    );
    const out = r.stdout || '';
    const l0Gold = /L0 schema \(gold\):\s+PASS/.test(out);
    const l0Gen = /L0 schema \(gen\):\s+PASS/.test(out);
    const l1 = /L1 unit recall:\s+PASS/.test(out);
    const l2Fail = /L2 story:\s+FAIL/.test(out);
    const l2Pass = /L2 story:\s+PASS/.test(out);

    console.log(`\n=== ${pkg} (${examId}) ===`);
    console.log(`Expected reason for L2 FAIL: ${reason}`);

    let ok;
    let verdict;
    if (!l0Gold || !l0Gen || !l1) {
      ok = false;
      verdict = 'REGRESSION — L0 or L1 no longer PASS (expected-fail only covers L2, this is a real break)';
    } else if (l2Pass) {
      ok = false;
      verdict = 'UNEXPECTED L2 PASS — the exam moved. Update expected-fail-exams.json + standing-disconfirming-exams.md deliberately if this is real, do not let this go silently green';
    } else if (l2Fail) {
      ok = true;
      verdict = 'PASS — L0/L1 hold, L2 fails exactly as expected (honest residual, not a regression)';
    } else {
      ok = false;
      verdict = 'L2 status is N/A, not FAIL — an expected-fail package should assert a real L2 claim; investigate';
    }

    console.log(verdict);
    if (!ok) {
      allOk = false;
      console.log('--- raw validate-calm-pair output ---');
      console.log(out);
    }
  }

  console.log(`\n${allOk ? 'ALL EXPECTED-FAIL EXAMS OK' : 'EXPECTED-FAIL HARNESS FOUND A REAL PROBLEM'}`);
  process.exit(allOk ? 0 : 1);
}

main();
