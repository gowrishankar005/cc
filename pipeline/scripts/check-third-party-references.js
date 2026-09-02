#!/usr/bin/env node
// Handover-hygiene mechanical check. Named because this exact class of
// cleanup already had to be done twice as a manual, after-the-fact sweep
// (the "Genericize Fineract/Waltz/aws-saas-boost/Fidelity references..."
// commits and the "Strip task-ID jargon from..." commits, both part of the
// enterprise-handover cleanup branch) instead of being caught at the PR
// that introduced each instance. CLAUDE.md already states both rules
// ("abstract third-party references the day you write them", "comments are
// for a stranger with no memory of today, no session/task-ID shorthand") —
// this makes them structurally enforced instead of memory-dependent.
//
// Same "flag it, exit 1, don't judge intent" posture as
// check-generalization.js and check-residual-taxonomy-sync.js. Two
// independent, real shapes:
//
//   (a) a real third-party evidence-repo or target-customer PROPER NOUN
//       (its actual capitalized product name — "Fineract", "Bank of
//       Anthos", "Fidelity", ...) added in prose or a comment anywhere in
//       the repo, outside an explicitly allowed path. Deliberately
//       case-sensitive and matched on the proper-noun form only — a
//       lowercase, hyphenated directory/module name (`fineract-charge`,
//       `spikes/fineract`) is a real, unavoidable path/identifier
//       reference, not narrative prose, and is not what this check is
//       for (see check-generalization.js for the separate, code-logic
//       version of this concern).
//   (b) a T-XXX-style tracking-ID prefix (`T-LR-3`, `T-P0-1`, `AREC Wave 3
//       T-C1`, ...) added to a NEW pipeline/src/** comment line — this
//       project's own established convention keeps such IDs in planning/
//       backlog docs (where they resolve against AGENT_TASKS_*.md) but
//       strips them from source comments, which should read standalone.
//
// Usage: node scripts/check-third-party-references.js [baseRef]  (default: origin/main)
// Exit code 1 if either shape is found.

const { execFileSync } = require('child_process');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const baseRef = process.argv[2] || 'origin/main';

// The real, actual product/company names this project has used as evidence
// sources or named as the target customer — see BACKLOG.md/Claim_Register.md's
// own already-anonymized phrasing for what each of these became. Update this
// list, don't invent a new detection mechanism, when a new sample repo or
// named customer is referenced for the first time.
const THIRD_PARTY_PROPER_NOUNS = [
  'Fineract',
  'Waltz',
  'Fidelity',
  'Bank of Anthos',
  'Shopizer',
  'Ghostfolio',
  'Legend SDLC',
  'Spring PetClinic',
  'AWS SaaS Boost',
  'Invoicerr',
  'Maven Doxia',
  'Symphony BDK',
  'OpenBB',
  'Medusa',
  'SalesManager',
];

// Paths deliberately exempt from the proper-noun check:
//   - spikes/ is gitignored scratch clones, never actually committed.
//   - coe-lab/fixtures + pipeline/test/fixtures are real-shaped sample data.
//   - coe-lab/gold/** package identifiers are real lookup keys a scoring
//     script depends on (see the "Genericize..." commit's own carve-out).
//   - Architect_Pilot_Feedback_Notes.md is a raw historical log whose
//     stated purpose is verbatim reproduction of what was actually
//     typed/seen — genericizing it would misrepresent the record.
//   - check-generalization.js's own SAMPLE_REPO_TOKENS denylist, and this
//     script's own token list above, legitimately name the real terms they
//     detect.
const ALLOWED_PATH_SUBSTRINGS = [
  '/spikes/',
  'coe-lab/fixtures',
  'pipeline/test/fixtures',
  'coe-lab/gold/',
  'docs/solution/Architect_Pilot_Feedback_Notes.md',
  'pipeline/scripts/check-generalization.js',
  'pipeline/scripts/check-third-party-references.js',
];

// This project's own tracking-ID shapes, confirmed against the real
// "Strip task-ID jargon from..." sweep commits: T-<CODE>(-<CODE>)+ (T-LR-3,
// T-P0-1, T-TC1-3, T-MR-4, ...) and the AREC wave-tracking prefix.
const TASK_ID_PATTERN = /\bT-[A-Z0-9]+(?:-[A-Z0-9]+)+\b|\bAREC\b/;

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

function isCommentLine(line) {
  const trimmed = line.trim();
  return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('*/') || trimmed.startsWith('#');
}

function checkThirdPartyProperNouns(files) {
  const findings = [];
  for (const file of files) {
    if (isAllowedPath(file)) continue;
    for (const line of addedLines(file)) {
      for (const noun of THIRD_PARTY_PROPER_NOUNS) {
        const pattern = new RegExp(`\\b${noun}\\b`);
        if (pattern.test(line)) {
          findings.push({ file, noun, line: line.trim() });
        }
      }
    }
  }
  return findings;
}

function checkTaskIdJargon(files) {
  const findings = [];
  for (const file of files) {
    if (!file.startsWith('pipeline/src/')) continue;
    for (const line of addedLines(file)) {
      if (!isCommentLine(line)) continue;
      const match = TASK_ID_PATTERN.exec(line);
      if (match) {
        findings.push({ file, match: match[0], line: line.trim() });
      }
    }
  }
  return findings;
}

function main() {
  const files = changedFiles();
  if (files.length === 0) {
    console.log('[check-third-party-references] no changed files vs', baseRef, '— nothing to check');
    return;
  }

  const properNounFindings = checkThirdPartyProperNouns(files);
  const taskIdFindings = checkTaskIdJargon(files);

  let failed = false;

  if (properNounFindings.length > 0) {
    failed = true;
    console.error('[check-third-party-references] FAILED — real third-party/customer name added in prose or a comment (CLAUDE.md: "abstract third-party references the day you write them"):');
    for (const f of properNounFindings) {
      console.error(`  ${f.file}: matched "${f.noun}" in: ${f.line}`);
    }
  }

  if (taskIdFindings.length > 0) {
    failed = true;
    console.error('[check-third-party-references] FAILED — tracking-ID jargon added to a pipeline/src comment (CLAUDE.md: "comments are for a stranger with no memory of today"):');
    for (const f of taskIdFindings) {
      console.error(`  ${f.file}: matched "${f.match}" in: ${f.line}`);
    }
  }

  if (failed) {
    console.error('\nGeneralize the reference (see BACKLOG.md/Claim_Register.md for this project\'s established anonymized phrasing) or strip the tracking ID before committing.');
    process.exit(1);
  }

  console.log('[check-third-party-references] clean —', files.length, 'file(s) checked against', baseRef);
}

main();
