#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { codeGraphEngine } from '../scanner/codegraph-provider';
import { discoverDeployableManifests } from '../scanner/deployable-manifest-provider';
import { runDetectGateSmokeTest } from '../scanner/detect-gate-smoketest';
import { loadEngineCapabilityMatrix, logEngineCapabilitySummary } from '../scanner/engine-capability-matrix';
import { detectCodeqlBuildConfig } from '../scanner/codeql-auto-detect';
import { cleanupCodeqlDatabases } from '../scanner/codeql-database-cache';
import { loadSignalCatalogue } from '../rules/rule-schema';
import { runModules } from '../modules/registry';
import { resolveModules, DEFAULT_MODULE_NAMES } from '../modules/available-modules';
import { AnalysisContext, RawRootFacts, runPasses } from '../analysis/pass-registry';
import { DEFAULT_PASSES } from '../analysis/passes';
import { writePlatformArtefacts } from './platform-artefacts';
import { buildEvidencePacks } from '../analysis/ir/evidence-packs';
import { renderIntelligenceIR } from '../analysis/ir/intelligence-ir';
import { CoverageReport, computeCompleteness } from '../analysis/coverage-report';
import { UnmappedSignalsReport } from '../analysis/unmapped-signals';
import { TypedFacts, CONTRACT_VERSION } from '../types/typed-facts';
import { mergeIncrementalFacts } from '../analysis/incremental-merge';
import { appendFactHistory } from '../analysis/fact-history';
import { logMem } from '../util/debug-mem';
import { isTestPath } from '../rules/test-path';

/**
 * Shared by both a normal scan-and-build run and --from-facts reconstruct-only
 * mode (T-X6-3) — runModules + --strict-overrides check + IR render is the
 * same tail either way; the only difference between the two modes is
 * whether facts/coverage/unmapped came from a fresh scan or a frozen file.
 * Kept here as a small helper, not duplicated, per "no feature dumps in
 * run-slice.ts" — this itself IS the wiring, not new analysis logic.
 */
function finishRun(
  facts: TypedFacts,
  coverage: CoverageReport,
  unmapped: UnmappedSignalsReport,
  outDir: string,
  overridesDir: string | undefined,
  moduleNames: string[],
  includeSnippets: boolean,
  strictOverrides: boolean,
  includeSystemNode: boolean
): void {
  runModules(resolveModules(moduleNames), facts, { outDir, overridesDir, includeSystemNode });
  logMem('after runModules');

  // T-X6-2 — --strict-overrides reads back calm-generator's own
  // overrides-applied-report.json (already written by runModules above) the
  // same way the IR's module-projection appendix already reads real module
  // output after the fact — not a new pattern, just this task's use of the
  // existing one. Orphans (stale DR/override pairs pointing at a
  // renamed/removed node) are a silent-decay risk if nobody's watching;
  // this makes that failure loud on request, default stays warn-only via
  // the report file alone.
  if (strictOverrides) {
    const reportPath = path.join(outDir, 'modules', 'calm-generator', 'overrides-applied-report.json');
    if (fs.existsSync(reportPath)) {
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      if (report.orphans?.length > 0) {
        console.error(`[run-slice] FAILED (--strict-overrides): ${report.orphans.length} orphaned override(s) — see modules/calm-generator/overrides-applied-report.json`);
        process.exit(1);
      }
    }
  }

  // T-X3-2 — rendered AFTER modules run so the optional "module projections"
  // appendix can read their real output (CALM node/relationship counts,
  // threat-signals findings) — still one-way (reads outDir, never writes
  // back into facts/ctx) and still not calm-generator's own artefact.
  const evidencePacks = buildEvidencePacks(facts.ignoredItems, facts.packageRoots, includeSnippets);
  const ir = renderIntelligenceIR(facts, coverage, unmapped, evidencePacks, outDir);
  fs.writeFileSync(path.join(outDir, 'intelligence-ir.md'), ir);

  console.log(`[run-slice] wrote artefacts to ${outDir}`);
}

