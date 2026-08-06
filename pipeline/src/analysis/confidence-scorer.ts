import { Evidence } from '../types/typed-facts';

/**
 * Weighted model, docs/spikes/Gap_Closure_Build_Ready_Specs_v0.1.md §7.
 * Bands: >=70 auto-include; 40-69 auto-include but flagged; <40 review queue.
 */
export function scoreConfidence(evidence: Evidence[]): number {
  const total = evidence.reduce((sum, e) => sum + e.weight, 0);
  return Math.min(100, total);
}

export type ConfidenceBand = 'high' | 'medium' | 'low';

export function bandFor(confidence: number): ConfidenceBand {
  if (confidence >= 70) return 'high';
  if (confidence >= 40) return 'medium';
  return 'low';
}
