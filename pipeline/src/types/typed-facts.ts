/**
 * The Analysis <-> Module contract (requirements v0.6 §1).
 * modules/calm-generator reads exactly this shape and nothing else about
 * how the facts were produced — CodeGraph, Graphify, or a future engine.
 */

export interface Evidence {
  signal: string; // raw signal name, e.g. "app.route" or "Controller"
  // 'openapi' added in CONTRACT_VERSION 2.0.0 (T-X4-1) — this is the named
  // reopen trigger from Contract_Evolution_Policy.md §3: a second real
  // engine (the OpenAPI provider) now produces Evidence for the same
  // construct kind (interfaces/routes) native-route/decorator already
  // produce, so the freeze documented there is void as of this version.
  // 'call' added in CONTRACT_VERSION 5.0.0 (AREC Wave 3 T-D1) — call-site
  // security signals (e.g. `validateHasReadPermission(...)`, `jwt.decode(...)`)
  // matched from CodeGraph's extractFromSource() `referenceKind: 'calls'`
  // entries — the same extraction API decorator evidence already uses, a
  // different reference kind, not a new engine.
  // 'field-type' added in CONTRACT_VERSION 6.0.0 (AREC Wave 3 T-E1) — a
  // field/variable's declared TYPE (e.g. a KafkaTemplate-typed field, real
  // messaging-producer evidence), same extraction API, `referenceKind:
  // 'references'` instead of 'calls'/'decorates'.
  // 'extends' added in CONTRACT_VERSION 7.0.0 (AREC Wave 3 T-E3) — a
  // class/interface's supertype (e.g. `extends JpaRepository<Charge, Long>`,
  // real Spring Data repository evidence), `referenceKind: 'extends'`.
  // 'structured-file' added in CONTRACT_VERSION 9.0.0 (T-Y4-1) — a real
  // path/method binding resolved from an infra template (CFN/SAM API
  // Gateway + Lambda Function join, cfn-manifest-provider.ts), matched to
  // its scanned handler unit by cfn-route-pass.ts. Same category
  // (http-entry-point) as native-route/decorator/openapi evidence — this
  // one carries a REAL path (unlike 'serverless-entry-point', which never
  // does), so it correctly participates in interface-building.
  // 'structured-config' added in CONTRACT_VERSION 10.0.0 (T-PC1-7,
  // B-spring-config) — a fact read directly from a deterministically
  // parsed `application.yml`/`.properties` file (spring-config-provider.ts),
  // matched to a semantic key this project's own mined vocabulary names
  // (`docs/solution/language/spring-config-property-vocabulary.md`). Unlike
  // every prior source, this one never touches CodeGraph's
  // extractFromSource()/decorates-ref API at all — a structured non-code
  // file read, same mechanism class as 'openapi'/'structured-file', not a
  // 5th extraction mechanism.
  // 'dependency-manifest' added in CONTRACT_VERSION 11.0.0 (T-CDX-2/3,
  // B-cdxgen-reuse) — a real component name/version from a deterministically
  // parsed CycloneDX SBOM (`@cyclonedx/cdxgen`, shelled out to the same way
  // Graphify already is), corroborating an ALREADY-detected persistence/
  // messaging unit — never a primary detection source on its own, always
  // weight-10 (corroboration tier), and only ever attached when exactly one
  // candidate unit exists in the root (never guessed under ambiguity).
  // No new source value added in CONTRACT_VERSION 12.0.0 (T-LM-2, resilience
  // lens) — retry annotations reuse the existing 'decorator' source (same
  // extractFromSource()/decorates-ref mechanism @PreAuthorize/@KafkaListener
  // already use) and timeout config reuses the existing 'structured-config'
  // source (same spring-config-provider.ts flat-key read datasource/broker
  // extraction already uses). Only Evidence.category gained a value.
  source: 'native-route' | 'decorator' | 'graphify-import' | 'openapi' | 'call' | 'field-type' | 'extends' | 'structured-file' | 'structured-config' | 'dependency-manifest';
  // 'serverless-entry-point' added in CONTRACT_VERSION 8.0.0 — a Lambda
  // handler's `implements RequestHandler` clause. Deliberately NOT the same category
  // as 'http-entry-point' even though it must win the same kind tie-break
  // (signal-mapper.ts treats both as decisive over persistence): real bug
  // found and fixed before shipping this — the raw signal TEXT here is a
  // type reference (`RequestHandler<...>`), not a path, and 'http-entry-point'
  // is also node-type-mapping.yml's interfaceCategories trigger for
  // `service`, so reusing it built a bogus path-interface from that type
  // reference. This category stays out of interfaceCategories (descriptive
  // only) until Y4 supplies a real path via CFN/SAM join.
  category:
    | 'http-entry-point'
    | 'framework-bootstrap'
    | 'persistence'
    | 'messaging'
    | 'folder-convention'
    | 'security-control'
    | 'serverless-entry-point'
    // 'spring-config' added in CONTRACT_VERSION 10.0.0 (T-PC1-7) — deliberately
    // descriptive-only (never added to any node-type-mapping.yml row's
    // interfaceCategories): the generic interface-builder.ts assumes a
    // route-shaped signal ("GET /path") for every category it builds
    // interfaces from, which a datasource URL/broker address/redis
    // host:port is not. `server.port` still becomes a real `tcp-host-port`
    // interface, but via a small dedicated function
    // (build-calm.ts's attachPortInterfaces), not this generic mechanism.
    | 'spring-config'
    // 'resilience' added in CONTRACT_VERSION 12.0.0 (T-LM-2, Lens Modules
    // lane) — a real, narrowly-scoped resilience-posture signal: a
    // retry-annotation (Spring Retry `@Retryable`, Resilience4j `@Retry`,
    // decorator-sourced) or a resilience4j timeout-duration config value
    // (structured-config-sourced). Deliberately descriptive-only, same as
    // 'spring-config' — never added to node-type-mapping.yml's
    // interfaceCategories (a retry annotation is not a route). Falls
    // through mapSignalsToUnits' kind-priority chain to the 'service'
    // default when it's the only evidence on a file, same precedent as a
    // security-control-only file (the proven DatatableWriteService shape).
    | 'resilience';
  weight: number;
  ref: string; // file:line for code-sourced evidence; "relativeFilePath:paths"-style pointer for openapi (no line numbers available from a parsed YAML/JSON document)
  /**
   * AREC Wave 3 T-D2 (C-rich) — additive OPTIONAL field (Contract_Evolution_Policy.md
   * §2(b), no separate bump beyond the source-union change above). The
   * evidence's own raw source-line argument/expression text when
   * extractable (e.g. "RESOURCE_NAME_FOR_PERMISSIONS" for a call-site
   * control, or a JAX-RS path segment for a decorator) — never a resolved
   * runtime VALUE, always the literal source text at that one line. Unset
   * when no argument was extractable (most evidence never sets this).
   */
  argument?: string;
}

