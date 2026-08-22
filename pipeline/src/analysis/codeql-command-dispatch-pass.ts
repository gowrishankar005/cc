import * as path from 'path';
import { AnalysisContext, AnalysisPass } from './pass-registry';
import { runCodeQLCommandDispatchResolution, CodeQLDispatchBinding } from '../scanner/codeql-command-dispatch-provider';
import { TypedUnit, PENDING_STATUS, PENDING_RELATIONSHIP_ID } from '../types/typed-facts';
import { relationshipTrust, unitIntroductionTrust } from './fact-trust-matrix';
import { loadEngineCapabilityMatrix, warnIfMechanismUnverified } from '../scanner/engine-capability-matrix';

/**
 * #18 (BACKLOG.md "CodeQL command-bus dispatch") — turns CodeQL's real
 * command-dispatch binding table (`codeql-command-dispatch-provider.ts`)
 * into TypedRelationships/TypedUnits. Architecturally and opt-in-shaped
 * identically to `codeql-di-pass.ts` — same `ctx.codeqlSourceRoot`/
 * `ctx.codeqlBuildCommand` gate (a no-op when either is absent; shares the
 * flags with the DI pass rather than needing its own pair, since both
 * queries run against the same real database), same graceful degradation,
 * same "opt-in only, never a default-on path" posture and the same license
 * reason (`codeql-di-pass.ts`'s own doc comment).
 *
 * Trust tier: `codeql-command-dispatch` placed at the SAME confidence as
 * DI resolution's mechanisms (7 same-root / 4 cross-root, between
 * Graphify's r2b and r2c) — comparably real, whole-codebase-scale evidence
 * (see `fact-trust-matrix.ts`'s own citation), not a different number
 * invented without justification. "CodeQL is never automatically primary"
 * still holds (`assertCodeqlNeverPrimary()` — every codeql row is checked
 * against the strongest non-codeql tier per fact type, not just DI's own
 * rows).
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

export const codeqlCommandDispatchPass: AnalysisPass = {
  name: 'codeqlCommandDispatch',
  run(ctx: AnalysisContext) {
    if (!ctx.codeqlSourceRoot || !ctx.codeqlBuildCommand) return;

    let bindings: CodeQLDispatchBinding[];
    try {
      bindings = runCodeQLCommandDispatchResolution(ctx.codeqlSourceRoot, ctx.codeqlBuildCommand, ctx.codeqlFallbackBuildCommand);
    } catch (err) {
      console.warn(`[codeql-command-dispatch] WARNING: unexpected failure running CodeQL command-dispatch resolution, continuing without it: ${err}`);
      return;
    }
    if (bindings.length === 0) return;

    let introducedCount = 0;
    let relationshipCount = 0;
    for (const binding of bindings) {
      // Same discipline as codeql-di-pass.ts's empty-name skip: never
      // introduce/reference a unit with a blank name, even though this
      // query's own shape (RefType.getName() on a real annotated class or a
      // real declaring type) hasn't been observed producing one — cheap,
      // consistent defense against the identical CodeQL edge case (an
      // anonymous class) if it were ever to occur here.
      if (!binding.dispatcherClass.trim() || !binding.handlerClass.trim()) continue;

      const dispatcherLoc = relativeToRoot(ctx.codeqlSourceRoot, ctx.packageRoots, binding.dispatcherFile);
      if (!dispatcherLoc) continue; // real class, but outside every scanned root
      const dispatcherUnit = findUnitByFile(ctx.unitsByRoot, dispatcherLoc.root, dispatcherLoc.relativeFilePath);
      if (!dispatcherUnit) continue; // CodeQL saw a real class; this pipeline's own extraction never turned it into a unit — nothing to anchor a relationship to

      const handlerLoc = relativeToRoot(ctx.codeqlSourceRoot, ctx.packageRoots, binding.handlerFile);
      if (!handlerLoc) continue;

      let handlerUnit = findUnitByFile(ctx.unitsByRoot, handlerLoc.root, handlerLoc.relativeFilePath);
      if (!handlerUnit) {
        // T-FS-4-class introduction — CodeQL is the ONLY mechanism that
        // knows this class exists and is real (a string-keyed command
        // handler this pipeline's own catalogue-driven detection never
        // independently reached). Same conservative 'service' default and
        // never-promoted-past-secondary status as codeql-di-pass.ts's own
        // implUnit introduction.
        handlerUnit = {
          id: `codeql-command-dispatch:${handlerLoc.root}:${handlerLoc.relativeFilePath}`,
          kind: 'service',
          name: binding.handlerClass,
          filePath: handlerLoc.relativeFilePath,
          startLine: 1,
          endLine: 1,
          status: PENDING_STATUS,
          evidence: [
            {
              signal: 'codeql-command-dispatch',
              source: 'codeql-di', // reuses the existing secondary-introduction evidence source (status-assignment.ts's SECONDARY_ONLY_SOURCES) — a second real producer of the same class of fact, not a new source needing its own hard-rule wiring
              category: 'framework-bootstrap',
              weight: unitIntroductionTrust('codeql', 'codeql-command-dispatch'),
              ref: `${handlerLoc.relativeFilePath}:1`,
            },
          ],
          confidence: unitIntroductionTrust('codeql', 'codeql-command-dispatch'),
        };
        ctx.allUnits.push(handlerUnit);
        const rootUnits = ctx.unitsByRoot.get(handlerLoc.root) ?? [];
        rootUnits.push(handlerUnit);
        ctx.unitsByRoot.set(handlerLoc.root, rootUnits);
        introducedCount++;
      }

      // Trust tier, enforced structurally: never contest an edge an
      // earlier, more-established mechanism already produced for this pair.
      const alreadyResolved = ctx.relationships.some((r) => r.from === dispatcherUnit.id && r.to === handlerUnit!.id);
      if (alreadyResolved) continue;

      const crossRoot = dispatcherLoc.root !== handlerLoc.root;
      ctx.relationships.push({
        from: dispatcherUnit.id,
        to: handlerUnit.id,
        kind: 'calls',
        crossPackage: crossRoot,
        source: 'codeql',
        confidence: relationshipTrust('codeql', 'codeql-command-dispatch', crossRoot ? 'cross-root' : 'same-root'),
        mechanism: 'codeql-command-dispatch',
        status: PENDING_STATUS,
        id: PENDING_RELATIONSHIP_ID,
      });
      relationshipCount++;
    }

    if (relationshipCount > 0 || introducedCount > 0) {
      console.log(`[codeql-command-dispatch] ${bindings.length} real dispatch binding(s) resolved by CodeQL; ${relationshipCount} new relationship(s), ${introducedCount} new unit(s) introduced`);
    }

    const matrix = loadEngineCapabilityMatrix(path.join(__dirname, '..', 'scanner'));
    warnIfMechanismUnverified(matrix, 'java', 'codeql-command-dispatch', bindings.length);
  },
};
