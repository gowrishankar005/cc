import { AnalysisContext, AnalysisPass, pushAll } from './pass-registry';
import { CONFIDENCE_FLOOR } from './passes';
import { discoverSpringConfigFiles, SpringConfigFile } from '../scanner/spring-config-provider';
import { Evidence, TypedUnit } from '../types/typed-facts';
import { scoreConfidence } from './confidence-scorer';

/**
 * T-PC1-3…6 (B-spring-config) — turns spring-config-provider.ts's raw flat
 * key-value maps into TypedUnits + Evidence, the "Scanner provider ->
 * TypedFacts" flow this project's own convention requires (openapi-pass.ts
 * is the direct precedent). Vocabulary + two real, mined findings this
 * extraction logic depends on are in
 * `docs/solution/language/spring-config-property-vocabulary.md` — do not
 * re-derive the key list from memory if extending this file.
 *
 * Each config file is processed INDEPENDENTLY (T-VM-2's decided
 * profile-merge policy) — a base `application.yml` and a sibling
 * `application-prod.yml` both setting `spring.datasource.url` produce TWO
 * separate corroborating units, one per file, each citing its own real
 * provenance. This is deliberately not merged: there is no reliable,
 * non-fabricating way to know which value actually wins at runtime without
 * the (separately tracked, out of scope) runtime-verification lane — citing
 * both real facts honestly is safer than guessing one.
 */
const CONFIG_WEIGHT = 40; // "sufficient alone" tier, same as jpa-entity's weight in signal-catalogue.yml — a config-file fact is as decisive as a decorator

function jdbcScheme(url: string): string | undefined {
  return /^jdbc:([a-z0-9+]+):/i.exec(url)?.[1]?.toLowerCase();
}

/**
 * Review finding (2026-08-09) — a physical file can now produce MORE THAN
 * ONE SpringConfigFile entry (an unconditional one plus one per
 * spring.config.activate.on-profile-scoped document it contains), all
 * sharing the same `filePath`. Using `filePath` alone as the unit-id key
 * would collide two real, distinct facts into one id (a real
 * `calm validate` "duplicate unique-id" risk) — `docProfile` disambiguates
 * them. Existing file-level-profile-only entries (docProfile unset) keep
 * their exact original id shape, so this is additive, not a breaking
 * rename for the already-tested case.
 */
function unitFileKey(file: SpringConfigFile): string {
  return file.docProfile ? `${file.filePath}#${file.docProfile}` : file.filePath;
}

function buildUnit(file: SpringConfigFile, suffix: string, kind: TypedUnit['kind'], name: string, signal: string, key: string): TypedUnit {
  const evidence: Evidence[] = [
    { signal, source: 'structured-config', category: 'spring-config', weight: CONFIG_WEIGHT, ref: `${file.filePath}:${key}` },
  ];
  return {
    id: `${unitFileKey(file)}::${suffix}`,
    kind,
    name,
    filePath: file.filePath,
    startLine: 1,
    endLine: 1, // no line numbers available from a parsed YAML/JSON/properties document — same honest limitation openapi-pass.ts already carries
    evidence,
    confidence: scoreConfidence(evidence),
  };
}

/** T-SC-3 — spring.datasource.url -> database unit + JDBC scheme (feeds build-calm.ts's protocol population). */
function extractDatasource(file: SpringConfigFile): TypedUnit | undefined {
  const url = file.properties.get('spring.datasource.url');
  if (!url) return undefined;
  const scheme = jdbcScheme(url);
  return buildUnit(file, 'spring-datasource', 'database', scheme ? `datasource (${scheme})` : 'datasource', `spring.datasource.url=${url}`, 'spring.datasource.url');
}

/** T-SC-4 — Kafka/RabbitMQ/ActiveMQ broker config -> topic (network) unit. */
function extractBrokers(file: SpringConfigFile): TypedUnit[] {
  const units: TypedUnit[] = [];

  const kafka = file.properties.get('spring.kafka.bootstrap-servers');
  if (kafka) units.push(buildUnit(file, 'spring-kafka', 'topic', 'kafka broker', `spring.kafka.bootstrap-servers=${kafka}`, 'spring.kafka.bootstrap-servers'));

  // Real, mined finding (spring-config-property-vocabulary.md §1): .addresses
  // takes precedence over .host/.port when set (RabbitProperties.java's own
  // field comment: "RabbitMQ host. Ignored if an address is set.").
  const rabbitAddresses = file.properties.get('spring.rabbitmq.addresses');
  const rabbitHost = file.properties.get('spring.rabbitmq.host');
  if (rabbitAddresses) {
    units.push(buildUnit(file, 'spring-rabbitmq', 'topic', 'rabbitmq broker', `spring.rabbitmq.addresses=${rabbitAddresses}`, 'spring.rabbitmq.addresses'));
  } else if (rabbitHost) {
    const port = file.properties.get('spring.rabbitmq.port') ?? '5672';
    units.push(buildUnit(file, 'spring-rabbitmq', 'topic', 'rabbitmq broker', `spring.rabbitmq.host=${rabbitHost}:${port}`, 'spring.rabbitmq.host'));
  }

  const activemq = file.properties.get('spring.activemq.broker-url');
  if (activemq) units.push(buildUnit(file, 'spring-activemq', 'topic', 'activemq broker', `spring.activemq.broker-url=${activemq}`, 'spring.activemq.broker-url'));

  return units;
}

