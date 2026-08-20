import * as path from 'path';
import { AnalysisContext, AnalysisPass } from './pass-registry';
import { runCodeQLDiResolution, CodeQLDiBinding } from '../scanner/codeql-di-provider';
import { TypedUnit } from '../types/typed-facts';

/**
 * T-LR-5 (AGENT_TASKS_Ext_CodeQL_Engine.md) — turns CodeQL's real DI-binding
 * table (`codeql-di-provider.ts`) into TypedRelationships/TypedUnits.
 * Opt-in only: `ctx.codeqlSourceRoot`/`ctx.codeqlBuildCommand` are set by
 * run-slice.ts from `--codeql-source-root` / `--codeql-build-command`; a
 * no-op (same as k8sTrustPass/envSoftGraphPass's own opt-in convention)
 * when either is absent. Registered in DEFAULT_PASSES so any facts it
 * produces still get graded/statused; never a default-on path.
 *
 * Trust tier (item 5 of the checklist; full matrix is T-LR-6, not this
 * task): same-root confidence (7) sits BETWEEN R2b's (8) and R2c's (6) —
 * deliberately not the strongest tier despite CodeQL's own real, verified
 * accuracy (E1b: 2106 bindings, correct ambiguity refusal) — "never
 * automatically primary" per the checklist means this engine earns trust
 * over time, not on day one, regardless of how good the underlying analysis
 * already measures. Enforced structurally, not just by the confidence
 * number: this pass NEVER creates a relationship for a (from, to) pair an
 * earlier pass already resolved — it only fills a gap no existing mechanism
 * reaches, never contests or overrides a fact CodeGraph/Graphify already
 * established.
 */
const CODEQL_DI_SAME_ROOT_CONFIDENCE = 7;
const CODEQL_DI_CROSS_ROOT_CONFIDENCE = 4;
/** Introduced-unit tier — same "own tier, never promoted" class as T-FS-4's dependency-manifest introduction. */
const CODEQL_DI_INTRODUCED_UNIT_CONFIDENCE = 10;

function relativeToRoot(sourceRoot: string, packageRoots: string[], codeqlRelativePath: string): { root: string; relativeFilePath: string } | undefined {
  for (const root of packageRoots) {
    const prefix = path.relative(sourceRoot, root);
    if (prefix === '') {
      return { root, relativeFilePath: codeqlRelativePath };
    }
    if (codeqlRelativePath === prefix || codeqlRelativePath.startsWith(`${prefix}${path.sep}`)) {
      return { root, relativeFilePath: codeqlRelativePath.slice(prefix.length + 1) };
    }
  }
  return undefined;
}

function findUnitByFile(unitsByRoot: Map<string, TypedUnit[]>, root: string, relativeFilePath: string): TypedUnit | undefined {
  return (unitsByRoot.get(root) ?? []).find((u) => u.filePath === relativeFilePath);
}

