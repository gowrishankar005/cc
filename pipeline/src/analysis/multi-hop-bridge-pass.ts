import { AnalysisContext, AnalysisPass, pushAll } from './pass-registry';
import { detectMultiHopBridgeRelationships } from './cross_package/multi-hop-bridge-detector';

/**
 * AREC Wave 3 T-C1 (R2). Reuses the SAME ctx.graphifyRun detectPersistencePass
 * already produced (no re-run) — a no-op when that pass didn't run/failed,
 * same graceful-degradation convention as reconcilePass/k8sTrustPass. MUST
 * run AFTER reconcilePass (which OVERWRITES ctx.relationships) — this pass
 * only APPENDS, so anything it added before reconcilePass ran would be
 * silently discarded, the same ordering hazard passes.ts's own header
 * comment already documents for k8sTrustPass/envSoftGraphPass.
 */
export const multiHopBridgePass: AnalysisPass = {
  name: 'multiHopBridge',
  run(ctx: AnalysisContext) {
    if (!ctx.graphifyRun) return;
    const { relationships, ignoredItems } = detectMultiHopBridgeRelationships(ctx.graphifyRun, ctx.unitsByRoot);
    if (relationships.length > 0) {
      console.log(`[run-slice] multi-hop bridge (R2): ${relationships.length} architecture relationship(s) resolved`);
    }
    pushAll(ctx.relationships, relationships);
    pushAll(ctx.allIgnoredItems, ignoredItems);
  },
};
