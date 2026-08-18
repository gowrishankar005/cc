import { AnalysisContext, AnalysisPass, existingServiceFilePaths, overridableServiceFilePaths, pushAll } from './pass-registry';
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
import { contradictionPass } from './contradiction-pass';
import { assignStatuses } from './status-assignment';

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
      // One emitted-unit set (BACKLOG.md "unitsByRoot/allUnits confidence-floor
      // divergence"): relationship producers read unitsByRoot via
      // buildNodeToUnitMap; grading and CALM emission read allUnits. A
      // sub-floor unit in only the first set can anchor a real edge that
      // then grades structural (kindById miss) and is dropped from CALM
      // (relationship-builder requires both endpoints to be nodes). Same
      // floor, both lists — sub-floor units stay IgnoredItems.
      const emitted: typeof units = [];
      for (const u of units) {
        if (u.confidence < CONFIDENCE_FLOOR) {
          ctx.allIgnoredItems.push(ignoreLowConfidence(u.id, u.confidence));
        } else {
          ctx.allUnits.push(u);
          emitted.push(u);
        }
      }
      pushAll(ctx.allIgnoredItems, ignoredItems);
      // T-TC1-2 (B-test-code-exclusion) — real, visible record of every
      // file excluded from extraction as test code, never a silent skip.
      for (const filePath of raw.excludedTestFiles) {
        ctx.allIgnoredItems.push({ ref: `${filePath}:0`, reason: 'TEST_CODE', detail: `Excluded from architectural extraction — matched a real test-path/filename convention (isTestPath())` });
      }
      ctx.unitsByRoot.set(root, emitted);
      console.log(`[run-slice] ${root}: ${raw.nativeRoutes.length} native route(s), ${raw.decoratorFacts.length} decorator fact(s), ${emitted.length} unit(s)${raw.excludedTestFiles.length > 0 ? `, ${raw.excludedTestFiles.length} test file(s) excluded` : ''}`);
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
      // T-LR-3 real-data finding — overridableServiceFilePaths(ctx) names
      // files whose ONLY existing 'service' unit evidence is a bare,
      // weak stereotype (no real route/security-control signal of its
      // own). detectPersistenceUnits still builds its own unit for those
      // files (see graphify-import-strategy-detector.ts's own doc comment);
      // the replace loop below swaps the weak unit out for the real
      // persistence one, merging the stereotype evidence onto it, rather
      // than the two ever coexisting as separate CALM nodes for one real
      // class (the exact regression a real reference Java/JAX-RS banking
      // platform class surfaced: real `@Service` AND real `JdbcTemplate`
      // usage on the same file).
      const overridable = overridableServiceFilePaths(ctx);
      const { unitsByRoot: persistenceUnitsByRoot, excludedTestFiles } = detectPersistenceUnits(ctx.graphifyRun, existingServiceFilePaths(ctx), overridable);
      for (const [root, persistenceUnits] of persistenceUnitsByRoot) {
        console.log(`[run-slice] ${root}: ${persistenceUnits.length} persistence unit(s) detected via graphify`);
        let replacedCount = 0;
        for (const pu of persistenceUnits) {
          if (!overridable.has(pu.filePath)) continue;
          const weakUnitIndex = ctx.allUnits.findIndex((u) => u.filePath === pu.filePath && u.kind === 'service');
          if (weakUnitIndex === -1) continue;
          // Merge the weak unit's own evidence (the bare stereotype fact)
          // onto the persistence unit before replacing — the real fact
          // stays visible, just no longer determines this unit's kind.
          pushAll(pu.evidence, ctx.allUnits[weakUnitIndex].evidence);
          ctx.allUnits.splice(weakUnitIndex, 1);
          const rootUnitList = ctx.unitsByRoot.get(root) ?? [];
          const weakRootIndex = rootUnitList.findIndex((u) => u.filePath === pu.filePath && u.kind === 'service');
          if (weakRootIndex !== -1) rootUnitList.splice(weakRootIndex, 1);
          replacedCount++;
        }
        if (replacedCount > 0) {
          console.log(`[run-slice] ${root}: ${replacedCount} weak bare-stereotype unit(s) replaced by real persistence evidence for the same file (never coexisting as two nodes)`);
        }
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
    // T-P0-1 (E2) round 3 — appends now, not overwrites, so it can run
    // AFTER multiHopBridgePass without discarding what that pass already
    // added; ctx.multiHopExaminedPairs (populated by that earlier pass)
    // tells graded-fact admission which edges are already someone else's
    // territory.
    const { relationships, unresolvedUnits } = reconcileCrossPackageEdges(ctx.graphifyRun, ctx.unitsByRoot, ctx.multiHopExaminedPairs, ctx.multiHopExaminedFiles);
    pushAll(ctx.relationships, relationships);
    // T-P0-1 (E2) — graded-fact-admission placeholders (kind: 'unresolved').
    // Pushed into ctx.allUnits (not ctx.unitsByRoot) since they're not real
    // per-root architectural units — only relationship endpoints and CALM
    // nodes. gradeRelationshipsPass (last pass) needs them in ctx.allUnits
    // to see their kind and force 'structural' grading.
    pushAll(ctx.allUnits, unresolvedUnits);
    const crossCount = relationships.filter((r) => r.crossPackage).length;
    console.log(
      `[run-slice] graphify: ${relationships.length} relationship(s) reconciled (${crossCount} cross-package, ${relationships.length - crossCount} same-package)${unresolvedUnits.length > 0 ? `, ${unresolvedUnits.length} admitted via unresolved-endpoint placeholder` : ''}`
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
 * T-FS-6 — the true LAST pass, after gradeRelationshipsPass: reads
 * ctx.allUnits/ctx.relationships/ctx.allIgnoredItems, never appends to any
 * of them, so it must run after every producer of all three, including
 * contradictionPass (whose ignored-items this pass cross-references).
 */
export const assignStatusPass: AnalysisPass = {
  name: 'assignStatus',
  run(ctx: AnalysisContext) {
    assignStatuses(ctx.allUnits, ctx.relationships, ctx.allIgnoredItems);
  },
};

/**
 * Default pass order. openApiPass (T-X4-1) added after mapSignalsPass —
 * independent of it (reads no shared state), grouped here since both are
 * "unit-producing" passes before persistence/reconcile. k8sTrustPass
 * (T-X5-1), envSoftGraphPass and multiHopBridgePass are all APPEND-only and
 * need the final ctx.unitsByRoot, so they run after the unit-producing
 * passes above. reconcilePass (T-P0-1, E2 round 3) now also appends rather
 * than overwrites ctx.relationships, so its position relative to those three
 * is no longer forced by an overwrite hazard — EXCEPT multiHopBridgePass
 * must still run BEFORE reconcilePass specifically, so
 * ctx.multiHopExaminedPairs is populated before reconcilePass's graded-fact
 * admission logic runs and can defer to it instead of racing it for the same
 * edge (see multi-hop-bridge-pass.ts's doc comment for the real fixtures
 * that caught this). k8sTrust/envSoftGraph read neither ctx.relationships
 * nor multiHopExaminedPairs, so their position among these five is
 * otherwise free. gradeRelationshipsPass reads (never appends to)
 * ctx.relationships, so it has to run after every pass that appends to it.
 * T-FS-6's assignStatusPass is now the true final pass — it reads
 * ctx.allIgnoredItems (including contradictionPass's own output) and
 * ctx.relationships' final `grade`/`confidence`/`mechanism`, so it must run
 * after every producer of all three, gradeRelationshipsPass included.
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
  multiHopBridgePass,
  reconcilePass,
  k8sTrustPass,
  envSoftGraphPass,
  // T-FS-3 — needs springConfigPass's database units (already final by this
  // point) and k8sTrustPass's own manifests-dir convention; reads neither
  // ctx.relationships nor multiHopExaminedPairs, so — same as its two
  // neighbors above — its exact position here is otherwise free. Must
  // still run before gradeRelationshipsPass, the true last pass.
  contradictionPass,
  gradeRelationshipsPass,
  assignStatusPass,
];