/**
 * Wave M T-M7 — orchestration is now: scan -> runPasses -> build TypedFacts
 * -> runModules, not one function body with every analysis step inlined.
 * "Scan" (raw structural-engine indexing) stays here, not a pass, since it's
 * the one step every pass depends on having already happened and it isn't
 * itself an "analysis" step — it's Scanner, feeding Analysis.
 */
async function runSlice(
  packageRoots: string[],
  outDir: string,
  overridesDir?: string,
  moduleNames: string[] = DEFAULT_MODULE_NAMES,
  strictDetect = false,
  includeSnippets = true,
  k8sManifestsDir?: string,
  strictOverrides = false,
  includeSystemNode = true,
  enableEnvSoftGraph = false,
  cfnManifestsDir?: string,
  codeqlSourceRoot?: string,
  codeqlBuildCommand?: string,
  repoManifestsDir?: string,
  codeqlFallbackBuildCommand?: string,
  strictIsolatedNodes = false
): Promise<void> {
  const catalogue = loadSignalCatalogue(path.join(__dirname, '..', 'rules'));
  logEngineCapabilitySummary(loadEngineCapabilityMatrix(path.join(__dirname, '..', 'scanner')));

  // Scan: structural-engine pass per package root (native routes + raw
  // decorator facts). Depends on the StructuralEngine interface
  // (structural-engine.ts), not on codegraph-provider.ts's specific
  // exports — codeGraphEngine is the one real implementation today,
  // swappable at this single call site.
  const engine = codeGraphEngine;
  const rawByRoot = new Map<string, RawRootFacts>();
  let anySilentFailure = false;
  for (const root of packageRoots) {
    const { handle, nativeRoutes: allNativeRoutes } = await engine.indexPackage(root);
    const detectGateResult = runDetectGateSmokeTest(root, allNativeRoutes.length);
    if (detectGateResult.suspectedSilentFailure) anySilentFailure = true;

    // T-TC1-2 (B-test-code-exclusion) — real, confirmed bug: a JUnit test
    // file's own JAX-RS-annotated inner test-fixture classes were typed as
    // a real service at confidence 100 with a fabricated route, because
    // nothing ever excluded /test/-path files from decorator/native-route
    // extraction. Filtered here, before any extraction runs, not after —
    // every excluded file becomes a real IgnoredItem (mapSignalsPass, per
    // this pass's own excludedTestFiles list), never a silent skip.
    const allIndexedFiles = engine.listIndexedFiles(handle, ['.py', '.ts', '.java']);
    const indexedFiles = allIndexedFiles.filter((file) => !isTestPath(file));
    const excludedTestFiles = allIndexedFiles.filter((file) => isTestPath(file));
    const nativeRoutes = allNativeRoutes.filter((r) => !isTestPath(r.filePath));
    for (const r of allNativeRoutes) {
      if (isTestPath(r.filePath) && !excludedTestFiles.includes(r.filePath)) excludedTestFiles.push(r.filePath);
    }

    const decoratorFacts = indexedFiles.flatMap((file) => engine.extractDecoratorFacts(handle, root, file));
    const callFacts = indexedFiles.flatMap((file) => engine.extractCallFacts(handle, root, file)); // T-D1
    const typeReferenceFacts = indexedFiles.flatMap((file) => engine.extractTypeReferenceFacts(handle, root, file)); // T-E1
    const extendsFacts = indexedFiles.flatMap((file) => engine.extractExtendsFacts(handle, root, file)); // T-E3
    const filesByExt: Record<string, number> = {};
    for (const file of indexedFiles) {
      const ext = path.extname(file);
      filesByExt[ext] = (filesByExt[ext] ?? 0) + 1;
    }
    const deployableManifests = discoverDeployableManifests(root); // T-X8-1
    rawByRoot.set(root, { nativeRoutes, decoratorFacts, callFacts, typeReferenceFacts, extendsFacts, filesByExt, deployableManifests, excludedTestFiles });
  }

  // T-X1-2 — detect-gate-smoketest.ts already computes suspectedSilentFailure
  // (requirements v0.6 §4's known CodeGraph detect()-gate silent-failure
  // pattern) but only warns; --strict-detect makes that failure loud instead
  // of leaving a monorepo pilot to silently produce zero routes and no
  // indication why. Default stays warn-only, unchanged from before this task.
  if (strictDetect && anySilentFailure) {
    console.error('[run-slice] FAILED (--strict-detect): at least one package root has grep-verified route usage but 0 native routes — see the [detect-gate-smoketest] warning(s) above.');
    process.exit(1);
  }

  const ctx: AnalysisContext = {
    packageRoots,
    outDir,
    catalogue,
    rawByRoot,
    allUnits: [],
    allIgnoredItems: [],
    unitsByRoot: new Map(),
    relationships: [],
    k8sManifestsDir,
    enableEnvSoftGraph,
    cfnManifestsDir,
    codeqlSourceRoot,
    codeqlBuildCommand,
    repoManifestsDir,
    codeqlFallbackBuildCommand,
  };
  await runPasses(DEFAULT_PASSES, ctx);
  logMem('after runPasses');
  cleanupCodeqlDatabases(); // every CodeQL-based pass that could use the shared database has now run
  const { coverage, unmapped } = writePlatformArtefacts(ctx, outDir);
  logMem('after writePlatformArtefacts');

  // S6 (BACKLOG.md "Isolated-node completeness flag") — soft by default,
  // same posture as S1/S2/S5 above; --strict-isolated-nodes is the opt-in
  // gate for a caller who wants a run with orphaned units to fail loudly
  // instead of only appearing in coverage-report.json's silenceFlags.
  if (strictIsolatedNodes && coverage.completeness.isolatedNodeCount > 0) {
    console.error(`[run-slice] FAILED (--strict-isolated-nodes): ${coverage.completeness.isolatedNodeCount} unit(s) have zero relationships touching them — see coverage-report.json's S6 silenceFlag for detail.`);
    process.exit(1);
  }

  const facts: TypedFacts = {
    contractVersion: CONTRACT_VERSION,
    runVersion: catalogue.version,
    generatedAt: new Date().toISOString(),
    packageRoots,
    units: ctx.allUnits,
    relationships: ctx.relationships,
    ignoredItems: ctx.allIgnoredItems,
  };

  // T-CL-2 — read the PRIOR run's typed-facts.json from this same --out
  // directory (if any) before finishRun's calm-generator module overwrites
  // it, and merge this run's freshly-computed units/relationships against
  // it: unaffected facts (unchanged evidence) carry their prior status
  // forward, a fact that was 'reviewed' is never silently overwritten
  // (see incremental-merge.ts's own doc comment for the full rule). A
  // mismatched contractVersion is treated as "no prior state" — merging
  // across a shape change isn't meaningful. First run into a fresh --out
  // directory is a no-op here (nothing to merge against).
  const priorFactsPath = path.join(outDir, 'typed-facts.json');
  let priorFacts: TypedFacts | undefined;
  if (fs.existsSync(priorFactsPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(priorFactsPath, 'utf8')) as TypedFacts;
      if (parsed.contractVersion === CONTRACT_VERSION) priorFacts = parsed;
      else console.warn(`[run-slice] prior typed-facts.json contractVersion "${parsed.contractVersion}" != "${CONTRACT_VERSION}" — skipping incremental merge for this run`);
    } catch (err) {
      console.warn(`[run-slice] WARNING: could not read prior typed-facts.json for incremental merge, continuing without it: ${err}`);
    }
  }
  const { report: mergeReport, history: mergeHistory } = mergeIncrementalFacts(priorFacts, facts.generatedAt, facts.units, facts.relationships);
  fs.writeFileSync(path.join(outDir, 'merge-report.json'), JSON.stringify(mergeReport, null, 2));
  appendFactHistory(outDir, mergeHistory);
  console.log(
    `[run-slice] incremental merge: units ${mergeReport.units.new} new / ${mergeReport.units.disappeared} disappeared / ${mergeReport.units.unaffected} unaffected / ${mergeReport.units.flaggedForReReview} flagged for re-review; relationships ${mergeReport.relationships.new} new / ${mergeReport.relationships.disappeared} disappeared / ${mergeReport.relationships.unaffected} unaffected / ${mergeReport.relationships.flaggedForReReview} flagged for re-review`
  );

  // Goal A's actual plumbing: a real registry, module list externalized
  // (Wave M T-M1) — resolveModules throws clearly on an unknown name rather
  // than silently dropping it, and the default list preserves the exact
  // behavior this pipeline has always had (calm-generator + threat-signals)
  // when --modules isn't passed.
  logMem('before finishRun');
  finishRun(facts, coverage, unmapped, outDir, overridesDir, moduleNames, includeSnippets, strictOverrides, includeSystemNode);
  logMem('after finishRun');
}