/**
 * T-SC-5 — spring.data.redis.host/.port (or the pre-Boot-3.0
 * spring.redis.host/.port fallback — real, mined finding, see the
 * vocabulary doc §2) -> database-kind unit. No existing detector covers
 * this at all today (genuinely new coverage, not a second source for
 * existing coverage). spring.cache.type is folded in as extra evidence
 * ONLY when a redis host is also present in the same file — alone, a bare
 * `cache.type: redis` names a technology but not an address, too weak to
 * anchor a unit on its own; named here as an honest limitation, not
 * silently ignored.
 */
function extractRedis(file: SpringConfigFile): TypedUnit | undefined {
  const host = file.properties.get('spring.data.redis.host') ?? file.properties.get('spring.redis.host');
  const hostKey = file.properties.has('spring.data.redis.host') ? 'spring.data.redis.host' : 'spring.redis.host';
  if (!host) return undefined;
  const port = file.properties.get('spring.data.redis.port') ?? file.properties.get('spring.redis.port') ?? '6379';

  const unit = buildUnit(file, 'spring-redis', 'database', 'redis', `${hostKey}=${host}:${port}`, hostKey);
  const cacheType = file.properties.get('spring.cache.type');
  if (cacheType) {
    unit.evidence.push({
      signal: `spring.cache.type=${cacheType}`,
      source: 'structured-config',
      category: 'spring-config',
      weight: 10, // corroboration-only tier, same as jpa-table's weight
      ref: `${file.filePath}:spring.cache.type`,
    });
    unit.confidence = scoreConfidence(unit.evidence);
  }
  return unit;
}

/**
 * Review fix (2026-08-16) — extracted from attachServerPort/
 * attachResilienceTimeout, which each independently recomputed and
 * duplicated this exact "exactly one service unit, or record a real
 * AMBIGUOUS_BOUNDARY IgnoredItem, never guess" block. `keyForRef` is the
 * property key that motivated this lookup, used only for the ignored-item's
 * ref/detail text — the lookup itself never depends on which key triggered
 * it. Returns the sole real service unit, or undefined when the caller
 * should not attach anything (0 or 2+ candidates, already recorded).
 */
function resolveSoleServiceUnit(ctx: AnalysisContext, root: string, file: SpringConfigFile, keyForRef: string, valueForDetail: string): TypedUnit | undefined {
  const serviceUnits = (ctx.unitsByRoot.get(root) ?? []).filter((u) => u.kind === 'service');
  if (serviceUnits.length === 1) return serviceUnits[0];

  ctx.allIgnoredItems.push({
    ref: `${unitFileKey(file)}:${keyForRef}`,
    reason: 'AMBIGUOUS_BOUNDARY',
    detail:
      serviceUnits.length === 0
        ? `${keyForRef}=${valueForDetail} found but no service unit exists in this root to attach it to`
        : `${keyForRef}=${valueForDetail} found but ${serviceUnits.length} service units exist in this root — never guessing which one owns it`,
  });
  return undefined;
}

/**
 * T-SC-6 — server.port -> a tcp-host-port interface on the root's single
 * `service` unit. Never guesses when 0 or 2+ candidates exist (same "never
 * guess" discipline as openapi-pass.ts's route-overlap merge check) — the
 * port fact is recorded as evidence ONLY when exactly one service unit
 * already exists for this root at the time this pass runs (after
 * mapSignals/openapi/cfnRoute in DEFAULT_PASSES order, so their units are
 * final); build-calm.ts's attachPortInterfaces reads it from there. The
 * ambiguous/no-candidate case is recorded as a real IgnoredItem, never
 * silently dropped.
 */
function attachServerPort(ctx: AnalysisContext, root: string, file: SpringConfigFile): void {
  const port = file.properties.get('server.port');
  if (!port) return;

  const unit = resolveSoleServiceUnit(ctx, root, file, 'server.port', port);
  if (!unit) return;

  unit.evidence.push({
    signal: `server.port=${port}`,
    source: 'structured-config',
    category: 'spring-config',
    weight: 0, // descriptive-only — never meant to move a unit's own confidence, only to carry the port fact through to build-calm.ts
    ref: `${unitFileKey(file)}:server.port`,
  });
}

