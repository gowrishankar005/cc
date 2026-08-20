# Weaver — Capabilities

Single reference for what is **built**, **partial**, or **backlog**. For scope (what Weaver is required to do), see [`../Requirements.md`](../Requirements.md). For what completeness claims are allowed about relationship/control coverage, see [`Claim_Register.md`](./Claim_Register.md).

## Product framing

| | |
|---|---|
| **Weaver is for** | Polyglot enterprise monorepos (Java / Python / Node) that need deterministic architecture extraction into CALM |
| **Weaver is not for** | A single small OSS app, one company's specific stack, or LLM-generated architecture |
| **Completeness claims** | Governed by `Claim_Register.md` — a high confidence score on what *was* found never implies the whole architecture story is complete |

## Platform

| Capability | Status | Notes |
|---|---|---|
| Typed-facts contract (`contractVersion`) | Built | Versions the shape of the Scanner→Analysis contract, separate from catalogue-content versioning |
| Fact identity scheme (T-CL-1) | Built | `TypedUnit.id` audited as already content-derived per-producer (never file:line, never a run-scoped counter); `TypedRelationship.id` added (`kind\|from\|to\|mechanism-or-source`), replacing a real run-scoped-counter bug in `relationship-builder.ts`'s old CALM `unique-id`. Foundational for incremental merge (T-CL-2, not yet built) and review history (T-CL-3, not yet built) — see `Claim_Register.md`'s `T-CL-1-fact-identity` row |
| Module registry + `--modules` flag | Built | Modules declare a supported contract major version; an incompatible module is skipped, a throwing module doesn't stop the others |
| CALM generator module | Built | Builders (node/interface/relationship/control/metadata) + override-applier |
| Second module (threat-signals) | Built | Proves the module boundary holds using only the typed-facts contract |
| Third module (resilience-lens) | Built (narrow) | Retry-annotation (Spring Retry `@Retryable`, Resilience4j `@Retry`) + timeout-config (`resilience4j.timelimiter.*.timeout-duration`) detection only, deliberately not "resilience" scoped whole — proves a second lens module can be added without touching Scanner/Rules/Analysis/CALM generator. `CONTRACT_VERSION` 12.0.0. Gold+scorer built alongside, per `Claim_Register.md`'s `resilience-lens` row for the full disclosure of what's out of scope (circuit-breaker/bulkhead, non-Java retry, code-only handling) |
| Per-module fitness declaration (BR-110) | Built | `modules/fitness.ts`'s `loadModuleFitness()` — a generic mechanism (proven by 2 real callers, threat-signals + resilience-lens), reads a checked-in `fitness.json` per module and attaches it to that module's own report JSON. Deliberately never computed live against gold at run time (CoE Lab isolation/CON-40). Absent/malformed defaults to an honest `not-yet-fit-to-gate`, never an error or a fake pass. See `Claim_Register.md`'s Module fitness section |
| Namespaced module outputs | Built | Each module writes under its own output folder; CALM output also gets a top-level copy for compatibility |
| Signal catalogue + construct-mapping catalogues | Built | New detection coverage is a data row, not new code, for anything the existing extraction mechanisms already cover |
| Control catalogue + builder | Built | Node/relationship/document-level `controls` with local requirement-file resolution |
| `connects`/`interacts` relationship shapes | Built | Regression-locked |
| Analysis pass registry | Built | Orchestration sequence is data (a pass list), not a hardcoded call chain |
| Route-composer registry | Built | Per-language route-assembly plugins (JAX-RS composed-route assembly is the reference implementation) |
| Engine capability matrix | Built (stub routing) | Loaded/validated; full dynamic multi-engine swap not yet wired |
| Persistence strategy catalogue | Partial | Driver-import + JPA `@Entity` + Spring Data + jOOQ dispatched; a small number of driver libraries remain plain-import only |
| Decision Record / Override apply | Partial | Node add/type-change/remove/rename + relationship add/remove (connects shape) built; boundary-change overrides not yet built |
| Regression suite | Built | Exact-value assertions against real fixtures, not smoke tests; sample-repo-dependent tests skip gracefully when the sample isn't present locally |
| Kubernetes manifest provider (shared-secret trust relationships) | Built | Flat/pre-rendered YAML only; Secret/ConfigMap *names* only, never values |
| OpenAPI/Swagger ingestion | Built | Routes + security schemes; no line-number provenance (structural pointer only) since YAML/JSON parsing here doesn't preserve source positions |
| Spring config file provider (`application.yml`/`.properties`) | Built | Deterministic reader; datasource/broker/cache detection, `server.port` → formal interface, JDBC protocol population |
| Dependency-manifest corroboration (via a real SBOM tool) | Built (partial) | Raises confidence on an already-detected unit; never a primary detection source. Container/compose facts not yet wired |
| Third-party plugin discovery / embed API | Backlog | Module boundary exists; discovery and an external embed API do not |
| Two-tier (global + domain) mapping config | Backlog | |
| Kubernetes-manifest-derived `deployed-in` relationships | Backlog | Trust relationships (shared secrets) are built; runtime-placement relationships are not |

## Extraction & analysis

