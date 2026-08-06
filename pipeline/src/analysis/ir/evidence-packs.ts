import * as fs from 'fs';
import * as path from 'path';
import { IgnoredItem } from '../../types/typed-facts';

/**
 * T-X3-1 — HITL/LLM-advisory review of an IgnoredItem currently has only a
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
  return ignoredItems
    .filter((item) => REVIEW_WORTHY_REASONS.includes(item.reason))
    .map((item) => {
      const pack: EvidencePack = { ref: item.ref, reason: item.reason, detail: item.detail };
      if (!includeSnippets) return pack;

      const resolved = resolveRefPath(item.ref, packageRoots);
      if (!resolved) return pack;

      const lines = fs.readFileSync(resolved.absPath, 'utf8').split('\n');
      const start = Math.max(0, resolved.line - 1 - SNIPPET_CONTEXT_LINES);
      const end = Math.min(lines.length, resolved.line + SNIPPET_CONTEXT_LINES);
      pack.snippet = lines.slice(start, end).map(redact);
      return pack;
    });
}
