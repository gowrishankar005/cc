import { AnalysisContext, AnalysisPass, pushAll } from './pass-registry';
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
 *
 * B-msg-prod-sqs (Robustness, real re-check) — AREC Wave 3 T-E3's original
 * fix (exclude any file already claimed by an earlier pass) prevented the
 * real duplicate-unique-id bug it targeted, but it did so by SILENTLY
 * DROPPING real messaging evidence whenever the SAME class is genuinely
 * both a persistence AND a messaging concern — confirmed real, not
 * hypothetical: the real lab fixture `ts-orders-dynamo`'s `OrdersDynamoStore`
 * class imports BOTH `@aws-sdk/client-dynamodb` and `@aws-sdk/client-sqs`;
 * before this fix it silently became a `database` unit with ZERO messaging
 * evidence at all, not even a low-confidence trace. Fixed properly: detect
 * messaging units unconditionally (no file-level pre-exclusion), then for
 * each one, if a unit with the SAME id already exists (from an earlier
 * pass), MERGE the messaging evidence onto that existing unit's evidence
 * array instead of creating a duplicate or dropping it — the earlier pass's
 * `kind` still wins the tie (same "first pass wins kind" precedent the old
 * exclusion enforced structurally), but the messaging evidence is now
 * honestly visible on the unit, not silently lost. Genuinely new
 * messaging-only units (no prior-pass collision) are still added exactly as
 * before.
 */
export const detectMessagingPass: AnalysisPass = {
  name: 'detectMessaging',
  run(ctx: AnalysisContext) {
    if (!ctx.graphifyRun) return;
    const messagingUnitsByRoot = detectMessagingUnits(ctx.graphifyRun);
    const existingUnitsById = new Map(ctx.allUnits.map((u) => [u.id, u]));
    for (const [root, messagingUnits] of messagingUnitsByRoot) {
      const genuinelyNewUnits = [];
      let mergedCount = 0;
      for (const mu of messagingUnits) {
        const existing = existingUnitsById.get(mu.id);
        if (existing) {
          pushAll(existing.evidence, mu.evidence);
          mergedCount++;
          continue;
        }
        genuinelyNewUnits.push(mu);
      }
      if (mergedCount > 0) {
        console.log(`[run-slice] ${root}: ${mergedCount} messaging evidence item(s) merged into already-typed unit(s) (real cross-category class, e.g. persistence+messaging in one class)`);
      }
      if (genuinelyNewUnits.length === 0) continue;
      console.log(`[run-slice] ${root}: ${genuinelyNewUnits.length} messaging unit(s) detected via graphify (import-only, low confidence)`);
      pushAll(ctx.allUnits, genuinelyNewUnits);
      ctx.unitsByRoot.set(root, [...(ctx.unitsByRoot.get(root) ?? []), ...genuinelyNewUnits]);
    }
  },
};
