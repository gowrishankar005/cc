# Architecture-as-Code — Java Solution Design (Slice 2, Fidelity-Baselined)

**Status: Phase 1 approach LOCKED, proven beyond the original spike.** §1.6's route-composition finding and §1.7's full-module Fineract run (823 files, then 6,781 for the cross-package test in `CLAUDE.md`) both hold. The phasing bet (source-only before build-dependent tooling) is now doubly justified: it delivered real routes, real persistence, real controls, *and* real cross-package edges — the last one only by fixing how Graphify itself is invoked (one combined pass per run, not one pass per root; see `CLAUDE.md`'s pipeline-architecture section), not by needing CodeQL/scip-java at all. Phase 2 (CodeQL/scip-java) remains genuinely deferred — nothing found this session created a new trigger for it. **Still open, unchanged**: Spring Data repository/jOOQ persistence strategies (§3.1's table), OpenAPI ingestion, and full 7,000+-file efficiency validation for the whole pipeline (the 96-second full-Fineract number is for the Graphify scan alone, not an end-to-end run at that scale).

**Authority rule** (per `docs/solution/Architecture_as_Code_Solution_Design_v2.md` §0 and `docs/spikes/Solution_Design_v2_Critical_Review.md` §3): this document is authoritative for **Slice 2 Java sequencing and Phase 1/2 engine choice**. The platform root (`Architecture_as_Code_Solution_Design_v2.md`) is authoritative for platform contracts and the CALM construction pattern. Where the two conflict, this document wins for Java engine sequencing, and the platform root's `engine-capability-matrix.yml` snippet is kept in sync with this doc, not the reverse.

**Status of the rest:** Solution design for Slice 2 (Java), companion to `Architecture_as_Code_Solution_Design_v2.md` — extends it, does not supersede it. Everything in v2 (two-goal framing, three construct-mapping catalogues, six builders, IR layer, LLM advisory layer, override flow) holds unchanged; this document adds the Java-specific engine strategy, the Fidelity-stack coverage plan, and the efficiency measures the Java target actually needs.

**Baseline:** Fidelity Investments' technology stack (`docs/requirements/CALM_Generator_Requirements_v0_14.md`, `memory/fidelity_fintech_evidence.md`) is the yardstick — Java/Spring Boot core, MongoDB/PostgreSQL/DynamoDB, SQS/SNS/Kafka messaging, OAuth2, static Swagger/OpenAPI, cloud-native deployment. Evidence repos remain the public proxies (Fineract, Waltz, CALM Hub) with Fidelity's stack as the design target.

---

## 0. Decisions locked this round (the four answers that shaped this doc)

| Decision | Answer | Consequence for this design |
|---|---|---|
| **Runtime environment for Java** | **Full build available, but deliberately deferred to Phase 2** (revised, see §1.5) | A build *is* available, which keeps scip-java/CodeQL/jQAssistant viable — but every one of them needs repo-specific build inputs (resolvable dependencies, private artifact-repo credentials, a green compile) that vary per repo and can't be assumed at onboarding. Phase 1 is therefore **source-only, zero build dependency**; Phase 2 adds build-dependent precision where Phase 1 measurably falls short. |
| **OpenAPI availability** | **Static spec checked in** | The api-contract provider is simple file discovery + parse — no build step, no springdoc runtime generation needed. Removes the `v0.6 §11` "OpenAPI may not be static" caveat *for this target specifically*. High-value, low-cost. |
| **Java engine strategy** | **Augment, don't replace** | CodeGraph + Graphify stay primary for Java (Graphify's Fineract-scale timeout is a config/duration matter, confirmed run repeatedly by the team, not a blocker). scip-java and CodeQL are added surgically for the specific gaps where they're clearly better — never as a from-scratch re-platform. |
| **First Java target** | **Public proxies** | Fineract (JAX-RS + JPA + Kafka + Spring Batch), Waltz (jOOQ + Spring MVC), CALM Hub (Quarkus + MongoDB + `@Authenticated`) — Fidelity stack as yardstick, no new repo access needed. |

---

## 1.5 Phasing — source-only first, build-dependent second (and why that ordering is stronger)

