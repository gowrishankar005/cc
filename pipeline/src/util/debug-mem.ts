/**
 * Opt-in stage-by-stage memory logging, zero cost when WEAVER_DEBUG_MEM is
 * unset. This is what actually found the real dominant OOM cause on a
 * large-scale Java repro (evidence-packs volume, not the combined Graphify
 * graph or the ignoredItems double-serialization originally suspected from
 * code-reading alone) — kept as a permanent, cheap diagnostic for the next
 * scale investigation, same convention as ANTHROPIC_API_KEY gating
 * suggest-rules.ts's optional path.
 */
export function logMem(label: string): void {
  if (!process.env.WEAVER_DEBUG_MEM) return;
  const m = process.memoryUsage();
  console.error(`[mem] ${label}: rss=${(m.rss / 1e6).toFixed(0)}MB heapUsed=${(m.heapUsed / 1e6).toFixed(0)}MB heapTotal=${(m.heapTotal / 1e6).toFixed(0)}MB external=${(m.external / 1e6).toFixed(0)}MB`);
}