/**
 * T-X6-3 — reconstruct-only mode: rebuilds modules + IR + overrides from an
 * EXISTING typed-facts.json, no rescan (no StructuralEngine/Graphify/k8s
 * calls at all). Real use case: iterating on an Override/Decision Record
 * pair against a large monorepo shouldn't require a multi-minute rescan
 * every time — the facts a human is authoring overrides against haven't
 * changed, only the overrides have.
 *
 * Refuses an incompatible contractVersion outright (major segment mismatch
 * against the currently-running code's CONTRACT_VERSION) rather than
 * attempting a reconstruction the module registry would just skip anyway —
 * failing loudly here, before any module even runs, per the acceptance
 * criterion ("refuse incompatible contractVersion").
 *
 * Honest limitation, not silently glossed over: coverage-report.json and
 * unmapped-signals-report.json are NOT regenerated — they need raw scan
 * internals (rawByRoot, the live GraphifyRun) that typed-facts.json never
 * carried in the first place, so there is nothing to reconstruct them FROM.
 * intelligence-ir.md is still rendered, with empty/placeholder coverage +
 * unmapped sections clearly marked as "not recomputed in --from-facts mode"
 * rather than showing misleading zeros as if a fresh scan found nothing.
 */
function runFromFacts(
  factsPath: string,
  outDir: string,
  overridesDir?: string,
  moduleNames: string[] = DEFAULT_MODULE_NAMES,
  includeSnippets = true,
  strictOverrides = false,
  includeSystemNode = true,
  strictIsolatedNodes = false
): void {
  const facts: TypedFacts = JSON.parse(fs.readFileSync(factsPath, 'utf8'));

  const factsMajor = facts.contractVersion.split('.')[0];
  const runningMajor = CONTRACT_VERSION.split('.')[0];
  if (factsMajor !== runningMajor) {
    console.error(
      `[run-slice] FAILED (--from-facts): ${factsPath} has contractVersion "${facts.contractVersion}" (major ${factsMajor}), but this build's CONTRACT_VERSION is "${CONTRACT_VERSION}" (major ${runningMajor}) — refusing to reconstruct against an incompatible contract shape.`
    );
    process.exit(1);
  }

  const placeholderCoverage: CoverageReport = {
    generatedAt: facts.generatedAt,
    graphifyStatus: 'skipped',
    roots: [],
    ignoredByReason: {},
    unmappedSignalCount: 0,
    k8sManifestsStatus: 'not-provided',
    relationshipsByKind: {},
    relationshipsBySource: {},
    relationshipsByMechanism: {},
    unresolvedByMechanism: {},
    // T-A1: real, not placeholder — facts.units/relationships are available
    // even in --from-facts mode, so S1/S2 can be computed honestly here
    // rather than zeroed out with everything else this mode can't recompute.
    completeness: computeCompleteness(facts.units, facts.relationships),
  };

  // Same honesty principle as the S1/S2 comment above — isolatedNodeCount is
  // real, not a placeholder, in this mode too, so --strict-isolated-nodes
  // must gate here exactly like the live-scan path (run-slice.ts's runSlice)
  // does, not silently no-op just because this is reconstruction.
  if (strictIsolatedNodes && placeholderCoverage.completeness.isolatedNodeCount > 0) {
    console.error(`[run-slice] FAILED (--strict-isolated-nodes): ${placeholderCoverage.completeness.isolatedNodeCount} unit(s) have zero relationships touching them — see coverage-report.json's S6 silenceFlag for detail.`);
    process.exit(1);
  }

  const placeholderUnmapped: UnmappedSignalsReport = {
    generatedAt: facts.generatedAt,
    totalUnmappedOccurrences: 0,
    clusterCount: 0,
    truncated: false,
    clusters: [],
    footer: '--from-facts mode: coverage/unmapped were NOT recomputed (no rescan) — see the original run\'s coverage-report.json for real counts.',
  };

  finishRun(facts, placeholderCoverage, placeholderUnmapped, outDir, overridesDir, moduleNames, includeSnippets, strictOverrides, includeSystemNode);
}

