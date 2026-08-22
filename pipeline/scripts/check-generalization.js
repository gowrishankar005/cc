#!/usr/bin/env node
// Mechanical bug-fix generalization check — BACKLOG.md P1 "Mechanical
// bug-fix generalization check" row. Named because passive review already
// missed one real instance of exactly this class of bug (T-LR-1's first
// pass hardcoded the annotation name 'Configuration' as a literal instead
// of a catalogue row; a human caught it by reading the diff, not this
// process). Flags a diff for a human's attention — does not attempt to
// judge intent, only surfaces the two real, cited shapes:
//
//   (a) a literal string added outside a test/fixture path that matches a
//       real sample repo this project has locally cloned under spikes/ —
//       the exact shape OOS_Registry.md's OOS-sample-repo-detectors already
//       forbids permanently.
//   (b) a change to a file that implements detection/matching/relationship
//       logic, with no corresponding regression-test or Claim_Register.md
//       change in the same diff — Catalogue_Intake.md's own requirement,
//       mechanically enforced rather than left to memory.
//
// Usage: node scripts/check-generalization.js [baseRef]  (default: origin/main)
// Exit code 1 if either shape is found — same "surface it, don't silently
// pass" posture as --strict-detect and the S-flags.

const { execFileSync } = require('child_process');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const baseRef = process.argv[2] || 'origin/main';

// Real, locally-cloned sample repos this project has used as evidence
// sources (see spikes/, gitignored) — not invented, read off the actual
// directory each time this script runs would be ideal, but spikes/ is
// gitignored and often absent in CI; this list is the same set BACKLOG.md/
// Claim_Register.md/E1-E2/Tier2 rows already name as real evidence sources.
// Update this list, don't invent a new detection mechanism, when a new
// sample repo is added to spikes/.
const SAMPLE_REPO_TOKENS = [
  'fineract',
  'waltz',
  'shopizer',
  'ghostfolio',
  'legend-sdlc',
  'legend-sdlc'.replace('-', ''),
  'boa-system',
  'bank-of-anthos',
  'spring-petclinic',
  'spring-bot',
  'invoicerr',
  'maven-doxia',
  'symphony-bdk',
  'openbb',
  'medusa',
  'salesmanager', // Shopizer's real Java package root (com.salesmanager)
];

// Paths where a sample-repo-shaped literal is expected and fine (fixtures
// are deliberately real-shaped; test assertions legitimately reference the
// sample data they were written against).
const ALLOWED_PATH_SUBSTRINGS = ['coe-lab/fixtures', 'pipeline/test', '/spikes/', 'docs/solution', 'scripts/check-generalization.js'];

// Files that implement detection/matching/relationship-building logic —
// Catalogue_Intake.md's four requirements apply to a change here.
const LOGIC_PATH_PATTERNS = [/^src\/analysis\//, /^src\/scanner\//, /^src\/modules\/calm-generator\//, /^src\/rules\/.*\.yml$/];

const TEST_OR_CLAIM_PATH_PATTERNS = [/^test\/regression\.test\.js$/];

function git(args) {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' });
}

function changedFiles() {
  return git(['diff', '--name-only', `${baseRef}...HEAD`])
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

function addedLines(fileRelativeToRepoRoot) {
  let diff;
  try {
    diff = git(['diff', `${baseRef}...HEAD`, '--', fileRelativeToRepoRoot]);
  } catch {
    return [];
  }
  return diff
    .split('\n')
    .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
    .map((l) => l.slice(1));
}

function isAllowedPath(file) {
  return ALLOWED_PATH_SUBSTRINGS.some((s) => file.includes(s));
}

// Real evidence-citation prose ("// verified against Fineract...") is
// expected and required by this project's own discipline — only a repo-
// specific literal actually used in a COMPARISON/LOOKUP is the forbidden
// OOS-sample-repo-detectors shape (code keyed to a sample repo's name), not
// a comment or doc-string mentioning the repo as evidence.
const COMPARISON_CONTEXT = /(===|==|!==|!=|\.includes\(|\.has\(|\.startsWith\(|\.endsWith\(|\.match\(|case\s)\s*['"`][^'"`]*['"`]/;

function isCommentLine(line) {
  const trimmed = line.trim();
  return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('*/') || trimmed.startsWith('#');
}

function checkSampleRepoLiterals(files) {
  const findings = [];
  for (const file of files) {
    if (isAllowedPath(file)) continue;
    if (!file.startsWith('pipeline/src/')) continue;
    for (const line of addedLines(file)) {
      if (isCommentLine(line)) continue;
      if (!COMPARISON_CONTEXT.test(line)) continue;
      const lower = line.toLowerCase();
      for (const token of SAMPLE_REPO_TOKENS) {
        if (lower.includes(token.toLowerCase())) {
          findings.push({ file, token, line: line.trim() });
        }
      }
    }
  }
  return findings;
}

function checkLogicWithoutTestOrClaim(files) {
  const touchedLogic = files.filter((f) => LOGIC_PATH_PATTERNS.some((re) => re.test(f.replace(/^pipeline\//, ''))));
  if (touchedLogic.length === 0) return [];
  const touchedTestOrClaim = files.some((f) => TEST_OR_CLAIM_PATH_PATTERNS.some((re) => re.test(f.replace(/^pipeline\//, ''))) || f === 'docs/solution/Claim_Register.md');
  if (touchedTestOrClaim) return [];
  return touchedLogic;
}

function main() {
  const files = changedFiles();
  if (files.length === 0) {
    console.log('[check-generalization] no changed files vs', baseRef, '— nothing to check');
    return;
  }

  const literalFindings = checkSampleRepoLiterals(files);
  const logicWithoutTest = checkLogicWithoutTestOrClaim(files);

  let failed = false;

  if (literalFindings.length > 0) {
    failed = true;
    console.error('[check-generalization] FAILED — sample-repo-shaped literal(s) added outside a test/fixture path (OOS-sample-repo-detectors forbids this permanently):');
    for (const f of literalFindings) {
      console.error(`  ${f.file}: matched "${f.token}" in: ${f.line}`);
    }
  }

  if (logicWithoutTest.length > 0) {
    failed = true;
    console.error('[check-generalization] FAILED — detection/matching/relationship logic changed with no regression-test or Claim_Register.md update in the same diff (Catalogue_Intake.md requirement):');
    for (const f of logicWithoutTest) {
      console.error(`  ${f}`);
    }
  }

  if (failed) {
    console.error('\nSee docs/solution/Catalogue_Intake.md and docs/solution/OOS_Registry.md#OOS-sample-repo-detectors before overriding.');
    process.exit(1);
  }

  console.log('[check-generalization] clean —', files.length, 'file(s) checked against', baseRef);
}

main();
