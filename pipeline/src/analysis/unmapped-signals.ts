import { IgnoredItem } from '../types/typed-facts';

/**
 * Unmatched raw signals currently vanish into a flat
 * INSUFFICIENT_EVIDENCE ignoredItems list (ignoreUnknownSignal, ignored-items.ts)
 * with no aggregate view, so the catalogue has no visible feedback loop.
 * Clustered and capped so "full AST dumps unusable" never fails or
 * explodes a run on volume.
 */
const UNMAPPED_DETAIL_PATTERN = /No signal-catalogue\.yml rule matched raw signal "([^"]*)"/;

const MAX_CLUSTERS = 100;
const MAX_SAMPLES_PER_CLUSTER = 5;

export interface UnmappedSignalCluster {
  signal: string;
  count: number;
  sampleRefs: string[];
}

export interface UnmappedSignalsReport {
  generatedAt: string;
  totalUnmappedOccurrences: number;
  clusterCount: number;
  truncated: boolean;
  clusters: UnmappedSignalCluster[];
  footer: string;
}

export function buildUnmappedSignalsReport(ignoredItems: IgnoredItem[]): UnmappedSignalsReport {
  const bySignal = new Map<string, { count: number; refs: string[] }>();
  let totalUnmappedOccurrences = 0;

  for (const item of ignoredItems) {
    const match = item.detail ? UNMAPPED_DETAIL_PATTERN.exec(item.detail) : null;
    if (!match) continue;
    totalUnmappedOccurrences++;
    const signal = match[1];
    if (!bySignal.has(signal)) bySignal.set(signal, { count: 0, refs: [] });
    const entry = bySignal.get(signal)!;
    entry.count++;
    if (entry.refs.length < MAX_SAMPLES_PER_CLUSTER) entry.refs.push(item.ref);
  }

  const allClusters: UnmappedSignalCluster[] = Array.from(bySignal.entries())
    .map(([signal, { count, refs }]) => ({ signal, count, sampleRefs: refs }))
    .sort((a, b) => b.count - a.count);

  return {
    generatedAt: new Date().toISOString(),
    totalUnmappedOccurrences,
    clusterCount: allClusters.length,
    truncated: allClusters.length > MAX_CLUSTERS,
    clusters: allClusters.slice(0, MAX_CLUSTERS),
    footer:
      'A signal clustered 5+ times is a catalogue-promotion candidate (rules/suggest-rules.ts or a manual signal-catalogue.yml row) — not a per-node override target.',
  };
}
