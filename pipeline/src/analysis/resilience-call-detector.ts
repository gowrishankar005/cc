import { DecoratorFact } from '../scanner/structural-engine';
import { IgnoredItem } from '../types/typed-facts';

/**
 * BACKLOG.md "Hand-rolled resilience-logic detection" — the last item in
 * the 2026-09-02 LLM-assist batch, and the only one that had no real
 * evidence to design against until a real evidence pass was run first
 * (see this task's own AGENT_TASKS_HandRolled_Resilience_Detection.md).
 *
 * Real evidence, two independent repos: `fineract-provider`'s
 * `Sender.java` is a genuine, textbook hand-rolled exponential-backoff
 * retry (explicit attempt/backoff/retries variables, backoff doubling,
 * the method's own javadoc says "exponential back-off to retry"). A
 * reference Java microservices banking sample's `LedgerReader.java` has
 * the IDENTICAL "loop + try/catch + sleep" shape but is a polling loop,
 * not retry-on-failure — real, confirmed proof the same deterministic
 * shape covers genuinely different intents that only reading the
 * surrounding code (an LLM's job, via the review-session dossier
 * addendum) can tell apart.
 *
 * Deliberately NOT routed through signal-catalogue.yml/signal-mapper.ts's
 * mapSignalsToUnits: that mechanism gives EVERY file with ANY matched
 * signal a real TypedUnit (defaulting to kind: 'service' with no other
 * category present). Weighted high enough to matter, a bare Thread.sleep
 * call would fabricate a phantom "service" node for any file that calls
 * it for an unrelated reason (a shutdown delay, a test wait). Weighted
 * low enough to be safe (matching python-jwt-decode-call's own
 * corroboration-only precedent), the signal alone never crosses
 * CONFIDENCE_FLOOR — and the real evidence above (Sender.java, a plain
 * unannotated class with zero other typed evidence) would never become a
 * unit at all. Resolved by emitting a real, dedicated IgnoredItem
 * directly instead — same pattern outbound-http-detector.ts/
 * env-soft-graph-detector.ts already use for evidence-thin signals that
 * must never fabricate a construct. NEVER creates a TypedUnit, under any
 * circumstance, by construction — no signal-catalogue.yml row, no
 * mapSignalsToUnits call anywhere in this file.
 *
 * Java `Thread.sleep` only — the one real, evidenced signal found. Do
 * not add Python (`time.sleep`)/Node without their own real evidence
 * pass first (none found in any spikes/ repo as of this writing).
 */
export const HAND_ROLLED_RESILIENCE_CANDIDATE_PREFIX = 'hand-rolled-resilience-candidate:';

const RESILIENCE_CALL_VOCABULARY = ['Thread.sleep'];

export function detectHandRolledResilienceCandidates(callFacts: DecoratorFact[]): IgnoredItem[] {
  const items: IgnoredItem[] = [];
  for (const call of callFacts) {
    if (!RESILIENCE_CALL_VOCABULARY.includes(call.referenceName)) continue;
    items.push({
      ref: `${call.filePath}:${call.line}`,
      reason: 'INSUFFICIENT_EVIDENCE',
      detail: `${HAND_ROLLED_RESILIENCE_CANDIDATE_PREFIX} calls "${call.referenceName}" at ${call.filePath}:${call.line} — may be a hand-rolled retry/backoff loop, a polling loop, rate-limiting, or unrelated; deterministic detection cannot distinguish these shapes without reading the surrounding code.`,
    });
  }
  return items;
}