// A real, reproduced bug:
// a single-dash typo (e.g. "-out" instead of "--out") was never recognized
// as a flag, so it fell through to the package-root list along with its
// intended value, produced 0-unit "roots" for both, and silently defaulted
// --out to the CWD with no error at all. Fail loudly instead — see below.
const KNOWN_FLAGS = [
  '--out',
  '--overrides',
  '--modules',
  '--strict-detect',
  '--no-snippets',
  '--k8s-manifests',
  '--cfn-manifests',
  '--strict-overrides',
  '--no-system-node',
  '--enable-env-soft-graph',
  '--from-facts',
  '--codeql-source-root',
  '--codeql-build-command',
  '--auto-codeql',
  '--no-auto-codeql',
  '--repo-manifests',
  '--strict-isolated-nodes',
];

// Flags that consume the NEXT token as their value — that token must never
// itself be checked against KNOWN_FLAGS (self-review, 2026-08-10: the first
// version of this function checked every token including flag VALUES, so a
// real invocation like `--overrides -tmp/session-drafts` would have wrongly
// rejected a legitimate, if unusually-named, directory argument).
const VALUE_TAKING_FLAGS = ['--out', '--overrides', '--modules', '--k8s-manifests', '--cfn-manifests', '--from-facts', '--codeql-source-root', '--codeql-build-command', '--repo-manifests'];

