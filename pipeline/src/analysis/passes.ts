import { AnalysisContext, AnalysisPass, existingServiceFilePaths, pushAll } from './pass-registry';
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
import { springConfigPass } from './spring-config-pass';
import { cdxgenCorroborationPass } from './cdxgen-corroboration-pass';
import { envSoftGraphPass } from './env-soft-graph-pass';
import { gradeRelationships } from './relationship-grading';
import { multiHopBridgePass } from './multi-hop-bridge-pass';
import { cfnRoutePass } from './cfn-route-pass';

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
        pushAll(result, fileFacts.filter((f) => !consumed.has(f)));
        pushAll(result, composed);
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
      pushAll(ctx.allIgnoredItems, ignoredItems);
      // T-TC1-2 (B-test-code-exclusion) — real, visible record of every
      // file excluded from extraction as test code, never a silent skip.
      for (const filePath of raw.excludedTestFiles) {
        ctx.allIgnoredItems.push({ ref: `${filePath}:0`, reason: 'TEST_CODE', detail: `Excluded from architectural extraction — matched a real test-path/filename convention (isTestPath())` });
      }
      ctx.unitsByRoot.set(root, units);
      console.log(`[run-slice] ${root}: ${raw.nativeRoutes.length} native route(s), ${raw.decoratorFacts.length} decorator fact(s), ${units.length} unit(s)${raw.excludedTestFiles.length > 0 ? `, ${raw.excludedTestFiles.length} test file(s) excluded` : ''}`);
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
      const { unitsByRoot: persistenceUnitsByRoot, excludedTestFiles } = detectPersistenceUnits(ctx.graphifyRun, existingServiceFilePaths(ctx));
      for (const [root, persistenceUnits] of persistenceUnitsByRoot) {
        console.log(`[run-slice] ${root}: ${persistenceUnits.length} persistence unit(s) detected via graphify`);
        pushAll(ctx.allUnits, persistenceUnits);
        const rootUnits: typeof persistenceUnits = [];
        pushAll(rootUnits, ctx.unitsByRoot.get(root) ?? []);
        pushAll(rootUnits, persistenceUnits);
        ctx.unitsByRoot.set(root, rootUnits);
      }
      // T-TC1-3 (B-test-code-exclusion) — real, visible record, never a silent skip.
      for (const filePath of excludedTestFiles) {
        ctx.allIgnoredItems.push({ ref: `${filePath}:0`, reason: 'TEST_CODE', detail: 'Excluded from persistence detection — matched a real test-path/filename convention (isTestPath()), despite importing a catalogued driver library' });
      }
      if (excludedTestFiles.length > 0) console.log(`[run-slice] ${excludedTestFiles.length} test file(s) excluded from persistence detection`);
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
  // T-Y4-1 — grouped with openApiPass: another structured-external-source
  // pass that only ENRICHES units mapSignalsPass already produced (never
  // creates new ones), so it just needs to run after mapSignalsPass, same
  // as openApiPass.
  cfnRoutePass,
  detectPersistencePass,
  detectMessagingPass,
  outboundHttpPass,
  // T-PC1-3…6 (B-spring-config) — runs after mapSignals/openApi/cfnRoute so
  // its server.port->service-unit attachment sees the root's FINAL service
  // unit set, same ordering reason detectPersistence/detectMessaging/
  // outboundHttp already sit here; before reconcile since it's a
  // unit-producing pass like its neighbors (Graphify reconciliation can't
  // structurally match these synthetic config-derived unit ids either way,
  // same honest limitation as any other non-Graphify-sourced unit).
  springConfigPass,
  // T-CDX-3 (B-cdxgen-reuse) — runs after springConfigPass so its
  // corroboration candidates (persistence/messaging units) include
  // spring-config-derived database/topic units too, not just
  // Graphify-import-derived ones; before reconcile like its neighbors,
  // since it only mutates existing units' evidence, never relationships.
  cdxgenCorroborationPass,
  reconcilePass,
  multiHopBridgePass,
  k8sTrustPass,
  envSoftGraphPass,
  gradeRelationshipsPass,
];