| Capability | Status | Notes |
|---|---|---|
| Coverage / unmapped-signal reporting | Built | Per-run visibility into what wasn't detected and why |
| Strict-detect quality gate (`--strict-detect`) | Built | Exits non-zero when routes were expected but zero were found |
| Persistence enrichment (cloud SDK clients) | Built | AWS SDK persistence-client detection |
| Messaging: cloud-native producers (SQS/SNS) | Built | Import-only SQS/SNS + KafkaTemplate field-type. A bare stereotype + messaging import is one node (replace-not-duplicate), same mechanism as persistence |
| Platform intermediate representation (IR) | Built (MVP scope) | Renders a human-readable markdown view from typed facts + real generated output; redacts sensitive snippet content |
| Relationship-add/-remove overrides | Built | Decision-Record-gated; dangling-endpoint and duplicate-id rejected |
| Orphan/stale override detection | Built | A Decision Record pointing at a since-renamed/removed target is classified and reported separately from other rejections |
| Multi-root cross-package relationship detection | Built | A single combined structural pass across all given roots — required for cross-module edges to be possible at all |
| Multi-hop architecture bridges (API → access-layer implementer → store) | Built (bounded) | Fixed, small hop bound by design — unbounded traversal risks connecting unrelated units through an accidental long chain. Four branches: Phase 1 (implementer is itself a store), R2b (implementer imports exactly one store), R2c (a concrete class referenced directly, no interface layer, itself imports exactly one store), R2-stereotype (2+ real `implements` candidates disambiguated when exactly one carries a catalogued stereotype and is itself a store). Every branch refuses rather than guesses under genuine ambiguity — see `Claim_Register.md`'s `R2-mechanism` row for real-evidence detail per branch |
| CodeQL DI-resolution engine (opt-in, T-LR-5) | Built (DI resolution only, local-only) | `--codeql-source-root`/`--codeql-build-command` — resolves a Spring interface field to its real implementation via a `@Bean`-factory method or a stereotype-disambiguated 2+-candidate interface, shapes neither CodeGraph nor Graphify can see at all. Real, non-trivial cost (a real compile + CodeQL database build); registered in `DEFAULT_PASSES` as a no-op unless both flags are set — never a default-on path, never in this pipeline's own CI (free-tier CodeQL license doesn't permit CI use against a non-Open-Source codebase). Command-bus dispatch (the other measured CodeQL gap) not shipped. See `Claim_Register.md`'s `T-LR-5-codeql-di` row |
| Tier-B residual review routing | Built (synthetic-evidenced; real-repo negative-path verified) | A multi-hop bridge with 2+ syntactic implementers where exactly one is itself a real store unit is routed to a distinct, always-on review-queue trigger (not the generic ambiguity refusal) — never auto-emits a relationship. See `Claim_Register.md`'s `T-FS-1-tier-b-residual` row: checked against 4 real repos, 0 real positive instances found, one informative real negative (a 126-implementer marker interface correctly not misclassified) |
| Contradiction detection between evidence sources | Built (Java/Spring-config-only) | Detects a real k8s Deployment manifest's container image (opt-in, `--k8s-manifests`) naming a DIFFERENT datastore engine than a Spring-config-sourced unit's own JDBC scheme — writes a distinguishable ignored-item and forces an always-on Tier A review trigger; never averages or silently picks one source. See `Claim_Register.md`'s `T-FS-3-contradiction-detection` row |
| Status vocabulary (BR-40) | Built | `TypedUnit.status`/`TypedRelationship.status`: `observed`/`inferred`/`requires-review`/`reviewed`/`externally-verified`, derived deterministically from confidence band, evidence source, and relationship mechanism — no new extraction. Hard rule: this pipeline's closest analog to "external system" (a `kind: 'unresolved'` unit) never auto-promotes to `observed`/`externally-verified` from code evidence alone. `reviewed` is set only by `override-applier.ts` on a human-confirmed element. Surfaced as `x-aac-status` in CALM node/relationship metadata. See `Claim_Register.md`'s `T-FS-6-status-vocabulary` row |
| Secondary-source fact introduction | Built | `cdxgen-corroboration-pass.ts`: a real, unambiguous cdxgen SBOM match with zero code-derived unit to corroborate now introduces a new unit at its own weight-10 tier instead of staying mute (still refuses to guess under 2+ real matches). Never promoted past that tier — a unit introduced this way always reads `requires-review` (T-FS-6's own hard rule). See `Claim_Register.md`'s `T-FS-4-secondary-source-introduction` row |
| Silence / completeness signal flags | Built | Flags when a service has HTTP-entry evidence but no security-control evidence, and other named completeness gaps, so an empty result reads as "checked, found nothing" rather than "not checked" |
| Confidence-floor unit-set consistency | Built | `mapSignalsPass` writes the same floor-filtered set to `unitsByRoot` (relationship producers) and `allUnits` (grading + emission). Sub-floor units are IgnoredItems only — they cannot anchor a relationship |

## Governance & process docs worth knowing about

- **[`Claim_Register.md`](./Claim_Register.md)** — authoritative on what completeness claims are allowed; prefer it over any other doc when they disagree.
- **[`OOS_Registry.md`](./OOS_Registry.md)** — permanent and long-horizon non-goals, each with a reason and a revisit trigger, so a deliberate scope decision doesn't silently get "discovered" as a gap later.
- **[`Contract_Evolution_Policy.md`](./Contract_Evolution_Policy.md)** — when a change requires bumping the typed-facts contract version vs. when it doesn't.
- **[`Catalogue_Intake.md`](./Catalogue_Intake.md)** — the process for adding a new detection catalogue row (evidence required, test required, claim-register entry required).
- **[`Module_Authoring_Guide.md`](./Module_Authoring_Guide.md)** — how to add a new module against the typed-facts contract.