/**
 * T-FS-6 (BACKLOG.md "Status vocabulary", BR-40) — fixed review-state
 * vocabulary, alongside (not replacing) the existing confidence/grade/band
 * scoring: 'observed' (direct high-confidence static evidence, no inference
 * hop) · 'inferred' (a deterministic rule or a multi-hop mechanism —
 * real, but one or more inference steps removed from direct evidence) ·
 * 'requires-review' (a genuine disagreement, ambiguity, or an unclassified
 * counterpart — a human must confirm) · 'reviewed' (human-confirmed via an
 * ACTIVE Decision Record/Override — the only status a formerly
 * requires-review fact can be promoted out of, set only by
 * override-applier.ts, never by any Analysis pass) · 'externally-verified'
 * (confirmed against an artifact independent of this run's own code
 * reading — a published API contract or a real deployed manifest, not a
 * static-analysis inference). Don't extend this vocabulary without a real
 * evidenced trigger for the new value — same discipline as any other
 * catalogue-adjacent enum in this codebase.
 *
 * Hard rule (not a heuristic, enforced in status-assignment.ts): a
 * `kind: 'unresolved'` unit — this pipeline's placeholder for a real call
 * site whose counterpart could not be classified into a real architectural
 * kind, the closest analog this model has to an "external system" whose
 * identity code evidence alone cannot confirm — never receives 'observed'
 * or 'externally-verified' from code evidence. It carries no Evidence at
 * all by construction, so this holds structurally, not just by convention;
 * status-assignment.ts still asserts it explicitly rather than leaving it
 * implicit.
 */
export type FactStatus = 'observed' | 'inferred' | 'requires-review' | 'reviewed' | 'externally-verified';

