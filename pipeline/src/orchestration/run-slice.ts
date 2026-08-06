#!/usr/bin/env node
import * as path from 'path';
import {
  indexPackage,
  extractDecoratorFacts,
  listIndexedFiles,
  NativeRouteFact,
  DecoratorFact,
} from '../scanner/codegraph-provider';
import { runDetectGateSmokeTest } from '../scanner/detect-gate-smoketest';
import { runGraphifyPass } from '../scanner/graphify-provider';
import { loadSignalCatalogue } from '../rules/rule-schema';
import { mapSignalsToUnits } from '../analysis/signal-mapper';
import { composeJaxRsRoutes } from '../analysis/jaxrs-route-composer';
import { reconcileCrossPackageEdges } from '../analysis/cross_package/graphify-reconciler';
import { detectPersistenceUnits } from '../analysis/cross_package/persistence-detector';
import { ignoreLowConfidence } from '../analysis/ignored-items';
import { writeArtefacts } from '../modules/calm-generator/write-artefacts';
import { TypedFacts, TypedUnit, IgnoredItem } from '../types/typed-facts';

const CONFIDENCE_FLOOR = 40;

async function runSlice(packageRoots: string[], outDir: string, overridesDir?: string): Promise<void> {
  const catalogue = loadSignalCatalogue(path.join(__dirname, '..', 'rules'));

  const allUnits: TypedUnit[] = [];
  const allIgnoredItems: IgnoredItem[] = [];
  const unitsByRoot = new Map<string, TypedUnit[]>();

  // Step 1-2 + 4-5: CodeGraph pass per package root (native routes + decorator facts -> typed units)
  for (const root of packageRoots) {
    const { cg, nativeRoutes } = await indexPackage(root);

    runDetectGateSmokeTest(root, nativeRoutes.length);

    const indexedFiles = listIndexedFiles(cg, ['.py', '.ts', '.java']);
    const decoratorFacts: DecoratorFact[] = [];
    for (const file of indexedFiles) {
      const fileFacts = extractDecoratorFacts(cg, root, file);
      // JAX-RS has no native route typing (CodeGraph is Spring/Play-only for
      // Java) — compose class-level + method-level @Path into full routes,
      // then drop the raw per-annotation facts that fed the composition so
      // they don't ALSO produce a redundant low-quality entry (same
      // precedence discipline as the native-route-vs-decorator-fallback fix).
      const { composed, consumed } = composeJaxRsRoutes(fileFacts);
      decoratorFacts.push(...fileFacts.filter((f) => !consumed.has(f)), ...composed);
    }

    const { units, ignoredItems } = mapSignalsToUnits(nativeRoutes, decoratorFacts, catalogue);
    for (const u of units) {
      if (u.confidence < CONFIDENCE_FLOOR) {
        allIgnoredItems.push(ignoreLowConfidence(u.id, u.confidence));
      } else {
        allUnits.push(u);
      }
    }
    allIgnoredItems.push(...ignoredItems);
    unitsByRoot.set(root, units);

    console.log(
      `[run-slice] ${root}: ${nativeRoutes.length} native route(s), ${decoratorFacts.length} decorator fact(s), ${units.length} unit(s)`
    );
  }

  // Step 3: one Graphify pass across all roots.
  let relationships: TypedFacts['relationships'] = [];
  if (packageRoots.length > 0) {
    try {
      const graphsByRoot = runGraphifyPass(packageRoots);

      // Persistence units: CodeGraph gives zero persistence signal (confirmed
      // repeatedly this project — Java JPA, now Python SQLAlchemy), but
      // Graphify's raw imports_from/contains edges already carry it. Add
      // these as database-kind units BEFORE reconciling, so the reconciler
      // has something to map db.py's class nodes onto — without this, those
      // Graphify nodes have no matching unit and every edge touching them
      // is silently dropped (the exact gap the accuracy audit found).
      for (const root of packageRoots) {
        const graph = graphsByRoot.get(root);
        if (!graph) continue;
        const persistenceUnits = detectPersistenceUnits(root, graph);
        if (persistenceUnits.length > 0) {
          console.log(`[run-slice] ${root}: ${persistenceUnits.length} persistence unit(s) detected via graphify`);
        }
        allUnits.push(...persistenceUnits);
        unitsByRoot.set(root, [...(unitsByRoot.get(root) ?? []), ...persistenceUnits]);
      }

      relationships = reconcileCrossPackageEdges(graphsByRoot, unitsByRoot);
      const crossCount = relationships.filter((r) => r.crossPackage).length;
      console.log(
        `[run-slice] graphify: ${relationships.length} relationship(s) reconciled (${crossCount} cross-package, ${relationships.length - crossCount} same-package)`
      );
    } catch (err) {
      console.warn(`[run-slice] WARNING: graphify pass failed, continuing without cross-package relationships: ${err}`);
    }
  }

  const facts: TypedFacts = {
    runVersion: catalogue.version,
    generatedAt: new Date().toISOString(),
    packageRoots,
    units: allUnits,
    relationships,
    ignoredItems: allIgnoredItems,
  };

  writeArtefacts(facts, outDir, overridesDir);
  console.log(`[run-slice] wrote artefacts to ${outDir}`);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: run-slice <package-root> [<package-root> ...] [--out <dir>] [--overrides <dir>]');
    process.exit(1);
  }
  const outIdx = args.indexOf('--out');
  const outDir = outIdx >= 0 ? args[outIdx + 1] : path.join(process.cwd(), 'calm-output');
  const overridesIdx = args.indexOf('--overrides');
  const overridesDir = overridesIdx >= 0 ? path.resolve(args[overridesIdx + 1]) : undefined;
  const positionalEnd = [outIdx, overridesIdx].filter((i) => i >= 0).reduce((min, i) => Math.min(min, i), args.length);
  const packageRoots = args.slice(0, positionalEnd).map((p) => path.resolve(p));

  runSlice(packageRoots, outDir, overridesDir).catch((err) => {
    console.error('[run-slice] FAILED:', err);
    process.exit(1);
  });
}

main();
