import { AnalysisContext, AnalysisPass, existingServiceFilePaths } from './pass-registry';
import { composeRoutesForFile } from './route-composer-registry';
import { mapSignalsToUnits } from './signal-mapper';
import { runGraphifyPass } from '../scanner/graphify-provider';
import { detectPersistenceUnits } from './cross_package/persistence-detector';
import { reconcileCrossPackageEdges } from './cross_package/graphify-reconciler';
import { ignoreLowConfidence } from './ignored-items';
import { openApiPass } from './openapi-pass';
import { k8sTrustPass } from './k8s-trust-pass';
import { detectMessagingPass } from './messaging-pass';
import { outboundHttpPass } from './outbound-http-pass';
import { envSoftGraphPass } from './env-soft-graph-pass';
import { gradeRelationships } from './relationship-grading';
import { multiHopBridgePass } from './multi-hop-bridge-pass';

export const CONFIDENCE_FLOOR = 40;

/** Groups a root's flat decoratorFacts by filePath, runs matching route composers per file, replaces the flat list with (non-consumed originals + composed). */
export const composeRoutesPass: AnalysisPass = {
  name: 'composeRoutes',
  run(ctx: AnalysisContext) {
    for (const [, raw] of ctx.rawByRoot) {
      const byFile = new Map<string, typeof raw.decoratorFacts>();
      for (const fact of raw.decoratorFacts) {
        if (!byFile.has(fact.filePath)) byFile.set(fact.filePath, []);
        byFile.get(fact.filePath)!.push(fact);
      }
      const result: typeof raw.decoratorFacts = [];
      for (const [, fileFacts] of byFile) {
        const { composed, consumed } = composeRoutesForFile(fileFacts);
        result.push(...fileFacts.filter((f) => !consumed.has(f)), ...composed);
      }
      raw.decoratorFacts = result;
    }
  },
};

/** Signal-catalogue lookup + confidence-floor filtering — the core Rules -> Analysis step. */
export const mapSignalsPass: AnalysisPass = {
  name: 'mapSignals',
  run(ctx: AnalysisContext) {
    for (const [root, raw] of ctx.rawByRoot) {
      const { units, ignoredItems } = mapSignalsToUnits(raw.nativeRoutes, raw.decoratorFacts, ctx.catalogue, raw.callFacts, raw.typeReferenceFacts, raw.extendsFacts);
      for (const u of units) {
        if (u.confidence < CONFIDENCE_FLOOR) {
          ctx.allIgnoredItems.push(ignoreLowConfidence(u.id, u.confidence));
        } else {
          ctx.allUnits.push(u);
        }
      }
      ctx.allIgnoredItems.push(...ignoredItems);
      ctx.unitsByRoot.set(root, units);
      console.log(`[run-slice] ${root}: ${raw.nativeRoutes.length} native route(s), ${raw.decoratorFacts.length} decorator fact(s), ${units.length} unit(s)`);
    }
  },
};

/** One combined Graphify pass (all roots) + persistence-unit detection. Failure here is caught and stored, not thrown — reconcilePass checks ctx.graphifyRun before proceeding, same graceful-degradation behavior as before this refactor. */
export const detectPersistencePass: AnalysisPass = {
  name: 'detectPersistence',
  run(ctx: AnalysisContext) {
    if (ctx.packageRoots.length === 0) return;
    try {
      ctx.graphifyRun = runGraphifyPass(ctx.packageRoots);
      const persistenceUnitsByRoot = detectPersistenceUnits(ctx.graphifyRun, existingServiceFilePaths(ctx));
      for (const [root, persistenceUnits] of persistenceUnitsByRoot) {
        console.log(`[run-slice] ${root}: ${persistenceUnits.length} persistence unit(s) detected via graphify`);
        ctx.allUnits.push(...persistenceUnits);
        ctx.unitsByRoot.set(root, [...(ctx.unitsByRoot.get(root) ?? []), ...persistenceUnits]);
      }
    } catch (err) {
      ctx.graphifyError = err;
      console.warn(`[run-slice] WARNING: graphify pass failed, continuing without cross-package relationships: ${err}`);
    }
  },
};

/** Cross-package/same-package relationship reconciliation, from the Graphify run detectPersistencePass produced. */
export const reconcilePass: AnalysisPass = {
  name: 'reconcile',
  run(ctx: AnalysisContext) {
    if (!ctx.graphifyRun) return; // Graphify pass didn't run or failed — already logged by detectPersistencePass
    ctx.relationships = reconcileCrossPackageEdges(ctx.graphifyRun, ctx.unitsByRoot);
    const crossCount = ctx.relationships.filter((r) => r.crossPackage).length;
    console.log(
      `[run-slice] graphify: ${ctx.relationships.length} relationship(s) reconciled (${crossCount} cross-package, ${ctx.relationships.length - crossCount} same-package)`
    );
  },
};

/** AREC Wave 3 T-A2 — grades every relationship the run collectively produced. MUST run LAST: it needs to see the final ctx.relationships array, after every producer (reconcile/k8s-trust/env-soft-graph) has added its own. */
export const gradeRelationshipsPass: AnalysisPass = {
  name: 'gradeRelationships',
  run(ctx: AnalysisContext) {
    gradeRelationships(ctx.relationships, ctx.allUnits);
  },
};

/**
 * Default pass order. openApiPass (T-X4-1) added after mapSignalsPass —
 * independent of it (reads no shared state), grouped here since both are
 * "unit-producing" passes before persistence/reconcile. k8sTrustPass
 * (T-X5-1) MUST run LAST, after reconcilePass — reconcilePass does
 * `ctx.relationships = reconcileCrossPackageEdges(...)` (an overwrite, not
 * an append), so anything pushed to ctx.relationships before it runs would
 * be silently discarded. multiHopBridgePass (AREC T-C1, R2) is APPEND-only
 * and also needs the final ctx.unitsByRoot, so it must run after
 * reconcilePass too — placed right after it, before the other append-only
 * relationship passes (order among k8sTrust/envSoftGraph/multiHopBridge
 * doesn't matter, none of them read each other's output).
 * gradeRelationshipsPass MUST be the true last pass for the same reason, one
 * level further — it reads (not overwrites) ctx.relationships, so it has to
 * run after every pass that appends to it.
 */
export const DEFAULT_PASSES: AnalysisPass[] = [
  composeRoutesPass,
  mapSignalsPass,
  openApiPass,
  detectPersistencePass,
  detectMessagingPass,
  outboundHttpPass,
  reconcilePass,
  multiHopBridgePass,
  k8sTrustPass,
  envSoftGraphPass,
  gradeRelationshipsPass,
];
