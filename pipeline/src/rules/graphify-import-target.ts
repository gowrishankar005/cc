/**
 * Real finding from testing against a real Node/NestJS fintech repo
 * (ghostfolio/ghostfolio — the first Node/TS codebase with actual
 * persistence/queue dependencies ever run through this pipeline): Graphify
 * does NOT use the literal npm package name as an `imports_from`/`imports`
 * edge target for EXTERNAL packages — it normalizes to `ref_<sanitized>`
 * (verified against real edges, not assumed): `@prisma/client` ->
 * `ref_prisma_client`, `@nestjs/bull` -> `ref_nestjs_bull`,
 * `@nest-lab/throttler-storage-redis` -> `ref_nest_lab_throttler_storage_redis`,
 * `big.js` -> `ref_big_js`. The rule, inferred from ~80 real ref_ targets in
 * one real repo's graph.json: strip a leading `@`, replace `/`, `-`, `.`
 * with `_`, prefix `ref_`.
 *
 * This silently broke EVERY Node/TS entry across persistence-detection-
 * catalogue.yml, messaging-detection-catalogue.yml, and
 * http-client-detection-catalogue.yml — they were never just "unverified,"
 * they were unreachable, since the catalogue held the literal package name
 * and Graphify's real edges never use it. Python's entries (sqlalchemy,
 * psycopg2, ...) are unaffected — confirmed no `ref_` transform applies to
 * Python's own import target naming in this same real run.
 *
 * GENERIC fix, not a per-library patch: every *-detection-schema.ts's
 * library-Set builder calls `expandWithGraphifyRefTargets()` once, so a new
 * catalogue row (any language, any package) is automatically matchable
 * against however Graphify actually names that edge target — no per-package
 * translation table to maintain.
 */
export function toGraphifyRefTarget(packageName: string): string {
  return 'ref_' + packageName.replace(/^@/, '').replace(/[/.\-]/g, '_');
}

/** Given a Set of literal catalogue library names, returns a new Set containing both the literal names (for languages/engines that keep them literal) and each one's ref_-transformed form (for Graphify's external-package edge naming) — purely additive, never removes a match that already worked. */
export function expandWithGraphifyRefTargets(libraries: Set<string>): Set<string> {
  const expanded = new Set(libraries);
  for (const lib of libraries) expanded.add(toGraphifyRefTarget(lib));
  return expanded;
}