export const codeqlDiPass: AnalysisPass = {
  name: 'codeqlDi',
  run(ctx: AnalysisContext) {
    if (!ctx.codeqlSourceRoot || !ctx.codeqlBuildCommand) return;

    let bindings: CodeQLDiBinding[];
    try {
      bindings = runCodeQLDiResolution(ctx.codeqlSourceRoot, ctx.codeqlBuildCommand);
    } catch (err) {
      console.warn(`[codeql-di] WARNING: unexpected failure running CodeQL DI resolution, continuing without it: ${err}`);
      return;
    }
    if (bindings.length === 0) return;

    let introducedCount = 0;
    let relationshipCount = 0;
    for (const binding of bindings) {
      // Real, found-via-a-live-run edge case (2026-08-19, a reference
      // Java/JAX-RS banking platform's fineract-provider): CodeQL's
      // `RefType.getName()` returns an empty string for an anonymous
      // implementation class (`new SomeInterface() { ... }` — a real,
      // valid Java construct di_resolution.ql's `ClassInstanceExpr`
      // resolution can legitimately land on). Never introduce a unit with
      // an empty/blank name — CALM's own schema forbids empty string
      // properties, and a human reading "" as an architectural component
      // name is worse than the honest gap of not showing it at all.
      if (!binding.resolvedImpl.trim() || !binding.injectingClass.trim()) continue;
      const injectingLoc = relativeToRoot(ctx.codeqlSourceRoot, ctx.packageRoots, binding.injectingFile);
      if (!injectingLoc) continue; // real class, but outside every scanned root — same "never guess across an unscanned boundary" discipline as every other cross-package mechanism here
      const injectingUnit = findUnitByFile(ctx.unitsByRoot, injectingLoc.root, injectingLoc.relativeFilePath);
      if (!injectingUnit) continue; // CodeQL saw a real class; this pipeline's own extraction never turned it into a unit — nothing to anchor a relationship to

      const implLoc = relativeToRoot(ctx.codeqlSourceRoot, ctx.packageRoots, binding.implFile);
      if (!implLoc) continue;

      let implUnit = findUnitByFile(ctx.unitsByRoot, implLoc.root, implLoc.relativeFilePath);
      if (!implUnit) {
        // T-FS-4-class introduction: CodeQL is the ONLY mechanism that knows
        // this class exists and is real (a stereotype-free @Bean-factory
        // impl, or a stereotype-annotated impl this pipeline's own
        // catalogue-driven detection didn't independently reach). Introduced
        // as a 'service' unit — the conservative default for "a real class
        // Spring wires as a dependency," never 'database'/'topic' (this
        // pass never claims persistence/messaging kind from DI-resolution
        // evidence alone; see BACKLOG.md's still-open JDBC-ownership row for
        // why kind inference from evidence like this stays intentionally
        // narrow). Never promoted past this tier — status-assignment.ts's
        // existing hard rule already covers any unit whose sole evidence
        // source is a secondary-introduction source; extended to
        // 'codeql-di' there.
        implUnit = {
          id: `codeql-di:${implLoc.root}:${implLoc.relativeFilePath}`,
          kind: 'service',
          name: binding.resolvedImpl,
          filePath: implLoc.relativeFilePath,
          startLine: 1,
          endLine: 1,
          evidence: [
            {
              signal: `codeql-di:${binding.mechanism}`,
              source: 'codeql-di',
              category: 'framework-bootstrap',
              weight: CODEQL_DI_INTRODUCED_UNIT_CONFIDENCE,
              ref: `${implLoc.relativeFilePath}:1`,
            },
          ],
          confidence: CODEQL_DI_INTRODUCED_UNIT_CONFIDENCE,
        };
        ctx.allUnits.push(implUnit);
        const rootUnits = ctx.unitsByRoot.get(implLoc.root) ?? [];
        rootUnits.push(implUnit);
        ctx.unitsByRoot.set(implLoc.root, rootUnits);
        introducedCount++;
      }

      // Trust tier, enforced structurally: never contest an edge an earlier,
      // more-established mechanism already produced for this exact pair.
      const alreadyResolved = ctx.relationships.some((r) => r.from === injectingUnit.id && r.to === implUnit!.id);
      if (alreadyResolved) continue;

      const crossRoot = injectingLoc.root !== implLoc.root;
      ctx.relationships.push({
        from: injectingUnit.id,
        to: implUnit.id,
        kind: 'calls',
        crossPackage: crossRoot,
        source: 'codeql',
        confidence: crossRoot ? CODEQL_DI_CROSS_ROOT_CONFIDENCE : CODEQL_DI_SAME_ROOT_CONFIDENCE,
        mechanism: binding.mechanism === 'bean-factory' ? 'codeql-di-bean-factory' : 'codeql-di-stereotype',
      });
      relationshipCount++;
    }

    if (relationshipCount > 0 || introducedCount > 0) {
      console.log(`[codeql-di] ${bindings.length} real DI binding(s) resolved by CodeQL; ${relationshipCount} new relationship(s), ${introducedCount} new unit(s) introduced`);
    }
  },
};
