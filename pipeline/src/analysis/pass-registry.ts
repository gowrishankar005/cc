import { SignalCatalogue } from '../rules/rule-schema';
import { TypedUnit, IgnoredItem, TypedRelationship } from '../types/typed-facts';
import { NativeRouteFact, DecoratorFact } from '../scanner/structural-engine';
import { GraphifyRun } from '../scanner/graphify-provider';
import { OpenApiDocument } from '../scanner/openapi-provider';
import { DeployableManifest } from '../scanner/deployable-manifest-provider';
import { logMem } from '../util/debug-mem';

/**
 * The highest-impact modularity fix without inventing a fake unified Engine
 * interface. `run-slice.ts` used to be a single function body where
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
  /** AREC Wave 3 T-D1 — call-site facts (referenceKind: 'calls'), same shape/scoping as decoratorFacts. */
  callFacts: DecoratorFact[];
  /** AREC Wave 3 T-E1 — field/variable type-reference facts (referenceKind: 'references'), same shape/scoping. */
  typeReferenceFacts: DecoratorFact[];
  /** AREC Wave 3 T-E3 — extends/implements supertype facts (referenceKind: 'extends'), same shape/scoping. */
  extendsFacts: DecoratorFact[];
  /** T-X0-1 coverage report input — indexed source files by extension, captured at scan time since only run-slice.ts's scan loop calls listIndexedFiles(). */
  filesByExt: Record<string, number>;
  /** T-X8-1 — deployable-unit manifests (package.json/pom.xml/build.gradle/Dockerfile) found directly at this root. */
  deployableManifests: DeployableManifest[];
  /** T-TC1-2 (B-test-code-exclusion) — real files excluded from all CodeGraph-derived extraction because isTestPath() matched them; mapSignalsPass turns each into a real, visible IgnoredItem (reason TEST_CODE), never a silent skip. */
  excludedTestFiles: string[];
}

export interface AnalysisContext {
  packageRoots: string[];
  /** T-onboarding-2 — this run's --out directory. Set once at context construction (run-slice.ts), used by detectPersistencePass so Graphify's own persistent cache (runGraphifyPass) writes under --out instead of beside the scanned source. */
  outDir: string;
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
  /** T-Y4-1 — set by run-slice.ts from --cfn-manifests <dir>; cfnRoutePass is a no-op when absent, same opt-in convention as k8sManifestsDir. */
  cfnManifestsDir?: string;
  /** T-LR-5 — set by run-slice.ts from --codeql-source-root / --codeql-build-command; codeqlDiPass is registered in DEFAULT_PASSES but a no-op unless both fields are set — never a default-on path. Real, non-trivial cost (a real compile + CodeQL database build) and a real license constraint (free-tier CodeQL CLI cannot run in this pipeline's own CI against a non-Open-Source codebase) are why this is never a default-on path. */
  codeqlSourceRoot?: string;
  codeqlBuildCommand?: string;
  /** T-MR-2 — set by run-slice.ts from --repo-manifests <dir>; crossRepoJoinPass (cross-repo-join-pass.ts) is a no-op when absent, same opt-in convention as k8sManifestsDir/cfnManifestsDir. */
  repoManifestsDir?: string;
  /** T-Y5-1 — set by cfnRoutePass itself (real counts from its own run), read by coverage-report.ts's S5 flag. Both undefined when cfnManifestsDir was never provided — distinct from "0 real bindings found" (defined, both 0). */
  cfnRouteBindingsFound?: number;
  cfnRouteBindingsBound?: number;
  /**
   * T-P0-1 (E2) round 3 — `${source}|${target}` raw-edge pairs
   * multiHopBridgePass's detector already examined (resolved or honestly
   * refused). Populated by multiHopBridgePass, which now runs BEFORE
   * reconcilePass specifically so reconcilePass's graded-fact admission can
   * defer to this set instead of racing the more specialized detector for
   * the same edge. Absent/empty is safe — reconcileCrossPackageEdges
   * defaults to an empty set when not passed.
   */
  multiHopExaminedPairs?: Set<string>;
  /** T-P0-1 (E2) round 3 continued — see multiHopExaminedPairs; file-level companion (multi-hop-bridge-detector.ts's examinedBridgeFiles) covering edges into a bridge candidate's non-class-level nodes (e.g. its methods) that examinedPairs alone misses. */
  multiHopExaminedFiles?: Set<string>;
  /**
   * T-LR-3 follow-up bugfix — units mapSignalsPass rejected as sub-`CONFIDENCE_FLOOR`
   * (never added to `allUnits`/`unitsByRoot`, only recorded as an `IgnoredItem`
   * with just a ref string, no evidence) but which are still a bare `service`
   * stereotype (framework-bootstrap-only evidence) eligible for the same
   * "replace with a later real detector's unit, merging evidence" treatment
   * `overridableServiceFilePaths` already gives to units that DID clear the
   * floor. Real finding: NestJS's bare `@Controller()` decorator
   * (`nestjs-controller-decorator`, signal-catalogue.yml) has weight 25, under
   * the 40 floor — a Controller-only file that also imports a messaging
   * client was silently losing its stereotype evidence entirely, because the
   * merge logic only ever looked in `allUnits`, where a sub-floor unit never
   * appears. Without this, `overridableServiceFilePaths` is blind to any
   * override candidate whose OWN confidence happens to be sub-floor.
   */
  subFloorServiceUnits?: TypedUnit[];
}

