import * as path from 'path';
import { AnalysisContext, AnalysisPass } from './pass-registry';
import { runCodeQLJpaTableResolution } from '../scanner/codeql-jpa-table-provider';
import { TypedUnit } from '../types/typed-facts';
import { scoreConfidence } from './confidence-scorer';

const JPA_TABLE_CORROBORATION_WEIGHT = 10; // same corroboration tier as jpa-table's own decorator-presence row (signal-catalogue.yml)

/**
 * JPA entity->table CodeQL candidate (BACKLOG.md) — turns CodeQL's real
 * `@Entity`->table-name bindings (`codeql-jpa-table-provider.ts`) into a
 * new Evidence entry on an ALREADY-detected persistence unit. Deliberately
 * corroboration-only, a materially simpler shape than `codeqlDiPass`/
 * `codeqlCommandDispatchPass`: never introduces a new unit, never contests
 * or changes a unit's existing `kind`, never builds a relationship — it
 * only adds the real table-name string `signal-mapper.ts`'s existing
 * `jpa-entity`/`jpa-table` catalogue rows can't see (a decorator fact
 * carries the annotation NAME, never its string argument).
 *
 * Same opt-in gate as every other CodeQL-based pass: a no-op unless
 * `ctx.codeqlSourceRoot`/`ctx.codeqlBuildCommand` are both set (hand-written
 * or `--auto-codeql`-derived) — never a default-on path, same real cost/
 * license reasons `codeql-di-pass.ts`'s own doc comment already states.
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

export const codeqlJpaTablePass: AnalysisPass = {
  name: 'codeqlJpaTable',
  run(ctx: AnalysisContext) {
    if (!ctx.codeqlSourceRoot || !ctx.codeqlBuildCommand) return;

    let bindings: ReturnType<typeof runCodeQLJpaTableResolution>;
    try {
      bindings = runCodeQLJpaTableResolution(ctx.codeqlSourceRoot, ctx.codeqlBuildCommand, ctx.codeqlFallbackBuildCommand);
    } catch (err) {
      console.warn(`[codeql-jpa-table] WARNING: unexpected failure running CodeQL JPA table resolution, continuing without it: ${err}`);
      return;
    }
    if (bindings.length === 0) return;

    let enrichedCount = 0;
    for (const binding of bindings) {
      const loc = relativeToRoot(ctx.codeqlSourceRoot, ctx.packageRoots, binding.file);
      if (!loc) continue; // real class, but outside every scanned root — same "never guess across an unscanned boundary" discipline as every other cross-package mechanism here
      const unit = findUnitByFile(ctx.unitsByRoot, loc.root, loc.relativeFilePath);
      if (!unit) continue; // CodeQL saw a real @Entity class; this pipeline's own extraction never turned it into a unit — nothing to enrich (corroboration-only, never introduces a unit)
      // Real gap found on review: signal-mapper.ts's own decisive-category
      // logic can classify a class carrying BOTH @Entity/@Table and strong
      // HTTP-entry-point evidence as 'service', not 'database' — same
      // precondition cdxgen-corroboration-pass.ts already enforces
      // (`u.kind === 'database' || u.kind === 'topic'`) before attaching
      // persistence-category evidence, never guessed at here either.
      if (unit.kind !== 'database') continue;

      // Idempotency within one run: never push the identical table-name fact twice.
      const alreadyHasTableName = unit.evidence.some((e) => e.source === 'codeql-jpa-table' && e.signal === binding.tableName);
      if (alreadyHasTableName) continue;

      unit.evidence.push({
        signal: binding.tableName,
        source: 'codeql-jpa-table',
        category: 'persistence',
        weight: JPA_TABLE_CORROBORATION_WEIGHT,
        ref: `${binding.file}:1`,
      });
      unit.confidence = scoreConfidence(unit.evidence);
      enrichedCount++;
    }
    if (enrichedCount > 0) {
      console.log(`[codeql-jpa-table] ${bindings.length} real JPA entity->table binding(s) resolved by CodeQL; ${enrichedCount} unit(s) enriched with a real table name`);
    }
  },
};
