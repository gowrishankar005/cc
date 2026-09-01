import * as path from 'path';
import { AnalysisContext, AnalysisPass } from './pass-registry';
import { runCodeQLDiResolution, CodeQLDiBinding } from '../scanner/codeql-di-provider';
import { TypedUnit, PENDING_STATUS, PENDING_RELATIONSHIP_ID } from '../types/typed-facts';
import { relationshipTrust, unitIntroductionTrust } from './fact-trust-matrix';
import { loadEngineCapabilityMatrix, warnIfMechanismUnverified } from '../scanner/engine-capability-matrix';

/**
 * T-LR-5 (AGENT_TASKS_Ext_CodeQL_Engine.md) — turns CodeQL's real DI-binding
 * table (`codeql-di-provider.ts`) into TypedRelationships/TypedUnits.
 * Opt-in only: `ctx.codeqlSourceRoot`/`ctx.codeqlBuildCommand` are set by
 * run-slice.ts from `--codeql-source-root` / `--codeql-build-command`
 * (hand-written), or auto-derived via `--auto-codeql` /
 * `WEAVER_CODEQL_LICENSE_CONFIRMED=1` (`codeql-auto-detect.ts`) — either
 * way, always a conscious, explicit opt-in at the run-slice.ts CLI layer,
 * never something this pass itself decides to enable. A no-op (same as
 * k8sTrustPass/envSoftGraphPass's own opt-in convention) when both context
 * fields are absent. Registered in DEFAULT_PASSES so any facts it produces
 * still get graded/statused; never a default-on path.
 *
 * Trust tier (item 5 of the checklist; full matrix is T-LR-6,
 * `fact-trust-matrix.ts`): same-root confidence (7) sits BETWEEN R2b's (8)
 * and R2c's (6) — deliberately not the strongest tier despite CodeQL's own
 * real, verified accuracy (E1b: 2106 bindings, correct ambiguity refusal) —
 * "never automatically primary" per the checklist means this engine earns
 * trust over time, not on day one, regardless of how good the underlying
 * analysis already measures. Enforced structurally, not just by the
 * confidence number: this pass NEVER creates a relationship for a (from, to)
 * pair an earlier pass already resolved — it only fills a gap no existing
 * mechanism reaches, never contests or overrides a fact CodeGraph/Graphify
 * already established. The actual confidence values live in
 * `fact-trust-matrix.ts`, not as local constants here — a second engine or a
 * new CodeQL fact type registers a row there, not a new constant in every
 * file that needs a number.
 */

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
      bindings = runCodeQLDiResolution(ctx.codeqlSourceRoot, ctx.codeqlBuildCommand, ctx.codeqlFallbackBuildCommand);
    } catch (err) {
      console.warn(`[codeql-di] WARNING: unexpected failure running CodeQL DI resolution, continuing without it: ${err}`);
      return;
    }
    if (bindings.length === 0) return;

    let introducedCount = 0;
    let relationshipCount = 0;
    for (const binding of bindings) {
      // Real, found-via-a-live-run edge case (2026-08-19, a reference
      // Java/JAX-RS banking platform's own provider module): CodeQL's
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
          status: PENDING_STATUS,
          evidence: [
            {
              signal: `codeql-di:${binding.mechanism}`,
              source: 'codeql-di',
              category: 'framework-bootstrap',
              weight: unitIntroductionTrust('codeql', 'codeql-di'),
              ref: `${implLoc.relativeFilePath}:1`,
            },
          ],
          confidence: unitIntroductionTrust('codeql', 'codeql-di'),
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
      const mechanism = binding.mechanism === 'bean-factory' ? 'codeql-di-bean-factory' : 'codeql-di-stereotype';
      ctx.relationships.push({
        from: injectingUnit.id,
        to: implUnit.id,
        kind: 'calls',
        crossPackage: crossRoot,
        source: 'codeql',
        confidence: relationshipTrust('codeql', mechanism, crossRoot ? 'cross-root' : 'same-root'),
        mechanism,
        status: PENDING_STATUS,
        id: PENDING_RELATIONSHIP_ID,
      });
      relationshipCount++;
    }

    if (relationshipCount > 0 || introducedCount > 0) {
      console.log(`[codeql-di] ${bindings.length} real DI binding(s) resolved by CodeQL; ${relationshipCount} new relationship(s), ${introducedCount} new unit(s) introduced`);
    }

    // T-onboarding-16 — real, cheap drift check: engine-capability-matrix.yml's
    // relationshipMechanisms section is this project's own record of which
    // (language, mechanism) combos have been measured "proven". di_resolution.ql
    // is Java/Spring-shaped only, so `bindings.length > 0` here always means
    // real Spring-annotated code was matched — this never fires as a false
    // alarm on a different framework, only as a warning if the matrix itself
    // ever falls out of sync with what this pass actually produced.
    const matrix = loadEngineCapabilityMatrix(path.join(__dirname, '..', 'scanner'));
    warnIfMechanismUnverified(matrix, 'java', 'codeql-di-resolution', bindings.length);
  },
};