export interface AnalysisPass {
  name: string;
  run(ctx: AnalysisContext): Promise<void> | void;
}

export async function runPasses(passes: AnalysisPass[], ctx: AnalysisContext): Promise<void> {
  for (const pass of passes) {
    await pass.run(ctx);
    logMem(`after ${pass.name}`);
  }
}

/**
 * Real files already established as a `service` unit (route/decorator
 * evidence) — passed to the import-based detectors (persistence/messaging)
 * so a Controller importing an ORM's generated TYPES for its own DTOs
 * (real finding, a reference Node/NestJS wealth-management app's `@prisma/client` type imports)
 * doesn't also become a competing database/topic unit for the same file.
 * Deliberately unconditional on evidence category — narrowing this set
 * itself (tried and reverted, see `overridableServiceFilePaths` below) lets
 * the import-based detectors independently create a SECOND, competing unit
 * for the same file under a different id scheme (`file::ClassName` vs
 * `file`), which is worse than the single-wrong-kind problem it was meant
 * to fix: two CALM nodes for one real class. Lives here (not in passes.ts)
 * so both passes.ts and messaging-pass.ts can import it without a circular
 * dependency between the two.
 */
export function existingServiceFilePaths(ctx: AnalysisContext): Set<string> {
  return new Set(ctx.allUnits.filter((u) => u.kind === 'service').map((u) => u.filePath));
}

/**
 * T-LR-3 real-data finding (2026-08-16): a SUBSET of `existingServiceFilePaths`
 * — files whose `service` unit's ENTIRE evidence set is `framework-bootstrap`
 * category only (a bare class-level stereotype like `@Service`, no real
 * route or security-control evidence of its own). Real regression surfaced
 * against a reference Java/JAX-RS banking platform: `spring-service-stereotype`
 * (signal-catalogue.yml, T-LR-3) correctly makes a bare-`@Service` class a
 * `service` unit, but `existingServiceFilePaths`'s original, unconditional
 * exclusion then used that fact to suppress persistence detection entirely
 * for the same file — silently flipping a real, previously-verified
 * `database`-kind class (real `@Service` AND real `JdbcTemplate` usage) to
 * `service`, contradicting this project's own documented finding that a
 * bare stereotype does NOT indicate non-ownership (`BACKLOG.md`'s JDBC-
 * ownership row, `soln/bug3-jdbc-ownership-phase-a-memo.md`) and the
 * standing rule that a fix here may only ever change `kind` from `database`
 * to `service`, never suppress unit creation.
 *
 * Consumed by `detectPersistencePass`/`detectMessagingPass` (passes.ts /
 * messaging-pass.ts) as an "override-eligible" set, distinct from a
 * narrower exclusion: files in this set still let the import-based
 * detector build its own persistence/messaging unit as normal, and the
 * calling pass then REPLACES the weak bare-stereotype unit with it (merging
 * the stereotype evidence on, kind from the import detector, never both as
 * two competing nodes) — never independently narrows
 * `existingServiceFilePaths` itself, which stays unconditional so the
 * ORIGINAL bug this filter fixes (a Controller with real `http-entry-point`
 * evidence) is completely unaffected.
 */
