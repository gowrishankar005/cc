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
  source: 'native-route' | 'decorator' | 'graphify-import' | 'openapi' | 'call' | 'field-type' | 'extends' | 'structured-file' | 'structured-config' | 'dependency-manifest' | 'codeql-di';
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

/**
 * CONTRACT_VERSION 14.0.0 (T-CL-4) — construction-time placeholder for
 * TypedUnit.status/TypedRelationship.status, now a REQUIRED field. Every
 * unit/relationship a real run produces gets its REAL status from
 * status-assignment.ts's assignStatusPass, unconditionally, as the true
 * last DEFAULT_PASSES entry (see TypedUnit.status's own doc comment) —
 * nothing reads a unit's/relationship's status before that pass overwrites
 * this placeholder, so its specific value here is never observable.
 */
export const PENDING_STATUS: FactStatus = 'inferred';

/**
 * CONTRACT_VERSION 14.0.0 (T-CL-4) — construction-time placeholder for
 * TypedRelationship.id, now a REQUIRED field. fact-identity.ts's
 * assignFactIds (analysis/passes.ts's factIdentityPass) unconditionally
 * overwrites every relationship's id from its own semantic coordinates, as
 * the true last relationship-producing DEFAULT_PASSES entry — nothing reads
 * a relationship's id before that pass overwrites this placeholder.
 */
export const PENDING_RELATIONSHIP_ID = '';

