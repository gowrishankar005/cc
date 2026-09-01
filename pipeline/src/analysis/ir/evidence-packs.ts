import * as fs from 'fs';
import * as path from 'path';
import { IgnoredItem } from '../../types/typed-facts';

/**
 * HITL/LLM-advisory review of an IgnoredItem currently has only a
 * bare `ref` (file:line); an architect has to open their own IDE to see
 * anything. Attaches a small ±K-line source snippet for the two reasons
 * that actually benefit from review (AMBIGUOUS_BOUNDARY, INSUFFICIENT_EVIDENCE
 * — the other six taxonomy reasons are either self-explanatory or genuinely
 * not review-worthy, e.g. TEST_CODE), with lines matching common secret
 * patterns redacted before the snippet ever leaves this function.
 *
 * `--no-snippets` (wired in run-slice.ts) skips this entirely — some review
 * contexts (CI logs, a shared HITL queue) shouldn't get source excerpts even
 * redacted, only refs.
 */
const SNIPPET_CONTEXT_LINES = 3;
const REVIEW_WORTHY_REASONS: IgnoredItem['reason'][] = ['AMBIGUOUS_BOUNDARY', 'INSUFFICIENT_EVIDENCE'];

/**
 * Real, measured root cause of the OOM
 * crash on a large Java module (2,462 files): 133,911 of 134,250 ignoredItems
 * were review-worthy (INSUFFICIENT_EVIDENCE), each one previously triggered
 * its own full `fs.readFileSync(...).split('\n')` with zero caching (average
 * 57 ignored items per file among only 2,361 unique files), and
 * `renderIntelligenceIR` embedded every single one — with a redacted
 * snippet — into one in-memory markdown string. Confirmed via
 * `process.memoryUsage()` instrumentation (WEAVER_DEBUG_MEM=1): this step,
 * not the combined Graphify graph or the ignoredItems double-serialization
 * (both real but an order of magnitude smaller), was the actual dominant
 * cost — heapUsed jumped from 443MB to 6,057MB crossing exactly this code
 * path. Capped the same way `unmapped-signals.ts`'s MAX_CLUSTERS already
 * caps a different unbounded-by-volume report — same precedent, not a new
 * pattern. Evidence packs exist for human/LLM HITL review; a 133,911-entry
 * markdown file was never reviewable either way, cap or no cap.
 */
export const MAX_EVIDENCE_PACKS = 500;

/** Cheap count (no file I/O) so callers can report an honest "N of TOTAL, truncated" without re-deriving the review-worthy filter. */
export function countReviewWorthyIgnoredItems(ignoredItems: IgnoredItem[]): number {
  let count = 0;
  for (const item of ignoredItems) {
    if (REVIEW_WORTHY_REASONS.includes(item.reason)) count++;
  }
  return count;
}

// Conservative, false-positive-tolerant patterns — redacting a non-secret
// line is a false positive that costs nothing; missing a real secret costs a
// lot. Matches "key = value" / "key: value" shapes where the key name looks
// secret-ish, redacting only the value side, not the whole line (keeps the
// snippet still useful for review).
const SECRET_LINE_PATTERN = /((?:password|passwd|secret|api[_-]?key|access[_-]?key|private[_-]?key|token|auth)\s*[:=]\s*)(['"]?)([^'",\s]+)(['"]?)/gi;

function redact(line: string): string {
  return line.replace(SECRET_LINE_PATTERN, (_m, prefix, q1, _value, q2) => `${prefix}${q1}[REDACTED]${q2}`);
}

export interface EvidencePack {
  ref: string;
  reason: IgnoredItem['reason'];
  detail?: string;
  snippet?: string[]; // redacted source lines, ±SNIPPET_CONTEXT_LINES around ref's line
}

function resolveRefPath(ref: string, packageRoots: string[]): { absPath: string; line: number } | undefined {
  const lastColon = ref.lastIndexOf(':');
  if (lastColon === -1) return undefined;
  const relativeFilePath = ref.slice(0, lastColon);
  const line = parseInt(ref.slice(lastColon + 1), 10);
  if (!Number.isFinite(line)) return undefined;
  for (const root of packageRoots) {
    const absPath = path.join(root, relativeFilePath);
    if (fs.existsSync(absPath)) return { absPath, line };
  }
  return undefined;
}

export function buildEvidencePacks(ignoredItems: IgnoredItem[], packageRoots: string[], includeSnippets: boolean): EvidencePack[] {
  // Real files are re-read for MANY items each at scale (avg 57 ignored
  // items per file on the large-module repro) — cache per absPath so
  // each file is read+split at most once per call, regardless of how many
  // ignored items land in it. Applies even under the cap below: still a
  // real win on any run smaller than MAX_EVIDENCE_PACKS.
  const fileLineCache = new Map<string, string[]>();
  const packs: EvidencePack[] = [];

  for (const item of ignoredItems) {
    if (!REVIEW_WORTHY_REASONS.includes(item.reason)) continue;
    if (packs.length >= MAX_EVIDENCE_PACKS) break;

    const pack: EvidencePack = { ref: item.ref, reason: item.reason, detail: item.detail };
    if (includeSnippets) {
      const resolved = resolveRefPath(item.ref, packageRoots);
      if (resolved) {
        let lines = fileLineCache.get(resolved.absPath);
        if (!lines) {
          lines = fs.readFileSync(resolved.absPath, 'utf8').split('\n');
          fileLineCache.set(resolved.absPath, lines);
        }
        const start = Math.max(0, resolved.line - 1 - SNIPPET_CONTEXT_LINES);
        const end = Math.min(lines.length, resolved.line + SNIPPET_CONTEXT_LINES);
        pack.snippet = lines.slice(start, end).map(redact);
      }
    }
    packs.push(pack);
  }

  return packs;
}