export function overridableServiceFilePaths(ctx: AnalysisContext): Set<string> {
  const paths = ctx.allUnits
    .filter((u) => u.kind === 'service' && u.evidence.every((e) => e.category === 'framework-bootstrap'))
    .map((u) => u.filePath);
  // Sub-floor stereotypes (see AnalysisContext.subFloorServiceUnits) are
  // already filtered to this same "service, framework-bootstrap-only"
  // criterion by mapSignalsPass, so they're included unconditionally here.
  const subFloorPaths = (ctx.subFloorServiceUnits ?? []).map((u) => u.filePath);
  return new Set([...paths, ...subFloorPaths]);
}

/**
 * Finds a weak stereotype unit eligible for replacement at `filePath` —
 * either a real (floor-cleared) unit still in `ctx.allUnits`, or a sub-floor
 * one that only exists in `ctx.subFloorServiceUnits` (see that field's doc
 * comment). Callers merge the returned unit's evidence onto their own new
 * unit, then splice it out of `allUnits`/`unitsByRoot` ONLY if it was found
 * there — a sub-floor unit was never in either list, so there's nothing to
 * splice for it.
 */
export function findOverridableServiceUnit(ctx: AnalysisContext, filePath: string): { unit: TypedUnit; inAllUnits: boolean } | undefined {
  const inAllUnits = ctx.allUnits.find((u) => u.filePath === filePath && u.kind === 'service');
  if (inAllUnits) return { unit: inAllUnits, inAllUnits: true };
  const subFloor = (ctx.subFloorServiceUnits ?? []).find((u) => u.filePath === filePath);
  if (subFloor) return { unit: subFloor, inAllUnits: false };
  return undefined;
}

/**
 * Real bug found by testing the lab `ts-orders-dynamo`
 * fixture (imports BOTH `@aws-sdk/client-dynamodb` and `@aws-sdk/client-sqs`
 * in one file): detectPersistencePass and detectMessagingPass each
 * independently walk file->contains->class over the SAME Graphify run —
 * neither knows about the other's output, so a file matching both a
 * persistence AND a messaging library produced TWO TypedUnits with the
 * SAME `id` (`filePath::ClassName`) but different `kind` — a live
 * `unique-ids-must-be-unique-in-architecture` calm validate ERROR, not a
 * cosmetic issue. Generalizes existingServiceFilePaths's own "a file
 * already claimed by an earlier pass must not also get a competing unit
 * from a later import-strategy pass" principle: ANY unit already in
 * ctx.allUnits (not just service-kind) by the time a LATER pass runs
 * excludes that file. Only messaging-pass.ts needs this (it runs after
 * detectPersistencePass in DEFAULT_PASSES) — detectPersistencePass runs
 * first, so no messaging units exist yet for it to exclude.
 */
export function existingUnitFilePaths(ctx: AnalysisContext): Set<string> {
  return new Set(ctx.allUnits.map((u) => u.filePath));
}

/**
 * Real crash found running the pipeline against a large Java module (2733
 * real files, single root, no multi-root involved): `target.push(...items)`
 * throws `RangeError: Maximum call stack size exceeded` once `items` is large
 * enough to exceed V8's call-argument limit — a smaller module (823 files)
 * already produced 25,283 ignored-items, well within range of tripping this
 * at the larger module's scale. Every pass in this directory pushes a
 * per-root/per-file result array onto a run-wide accumulator (ignoredItems,
 * units, relationships) — the same latent crash risk existed at all 13 call
 * sites, just not yet triggered by a small enough array. Loop-based, not
 * spread-based, has no such limit.
 */
export function pushAll<T>(target: T[], items: T[]): void {
  for (const item of items) target.push(item);
}
