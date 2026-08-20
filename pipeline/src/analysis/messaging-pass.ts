import { AnalysisContext, AnalysisPass, existingServiceFilePaths, overridableServiceFilePaths, findOverridableServiceUnit, pushAll } from './pass-registry';
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
 * messaging units, then for each one, if a unit with the SAME id already
 * exists (from an earlier pass), MERGE the messaging evidence onto that
 * existing unit's evidence array instead of creating a duplicate or dropping
 * it — the earlier pass's `kind` still wins the tie (same "first pass wins
 * kind" precedent the old exclusion enforced structurally), but the
 * messaging evidence is now honestly visible on the unit, not silently
 * lost. Genuinely new messaging-only units (no prior-pass collision) are
 * still added exactly as before.
 *
 * T-LR-3 follow-up (weak-service / messaging duplicate-node): same
 * replace-not-duplicate mechanism detectPersistencePass already uses.
 * Decorator-created service units use id `filePath`; import-strategy
 * messaging units use `filePath::ClassName`, so the same-id merge above
 * never fires for them. A file whose only service evidence is a bare
 * framework-bootstrap stereotype (overridableServiceFilePaths) plus a real
 * messaging-client import would otherwise emit two CALM nodes for one
 * class. KafkaTemplate field-type detection is a different path
 * (signal-mapper, same unit) and is not this collision.
 */
export const detectMessagingPass: AnalysisPass = {
  name: 'detectMessaging',
  run(ctx: AnalysisContext) {
    if (!ctx.graphifyRun) return;
    const overridable = overridableServiceFilePaths(ctx);
    const { unitsByRoot: messagingUnitsByRoot, excludedTestFiles } = detectMessagingUnits(
      ctx.graphifyRun,
      existingServiceFilePaths(ctx),
      overridable
    );
    // T-TC1-3 (B-test-code-exclusion) — real, visible record, never a silent skip.
    for (const filePath of excludedTestFiles) {
      ctx.allIgnoredItems.push({ ref: `${filePath}:0`, reason: 'TEST_CODE', detail: 'Excluded from messaging detection — matched a real test-path/filename convention (isTestPath()), despite importing a catalogued messaging-client library' });
    }
    if (excludedTestFiles.length > 0) console.log(`[run-slice] ${excludedTestFiles.length} test file(s) excluded from messaging detection`);
    for (const [root, messagingUnits] of messagingUnitsByRoot) {
      const genuinelyNewUnits = [];
      let mergedCount = 0;
      let replacedCount = 0;
      for (const mu of messagingUnits) {
        if (overridable.has(mu.filePath)) {
          const found = findOverridableServiceUnit(ctx, mu.filePath);
          if (found) {
            pushAll(mu.evidence, found.unit.evidence);
            if (found.inAllUnits) {
              const weakUnitIndex = ctx.allUnits.findIndex((u) => u.filePath === mu.filePath && u.kind === 'service');
              if (weakUnitIndex !== -1) ctx.allUnits.splice(weakUnitIndex, 1);
              const rootUnitList = ctx.unitsByRoot.get(root) ?? [];
              const weakRootIndex = rootUnitList.findIndex((u) => u.filePath === mu.filePath && u.kind === 'service');
              if (weakRootIndex !== -1) rootUnitList.splice(weakRootIndex, 1);
            }
            replacedCount++;
          }
        }
        const existing = ctx.allUnits.find((u) => u.id === mu.id);
        if (existing) {
          pushAll(existing.evidence, mu.evidence);
          mergedCount++;
          continue;
        }
        genuinelyNewUnits.push(mu);
      }
      if (replacedCount > 0) {
        console.log(`[run-slice] ${root}: ${replacedCount} weak bare-stereotype unit(s) replaced by real messaging evidence for the same file (never coexisting as two nodes)`);
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
