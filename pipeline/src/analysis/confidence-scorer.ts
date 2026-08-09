import { Evidence } from '../types/typed-facts';

/**
 * Weighted confidence model. Bands: >=70 auto-include; 40-69 auto-include
 * but flagged; <40 review queue.
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