export interface TypedUnit {
  id: string; // stable id, derived from qualifiedName or file+line
  // 'topic' added in CONTRACT_VERSION 4.0.0 (T-X7-1) — executes the dry run
  // already rehearsed in Contract_Evolution_Policy.md §4 for real: a
  // message queue/topic (Kafka topic, JMS queue, SQS queue, SNS topic) is a
  // genuinely new architectural category, not a service or a database.
  kind: 'service' | 'database' | 'topic' | 'unresolved';
  name: string;
  filePath: string;
  startLine: number;
  endLine: number;
  evidence: Evidence[];
  confidence: number; // 0-100, weighted confidence bands
  // Additive OPTIONAL field (Contract_Evolution_Policy.md §2(b), no
  // CONTRACT_VERSION bump — not one of §1's tracked closed unions). Set by
  // status-assignment.ts (the true last Analysis pass) from this unit's own
  // already-computed kind/confidence/evidence — no new extraction. Bumped
  // to 'reviewed' only by override-applier.ts, strictly after Analysis, on
  // the CALM element this unit produced — Analysis itself never writes
  // 'reviewed', preserving the "Analysis concludes, Override corrects"
  // separation the Decision Record mechanism depends on.
  status?: FactStatus;
}

export interface TypedRelationship {
  from: string;
  to: string;
  // 'shares-secret' added in CONTRACT_VERSION 3.0.0 (T-X5-0) — a k8s
  // Secret/ConfigMap-mounted-by-both-deployments trust relationship is
  // architecturally distinct from a code-level calls/imports/connects edge
  // (implicit trust via a shared credential, not a network call or a static
  // import), so it gets its own named kind rather than being silently
  // folded into 'connects' — the exact "relationship vocabulary thin"
  // complaint this was named to fix, not perpetuate.
  kind: 'calls' | 'imports' | 'connects' | 'shares-secret';
  crossPackage: boolean;
  // 'k8s' added alongside 'shares-secret' in the same 3.0.0 bump — the k8s
  // manifest provider (scanner/k8s-manifest-provider.ts) is a third
  // relationship-evidence source, distinct from codegraph/graphify.
  source: 'codegraph' | 'graphify' | 'k8s';
  // T-X9-1 — additive OPTIONAL field (Contract_Evolution_Policy.md §2(b),
  // no CONTRACT_VERSION bump needed: an unknown optional field is harmless
  // to any existing module). Set only by the env soft-graph detector today
  // (low, fixed confidence for a name-correlation-inferred edge) — every
  // other relationship producer leaves it unset, which relationship-builder.ts
  // correctly treats as "no confidence claim," not zero.
  confidence?: number;
  // Additive OPTIONAL field (Contract_Evolution_Policy.md §2(b), no
  // CONTRACT_VERSION bump). Computed generically by analysis/relationship-grading.ts's
  // gradeRelationshipsPass (last pass in DEFAULT_PASSES, after every
  // relationship producer) from rel.kind + endpoint TypedUnit.kind — never
  // from a repo-specific name. 'structural': Graphify dual-unit edge with
  // neither endpoint a service (e.g. a reference Java/JAX-RS banking platform's entity<->entity mesh — real,
  // but not an "architecture" claim on its own, per the Claim Register's
  // dual-unit decision). 'architecture': at least one endpoint is a service
  // unit (R1 one-hop service->database/topic, or a real service->service
  // call/import). 'trust': kind === 'shares-secret' (implicit trust via a
  // shared credential, not a code-level edge). Always set by the time a run
  // completes — absence would only mean an older typed-facts.json predating
  // this field, never a live-run gap.
  grade?: 'structural' | 'architecture' | 'trust';
  // Additive OPTIONAL field (Contract_Evolution_Policy.md §2(b), no CONTRACT_VERSION bump).
  // Set only by multi-hop-bridge-detector.ts's branches, already
  // distinguishable by confidence value (15/10 / 8/5 / 6/3) but not
  // self-documenting — this makes "which branch produced this edge"
  // askable directly (coverage report, IR, a future query layer) without
  // hardcoding the confidence-value mapping. 'r2-phase1': the bridge's sole
  // implementer IS itself a database/topic unit (S-layered-access).
  // 'r2b': the implementer is not itself a store but imports exactly one
  // (S-layered-domain) — one inference hop deeper. 'r2c' (T-LR-2,
  // BACKLOG.md "Direct-delegate bridge detection") — no `implements`-based
  // interface layer at all; a concrete class referenced directly imports
  // exactly one store itself. Every other relationship producer
  // (R0/R1/k8s/env-soft-graph) leaves this unset — absence means "not
  // multi-hop-derived," never a fake default.
  // 'admitted-unresolved' added for T-P0-1 (E2, graded fact admission,
  // BACKLOG.md's "Graded fact admission (dual-unit gate)" row) — a raw
  // Graphify edge whose OTHER endpoint doesn't resolve to a real TypedUnit,
  // admitted with a synthesized `kind: 'unresolved'` placeholder unit on
  // that side instead of being silently dropped by
  // graphify-reconciler.ts's `if (!from || !to) continue`.
  // 'r2-stereotype' added for T-LR-3 (BACKLOG.md "Plain-interface bridge
  // detection") — a bridge with 2+ real `implements` candidates (previously
  // always refused as ambiguous) resolves when exactly ONE of them carries
  // real, catalogue-recognized `@Service` stereotype evidence
  // (spring-service-stereotype in signal-catalogue.yml) and the terminal
  // check (implementer IS itself a database/topic unit) also passes —
  // the same disambiguation-by-corroboration mechanism the CodeQL
  // DI-resolution experiment verified at real scale
  // (E1b-codeql-di-resolution-experiment.md's own "stereotype" mechanism).
  // Deliberately does NOT also chase the r2b store-import hop after
  // disambiguating — compounding an ambiguity-resolution step with a second
  // inferred hop in the same edge would stack two layers of inference
  // beyond what E1b's own evidence covers; 0 or 2+ stereotype-carrying
  // implementers still refuses, same "never guess" discipline as every
  // other branch. Not one of Contract_Evolution_Policy.md §1's tracked
  // closed unions (only Evidence.source/category, TypedUnit.kind,
  // TypedRelationship.kind, IgnoredItem.reason are) — this field is
  // advisory provenance no module's core logic branches on, so widening it
  // needs no CONTRACT_VERSION bump.
  mechanism?: 'r2-phase1' | 'r2b' | 'r2c' | 'r2-stereotype' | 'admitted-unresolved';
  // T-FS-6 — same FactStatus vocabulary and same status-assignment.ts /
  // override-applier.ts split as TypedUnit.status (see that field's own doc
  // comment). Additive OPTIONAL, no CONTRACT_VERSION bump.
  status?: FactStatus;
}

