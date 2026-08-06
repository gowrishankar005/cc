import { AnalysisContext, AnalysisPass, existingServiceFilePaths } from './pass-registry';
import { detectMessagingUnits } from './cross_package/messaging-detector';

/**
 * T-X7-2 — a separate pass from detectPersistencePass (passes.ts), even
 * though both read the SAME ctx.graphifyRun, to keep each pass's name
 * matching its actual scope (one is genuinely "persistence," this is
 * genuinely "messaging") rather than quietly widening detectPersistencePass
 * into a general "Graphify-based detection" pass. Does NOT re-run Graphify —
 * reuses the GraphifyRun detectPersistencePass already produced; a no-op
 * when that pass didn't run or failed (ctx.graphifyRun undefined), same
 * graceful-degradation convention as reconcilePass.
 */
export const detectMessagingPass: AnalysisPass = {
  name: 'detectMessaging',
  run(ctx: AnalysisContext) {
    if (!ctx.graphifyRun) return;
    const messagingUnitsByRoot = detectMessagingUnits(ctx.graphifyRun, existingServiceFilePaths(ctx));
    for (const [root, messagingUnits] of messagingUnitsByRoot) {
      if (messagingUnits.length === 0) continue;
      console.log(`[run-slice] ${root}: ${messagingUnits.length} messaging unit(s) detected via graphify (import-only, low confidence)`);
      ctx.allUnits.push(...messagingUnits);
      ctx.unitsByRoot.set(root, [...(ctx.unitsByRoot.get(root) ?? []), ...messagingUnits]);
    }
  },
};