function checkForUnknownFlags(args: string[]): void {
  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (VALUE_TAKING_FLAGS.includes(token)) {
      i++; // skip this flag's value — never validated as a flag name itself
      continue;
    }
    if (!token.startsWith('-') || KNOWN_FLAGS.includes(token)) continue;
    // Real case this was built for: "-out" (single dash) — prepending one
    // more dash recovers the intended flag name for a helpful suggestion.
    const doubleDashGuess = `-${token}`;
    const suggestion = KNOWN_FLAGS.includes(doubleDashGuess) ? ` Did you mean '${doubleDashGuess}'?` : '';
    console.error(
      `[run-slice] Unknown option '${token}'.${suggestion}\n` +
        `Known flags: ${KNOWN_FLAGS.join(', ')}\n` +
        `(a package-root path is never expected to start with '-' — if it genuinely does, this validation would need updating, not silently bypassed)`
    );
    process.exit(1);
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error(
      'Usage: run-slice <package-root> [<package-root> ...] [--out <dir>] [--overrides <dir>] [--modules <name>,<name>,...] [--strict-detect] [--no-snippets] [--k8s-manifests <dir>] [--cfn-manifests <dir>] [--strict-overrides] [--no-system-node] [--enable-env-soft-graph] [--codeql-source-root <dir> --codeql-build-command <cmd>] [--auto-codeql] [--no-auto-codeql] [--repo-manifests <dir>] [--strict-isolated-nodes]\n' +
        '   or: run-slice --from-facts <typed-facts.json> [--out <dir>] [--overrides <dir>] [--modules <name>,<name>,...] [--no-snippets] [--strict-overrides] [--no-system-node]'
    );
    process.exit(1);
  }
  checkForUnknownFlags(args);
  const outIdx = args.indexOf('--out');
  const outDir = outIdx >= 0 ? args[outIdx + 1] : path.join(process.cwd(), 'calm-output');
  const overridesIdx = args.indexOf('--overrides');
  const overridesDir = overridesIdx >= 0 ? path.resolve(args[overridesIdx + 1]) : undefined;
  const modulesIdx = args.indexOf('--modules');
  const moduleNames = modulesIdx >= 0 ? args[modulesIdx + 1].split(',').map((s) => s.trim()) : DEFAULT_MODULE_NAMES;
  const noSnippetsIdx = args.indexOf('--no-snippets');
  const includeSnippets = noSnippetsIdx === -1;
  const strictOverrides = args.includes('--strict-overrides');
  const strictOverridesIdx = args.indexOf('--strict-overrides');
  const noSystemNodeIdx = args.indexOf('--no-system-node');
  const includeSystemNode = noSystemNodeIdx === -1;
  const strictIsolatedNodesIdx = args.indexOf('--strict-isolated-nodes');
  const strictIsolatedNodes = strictIsolatedNodesIdx >= 0;

  const fromFactsIdx = args.indexOf('--from-facts');
  if (fromFactsIdx >= 0) {
    const factsPath = path.resolve(args[fromFactsIdx + 1]);
    runFromFacts(factsPath, outDir, overridesDir, moduleNames, includeSnippets, strictOverrides, includeSystemNode, strictIsolatedNodes);
    return;
  }

  const strictDetect = args.includes('--strict-detect');
  const strictDetectIdx = args.indexOf('--strict-detect');
  const k8sManifestsIdx = args.indexOf('--k8s-manifests');
  const k8sManifestsDir = k8sManifestsIdx >= 0 ? path.resolve(args[k8sManifestsIdx + 1]) : undefined;
  const cfnManifestsIdx = args.indexOf('--cfn-manifests');
  const cfnManifestsDir = cfnManifestsIdx >= 0 ? path.resolve(args[cfnManifestsIdx + 1]) : undefined;
  const enableEnvSoftGraph = args.includes('--enable-env-soft-graph');
  const enableEnvSoftGraphIdx = args.indexOf('--enable-env-soft-graph');
  const codeqlSourceRootIdx = args.indexOf('--codeql-source-root');
  let codeqlSourceRoot = codeqlSourceRootIdx >= 0 ? path.resolve(args[codeqlSourceRootIdx + 1]) : undefined;
  const codeqlBuildCommandIdx = args.indexOf('--codeql-build-command');
  let codeqlBuildCommand = codeqlBuildCommandIdx >= 0 ? args[codeqlBuildCommandIdx + 1] : undefined;
  let codeqlFallbackBuildCommand: string | undefined;
  const autoCodeqlIdx = args.indexOf('--auto-codeql');
  const noAutoCodeqlIdx = args.indexOf('--no-auto-codeql');
  const repoManifestsIdx = args.indexOf('--repo-manifests');
  const repoManifestsDir = repoManifestsIdx >= 0 ? path.resolve(args[repoManifestsIdx + 1]) : undefined;
  const positionalEnd = [outIdx, overridesIdx, modulesIdx, strictDetectIdx, noSnippetsIdx, k8sManifestsIdx, cfnManifestsIdx, strictOverridesIdx, noSystemNodeIdx, enableEnvSoftGraphIdx, codeqlSourceRootIdx, codeqlBuildCommandIdx, autoCodeqlIdx, noAutoCodeqlIdx, repoManifestsIdx, strictIsolatedNodesIdx].filter((i) => i >= 0).reduce((min, i) => Math.min(min, i), args.length);
  const packageRoots = args.slice(0, positionalEnd).map((p) => path.resolve(p));

  // --auto-codeql / WEAVER_CODEQL_LICENSE_CONFIRMED: only fills in a gap
  // left by explicit flags, never overrides them — a caller who hand-wrote
  // --codeql-source-root/--codeql-build-command already made a deliberate
  // choice, same "never contest an existing fact" discipline the CodeQL DI
  // pass itself already follows for relationships (codeql-di-pass.ts).
  //
  // WEAVER_CODEQL_LICENSE_CONFIRMED=1 is a per-ENVIRONMENT confirmation
  // (set once in a shell profile or CI job config), not a per-repo default —
  // it must equal exactly "1", not any truthy string, to avoid an unrelated
  // env var collision or a copy-pasted "=true" silently enabling this. A
  // fresh clone of this repo with nothing set in its environment behaves
  // identically to before this existed: CodeQL stays off. See README's
  // CodeQL section for the real license text this confirms — this pipeline
  // has no way to verify a caller's actual license tier, only that they
  // have consciously attested to having checked it.
  //
  // --no-auto-codeql is the escape hatch: even with the env var set
  // globally, one invocation can still skip CodeQL (e.g. a fast smoke-test
  // run) without unsetting the environment variable.
  const envLicenseConfirmed = process.env.WEAVER_CODEQL_LICENSE_CONFIRMED === '1';
  const autoCodeqlRequested = autoCodeqlIdx >= 0 || envLicenseConfirmed;
  if (noAutoCodeqlIdx >= 0 && autoCodeqlRequested) {
    console.log('[run-slice] --no-auto-codeql: suppressing auto-detected CodeQL DI-resolution for this run (--auto-codeql flag and/or WEAVER_CODEQL_LICENSE_CONFIRMED were present but overridden)');
  } else if (noAutoCodeqlIdx === -1 && autoCodeqlRequested && !codeqlSourceRoot && !codeqlBuildCommand) {
    const trigger = autoCodeqlIdx >= 0 ? '--auto-codeql' : 'WEAVER_CODEQL_LICENSE_CONFIRMED=1';
    const detected = detectCodeqlBuildConfig(packageRoots);
    if (detected) {
      codeqlSourceRoot = detected.sourceRoot;
      codeqlBuildCommand = detected.buildCommand;
      codeqlFallbackBuildCommand = detected.fallbackBuildCommand;
      const fallbackNote = detected.fallbackBuildCommand ? ` (falls back to Maven if this build fails: ${detected.fallbackBuildCommand})` : '';
      console.log(`[run-slice] ${trigger}: detected ${detected.buildTool} build at ${detected.sourceRoot}, running CodeQL DI-resolution with build command: ${detected.buildCommand}${fallbackNote}`);
    } else {
      console.log(`[run-slice] ${trigger}: no build.gradle/build.gradle.kts (with gradlew) or pom.xml found at the common package root — continuing without CodeQL DI-resolution evidence`);
    }
  }

  runSlice(packageRoots, outDir, overridesDir, moduleNames, strictDetect, includeSnippets, k8sManifestsDir, strictOverrides, includeSystemNode, enableEnvSoftGraph, cfnManifestsDir, codeqlSourceRoot, codeqlBuildCommand, repoManifestsDir, codeqlFallbackBuildCommand, strictIsolatedNodes).catch((err) => {
    console.error('[run-slice] FAILED:', err);
    process.exit(1);
  });
}

main();
