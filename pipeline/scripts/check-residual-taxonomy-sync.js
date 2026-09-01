#!/usr/bin/env node
// Mechanical residual-taxonomy sync check (T-4, BACKLOG.md /
// AGENT_TASKS_Residual_Taxonomy_Sync_Check.md). Structurally modeled on
// check-generalization.js (same git helpers, same "flag it, exit 1, don't
// judge intent" posture) — watches a different drift class: a new residual
// producer (a silence-flag, an IgnoredItem.reason, a triage.py trigger)
// landing without docs/solution/Architect_Residual_Review_Session.md §3's
// producer registry being updated in the same diff. Named because this
// exact drift already happened once for real: triage.py's _TRIGGER_MAP
// gained a trigger without §3 being updated, and the doc's own status line
// contradicted its own body until a human caught it by reading the diff.
//
// Usage: node scripts/check-residual-taxonomy-sync.js [baseRef]  (default: origin/main)
// Exit code 1 if a producer file changed without the registry doc changing
// in the same diff.

const { execFileSync } = require('child_process');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const baseRef = process.argv[2] || 'origin/main';

const REGISTRY_DOC = 'docs/solution/Architect_Residual_Review_Session.md';

// The three real producer locations named in AGENT_TASKS_Residual_Taxonomy_
// Sync_Check.md, confirmed against current code. Update this list, don't
// invent a new detection mechanism, if a producer moves or a new one is
// added — and update §3's own producer table to match.
const PRODUCERS = [
  {
    file: 'pipeline/src/analysis/coverage-report.ts',
    matches: (line) => /silenceFlags\.push\(/.test(line) || /`S\d[\w-]*-/.test(line),
  },
  {
    file: 'pipeline/src/types/typed-facts.ts',
    // IgnoredItem.reason union members are always `| 'UPPER_SNAKE_CASE'`
    // lines (see the interface block) — matching that literal shape avoids
    // needing to parse the interface body or track hunk line ranges.
    matches: (line) => /^\s*\|\s*'[A-Z_]+'/.test(line),
  },
  {
    file: 'tools/review-session/triage.py',
    // Every real _TRIGGER_MAP entry is a complete one-line `"key": ("A", "class"),`
    // tuple (see the current table) — matching the full tuple shape, not just
    // `"key": (`, avoids false-positiving on unrelated dict literals elsewhere
    // in the file that share the leading `"key": (` shape (e.g. `_build_residuals`'s
    // multi-line `"rationale": (` entries).
    matches: (line) => /^\s*"[\w-]+":\s*\("[ABC]",\s*"[\w-]+"\),?\s*$/.test(line),
  },
];

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

function main() {
  const files = changedFiles();
  if (files.length === 0) {
    console.log('[check-residual-taxonomy-sync] no changed files vs', baseRef, '— nothing to check');
    return;
  }

  const touchedRegistryDoc = files.includes(REGISTRY_DOC);
  const producerHits = [];

  for (const producer of PRODUCERS) {
    if (!files.includes(producer.file)) continue;

    const hits = addedLines(producer.file).filter((l) => producer.matches(l));
    if (hits.length > 0) {
      producerHits.push({ file: producer.file, lines: hits });
    }
  }

  if (producerHits.length > 0 && !touchedRegistryDoc) {
    console.error(
      '[check-residual-taxonomy-sync] FAILED — a residual producer changed with no matching update to ' +
        REGISTRY_DOC +
        ' §3 (producer registry) in the same diff:'
    );
    for (const hit of producerHits) {
      console.error(`  ${hit.file}:`);
      for (const line of hit.lines) {
        console.error(`    ${line.trim()}`);
      }
    }
    console.error(
      '\nA new silence-flag, IgnoredItem.reason, or triage.py trigger is not done until it is a row in ' +
        REGISTRY_DOC +
        " §3's producer registry — see CLAUDE.md's \"Working in this repo\" rule (added 2026-08-23)."
    );
    process.exit(1);
  }

  console.log('[check-residual-taxonomy-sync] clean —', files.length, 'file(s) checked against', baseRef);
}

main();