export interface IgnoredItem {
  ref: string;
  reason:
    | 'TEST_CODE'
    | 'GENERATED_CODE'
    | 'PURE_UTILITY'
    | 'AMBIGUOUS_BOUNDARY'
    | 'INSUFFICIENT_EVIDENCE'
    | 'EXCLUDED_BY_CONFIG'
    | 'CROSS_DOMAIN_UNRESOLVED'
    | 'OTHER';
  detail?: string;
}

// Versions the SHAPE of TypedFacts itself (this interface), separate from
// runVersion (which pins the signal-catalogue.yml content used for a given
// run). A module declares which contractVersions it supports
// (modules/registry.ts); the registry refuses to run a module against an
// incompatible shape rather than silently misfeeding it. Bump only on a
// breaking shape change to TypedUnit/TypedRelationship/Evidence/IgnoredItem.
//
// 2.0.0 (T-X4-1, Contract_Evolution_Policy.md §5): Evidence.source gained
// 'openapi' — a closed-union extension, tier (c). Both existing modules
// (calm-generator, threat-signals) were reviewed and bumped to
// supportedMajorVersion "2" (available-modules.ts) since neither needs
// code changes to keep working correctly against the new value —
// calm-generator's interface-builder already generalizes over Evidence.source
// via a precedence table (T-X4-2), threat-signals filters on category only.
//
// 3.0.0 (T-X5-0, Contract_Evolution_Policy.md §5): TypedRelationship.kind
// gained 'shares-secret', TypedRelationship.source gained 'k8s' — another
// closed-union extension, tier (c), for the k8s manifest provider (T-X5-1).
// Both modules reviewed again and bumped to supportedMajorVersion "3":
// calm-generator's relationship-builder.ts needed no code change (the
// generic `${rel.kind} relationship (...)` description and the
// catalogue-driven relationship-type-mapping.yml lookup both already
// generalize over TypedRelationship.kind); threat-signals is unaffected
// (it inspects Evidence.category on units, never touches relationships).
//
// 4.0.0 (T-X7-1, Contract_Evolution_Policy.md §5): TypedUnit.kind gained
// 'topic' — the exact dry run §4 rehearsed, executed for real. Sequencing
// followed §4's own note precisely: the node-type-mapping.yml row
// (unitKind: topic -> calmNodeType: network) was added in the SAME change
// as this bump, before calm-generator's supportedMajorVersion was raised —
// not after. Both modules reviewed and bumped to supportedMajorVersion
// "4": calm-generator needed the new mapping row (now present);
// threat-signals needed no change (filters on Evidence.category, which is
// unaffected — 'messaging' already existed in the category union).
//
// 5.0.0 (AREC Wave 3 T-D1, Contract_Evolution_Policy.md §5): Evidence.source
// gained 'call' — another closed-union extension, tier (c), for call-site
// security-control detection (control-builder's DatatableWriteService-class
// finding extended from decorator-only to call-site-capable). Both modules
// reviewed and bumped to supportedMajorVersion "5": calm-generator's
// control-builder.ts filters on `Evidence.category === 'security-control'`
// only, never on `.source` — needed no code change; threat-signals filters
// on category only too, same as every prior bump. `Evidence.argument?:
// string` (same change) is additive-optional, tier (b), no separate bump.
//
// 6.0.0 (AREC Wave 3 T-E1, Contract_Evolution_Policy.md §5): Evidence.source
// gained 'field-type' — another closed-union extension, tier (c), for the
// messaging-producer typed-field detection (KafkaTemplate field type).
// Both modules reviewed and bumped to supportedMajorVersion "6":
// calm-generator's control-builder.ts/interface-builder.ts filter on
// category/precedence-table, both already generalize (interface-builder's
// SOURCE_PRECEDENCE table gained a 'field-type' entry, same as 'call' did);
// threat-signals filters on category only, unaffected.
//
// 7.0.0 (AREC Wave 3 T-E3, Contract_Evolution_Policy.md §5): Evidence.source
// gained 'extends' — another closed-union extension, tier (c), for
// Spring Data repository detection (`extends JpaRepository<...>`). Both
// modules reviewed and bumped to supportedMajorVersion "7": calm-generator's
// interface-builder.ts SOURCE_PRECEDENCE table gained the new key in the
// same change, before this bump; control-builder.ts/threat-signals filter
// on category, unaffected.
//
// 10.0.0 (T-PC1-7, B-spring-config, Contract_Evolution_Policy.md §5):
// Evidence.source gained 'structured-config', Evidence.category gained
// 'spring-config' — a closed-union extension, tier (c), for the new
// scanner/spring-config-provider.ts + analysis/spring-config-pass.ts. Both
// modules reviewed and bumped to supportedMajorVersion "10": calm-generator
// needed one real, new (not just additive) piece of logic —
// build-calm.ts's attachPortInterfaces, since interface-builder.ts's
// existing generic mechanism assumes a route-shaped signal every category
// it already handles has, which spring-config's facts are not;
// threat-signals filters on category only ('http-entry-point'/
// 'security-control'), unaffected by a new, unrelated category value.
//
// 11.0.0 (T-CDX-2/3, B-cdxgen-reuse, Contract_Evolution_Policy.md §5):
// Evidence.source gained 'dependency-manifest' — a closed-union extension,
// tier (c), for scanner/cdxgen-provider.ts + analysis/cdxgen-corroboration-pass.ts.
// No new Evidence.category (reuses the existing 'persistence'/'messaging'
// values — this genuinely IS persistence/messaging evidence, just from a
// third mechanism, corroboration-weight-10 only). Both modules reviewed and
// bumped to supportedMajorVersion "11": calm-generator's interface-builder.ts
// SOURCE_PRECEDENCE table gained the new key (never contributes interfaces,
// ordered last like every other non-route-shaped source); threat-signals
// filters on category only, unaffected by a new source value on an
// already-existing category.
//
// 12.0.0 (T-LM-2, Lens Modules lane, AGENT_TASKS_Ext_Lens_Modules.md):
// Evidence.category gained 'resilience' — a closed-union extension, tier
// (c), for the new resilience-lens module. No new Evidence.source (reuses
// 'decorator' for retry annotations and 'structured-config' for timeout
// values — both already-proven mechanisms, no third extraction path).
// Both existing modules reviewed and bumped to supportedMajorVersion "12":
// calm-generator's control-builder.ts filters on
// `category === 'security-control'` only (unaffected); interface-builder.ts
// never treats 'resilience' as route-shaped (not added to
// node-type-mapping.yml's interfaceCategories, same as 'spring-config');
// threat-signals filters on 'http-entry-point'/'security-control' only
// (unaffected).
export const CONTRACT_VERSION = '12.0.0';

export interface TypedFacts {
  contractVersion: string; // this TypedFacts SHAPE's version — see CONTRACT_VERSION
  runVersion: string; // pins the signal-catalogue.yml version used for this run
  generatedAt: string;
  packageRoots: string[];
  units: TypedUnit[];
  relationships: TypedRelationship[];
  ignoredItems: IgnoredItem[];
}