/**
 * T-LM-2 (Lens Modules lane) — resilience4j's real, documented Spring Boot
 * property shape: `resilience4j.timelimiter.instances.<name>.timeout-duration`
 * (the `<name>` segment is an arbitrary, user-chosen instance name, so this
 * is a wildcard match over the flattened key map, not a fixed literal key
 * like server.port). Same structured-file-ingestion mechanism as every
 * other extraction in this file — spring-config-provider.ts already
 * flattens the YAML/properties generically; no new parsing mechanism.
 *
 * Review fix (2026-08-16) — the original STRICT-only regex (`[^.]+`, no
 * dots in the instance-name segment) silently `continue`'d past a
 * legitimate quoted/dotted instance name (e.g. a YAML key
 * `instances."payments.eu".timeout-duration`, which flattenYaml joins into
 * `...instances.payments.eu.timeout-duration` — indistinguishable from a
 * 3-segment path once flattened) with ZERO IgnoredItem, inconsistent with
 * this file's own "never guess, never silently drop" discipline
 * (resolveSoleServiceUnit's ambiguous-boundary case, right above, always
 * records one). Fixed: a LOOSE regex additionally catches the multi-segment
 * shape; a LOOSE-but-not-STRICT match now records a real IgnoredItem
 * (INSUFFICIENT_EVIDENCE — this pipeline cannot losslessly recover where a
 * dotted/quoted instance name ends once the key is flattened) instead of
 * silently vanishing. See scope-limitations.yml's
 * resilience-lens-retry-timeout-only entry for the disclosed residual.
 */
const TIMELIMITER_TIMEOUT_KEY_STRICT = /^resilience4j\.timelimiter\.instances\.[^.]+\.timeout-duration$/;
const TIMELIMITER_TIMEOUT_KEY_LOOSE = /^resilience4j\.timelimiter\.instances\..+\.timeout-duration$/;

/**
 * Attaches a real timeout-config fact to the root's single `service` unit —
 * same "never guess" discipline as attachServerPort just above: the fact is
 * recorded as evidence ONLY when exactly one service unit already exists in
 * this root (after mapSignals/openapi/cfnRoute have run); 0 or 2+
 * candidates record a real IgnoredItem instead of guessing which unit owns
 * the timeout. Weight 0 (descriptive-only, same as attachServerPort) — this
 * pipeline never claims to know whether a timeout is well-tuned, only that
 * one is configured; the resilience-lens module surfaces the raw fact for a
 * human to judge.
 */
function attachResilienceTimeout(ctx: AnalysisContext, root: string, file: SpringConfigFile): void {
  for (const [key, value] of file.properties) {
    const strictMatch = TIMELIMITER_TIMEOUT_KEY_STRICT.test(key);
    if (!strictMatch) {
      if (TIMELIMITER_TIMEOUT_KEY_LOOSE.test(key)) {
        ctx.allIgnoredItems.push({
          ref: `${unitFileKey(file)}:${key}`,
          reason: 'INSUFFICIENT_EVIDENCE',
          detail: `${key}=${value} looks like a resilience4j timelimiter timeout-duration key but its instance-name segment contains a dot (a quoted/dotted instance name) — this pipeline cannot losslessly recover where the instance name ends once the key is flattened, so it is not attached as evidence, never guessed`,
        });
      }
      continue;
    }

    const unit = resolveSoleServiceUnit(ctx, root, file, key, value);
    if (!unit) continue;

    unit.evidence.push({
      signal: `${key}=${value}`,
      source: 'structured-config',
      category: 'resilience',
      weight: 0,
      ref: `${unitFileKey(file)}:${key}`,
    });
  }
}

export const springConfigPass: AnalysisPass = {
  name: 'springConfig',
  run(ctx: AnalysisContext) {
    for (const root of ctx.packageRoots) {
      const files = discoverSpringConfigFiles(root);
      for (const file of files) {
        const candidates: TypedUnit[] = [];
        const datasource = extractDatasource(file);
        if (datasource) candidates.push(datasource);
        pushAll(candidates, extractBrokers(file));
        const redis = extractRedis(file);
        if (redis) candidates.push(redis);

        for (const unit of candidates) {
          if (unit.confidence < CONFIDENCE_FLOOR) {
            ctx.allIgnoredItems.push({ ref: unit.id, reason: 'INSUFFICIENT_EVIDENCE', detail: `Confidence ${unit.confidence} below the review-queue threshold (40)` });
            continue;
          }
          ctx.allUnits.push(unit);
          ctx.unitsByRoot.set(root, [...(ctx.unitsByRoot.get(root) ?? []), unit]);
        }

        attachServerPort(ctx, root, file);
        attachResilienceTimeout(ctx, root, file);
      }
    }
  },
};
