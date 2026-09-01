import * as fs from 'fs';
import * as path from 'path';
import { FactHistoryEntry } from './incremental-merge';

/**
 * Fact identity, incremental merge, and review history (BACKLOG.md) —
 * "who/when/on-what-evidence a status changed is retrievable,
 * not just current state". Two real sources of status-change events exist
 * in this pipeline and this file deliberately does not duplicate either:
 *  - HUMAN-driven changes (a fact promoted to 'reviewed') already carry a
 *    full audit record — `reviewer`, `reviewed_at`, `rationale`,
 *    `evidence_snapshot` — on the Decision Record itself
 *    (`types/overrides.ts`), which persists in the overrides directory
 *    across runs. That's the "who" for a human-driven transition; nothing
 *    here needs to re-record it.
 *  - ANALYSIS-driven changes (a fresh run's evidence moves a fact's status,
 *    or contradicting evidence forces a previously-'reviewed' fact back to
 *    're-review') are produced by `incremental-merge.ts`'s
 *    `mergeIncrementalFacts` — this file is where those become retrievable
 *    across runs, by appending (never overwriting) to
 *    `<outDir>/fact-history.json`, one growing JSON array, oldest first.
 */

const HISTORY_FILE = 'fact-history.json';

export function readFactHistory(outDir: string): FactHistoryEntry[] {
  const historyPath = path.join(outDir, HISTORY_FILE);
  if (!fs.existsSync(historyPath)) return [];
  return JSON.parse(fs.readFileSync(historyPath, 'utf8'));
}

export function appendFactHistory(outDir: string, entries: FactHistoryEntry[]): void {
  if (entries.length === 0) return;
  const existing = readFactHistory(outDir);
  const combined = [...existing, ...entries];
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, HISTORY_FILE), JSON.stringify(combined, null, 2));
}
