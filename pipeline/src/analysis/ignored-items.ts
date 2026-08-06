import { IgnoredItem } from '../types/typed-facts';

/** Taxonomy: docs/spikes/Gap_Closure_Build_Ready_Specs_v0.1.md §5. Language-agnostic, used as-is. */
export function ignoreUnknownSignal(ref: string, rawSignal: string): IgnoredItem {
  return {
    ref,
    reason: 'INSUFFICIENT_EVIDENCE',
    detail: `No signal-catalogue.yml rule matched raw signal "${rawSignal}" — candidate for rules/suggest-rules.ts`,
  };
}

export function ignoreLowConfidence(ref: string, confidence: number): IgnoredItem {
  return {
    ref,
    reason: 'INSUFFICIENT_EVIDENCE',
    detail: `Confidence ${confidence} below the review-queue threshold (40)`,
  };
}
