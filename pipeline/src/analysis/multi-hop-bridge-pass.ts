import { AnalysisContext, AnalysisPass, pushAll } from './pass-registry';
import { detectMultiHopBridgeRelationships } from './cross_package/multi-hop-bridge-detector';
import { bridgeStereotypeSignals } from '../rules/rule-schema';

/**
 * AREC Wave 3 T-C1 (R2). Reuses the SAME ctx.graphifyRun detectPersistencePass
 * already produced (no re-run) — a no-op when that pass didn't run/failed,
 * same graceful-degradation convention as reconcilePass/k8sTrustPass.
 *
 * T-P0-1 (E2) round 3 — now runs BEFORE reconcilePass (both append to
 * ctx.relationships, which is safe in either order on its own), so that
 * ctx.multiHopExaminedPairs is populated before reconcilePass's graded-fact
 * admission logic runs. Without this, admission raced this detector for the
 * same "service -> unresolved node" edges and won just by running first,
 * confirmed with real fixtures (`r2b-implementer-hop-sample`,
 * `r2c-direct-delegate-sample`) — admission would silently admit a blunt,
 * low-confidence fact for exactly the edge this detector was about to
 * examine far more carefully.
 */
export const multiHopBridgePass: AnalysisPass = {
  name: 'multiHopBridge',
  run(ctx: AnalysisContext) {
    if (!ctx.graphifyRun) return;
    const { relationships, ignoredItems, examinedPairs, examinedBridgeFiles } = detectMultiHopBridgeRelationships(
      ctx.graphifyRun,
      ctx.unitsByRoot,
      bridgeStereotypeSignals(ctx.catalogue)
    );
    if (relationships.length > 0) {
      console.log(`[run-slice] multi-hop bridge (R2): ${relationships.length} architecture relationship(s) resolved`);
    }
    pushAll(ctx.relationships, relationships);
    pushAll(ctx.allIgnoredItems, ignoredItems);
    ctx.multiHopExaminedPairs = examinedPairs;
    ctx.multiHopExaminedFiles = examinedBridgeFiles;
  },
};
