import { DeploymentManifest } from '../../scanner/k8s-manifest-provider';
import { TypedUnit, IgnoredItem } from '../../types/typed-facts';
import { jdbcScheme } from '../jdbc-url';

/**
 * BACKLOG.md's own named gap ("Contradiction detection between evidence
 * sources"): two evidence sources asserting DIFFERENT VALUES
 * for the same real-world fact currently just both add weight in
 * confidence-scorer.ts — contradiction raises confidence instead of
 * lowering it, and nothing forces a human to look. Evidenced class: a
 * (possibly stale) deployment manifest naming one datastore engine while
 * the current, live application config names a different one.
 *
 * DELIBERATE DESIGN CHOICE: this does NOT touch scoreConfidence or any
 * unit's own confidence number — averaging two conflicting values (or
 * silently picking one to "win") is exactly the failure mode this
 * exists to prevent (a confidence-replay experiment already found averaging
 * correlated multi-clause evidence makes decisions LESS correct; a genuine
 * value-level contradiction is worse to average than that). Each source's own
 * evidence-based confidence stays exactly what it already was. Instead,
 * this only ever WRITES a new, distinguishable IgnoredItem
 * (reason: AMBIGUOUS_BOUNDARY, detail prefixed "contradiction: ") that
 * hitl-review-trigger.ts turns into an always-on review-queue trigger
 * (never gated behind a silence flag, same convergent design as the
 * tier-b-single-candidate class) — forcing a human decision, never a silent
 * pick, never a blended number.
 *
 * SCOPE (see scope-limitations.yml's tier-b-single-candidate-scope
 * sibling entry, tier-b-single-candidate-scope, and this row's own
 * contradiction-detection-java-spring-only entry): today this compares
 * exactly ONE pairing — a k8s Deployment's container image (already read
 * by k8s-manifest-provider.ts, no new extraction mechanism) against a
 * spring-config-sourced database unit's spring.datasource.url JDBC scheme
 * (already read by spring-config-provider.ts). Both are already-proven
 * structured-file-ingestion sources (CLAUDE.md's fourth mechanism) — this
 * is a new CORRELATION between two existing sources, not a new extraction
 * mechanism. Never guesses, scoped PER UNIT (real bug fixed on code review
 * 2026-08-16 — this gate used to be computed once, globally, across the
 * whole manifest set): for a given unit, if any deployment already agrees
 * with its config engine that's real corroboration regardless of other,
 * differently-engined deployments present for unrelated concerns (e.g. a
 * Redis cache alongside a Postgres store); only when nothing agrees does
 * "exactly one disagreeing engine vs. 2+ genuinely ambiguous ones" apply,
 * same "never guess" discipline as multi-hop-bridge-detector.ts.
 */

/**
 * Canonical engine tokens, shared vocabulary between a JDBC URL scheme
 * (postgresql/mysql/...) and a container image's own base name
 * (postgres/mysql/mongo/...) — the two real vocabularies this detector
 * has to reconcile, since they don't already agree on spelling (postgres
 * vs postgresql, mongo vs mongodb).
 */
const ENGINE_ALIASES: Record<string, string> = {
  postgres: 'postgresql',
  postgresql: 'postgresql',
  mysql: 'mysql',
  mariadb: 'mariadb',
  mongo: 'mongodb',
  mongodb: 'mongodb',
  redis: 'redis',
  cassandra: 'cassandra',
  oracle: 'oracle',
  sqlserver: 'sqlserver',
  mssql: 'sqlserver',
  db2: 'db2',
  sqlite: 'sqlite',
  h2: 'h2',
  dynamodb: 'dynamodb',
};

function canonicalEngine(token: string): string | undefined {
  return ENGINE_ALIASES[token.toLowerCase()];
}

/** Shared with hitl-review-trigger.ts's own filter — a named constant instead of a second hardcoded copy of the same literal (same guardrail class as multi-hop-bridge-detector.ts's exported prefixes). Unlike those, this detector already carries the contradicted unit's real id in `IgnoredItem.ref` directly (no string-slicing needed to recover it) — this constant only guards the filter-by-prefix step. */
export const CONTRADICTION_PREFIX = 'contradiction: ';

/** jdbc-url.ts's shared scheme extraction (colon-default-aware), then reconciled against this file's own image/JDBC engine-name vocabulary. Real bug fixed on code review (2026-08-16): this used to be a hand-copied re-derivation of spring-config-pass.ts's jdbcScheme() with its own comment promising to "stay in sync" — that promise already failed once in this same commit (port-interface-builder.ts's sibling check drifted). One shared function now, not two copies. */
function jdbcSchemeEngine(url: string): string | undefined {
  const scheme = jdbcScheme(url);
  return scheme ? canonicalEngine(scheme) : undefined;
}

