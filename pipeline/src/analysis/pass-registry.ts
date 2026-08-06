import { SignalCatalogue } from '../rules/rule-schema';
import { TypedUnit, IgnoredItem, TypedRelationship } from '../types/typed-facts';
import { NativeRouteFact, DecoratorFact } from '../scanner/structural-engine';
import { GraphifyRun } from '../scanner/graphify-provider';
import { OpenApiDocument } from '../scanner/openapi-provider';
import { DeployableManifest } from '../scanner/deployable-manifest-provider';

/**
 * Wave M T-M7 (Modularity_and_Integration_Assessment.md friction F1 — "the
 * highest-impact modularity fix without inventing a fake unified Engine
 * interface"). `run-slice.ts` used to be a single function body where
 * mapSignals, JAX-RS composition, persistence detection, and reconciliation
 * were all inline steps — every new analysis step meant editing that one
 * function, not registering something named. This is the fix: an ordered
 * list of named `AnalysisPass`es sharing one mutable `AnalysisContext`,
 * run in sequence. `run-slice.ts` becomes: scan -> runPasses -> build
 * TypedFacts -> runModules — matching the task's own sketch exactly.
 *
 * Deliberately NOT parallel execution (passes depend on each other's
 * output — composeRoutes must run before mapSignals reads decoratorFacts;
 * mapSignals must run before persistence/reconcile have units to map onto)
 * and deliberately NOT a rewrite of the Scanner engines themselves — this
 * is orchestration-layer modularity only, per T-M7's own "out of scope."
 */
export interface RawRootFacts {
  nativeRoutes: NativeRouteFact[];
  decoratorFacts: DecoratorFact[];
  /** T-X0-1 coverage report input — indexed source files by extension, captured at scan time since only run-slice.ts's scan loop calls listIndexedFiles(). */
  filesByExt: Record<string, number>;
  /** T-X8-1 — deployable-unit manifests (package.json/pom.xml/build.gradle/Dockerfile) found directly at this root. */
  deployableManifests: DeployableManifest[];
}

export interface AnalysisContext {
  packageRoots: string[];
  catalogue: SignalCatalogue;
  rawByRoot: Map<string, RawRootFacts>;
  allUnits: TypedUnit[];
  allIgnoredItems: IgnoredItem[];
  unitsByRoot: Map<string, TypedUnit[]>;
  relationships: TypedRelationship[];
  /** Populated by detectPersistencePass; consumed by reconcilePass. Absent if the Graphify pass failed (graceful degradation, unchanged from before this refactor). */
  graphifyRun?: GraphifyRun;
  graphifyError?: unknown;
  /** Populated by openApiPass (T-X4-1); undefined for a root openApiPass hasn't run for yet. Empty array (not absent) means "ran, found none" — coverage-report.ts distinguishes the two. */
  openApiDocumentsByRoot?: Map<string, OpenApiDocument[]>;
  /** Set by run-slice.ts from --k8s-manifests <dir>; k8sTrustPass (T-X5-1) is a no-op when absent — opt-in, same convention as overridesDir. */
  k8sManifestsDir?: string;
  /** T-X9-1 — set by run-slice.ts from --enable-env-soft-graph; envSoftGraphPass is a no-op unless this AND k8sManifestsDir are both set. Default false/off. */
  enableEnvSoftGraph?: boolean;
}

export interface AnalysisPass {
  name: string;
  run(ctx: AnalysisContext): Promise<void> | void;
}

export async function runPasses(passes: AnalysisPass[], ctx: AnalysisContext): Promise<void> {
  for (const pass of passes) {
    await pass.run(ctx);
  }
}

/**
 * Real files already established as a `service` unit (route/decorator
 * evidence) — passed to the import-based detectors (persistence/messaging)
 * so a Controller importing an ORM's generated TYPES for its own DTOs
 * (real finding, ghostfolio/ghostfolio's `@prisma/client` type imports)
 * doesn't also become a competing database/topic unit for the same file.
 * Lives here (not in passes.ts) so both passes.ts and messaging-pass.ts can
 * import it without a circular dependency between the two.
 */
export function existingServiceFilePaths(ctx: AnalysisContext): Set<string> {
  return new Set(ctx.allUnits.filter((u) => u.kind === 'service').map((u) => u.filePath));
}