**The constraint driving this:** every build-dependent tool (CodeQL DB build, scip-java indexing, jQAssistant's Maven plugin) needs repo-specific inputs to work — resolvable dependencies, credentials for private artifact repositories, a compile that actually succeeds, correct JDK version. Those vary per repo and are exactly the kind of onboarding friction that turns "scan a new repo" into a bespoke setup task. That's the same per-repo-patching failure mode this whole design exists to avoid, just relocated from code into build configuration.

**The finding that makes deferral safe — and better:** the mechanisms Phase 1 relies on are the ones this project has actually *proven against real Java source*, while the build-dependent tools are researched-but-never-run. `CodeGraph.extractFromSource(filePath, source)` reads a file's content directly — **no index, no build, no dependency resolution** — and was verified against real Fineract code returning correct annotation names with correct attribution (36 refs for `ChargesApiResource.java`, 48 for `Charge.java`, per `docs/spikes/CodeGraph_Annotation_Extraction_Reconciliation_Spike.md`). So the honest evidence ranking inverts the original §1 framing: **the build-free mechanism is the proven one; CodeQL/scip-java are the speculative ones.** Leading with the proven path is both faster to first result and better justified.

### Phase 1 — source-only Java (zero build dependency)

Everything here works on a bare `git clone`, no compile — status column added per `docs/spikes/Solution_Design_v2_Critical_Review.md` §2.2's finding that this table previously read as committed scope when several rows are still design-only:

| Capability | Mechanism | Build needed? | Status |
|---|---|---|---|
| JAX-RS routes (`@Path`/`@GET`) | `extractFromSource()` decorates refs + literal-argument composition | **No** | **Built & proven** — 19/19 real Fineract routes, merged into `codegraph-provider.ts`/`jaxrs-route-composer.ts` |
| Spring MVC routes | CodeGraph native typing | **No** | **Mechanism proven** (Flask/FastAPI/NestJS native typing all real) — never actually run against a real Java Spring MVC file in this project; Java-specific instance unverified |
| JPA persistence (`@Entity`/`@Table`) | `extractFromSource()` decorates | **No** | **Built & proven** — 36 real `database` nodes, real Fineract `fineract-core` run |
| Spring Data repositories | `extractFromSource()` + interface-extends detection | **No** | **Backlog** — `persistence-detector.ts` is still single-shape (driver-import only); this strategy is designed (§3.1), not coded |
| jOOQ / Mongo / Postgres / Dynamo persistence | Graphify import-edges (strategy table, §3.1) | **No** | **Backlog** — Mongo/Postgres/Dynamo entries in `PERSISTENCE_LIBRARIES` are Node/Python-only today; no Java equivalents wired |
| Auth controls (`@PreAuthorize`/`@Secured`/`@Authenticated`) | `extractFromSource()` decorates | **No** | **Built & proven** — `control-builder.ts` real, `@PreAuthorize` verified against `DatatableWriteService.java` |
| Resiliency (`@CircuitBreaker`/`@Retry`) | `extractFromSource()` decorates | **No** | **Backlog** — mechanism proven for a different signal (`@PreAuthorize`), no catalogue row or fixture for resilience4j yet |
| Spring Batch, Kafka, JMS | `extractFromSource()` + Graphify typed-field | **No** | **Backlog** — evidenced in requirements (`v0.11`/`v0.12`), no code |
| API contract → routes, schemas, `securitySchemes` | Static OpenAPI file parse | **No** — spec is checked in (locked decision #2) | **Backlog** — api-contract provider not built |
| Cross-package edges | Graphify whole-run pass + reconciler | **No** | **Built & proven** — 265 real cross-module Fineract edges, see `CLAUDE.md` |
| k8s trust + deployment decorators | Manifest file parse | **No** | **Backlog** — k8s-manifest provider not built |

**Corrected claim** (an earlier version of this line overstated coverage — flagged directly in `docs/spikes/Solution_Design_v2_Critical_Review.md` §2.2/§3): **Phase 1 mechanisms cover every Fidelity concern that maps to one of the four proven mechanisms (native typing, decorates-ref extraction, import-edge detection, structured-file ingestion) — this is not the same as saying the entire Fidelity stack is already delivered.** Per the status column above, JAX-RS routes, JPA `@Entity`, cross-package edges, and `@PreAuthorize` controls are genuinely **built and proven**; Spring Data, jOOQ, multi-database persistence, resiliency, messaging, OpenAPI, and k8s are **backlog** — designed, not coded. Treat §2's full coverage table below as a *map of what Phase 1's mechanisms could reach*, not a single-slice commitment (`docs/spikes/Solution_Design_v2_Critical_Review.md` §5 action 4).

### Phase 2 — build-dependent precision, added where Phase 1 measurably falls short

Two things Phase 1 genuinely can't do as well, and only these two:
1. **Cross-package reference precision** — Graphify's filePath+line-range reconciler is heuristic (§3.3). scip-java replaces it with exact symbol resolution. *Trigger to build Phase 2:* Phase 1 shows real cross-package edges being missed or mis-attributed at Java scale.
2. **Framework-aware semantic queries** — CodeQL's query packs understand JAX-RS/Spring-Data semantics beyond raw annotation names. *Trigger:* Phase 1's raw-annotation output proves insufficient for correct entity-relationship modeling. **Route path assembly specifically is resolved — see §1.6; this trigger is now scoped narrower than originally written.**

### 1.6 Spike result: JAX-RS route-path assembly — RESOLVED, with one real caveat found and fixed

**Run this session, against real Fineract source, not simulated.** The open question from §7's original risk table — can `extractFromSource()`'s output actually be composed into correct full route paths — is answered: **yes, with one necessary addition.**

**The caveat, found by checking the actual SDK types before writing any code:** `UnresolvedReference` (what a `decorates`-kind reference returns) has **no field for the annotation's argument value** — confirmed by reading `node_modules/@colbymchenry/codegraph/dist/types.d.ts` directly. It gives `referenceName` (`"Path"`), `fromNodeId`, `line`, `column` — never the string inside `@Path("...")`. So route-path assembly needs one small addition beyond what `codegraph-provider.ts` currently does: **read the source line at the reference's own `line` number and regex out the quoted literal.** This is still zero-build, still source-only, still Phase 1 — just a real, previously-unstated addition to the extraction mechanism, not a new engine.

**What was verified, concretely:**
- `fromNodeId` attribution is exact — every class-level annotation (`@Path`, `@Component`, `@Tag`) attributed to the class node id, every method-level annotation attributed to its own distinct method node id, with zero cross-attribution across 7 real route methods checked by hand against source.
- Class-level `@Path` + method-level `@Path` (or its absence) compose correctly via string join, including the hardest real case found: `DelinquencyApiResource`'s `"buckets/{delinquencyBucketId}"` literal is reused verbatim across three different methods (`GET`/`PUT`/`DELETE`) — correctly disambiguated by HTTP verb each time, not by path alone.
- **Result: 19/19 real routes correctly assembled across three real Fineract resource files** (`ChargesApiResource` 6/6, `SchedulerApiResource` 2/2, `DelinquencyApiResource` 8/8, plus 3 further real routes in the same file initially left out of the transcribed ground truth and confirmed correct on recheck — not extraction errors, a ground-truth transcription gap, corrected). Zero mismatches, zero false positives.

**Consequence for §1.5's phasing:** trigger 2 (framework-aware CodeQL queries) is **not** needed for route-path assembly — that capability is proven at Phase 1 with the literal-extraction addition above. CodeQL's remaining justification narrows to entity-relationship modeling (JPA) and cross-package precision (scip-java's job, trigger 1) — a smaller Phase 2 scope than originally written. **This addition is merged**: `codegraph-provider.ts`'s decorator-fact extraction now includes literal-argument extraction as a real, checked-in step (see §1.7).

**The decisive advantage of this ordering:** Phase 1 generates the *evidence* for whether Phase 2 is needed at all, and precisely where. Without it, adopting CodeQL/scip-java is a bet on a researched-not-run tool. With it, Phase 2 becomes targeted remediation of measured gaps — the same evidence-before-adoption discipline this project already applies to every tool decision.

### 1.7 Merged and run end-to-end against real Fineract — RESOLVED, two more real bugs found

**Not just the spike — the fix is in `pipeline/src/` and a real Fineract module ran through the whole pipeline** (`fineract-charge`: `ChargesApiResource` + the `Charge` JPA entity; later `fineract-core`, 823 files), producing real `architecture.calm.json`, passing `calm validate` at 0 errors. Two pre-existing bugs surfaced, neither visible until Java code actually exercised these paths (full detail in `CLAUDE.md`'s pipeline-architecture section):

1. **`signal-mapper.ts` hardcoded every unit's kind to `'service'`, never reading the matched rule's `calmNodeType`.** Invisible for Python/Node (persistence there only ever came from the separate Graphify-based detector, which sets `kind: 'database'` directly). The new JPA `@Entity` decorator path exposed it immediately — `Charge.java` came out typed `service`. Fixed: kind is now derived from which `calmNodeType`(s) the file's evidence actually voted for.
2. **`findRule`'s substring matching was a real false-positive risk, confirmed not hypothetical**: Lombok's `@Getter` (common on JPA entity fields) matched the new JAX-RS `"GET"` rule via plain `.includes()`, mistyping `Charge.java` with 6+ bogus interfaces. Fixed with word-boundary regex matching, re-verified against all three Fineract files plus the BoA/NestJS fixtures — no regressions.

**Final verified result**: `ChargesApiResource` → `service` node, 6 correct composed routes. `Charge` → `database` node, zero interfaces (correct — JPA entities don't expose HTTP interfaces). Both signal-catalogue additions (`jax-rs-composed-route`, `jpa-entity` at weight 40 — deliberately the "sufficient alone" tier, not the Graphify-detector's flat 20, since this decorator-path unit IS confidence-floor-checked while that one isn't — `jpa-table` at weight 10, corroboration only) are real, checked-in catalogue rows, not a spike script. Since this section was written, the same pipeline was also run against `fineract-core` (823 files, 44 real units, `control-builder.ts` finding `DatatableWriteService`'s real `@PreAuthorize` evidence) and against `fineract-charge`+`fineract-core` combined (265 real cross-module edges) — see `CLAUDE.md` for the full record.

**What this proves and what it doesn't**: this is real evidence that the "new framework = catalogue row, not code" genericity claim (Solution Design v2's central thesis) survives first contact with real Java source — but the bugs found are exactly the kind of thing that only surfaces by running a *second* code shape through a pipeline built and tuned against a *first* one. **Corrected risk framing** (§7 below): "Java never run end-to-end" is no longer accurate — several real modules have run, at increasing scale. The honest residual risk is **breadth**: Spring Data repository interfaces, jOOQ, messaging, k8s, and OpenAPI are still unverified in code, not that Java is untested in principle.

---

## 1. Engine Strategy for Java — augment CodeGraph+Graphify, precisely where each is weak

The v2 capability matrix (`engine-capability-matrix.yml`, v2 §6.1) already routes per `{language, framework}`. This section fills in the Java rows concretely, honoring "augment, don't replace" — **this table is the authoritative one for Java per this doc's own conflict rule (top of file); v2 §6.1's copy is kept in sync with it, not the reverse.**

```yaml
# engine-capability-matrix.yml — Java rows (extends v2 §6.1)
routes:
  - language: java
    framework: [spring-mvc]
    primaryEngine: codegraph-native-route        # mechanism proven for other frameworks; Java Spring MVC instance unverified
    crossPackageEngine: graphify                  # PHASE 1 — proven, 265 real cross-module Fineract edges
    augmentEngine: scip-java                       # PHASE 2 — precise symbol resolution, replaces the
                                                   #           line-range reconciler heuristic (needs build)
  - language: java
    framework: [jax-rs, quarkus]
    primaryEngine: codegraph-extract-from-source   # PHASE 1 — PROVEN: 19/19 real Fineract routes, merged into codebase
    augmentEngine: codeql                           # PHASE 2 — only if a measured gap appears; none found yet
  - language: java
    framework: [jpa, spring-data-repository]
    primaryEngine: codegraph-extract-from-source   # PHASE 1 — proven for bare @Entity (36 real Fineract nodes); Spring Data repository shape still backlog
    augmentEngine: codeql                           # PHASE 2 — framework-aware entity/repo semantics if needed
  - language: java
    framework: [spring-security-oauth2, resilience4j, spring-batch, spring-kafka]
    primaryEngine: codegraph-extract-from-source   # mechanism proven (via @PreAuthorize); these specific signals still backlog
    corroborateEngine: codeql                       # where a query pack exists, use it to raise confidence tier
crossPackageBackbone: graphify                     # unchanged for Python/Node; Java adds scip-java alongside
```

**Why each augmentation, and only where it earns its place:**

- **scip-java — for cross-package reference precision, not as a replacement backbone.** Graphify stays the cross-package backbone — it now genuinely works (265 real edges, once fixed to run one combined pass instead of per-root — see `CLAUDE.md`). But Graphify's reconciler matches by filePath + line-range (v2 §4.1) — a heuristic that already needed one patch (`userservice_create_app`) and has a documented, disclosed trade-off at wide scan scope (`CLAUDE.md`). scip-java, unlocked by the full build, would produce *precise* symbol/reference resolution with no line-range guessing. **Trigger to actually build it**: real cross-package edges being missed or mis-attributed at Java scale — not yet measured as a problem, since the fix already found 265 real edges including the specific evidenced case.

- **CodeQL — for JAX-RS/JPA/Spring-Data framework semantics CodeGraph structurally lacks.** CodeGraph's Java native typing is Spring-MVC-only (confirmed by reading its resolver source). CodeQL's standard Java query packs already model JAX-RS routing, JPA entities, and Spring Data repositories. **Not currently justified**: Phase 1 already proves route-path assembly (§1.6) and bare `@Entity` typing (§1.7) without it. Remaining justification is narrow — Spring Data repository-interface semantics and jOOQ, both still Phase 1 (catalogue-row) candidates before CodeQL is worth its build-dependency cost.

- **CodeGraph `extractFromSource()` — kept as the proven workhorse for the long tail of Spring annotations** (Security/OAuth2, resilience4j, Batch, Kafka) that neither CodeGraph-native nor a CodeQL query pack covers. This is the mechanism already proven at 36–48 refs/file against real Fineract source, and now also proven for control detection (`@PreAuthorize`); it doesn't get thrown away, it gets *narrowed* to where it's genuinely needed (§4 efficiency — not run on every file).

- **jQAssistant — named, viable now (full build), but held as documented backlog, not adopted this round.** With the build environment it's finally runnable, and its Neo4j-backed JAX-RS/CDI plugins are purpose-built for enterprise Java. But adopting it means a Neo4j integration and a second graph store to reconcile — real cost. Recommendation: **spike it against Fineract during Slice 2b/2c to compare its JAX-RS output quality against Phase 1's proven mechanism**, and adopt only if it clearly beats what's already working. Not a blind add.

## 2. Fidelity-Stack Coverage — every concern mapped to a mechanism and an engine

This is the concrete "does it cover a real Fidelity-shaped Java service" table — **read as a coverage map, not a single-slice commitment** (per the correction in §1.5 and `docs/spikes/Solution_Design_v2_Critical_Review.md` §5 action 4). Each row names the detection mechanism, the engine, the CALM construct it produces, the honest evidence level, and now a **Status** column distinguishing what's actually in `pipeline/src/` from what's designed.

| Fidelity concern | Detection mechanism | Engine | CALM output | Evidence level | Status |
|---|---|---|---|---|---|
| **Spring MVC routes** | Native `@RestController`/`@GetMapping` typing | CodeGraph-native | `service` node + `path-interface` | Mechanism proven (Flask/FastAPI/NestJS) | **designed** — no real Java Spring MVC file run yet |
| **JAX-RS routes** (Fineract, Quarkus) | `@Path`+`@GET` decorates + composition | **extractFromSource primary (Phase 1)**; CodeQL Phase-2 augment only if a measured gap appears | `service` node + interface | **Proven — 19/19 real routes, §1.6** | **built** |
| **JPA persistence** | `@Entity`/`@Table`/`@Column` | extractFromSource decorates | `database` node | Proven; CodeGraph gives zero native (confirmed twice) | **built** — 36 real Fineract nodes |
| **Spring Data repositories** | `@Repository extends CrudRepository/JpaRepository` | extractFromSource, Phase 1 | `database` node (repository-interface pattern) | Evidenced (BoA `v0.12`), mechanism specified | **backlog** |
| **jOOQ persistence** | `org.jooq.*` import + typed-field | Graphify import-edge (like SQLAlchemy) | `database` node | Evidenced (Waltz `GenericSelector.java:23-24`) | **backlog** |
| **MongoDB / PostgreSQL / DynamoDB** | Driver/SDK import detection | Graphify import-edge + persistence-detector (generalized, §3.1) | `database` node, one per store | Mongo evidenced (CALM Hub); Postgres/Dynamo Fidelity-named | **backlog** — Java entries not in `PERSISTENCE_LIBRARIES` yet |
| **OAuth2 / Spring Security** | `securityScheme` in static OpenAPI **+** `@PreAuthorize`/`@Secured`/`@EnableWebSecurity` decorates | api-contract provider (not built) + extractFromSource (built) | `controls` (security domain) + `evidence.json`-shaped provenance | `@PreAuthorize` proven (Fineract `DatatableWriteService.java`); OpenAPI-as-signal designed | **partial** — decorator path built, OpenAPI path backlog |
| **Quarkus `@Authenticated`** | decorates ref | extractFromSource | `controls` | Evidenced (CALM Hub, `v0.11` breadth spike) | **backlog** — no catalogue row yet |
| **Resilience4j** (`@CircuitBreaker`/`@Retry`/`@Bulkhead`) | decorates ref, params → `units.json` time/rate values | extractFromSource | `controls` (resiliency domain) + `config` carrying timing | Mechanism proven (via `@PreAuthorize`); this signal untested | **backlog** |
| **Spring Batch** | `@EnableBatchIntegration`/`@Scheduled(cron=...)` | extractFromSource, cron → `units.json` cron-expression | `service` node (batch-job kind) + timing metadata | Evidenced (Fineract 28 files, `v0.12`) | **backlog** |
| **Kafka** (`@KafkaListener`/`KafkaTemplate`) | decorator (consumer) + typed-field (producer) | extractFromSource + Graphify | `network` node (topic) + `connects` | Evidenced (Fineract, `v0.11` two-mechanism design) | **backlog** |
| **JMS/ActiveMQ** | `JmsTemplate`/`jakarta.jms.Queue` | extractFromSource + Graphify | `network` node + `connects` | Evidenced (Fineract, `v0.12`) | **backlog** |
| **AWS SQS/SNS** | `@aws-sdk`/SDK client import | Graphify import + persistence-detector-style | `network` node + `connects` | Fidelity-named (`v0.14`) | **backlog** |
| **API contract** (routes, schemas, security) | Static OpenAPI/Swagger file parse | api-contract provider | routes → interfaces; `securityScheme` → controls | Static file confirmed available for target | **backlog** — provider not built |
| **Logging** | Logging-framework import (SLF4J/Logback/Log4j2) presence | Graphify import-edge (like persistence) | `x-aac-observability` metadata (not a node) | Cheapest mechanism, specified | **backlog** |
| **k8s trust / deployment** | shared Secret/ConfigMap; image/namespace | k8s-manifest provider | `shares-secret` relationship + `deployment` decorator | Specified (v2 §4.1) | **backlog** |

**The pattern that keeps this from being per-repo patching:** every mechanism in the table is one of four already-proven shapes — native typing, decorates-ref extraction, import-edge detection, or structured-file ingestion (OpenAPI/k8s). A new Fidelity-stack framework is a *catalogue row selecting one of these four mechanisms* plus, at most, a capability-matrix routing row — not new extraction code. The four mechanisms are the fixed vocabulary; frameworks are data. (The one real exception where this breaks is persistence code-shape — addressed head-on in §3.1.) **Four rows are actually built; the rest are designed, not committed scope for any single slice** — see §10 for the slice split that follows from this.

## 3. Closing the three "will patch per repo" risks — concretely, for Java

### 3.1 Persistence detection — generalize from code-shape to mechanism (the biggest real risk)

**The problem, restated:** `persistence-detector.ts` assumes one wrapper-class-per-file (`source_location === 'L1'`, single-level `contains` traversal). Java persistence has at least four genuinely different code shapes — JPA `@Entity` classes, Spring Data repository *interfaces*, jOOQ typed queries, plain JDBC — none matching BoA's `db.py` shape. Left as-is, each new shape is a code patch. **This is now also tracked as Wave M task T-M9 (persistence strategy catalogue + dispatcher) — implementation, when it happens, should satisfy both this section and that task's acceptance criteria.**

**The fix — a persistence-detection strategy table, not one hardcoded traversal:**

```yaml
# rules/persistence-detection-catalogue.yml — NEW, not yet built
strategies:
  - id: jpa-entity
    trigger: annotation          # @Entity/@Table present on a class — ALREADY BUILT via the decorator/signal-catalogue path, doesn't need this dispatcher to work today
    engine: extractFromSource
    emitAs: database
  - id: spring-data-repository
    trigger: interface-extends    # interface extends CrudRepository/JpaRepository
    engine: extractFromSource
    emitAs: database
  - id: jooq
    trigger: import-typed-field   # org.jooq.* import + typed field usage
    engine: graphify
    emitAs: database
  - id: driver-import             # Mongo/Postgres/Dynamo/JDBC driver
    trigger: import               # library import (generalizes current SQLAlchemy path — this is the ONE strategy already effectively live, as persistence-detector.ts's current hardcoded logic)
    engine: graphify
    emitAs: database
```

`persistence-detector.ts` becomes a dispatcher over these strategies — the current SQLAlchemy/single-file logic becomes *one strategy (`driver-import`)*, not the whole detector. **This converts "new persistence shape = code patch" into "new persistence shape = catalogue row selecting a strategy,"** matching the genericity discipline the rest of the pipeline already has. Where a truly new shape appears that none of the four strategies fit, *that* is a real code addition (a new strategy) — but it's added once, for a mechanism, not per repo.

### 3.2 Java framework onboarding cost — made explicit and bounded

"Add a Java framework" touches at most: (a) a `signal-catalogue.yml` row, (b) an `engine-capability-matrix.yml` routing row, (c) possibly a `persistence-detection-catalogue.yml` strategy if it's a persistence tech. No builder code, no extraction code, unless it needs a genuinely new *mechanism* (a fifth beyond native/decorates/import/structured-file) — which the Fidelity stack, mapped in §2, never does. This bound is the concrete answer to "does it patch per repo": for everything in Fidelity's stack, no — though as §2's status column shows, most rows still need their catalogue entries written, not just the mechanism to exist in principle.

### 3.3 Reconciler heuristics — Graphify now works for Java, scip-java remains a Phase 2 precision option

The filePath+line-range reconciler is the design's most shape-fragile component. **Update**: as of the cross-package fix (`CLAUDE.md`), Graphify's reconciler now produces real, correct cross-module edges for Java (265 real edges, `fineract-charge`+`fineract-core`) — the fix was running one combined extraction pass, not swapping engines. scip-java's precise symbol resolution remains a real Phase 2 option if a specific measured gap appears (missed or mis-attributed edges at larger scale), but is not currently required to make cross-package Java detection work at all, which is a stronger starting position than this section originally assumed.

## 4. Efficiency — extraction is the cost, and here's the Java plan

CALM generation is cheap (builders over ~5–15 nodes per typical package, 44 for the largest real run so far); most efficiency effort goes to extraction. Concrete measures, Java-weighted, with real measurements where they exist:

- **`extractFromSource()` at real scale, measured**: 823 real Fineract files completed in ~10 seconds; a later 6,781-file combined scan (for the cross-package test) completed in ~96 seconds for the Graphify portion. Narrowing `extractFromSource()` to only annotated files (the original plan here) remains a valid future optimization but hasn't proven necessary yet at these real scales.

- **CodeQL: build the database once, query every construct** — unchanged reasoning, not yet applicable since CodeQL isn't in active use (§1).

- **scip-java runs alongside the build that already happens** — unchanged reasoning, not yet applicable.

- **Graphify's own incremental cache is now used, not discarded every run** (`CLAUDE.md`) — a persistent `.graphify-cache/` replaced the old temp-dir-then-delete pattern. Measured: re-running Fineract `fineract-core` went from 8.5s (cold) to 2.7s (cached), a real 3.1x speedup, byte-identical output. This closes the "incremental/caching" item this section originally left as backlog.

- **Static OpenAPI ingestion is nearly free and replaces expensive controller parsing** — still backlog (§2), unchanged reasoning: a checked-in `openapi.yaml` gives every route + schema + securityScheme in one structured read, cheaper and richer than annotation-extracting every controller.

## 5. Auth / Resiliency / Logging — control and observability evidence capture, Java-concrete

**Renamed from "governance evidence" per `docs/spikes/Solution_Design_v2_Critical_Review.md` §2.1 — this is evidence-capture, not governance, and the title should say so plainly rather than risk re-conflating the two, the exact scope slip `v0.10`'s controls correction already had to fix once.** Ties directly to v2 §5.5's control-builder and the CALM construct deep-dive (`docs/spikes/CALM_Construct_Reference_Deep_Dive_Spike.md`):

- **Authentication/authorization** → `controls` (security domain). **Built and proven**: `@PreAuthorize` decorates detection, real evidence at `DatatableWriteService.java` lines 27/30/33/36. **Backlog**: static OpenAPI `securitySchemes` as a second detection mechanism, Spring Security config-class detection.
- **Resiliency** → `controls` (resiliency domain), from resilience4j `@CircuitBreaker`/`@Retry`/`@Bulkhead` decorates, with the annotation's own parameters (backoff, wait-duration, max-attempts) rendered as `units.json` time/rate values inside the control's `config`. **Backlog** — mechanism proven for a different annotation, this specific signal untested.
- **Logging/observability** → `x-aac-observability` metadata (not a first-class node — logging is cross-cutting, not an architectural component), from logging-framework import presence. **Backlog.**
- **Scope honesty, carried forward:** this captures *evidence that controls exist in code* — not that they're correctly implemented, enforced on every path, or compliant. The `x-aac-scope-limitations` disclosure states this plainly, unchanged from v2.

## 6. Validation Plan — against the three proxies, Fidelity stack as yardstick

1. **Fineract** — the primary Java proxy: JAX-RS routes (proven), JPA persistence (proven), `@PreAuthorize` controls (proven), Kafka messaging (backlog), Spring Batch (backlog). Cross-package edges also now proven (265 real edges).
2. **Waltz** — jOOQ persistence strategy (§3.1, backlog), Spring MVC routes (unverified, §2).
3. **CALM Hub** — Quarkus/JAX-RS, MongoDB, `@Authenticated` controls (backlog), and (if it ships one) a static OpenAPI spec.
4. ~~Route-path assembly check~~ — **DONE, see §1.6/§1.7.** Merged into the real pipeline, not just a spike.
5. **`calm validate`** after generation — unchanged discipline, real schema validation, every run. Now automated via `pipeline/test/regression.test.js` (`npm test`), not manual.
6. **Phase 1 gap measurement, feeding the Phase 2 decision** — measured this session: 265 real cross-package edges found, zero missed/mis-attributed cases identified so far. No trigger for scip-java yet.

**Phase 2 validation (only if a real measured gap appears):**
7. **scip-java precision check** — not yet triggered.
8. **CodeQL DB-build feasibility** — not yet triggered.

## 7. Risks & Open Points

| Risk | Status |
|---|---|
| ~~Java never run end-to-end~~ | **CORRECTED — was stale, flagged by `docs/spikes/Solution_Design_v2_Critical_Review.md` §2.6.** Several real Java modules have now run end-to-end at increasing scale (`fineract-charge`, `fineract-core` at 823 files, a 6,781-file combined cross-package scan). **The real residual risk is breadth, not existence**: only bare `@Entity` persistence is proven (not Spring Data/jOOQ), only one control signal is proven (`@PreAuthorize`, not resiliency/OAuth2-via-OpenAPI), messaging/k8s/OpenAPI are entirely unbuilt. Named first because it still outweighs every item below, restated accurately this time. |
| CodeQL DB won't build for some real repos | De-risked by phasing (§1.5) — Phase 1 has no build dependency at all. Not currently load-bearing since CodeQL isn't in active use. |
| scip-java integration cost underestimated | Deferred to Phase 2, no trigger fired yet — cross-package detection already works via the Graphify fix. |
| Phase 1's raw-annotation output insufficient for correct route paths | **RESOLVED** (§1.6/§1.7) — merged and verified in the real pipeline, not just a spike. |
| Persistence strategy table misses a real Java shape | Real, unchanged — the strategy table itself (§3.1) is still design-only; tracked as Wave M T-M9. |
| jQAssistant adds a second graph store if adopted | Held as spike-then-decide (§1), not adopted blind. |
| Static OpenAPI assumption may not hold for every service | Locked decision #2 says specs are checked in; annotation extraction remains the fallback, itself still backlog for OpenAPI-adjacent signals. |
| Graphify same-package edge under-resolution at wide scan scope | **New, disclosed this session** (`CLAUDE.md`) — a real, measured trade-off of the cross-package fix: Graphify occasionally emits a dangling edge-target id at wider scan scope, reducing same-package precision slightly. Named here per `docs/spikes/Solution_Design_v2_Critical_Review.md` §2.6's finding that this belonged in a risk table, not only buried in `CLAUDE.md`. |

## 8. Decision Log

| Decision | Options | Choice | Why |
|---|---|---|---|
| Java engine strategy | Replace with scip-java primary; augment CodeGraph+Graphify; jQAssistant primary | **Augment** (locked) | Keeps proven Spring-MVC native typing and the working Graphify backbone; adds precision (scip-java) and framework-awareness (CodeQL) only where CodeGraph is documented-weak. Lowest-risk path to Java coverage. |
| Build-dependent tooling: adopt now or phase | (a) Use CodeQL/scip-java from the start since a build is available; (b) Phase 1 source-only, Phase 2 build-dependent once Phase 1 shows where it's actually needed | **(b), phased** (§1.5) | Build-dependent tools need per-repo inputs (resolvable deps, private-repo credentials, green compile) — onboarding friction that recreates the per-repo-patching problem in build config. Decisive factor: `extractFromSource()` is *proven against real Fineract Java source* while CodeQL/scip-java are researched-not-run, so the build-free path is also the better-evidenced one. Phase 1 then generates the evidence for whether Phase 2 is needed and precisely where — and it has: zero triggers fired after real, at-scale runs. |
| OpenAPI ingestion | Build-time generate; static file; annotation-only | **Static file** (locked) | Simplest viable — file discovery + parse, no build step for this part. Highest value/cost ratio of any single Java extraction change still not built. |
| Persistence detection | Keep single-shape detector; strategy table | Strategy table (§3.1) | The single biggest per-repo-patch risk; a strategy table converts most Java persistence shapes to catalogue rows, matching the pipeline's existing genericity discipline. Not yet implemented — tracked as Wave M T-M9. |
| Cross-package Java edges | Graphify reconciler heuristic only; add scip-java precision | **Fixed Graphify's own invocation first** (one combined pass, not scip-java) | The actual root cause was structural (per-root extraction can't see cross-root files), not a precision problem scip-java would have solved. Found by testing, not assumed — see `CLAUDE.md`. scip-java remains a real Phase 2 option if a precision gap is later measured. |
| jQAssistant | Adopt now (build available); spike-then-decide; drop | Spike-then-decide (§1) | Newly runnable, purpose-built for Java, but carries a Neo4j integration cost — earns adoption only by beating what's already working on real output, not by availability alone. |
| extractFromSource at scale | Run on every file; run on annotated subset only | Run on every file, measured acceptable | Real measurement (823 files ~10s, 6,781 files ~96s for the Graphify portion) shows this hasn't been a bottleneck yet at real scales tested — narrowing remains a valid future optimization, not an urgent one. |

---

## Sources

`Architecture_as_Code_Solution_Design_v2.md` (parent, platform-contracts-authoritative); `docs/spikes/Solution_Design_v2_Critical_Review.md` (this revision's corrections trace directly to its findings); `docs/spikes/CALM_Construct_Reference_Deep_Dive_Spike.md`; `docs/spikes/CodeGraph_vs_Graphify_Comparison.md`; `docs/requirements/CALM_Generator_Requirements_v0_11.md`/`v0_12.md`/`v0_14.md` (Java framework + Fidelity evidence); `memory/fidelity_fintech_evidence.md`; real evidence repos `spikes/fineract`, `spikes/waltz`, CALM Hub; `CLAUDE.md`'s pipeline-architecture section (real run results, this and prior sessions). scip-java and CodeQL: researched, no Phase 2 trigger fired yet — evidence level stated honestly as researched-not-yet-run for both.