/**
 * "docker.io/library/postgres:14-alpine" -> "postgres"; "myorg/orders-service:1.4"
 * -> undefined (not a known engine token — never guessed from an unrelated
 * app image name).
 *
 * Real bugs fixed on code review (2026-08-16), both verified directly:
 * (1) `image.split(':')[0]` assumed at most one colon in the whole string,
 * breaking on a private registry with an explicit port
 * ("localhost:5000/postgres:14-alpine" -> "localhost" instead of
 * "postgres"). Fixed: only the LAST colon occurring AFTER the last `/` is
 * ever a tag separator — a colon earlier in the string (a registry:port)
 * never is, per real Docker image-reference syntax.
 * (2) Checking only the FINAL path segment against ENGINE_ALIASES broke on
 * real official multi-segment images where the engine name isn't last
 * ("mcr.microsoft.com/mssql/server:2022-latest" -> last segment "server",
 * not in the vocabulary, while "mssql" — a real ENGINE_ALIASES entry — sits
 * one segment earlier). Fixed: check every path segment, not just the last.
 */
export function imageEngine(image: string): string | undefined {
  const lastSlash = image.lastIndexOf('/');
  const tagColonIdx = image.indexOf(':', lastSlash + 1); // lastSlash === -1 is fine: searches from index 0.
  const withoutTag = tagColonIdx === -1 ? image : image.slice(0, tagColonIdx);
  for (const segment of withoutTag.split('/')) {
    const engine = canonicalEngine(segment);
    if (engine) return engine;
  }
  return undefined;
}

export function detectValueContradictions(deployments: DeploymentManifest[], units: TypedUnit[]): { ignoredItems: IgnoredItem[] } {
  const ignoredItems: IgnoredItem[] = [];

  const engineDeployments = deployments
    .map((d) => (d.image ? { deployment: d, engine: imageEngine(d.image) } : undefined))
    .filter((x): x is { deployment: DeploymentManifest; engine: string } => !!x && !!x.engine);
  if (engineDeployments.length === 0) return { ignoredItems }; // no manifest signal to compare against, for any unit.

  for (const unit of units) {
    if (unit.kind !== 'database') continue;
    // Real second key found verifying this against a reference Java/JAX-RS
    // banking platform's real-instance pass (2026-08-15): spring-config-pass.ts's
    // extractDatasource() also falls back to spring.datasource.hikari.jdbcUrl
    // when spring.datasource.url is absent — same real fact, different
    // property key, so this check must accept either signal prefix.
    const datasourceEvidence = unit.evidence.find(
      (e) => e.source === 'structured-config' && (e.signal.startsWith('spring.datasource.url=') || e.signal.startsWith('spring.datasource.hikari.jdbcUrl='))
    );
    if (!datasourceEvidence?.argument) continue;
    const configEngine = jdbcSchemeEngine(datasourceEvidence.argument);
    if (!configEngine) continue; // no resolvable scheme — nothing to compare.

    // Real bug fixed on code review (2026-08-16): the "never guess" gate
    // used to be computed ONCE, globally, across every deployment in the
    // whole manifest set — so a completely normal real shape (e.g. one
    // Postgres deployment for this service's own store, alongside an
    // unrelated Redis cache deployment for a different concern) made
    // `detectValueContradictions` bail out for the ENTIRE run, not just
    // the genuinely ambiguous units. "Never guess" must gate on
    // disagreement about THIS unit's own fact, not on the mere presence of
    // multiple different, unrelated facts elsewhere in the manifest set.
    //
    // Per-unit scoping: if ANY real deployment already agrees with this
    // unit's own config engine, that's real corroboration — other,
    // differently-engined deployments present in the same manifest set
    // (legitimately different real stores) don't invalidate it. Only when
    // NO deployment agrees do we ask whether exactly one distinct
    // disagreeing engine exists (a genuine single rival claim) or 2+
    // (genuinely ambiguous which one, if any, is the real counterpart —
    // never guess).
    const agreeing = engineDeployments.some((e) => e.engine === configEngine);
    if (agreeing) continue;

    const disagreeingEngines = [...new Map(engineDeployments.map((e) => [e.engine, e])).values()];
    if (disagreeingEngines.length !== 1) continue; // 2+ distinct disagreeing engines — ambiguous which is the real rival claim, never guess.
    const manifestEngine = disagreeingEngines[0];

    ignoredItems.push({
      ref: unit.id,
      reason: 'AMBIGUOUS_BOUNDARY',
      detail: `${CONTRADICTION_PREFIX}"${unit.id}"'s spring-config evidence (${datasourceEvidence.signal}) names datastore engine "${configEngine}", but deployment manifest "${manifestEngine.deployment.name}" (image "${manifestEngine.deployment.image}") names a DIFFERENT engine "${manifestEngine.engine}" for the same real-world datastore — conflicting assertions about one fact, forced to review, never averaged into a single confidence score.`,
    });
  }

  return { ignoredItems };
}