export interface TypedUnit {
  // T-CL-1 (BACKLOG.md "Fact identity, incremental merge, and review
  // history") — every existing producer already derives this from semantic
  // coordinates, never a file:line span or a run-scoped counter, so this
  // field needed no shape change, only this comment correcting a stale
  // claim ("derived from qualifiedName or file+line" — line was never
  // actually part of it). mapSignalsToUnits: the unit's own filePath
  // (Slice-1 granularity, one file == one unit). Synthetic-unit producers
  // each add their own discriminator to stay content-derived: cdxgen
  // corroboration (`cdxgen:<root>:<matchName>`), spring-config
  // (`<fileKey>::<suffix>`), Graphify cross-package import strategy
  // (`<relativeFilePath>::<className>`), codeql-di (`codeql-di:<root>:<relativeFilePath>`),
  // and the graded-fact-admission unresolved-endpoint placeholder
  // (`unresolved:<graphifyNodeId>` — verified 2026-08-20 against a real
  // `graphify extract` two-run diff that graphifyy's own `_make_id` is
  // content-derived from the symbol's file+name, not a counter, so this is
  // safe to key on directly). A file rename changes this id; the old id
  // simply stops appearing in a later run's TypedFacts — T-CL-2's merge
  // reads that as a disappeared fact plus a new one, not a bug to work
  // around here.
  id: string;
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
  // REQUIRED as of CONTRACT_VERSION 14.0.0 (T-CL-4, Contract_Evolution_Policy.md
  // §2(c) — promoting an existing optional field to required is a real
  // shape guarantee, not cosmetic). Previously `status?:` (T-FS-6,
  // additive-optional, tier (b)) — promoted once `assignStatusPass`
  // (status-assignment.ts) was confirmed the unconditional true-last
  // DEFAULT_PASSES entry (analysis/passes.ts), so every unit a real run
  // produces always carries one; a module can now rely on `status` being
  // present instead of checking for absence. Set by status-assignment.ts
  // from this unit's own already-computed kind/confidence/evidence — no new
  // extraction. Bumped to 'reviewed' only by override-applier.ts, strictly
  // after Analysis, on the CALM element this unit produced — Analysis
  // itself never writes 'reviewed', preserving the "Analysis concludes,
  // Override corrects" separation the Decision Record mechanism depends on.
  status: FactStatus;
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
  // 'deployed-in' added in CONTRACT_VERSION 15.0.0 (T-MR-3, BACKLOG.md
  // "Kubernetes-manifest-derived deployed-in relationships") — runtime
  // PLACEMENT (which namespace a service actually runs in), the other half
  // of what the k8s manifest provider already reads; shares-secret (T-X5-1)
  // is the trust half. `rel.to` is a synthetic namespace-node id
  // (`k8s-namespace:<namespace>`, modules/calm-generator/k8s-namespace-node-builder.ts)
  // built directly as a CALM node the same way system-node-builder.ts's
  // synthetic system node is — never a TypedUnit, since a k8s namespace has
  // no source file to attribute one to.
  kind: 'calls' | 'imports' | 'connects' | 'shares-secret' | 'deployed-in';
  crossPackage: boolean;
  // 'k8s' added alongside 'shares-secret' in the same 3.0.0 bump — the k8s
  // manifest provider (scanner/k8s-manifest-provider.ts) is a third
  // relationship-evidence source, distinct from codegraph/graphify.
  // 'repo-manifest' added in CONTRACT_VERSION 16.0.0 (T-MR-2,
  // AGENT_TASKS_Ext_MultiRepo_Deployment.md) — a ranked cross-repo join
  // resolved against another repo's human-authored T-MR-1 manifest
  // (scanner/repo-manifest-provider.ts), never against this run's own
  // scanned code. Both endpoints are synthetic (never a real TypedUnit —
  // neither this repo's own anchor nor the other repo's published contract
  // has a file this run indexed), same "no source file, build the CALM node
  // directly" pattern k8s-namespace-node-builder.ts already established.
  source: 'codegraph' | 'graphify' | 'k8s' | 'codeql' | 'repo-manifest';
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
  // shared credential, not a code-level edge). 'structural' also covers
  // kind === 'deployed-in' (T-MR-3) — a real, verified k8s namespace-placement
  // fact, but not a service->store/service connectivity claim, so it must
  // never satisfy coverage-report.ts's/hitl-review-trigger.ts's own
  // `grade === 'architecture'` filters (both documented as meaning
  // specifically R1/R2, "never structural/trust") — a service whose only
  // relationship is where it runs, not who it talks to, must still count as
  // having zero real architecture-grade outbound coverage. Always set by the
  // time a run completes — absence would only mean an older typed-facts.json
  // predating this field, never a live-run gap.
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
  // 'codeql-di-bean-factory' / 'codeql-di-stereotype' added for T-LR-5
  // (AGENT_TASKS_Ext_CodeQL_Engine.md) — codeql-di-pass.ts's two branches,
  // matching di_resolution.ql's own 'mechanism' column exactly: a
  // @Bean-factory-wired interface->impl binding, or a stereotype-resolved
  // one CodeQL's whole-database join found but this pipeline's own
  // Graphify-based r2-stereotype/r2c branches did not reach (different
  // reach, not a duplicate of those mechanisms — trust-tier-gated,
  // codeql-di-pass.ts never overrides an edge an earlier mechanism already
  // produced for the same pair).
  // 'codeql-command-dispatch' added for #18 (codeql-command-dispatch-pass.ts)
  // — a real registration/lookup string-keyed join, structurally distinct
  // from the DI mechanisms above (a dispatcher/handler join, not an
  // interface/impl resolution), same trust-tier/never-override discipline.
  // 'cross-repo-api-spec' / 'cross-repo-artifact' / 'cross-repo-service-catalogue'
  // added for T-MR-2 (cross-repo-join-detector.ts) — the three ranked
  // reliability tiers, named in the same order: a shared OpenAPI/AsyncAPI
  // spec title, a published artifact coordinate, or a service-catalogue
  // name/DNS match (the weakest tier — see repo-manifest-provider.ts's
  // ServiceCatalogueIdentity doc comment for why it's still never promoted
  // above 'requires-review'). Like every other value in this field, not one
  // of Contract_Evolution_Policy.md §1's tracked closed unions (advisory
  // provenance only) — no CONTRACT_VERSION bump for this addition;
  // TypedRelationship.source gaining 'repo-manifest' is the real (c)-tier
  // change for T-MR-2.
  mechanism?:
    | 'r2-phase1'
    | 'r2b'
    | 'r2c'
    | 'r2-stereotype'
    | 'admitted-unresolved'
    | 'codeql-di-bean-factory'
    | 'codeql-di-stereotype'
    | 'codeql-command-dispatch'
    | 'cross-repo-api-spec'
    | 'cross-repo-artifact'
    | 'cross-repo-service-catalogue';
  // REQUIRED as of CONTRACT_VERSION 14.0.0 (T-CL-4) — same promotion
  // reasoning as TypedUnit.status above: previously `status?:` (T-FS-6,
  // tier (b)), promoted once `assignStatusPass` was confirmed unconditional
  // in DEFAULT_PASSES for every relationship a real run produces. Same
  // status-assignment.ts / override-applier.ts split as TypedUnit.status.
  status: FactStatus;
  // REQUIRED as of CONTRACT_VERSION 14.0.0 (T-CL-4) — previously `id?:`
  // (T-CL-1, tier (b)), promoted once `factIdentityPass` (analysis/passes.ts,
  // after every relationship producer including gradeRelationshipsPass) was
  // confirmed unconditional in DEFAULT_PASSES, and once T-CL-2's incremental
  // merge started depending on every relationship actually carrying one to
  // key its prior/fresh matching on. Computed by fact-identity.ts's
  // assignFactIds from this relationship's own semantic coordinates: kind
  // (fact type) + from/to (endpoint identities, themselves stable
  // TypedUnit.id values) + mechanism-or-source (discriminator — mechanism
  // when a specialized detector set one, otherwise source, so e.g. a plain
  // graphify reconcile edge and a multi-hop-bridge-detector edge between the
  // same two units never collide even though kind/from/to alone would).
  // relationship-builder.ts reuses this id directly as the CALM `unique-id`.
  id: string;
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
// 13.0.0 (T-LR-5, AGENT_TASKS_Ext_CodeQL_Engine.md): Evidence.source gained
// 'codeql-di' and TypedRelationship.source gained 'codeql' — both closed-union
// extensions, tier (c), for the new codeql-di-provider.ts + codeql-di-pass.ts.
// A second real StructuralEngine-class source (CodeQL's Java data-flow
// analysis), not a Graphify/CodeGraph variant: it resolves a Spring interface
// field to its real implementation via two mechanisms neither existing engine
// can see at all (bean-factory wiring, stereotype-annotated implementers with
// 2+ syntactic candidates) — see E1b-codeql-di-resolution-experiment.md.
// 'codeql-di' Evidence.source is used ONLY when codeql-di-pass.ts introduces
// a placeholder unit for a resolved implementation class with no existing
// TypedUnit (same "secondary source introduces a fact at its own tier"
// pattern T-FS-4 established for dependency-manifest evidence — see
// status-assignment.ts's hard rule, generalized to cover this source too).
// Both existing modules + resilience-lens reviewed and bumped to
// supportedMajorVersion "13": none filter on TypedRelationship.source or
// Evidence.source in a way a new value could silently break (calm-generator's
// interface-builder.ts SOURCE_PRECEDENCE table gained 'codeql-di', ordered
// last like every other non-route-shaped source; relationship-builder.ts
// treats TypedRelationship.source as pass-through provenance metadata only).
// 14.0.0 (T-CL-4, AGENT_TASKS_Ext_Contract_Lifecycle.md, Contract_Evolution_Policy.md
// §2(c)): TypedUnit.status, TypedRelationship.status, and TypedRelationship.id
// promoted from optional to REQUIRED — a new-required-field change, tier (c),
// not a closed-union extension. Real, not cosmetic: status-assignment.ts's
// assignStatusPass and fact-identity.ts's factIdentityPass (via
// analysis/passes.ts's factIdentityPass entry) are both unconditional,
// always-last DEFAULT_PASSES entries — every unit/relationship a real run
// produces has always carried both fields since T-FS-6/T-CL-1 shipped, this
// bump only makes that guarantee visible in the type itself, and (per T-CL-2)
// gives incremental-merge.ts's id-keyed matching something the contract
// itself promises will be present, not just a per-producer convention. Every
// existing module reviewed and bumped to supportedMajorVersion "14": none
// ever branched on the ABSENCE of `status`/`id` (calm-generator's
// relationship-builder.ts's own `rel.id ?? computeRelationshipId(rel)`
// fallback and `rel.status !== undefined` metadata guard both still compile
// and behave identically against a value that's now always defined;
// threat-signals/resilience-lens filter on Evidence.category only, never
// touch TypedUnit.status/TypedRelationship.id/.status at all).
//
// 15.0.0 (T-MR-3, AGENT_TASKS_Ext_MultiRepo_Deployment.md, BACKLOG.md
// "Kubernetes-manifest-derived deployed-in relationships"): TypedRelationship.kind
// gained 'deployed-in' — a closed-union extension, tier (c). Runtime
// placement (which k8s namespace a service actually runs in), the
// documented-but-unbuilt other half of the k8s manifest provider — see
// Architecture_as_Code_Solution_Design_v2.md §14.1's "Closed here" decision:
// the namespace becomes a real `node-type: system` CALM node, with
// `deployed-in` relationships from each service to it, built by
// analysis/cross_package/k8s-deployment-detector.ts +
// modules/calm-generator/k8s-namespace-node-builder.ts. Every existing
// module reviewed and bumped to supportedMajorVersion "15": calm-generator's
// relationship-type-mapping.yml gained the new row (relationship-builder.ts's
// `case 'deployed-in':` branch was already written, just unreachable until
// now); threat-signals/resilience-lens filter on Evidence.category only,
// never touch TypedRelationship.kind, unaffected by a new value.
//
// 16.0.0 (T-MR-2, AGENT_TASKS_Ext_MultiRepo_Deployment.md, BACKLOG.md
// "Cross-repo relationship resolution (beyond co-scanned roots)"):
// TypedRelationship.source gained 'repo-manifest' — a closed-union
// extension, tier (c). A ranked, never-guessed join against another repo's
// T-MR-1 manifest (scanner/repo-manifest-provider.ts): shared API-spec
// identity -> published artifact coordinates -> service-catalogue/DNS,
// strictly in that order, each tier only tried once the one before it
// failed to resolve (analysis/cross_package/cross-repo-join-detector.ts).
// Both endpoints are synthetic 'system'-node-type CALM nodes (never a
// TypedUnit — neither side has a file this run indexed), built directly by
// modules/calm-generator/external-repo-node-builder.ts, same "no source
// file" pattern k8s-namespace-node-builder.ts (T-MR-3) already established.
// Every relationship this mechanism produces is capped at
// status: 'requires-review' regardless of which tier resolved it
// (status-assignment.ts) and grade: 'structural', never 'architecture'
// (relationship-grading.ts) — this task's own acceptance text ("never infer
// a cross-repo edge from naming alone — review status at best") is honored
// as an absolute cap on the whole mechanism, not just the weakest tier.
// All three modules reviewed and bumped to supportedMajorVersion "16":
// calm-generator's relationship-builder.ts needed no code change (the
// `connects` kind + the existing `default: connects` fallback in
// relationship-type-mapping.yml already resolve a 'system'->'system' pair,
// confirmed by adding an explicit row rather than relying on the fallback
// silently); threat-signals/resilience-lens filter on Evidence.category
// only, never touch TypedRelationship.source, unaffected.
export const CONTRACT_VERSION = '16.0.0';

export interface TypedFacts {
  contractVersion: string; // this TypedFacts SHAPE's version — see CONTRACT_VERSION
  runVersion: string; // pins the signal-catalogue.yml version used for this run
  generatedAt: string;
  packageRoots: string[];
  units: TypedUnit[];
  relationships: TypedRelationship[];
  ignoredItems: IgnoredItem[];
}
