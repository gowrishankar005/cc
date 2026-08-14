import { DeploymentManifest } from '../../scanner/k8s-manifest-provider';
import { TypedUnit, IgnoredItem } from '../../types/typed-facts';

/**
 * T-FS-3 (BACKLOG.md "Contradiction detection between evidence sources").
 *
 * BACKLOG's own named gap: two evidence sources asserting DIFFERENT VALUES
 * for the same real-world fact currently just both add weight in
 * confidence-scorer.ts — contradiction raises confidence instead of
 * lowering it, and nothing forces a human to look. Evidenced class: a
 * (possibly stale) deployment manifest naming one datastore engine while
 * the current, live application config names a different one.
 *
 * DELIBERATE DESIGN CHOICE: this does NOT touch scoreConfidence or any
 * unit's own confidence number — averaging two conflicting values (or
 * silently picking one to "win") is exactly the failure mode this task
 * exists to prevent (T-FS-5/E5 already found averaging correlated
 * multi-clause evidence makes decisions LESS correct; a genuine value-level
 * contradiction is worse to average than that). Each source's own
 * evidence-based confidence stays exactly what it already was. Instead,
 * this only ever WRITES a new, distinguishable IgnoredItem
 * (reason: AMBIGUOUS_BOUNDARY, detail prefixed "contradiction: ") that
 * hitl-review-trigger.ts turns into an always-on review-queue trigger
 * (never gated behind a silence flag, same convergent design as T-FS-1's
 * tier-b-single-candidate) — forcing a human decision, never a silent
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
 * mechanism. Never guesses: 0 or 2+ resolvable-engine deployments in the
 * manifest set means "not enough signal to compare," same "never guess"
 * discipline as multi-hop-bridge-detector.ts.
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

/** Same JDBC-scheme extraction spring-config-pass.ts already uses (jdbcScheme()) — re-derived here rather than imported to keep this cross_package detector's only real dependency on spring-config-pass.ts's OUTPUT (a unit's evidence), not its internals. */
function jdbcSchemeEngine(url: string): string | undefined {
  const match = /^jdbc:([a-z0-9+]+):/i.exec(url);
  return match ? canonicalEngine(match[1]) : undefined;
}

/** "docker.io/library/postgres:14-alpine" -> "postgres"; "myorg/orders-service:1.4" -> undefined (not a known engine token — never guessed from an unrelated app image name). */
function imageEngine(image: string): string | undefined {
  const withoutTag = image.split(':')[0];
  const lastSegment = withoutTag.split('/').pop() ?? withoutTag;
  return canonicalEngine(lastSegment);
}

export function detectValueContradictions(deployments: DeploymentManifest[], units: TypedUnit[]): { ignoredItems: IgnoredItem[] } {
  const ignoredItems: IgnoredItem[] = [];

  const engineDeployments = deployments
    .map((d) => (d.image ? { deployment: d, engine: imageEngine(d.image) } : undefined))
    .filter((x): x is { deployment: DeploymentManifest; engine: string } => !!x && !!x.engine);
  // Dedupe by resolved engine token, not by deployment — two deployments
  // that both happen to name the SAME engine are not ambiguous about which
  // engine the manifest set asserts, only about which single deployment
  // object to cite; that distinction doesn't matter for THIS comparison.
  const uniqueEngines = [...new Map(engineDeployments.map((e) => [e.engine, e])).values()];
  if (uniqueEngines.length !== 1) return { ignoredItems }; // 0: no manifest signal to compare; 2+: genuinely ambiguous which manifest engine is authoritative — never guess.
  const manifestEngine = uniqueEngines[0];

  for (const unit of units) {
    if (unit.kind !== 'database') continue;
    const datasourceEvidence = unit.evidence.find((e) => e.source === 'structured-config' && e.signal.startsWith('spring.datasource.url='));
    if (!datasourceEvidence?.argument) continue;
    const configEngine = jdbcSchemeEngine(datasourceEvidence.argument);
    if (!configEngine || configEngine === manifestEngine.engine) continue; // no resolvable scheme, or the two sources agree — nothing to force review on.

    ignoredItems.push({
      ref: unit.id,
      reason: 'AMBIGUOUS_BOUNDARY',
      detail: `contradiction: "${unit.id}"'s spring-config evidence (${datasourceEvidence.signal}) names datastore engine "${configEngine}", but deployment manifest "${manifestEngine.deployment.name}" (image "${manifestEngine.deployment.image}") names a DIFFERENT engine "${manifestEngine.engine}" for the same real-world datastore — conflicting assertions about one fact, forced to review, never averaged into a single confidence score.`,
    });
  }

  return { ignoredItems };
}
