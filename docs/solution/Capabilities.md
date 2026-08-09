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
| Module registry + `--modules` flag | Built | Modules declare a supported contract major version; an incompatible module is skipped, a throwing module doesn't stop the others |
| CALM generator module | Built | Builders (node/interface/relationship/control/metadata) + override-applier |
| Second module (threat-signals) | Built | Proves the module boundary holds using only the typed-facts contract |
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
| Messaging: cloud-native producers (SQS/SNS) | Built | |
| Platform intermediate representation (IR) | Built (MVP scope) | Renders a human-readable markdown view from typed facts + real generated output; redacts sensitive snippet content |
| Relationship-add/-remove overrides | Built | Decision-Record-gated; dangling-endpoint and duplicate-id rejected |
| Orphan/stale override detection | Built | A Decision Record pointing at a since-renamed/removed target is classified and reported separately from other rejections |
| Multi-root cross-package relationship detection | Built | A single combined structural pass across all given roots — required for cross-module edges to be possible at all |
| Multi-hop architecture bridges (API → access-layer implementer → store) | Built (bounded) | Fixed, small hop bound by design — unbounded traversal risks connecting unrelated units through an accidental long chain |
| Silence / completeness signal flags | Built | Flags when a service has HTTP-entry evidence but no security-control evidence, and other named completeness gaps, so an empty result reads as "checked, found nothing" rather than "not checked" |

## Governance & process docs worth knowing about

- **[`Claim_Register.md`](./Claim_Register.md)** — authoritative on what completeness claims are allowed; prefer it over any other doc when they disagree.
- **[`OOS_Registry.md`](./OOS_Registry.md)** — permanent and long-horizon non-goals, each with a reason and a revisit trigger, so a deliberate scope decision doesn't silently get "discovered" as a gap later.
- **[`Contract_Evolution_Policy.md`](./Contract_Evolution_Policy.md)** — when a change requires bumping the typed-facts contract version vs. when it doesn't.
- **[`Catalogue_Intake.md`](./Catalogue_Intake.md)** — the process for adding a new detection catalogue row (evidence required, test required, claim-register entry required).
- **[`Module_Authoring_Guide.md`](./Module_Authoring_Guide.md)** — how to add a new module against the typed-facts contract.
