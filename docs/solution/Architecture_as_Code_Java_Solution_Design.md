# Architecture-as-Code — Java Solution Design (Slice 2, Fidelity-Baselined)

**Status:** Solution design for Slice 2 (Java), companion to `Architecture_as_Code_Solution_Design_v2.md` — extends it, does not supersede it. Everything in v2 (two-goal framing, three construct-mapping catalogues, six builders, IR layer, LLM advisory layer, override flow) holds unchanged; this document adds the Java-specific engine strategy, the Fidelity-stack coverage plan, and the efficiency measures the Java target actually needs.

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

Everything here works on a bare `git clone`, no compile:

| Capability | Mechanism | Build needed? |
|---|---|---|
| JAX-RS routes (`@Path`/`@GET`) | `extractFromSource()` decorates refs | **No** — proven on Fineract |
| Spring MVC routes | CodeGraph native typing | **No** |
| JPA persistence (`@Entity`/`@Table`) | `extractFromSource()` decorates | **No** — proven mechanism |
| Spring Data repositories | `extractFromSource()` + interface-extends detection | **No** |
| jOOQ / Mongo / Postgres / Dynamo persistence | Graphify import-edges (strategy table, §3.1) | **No** |
| Auth controls (`@PreAuthorize`/`@Secured`/`@Authenticated`) | `extractFromSource()` decorates | **No** — proven on Fineract |
| Resiliency (`@CircuitBreaker`/`@Retry`) | `extractFromSource()` decorates | **No** |
| Spring Batch, Kafka, JMS | `extractFromSource()` + Graphify typed-field | **No** |
| API contract → routes, schemas, `securitySchemes` | Static OpenAPI file parse | **No** — spec is checked in (locked decision #2) |
| Cross-package edges | Graphify whole-run pass + reconciler | **No** |
| k8s trust + deployment decorators | Manifest file parse | **No** |

**That is the entire Fidelity-stack coverage table (§2) minus nothing of substance.** Phase 1 produces real `architecture.calm.json` for Java — routes, persistence, controls, messaging, relationships — with zero build setup per repo.

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

**Consequence for §1.5's phasing:** trigger 2 (framework-aware CodeQL queries) is **not** needed for route-path assembly — that capability is proven at Phase 1 with the literal-extraction addition above. CodeQL's remaining justification narrows to entity-relationship modeling (JPA) and cross-package precision (scip-java's job, trigger 1) — a smaller Phase 2 scope than originally written. **Action for the build round**: add literal-argument extraction (line-read + regex, scoped to the reference's own line) as an explicit step in `codegraph-provider.ts`'s decorator-fact extraction, not deferred to Phase 2.

**The decisive advantage of this ordering:** Phase 1 generates the *evidence* for whether Phase 2 is needed at all, and precisely where. Without it, adopting CodeQL/scip-java is a bet on a researched-not-run tool. With it, Phase 2 becomes targeted remediation of measured gaps — the same evidence-before-adoption discipline this project already applies to every tool decision.

### 1.7 Merged and run end-to-end against real Fineract — RESOLVED, two more real bugs found

**Not just the spike — the fix is in `pipeline/src/` and a real Fineract module ran through the whole pipeline** (`fineract-charge`: `ChargesApiResource` + the `Charge` JPA entity), producing real `architecture.calm.json`, passing `calm validate` at 0 errors. Two pre-existing bugs surfaced, neither visible until Java code actually exercised these paths (full detail in `CLAUDE.md`'s pipeline-architecture section):

1. **`signal-mapper.ts` hardcoded every unit's kind to `'service'`, never reading the matched rule's `calmNodeType`.** Invisible for Python/Node (persistence there only ever came from the separate Graphify-based detector, which sets `kind: 'database'` directly). The new JPA `@Entity` decorator path exposed it immediately — `Charge.java` came out typed `service`. Fixed: kind is now derived from which `calmNodeType`(s) the file's evidence actually voted for.
2. **`findRule`'s substring matching was a real false-positive risk, confirmed not hypothetical**: Lombok's `@Getter` (common on JPA entity fields) matched the new JAX-RS `"GET"` rule via plain `.includes()`, mistyping `Charge.java` with 6+ bogus interfaces. Fixed with word-boundary regex matching, re-verified against all three Fineract files plus the BoA/NestJS fixtures — no regressions.

**Final verified result**: `ChargesApiResource` → `service` node, 6 correct composed routes. `Charge` → `database` node, zero interfaces (correct — JPA entities don't expose HTTP interfaces). Both signal-catalogue additions (`jax-rs-composed-route`, `jpa-entity` at weight 40 — deliberately the "sufficient alone" tier, not the Graphify-detector's flat 20, since this decorator-path unit IS confidence-floor-checked while that one isn't — `jpa-table` at weight 10, corroboration only) are real, checked-in catalogue rows, not a spike script.

**What this proves and what it doesn't**: this is real evidence that the "new framework = catalogue row, not code" genericity claim (Solution Design v2's central thesis) survives first contact with real Java source — but the two bugs found are exactly the kind of thing that only surfaces by running a *second* code shape through a pipeline built and tuned against a *first* one. One module, two units. Persistence-strategy genericity beyond bare `@Entity` (Spring Data repository interfaces, jOOQ), cross-package edges, and controls are all still unverified for Java — this closes the route/persistence-typing slice of Phase 1, not all of it.

---

## 1. Engine Strategy for Java — augment CodeGraph+Graphify, precisely where each is weak

The v2 capability matrix (`engine-capability-matrix.yml`, §6.1) already routes per `{language, framework}`. This section fills in the Java rows concretely, honoring "augment, don't replace":

```yaml
# engine-capability-matrix.yml — Java rows (extends v2 §6.1)
routes:
  - language: java
    framework: [spring-mvc]
    primaryEngine: codegraph-native-route        # PROVEN — CodeGraph types Spring MVC natively, keep as-is
    crossPackageEngine: graphify                  # PHASE 1 — unchanged; longer timeout for Fineract-scale
    augmentEngine: scip-java                       # PHASE 2 — precise symbol resolution, replaces the
                                                   #           line-range reconciler heuristic (needs build)
  - language: java
    framework: [jax-rs, quarkus]
    primaryEngine: codegraph-extract-from-source   # PHASE 1 — proven on real Fineract source, needs no build
    augmentEngine: codeql                           # PHASE 2 — only if Phase 1's raw-annotation output proves
                                                    #           insufficient for full route-path assembly
  - language: java
    framework: [jpa, spring-data-repository]
    primaryEngine: codegraph-extract-from-source   # PHASE 1 — proven mechanism, no build
    augmentEngine: codeql                           # PHASE 2 — framework-aware entity/repo semantics if needed
  - language: java
    framework: [spring-security-oauth2, resilience4j, spring-batch, spring-kafka]
    primaryEngine: codegraph-extract-from-source   # annotation-detectable via decorates refs (proven mechanism)
    corroborateEngine: codeql                       # where a query pack exists, use it to raise confidence tier
crossPackageBackbone: graphify                     # unchanged for Python/Node; Java adds scip-java alongside
```

**Why each augmentation, and only where it earns its place:**

- **scip-java — for cross-package reference precision, not as a replacement backbone.** Graphify stays the cross-package backbone (it works, the timeout is solved). But Graphify's reconciler matches by filePath + line-range (v2 §4.1) — a heuristic that already needed one patch (`userservice_create_app`) and is the design's most shape-fragile part (§3.3 below). scip-java, unlocked by the full build, produces *precise* symbol/reference resolution — exact caller→callee edges with no line-range guessing. **Used specifically to resolve cross-package Java edges the Graphify reconciler is unsure about**, not to re-do what Graphify already gets right. This directly attacks the "reconciler heuristics force per-repo patches" risk (§3.3) by replacing a heuristic with a precise index *for Java*, where the build makes it available.

- **CodeQL — for JAX-RS/JPA/Spring-Data framework semantics CodeGraph structurally lacks.** CodeGraph's Java native typing is Spring-MVC-only (confirmed by reading its resolver source). CodeQL's standard Java query packs already model JAX-RS routing, JPA entities, and Spring Data repositories — the exact frameworks Fineract/CALM Hub actually use. The DB-build cost is amortized: build once per repo, query many constructs (routes, persistence, controls) from the same database (§4 efficiency). **Used where CodeGraph is at its documented 100%-fuzzy-tier worst**, with `extractFromSource()` retained as graceful fallback if a CodeQL DB can't build.

- **CodeGraph `extractFromSource()` — kept as the proven workhorse for the long tail of Spring annotations** (Security/OAuth2, resilience4j, Batch, Kafka) that neither CodeGraph-native nor a CodeQL query pack covers. This is the mechanism already proven at 36–48 refs/file against real Fineract source; it doesn't get thrown away, it gets *narrowed* to where it's genuinely needed (§4 efficiency — not run on every file).

- **jQAssistant — named, viable now (full build), but held as documented backlog, not adopted this round.** With the build environment it's finally runnable, and its Neo4j-backed JAX-RS/CDI plugins are purpose-built for enterprise Java. But adopting it means a Neo4j integration and a second graph store to reconcile — real cost. Recommendation: **spike it against Fineract during Slice 2 to compare its JAX-RS output quality against the CodeQL route above**, and adopt only if it clearly beats CodeQL+extractFromSource. Not a blind add.

## 2. Fidelity-Stack Coverage — every concern mapped to a mechanism and an engine

This is the concrete "does it cover a real Fidelity-shaped Java service" table. Each row names the detection mechanism, the engine, the CALM construct it produces, and the honest evidence level.

| Fidelity concern | Detection mechanism | Engine | CALM output | Evidence level |
|---|---|---|---|---|
| **Spring MVC routes** | Native `@RestController`/`@GetMapping` typing | CodeGraph-native | `service` node + `path-interface` | Proven (BoA Slice 1 + CodeGraph resolver) |
| **JAX-RS routes** (Fineract, Quarkus) | Framework-aware query / `@Path`+`@GET` decorates | CodeQL primary, extractFromSource fallback | `service` node + interface | Proven mechanism (extractFromSource, 36 refs/`ChargesApiResource`); CodeQL researched-pending-spike |
| **JPA persistence** | `@Entity`/`@Table`/`@Column` | CodeQL / extractFromSource decorates | `database` node | Proven mechanism; CodeGraph gives zero native (confirmed twice) |
| **Spring Data repositories** | `@Repository extends CrudRepository/JpaRepository` | CodeQL / extractFromSource | `database` node (repository-interface pattern) | Evidenced (BoA `v0.12`), mechanism specified |
| **jOOQ persistence** | `org.jooq.*` import + typed-field | Graphify import-edge (like SQLAlchemy) + scip-java for precise type | `database` node | Evidenced (Waltz `GenericSelector.java:23-24`) |
| **MongoDB / PostgreSQL / DynamoDB** | Driver/SDK import detection | Graphify import-edge + persistence-detector (generalized, §3.1) | `database` node, one per store | Mongo evidenced (CALM Hub); Postgres/Dynamo Fidelity-named, mechanism generalizes |
| **OAuth2 / Spring Security** | `securityScheme` in static OpenAPI **+** `@PreAuthorize`/`@Secured`/`@EnableWebSecurity` decorates | api-contract provider (primary) + extractFromSource | `controls` (security domain) + `evidence.json` provenance | OpenAPI-as-control-signal NEW this design; `@PreAuthorize` proven (Fineract `DatatableWriteService.java`) |
| **Quarkus `@Authenticated`** | decorates ref | extractFromSource | `controls` | Evidenced (CALM Hub, `v0.11` breadth spike) |
| **Resilience4j** (`@CircuitBreaker`/`@Retry`/`@Bulkhead`) | decorates ref, params → `units.json` time/rate values | extractFromSource | `controls` (resiliency domain) + `config` carrying timing | **NEW** — mechanism is the proven decorates path; resiliency-as-control is `v0.10 §0`'s corrected scope + this design's `units.json` finding |
| **Spring Batch** | `@EnableBatchIntegration`/`@Scheduled(cron=...)` | extractFromSource, cron → `units.json` cron-expression | `service` node (batch-job kind) + timing metadata | Evidenced (Fineract 28 files, `v0.12`) |
| **Kafka** (`@KafkaListener`/`KafkaTemplate`) | decorator (consumer) + typed-field (producer) | extractFromSource + Graphify | `network` node (topic) + `connects` | Evidenced (Fineract, `v0.11` two-mechanism design) |
| **JMS/ActiveMQ** | `JmsTemplate`/`jakarta.jms.Queue` | extractFromSource + Graphify | `network` node + `connects` | Evidenced (Fineract, `v0.12`) |
| **AWS SQS/SNS** | `@aws-sdk`/SDK client import | Graphify import + persistence-detector-style | `network` node + `connects` | Fidelity-named (`v0.14`), mechanism generalizes from Kafka |
| **API contract** (routes, schemas, security) | Static OpenAPI/Swagger file parse | api-contract provider | routes → interfaces; `securityScheme` → controls | **NEW primary source** — static file confirmed available |
| **Logging** | Logging-framework import (SLF4J/Logback/Log4j2) presence | Graphify import-edge (like persistence) | `x-aac-observability` metadata (not a node) | **NEW, specified** — cheapest mechanism, import-presence not deep analysis |
| **k8s trust / deployment** | shared Secret/ConfigMap; image/namespace | k8s-manifest provider | `shares-secret` relationship + `deployment` decorator | Specified (v2 §4.1), unchanged |

**The pattern that keeps this from being per-repo patching:** every mechanism in the table is one of four already-proven shapes — native typing, decorates-ref extraction, import-edge detection, or structured-file ingestion (OpenAPI/k8s). A new Fidelity-stack framework is a *catalogue row selecting one of these four mechanisms* plus, at most, a capability-matrix routing row — not new extraction code. The four mechanisms are the fixed vocabulary; frameworks are data. (The one real exception where this breaks is persistence code-shape — addressed head-on in §3.1.)

## 3. Closing the three "will patch per repo" risks — concretely, for Java

### 3.1 Persistence detection — generalize from code-shape to mechanism (the biggest real risk)

**The problem, restated:** `persistence-detector.ts` assumes one wrapper-class-per-file (`source_location === 'L1'`, single-level `contains` traversal). Java persistence has at least four genuinely different code shapes — JPA `@Entity` classes, Spring Data repository *interfaces*, jOOQ typed queries, plain JDBC — none matching BoA's `db.py` shape. Left as-is, each new shape is a code patch.

**The fix — a persistence-detection strategy table, not one hardcoded traversal:**

```yaml
# rules/persistence-detection-catalogue.yml — NEW
strategies:
  - id: jpa-entity
    trigger: annotation          # @Entity/@Table present on a class
    engine: codeql               # or extractFromSource decorates
    emitAs: database
  - id: spring-data-repository
    trigger: interface-extends    # interface extends CrudRepository/JpaRepository
    engine: codeql
    emitAs: database
  - id: jooq
    trigger: import-typed-field   # org.jooq.* import + typed field usage
    engine: graphify + scip-java  # scip-java for precise type resolution
    emitAs: database
  - id: driver-import             # Mongo/Postgres/Dynamo/JDBC driver
    trigger: import               # library import (generalizes current SQLAlchemy path)
    engine: graphify
    emitAs: database
```

`persistence-detector.ts` becomes a dispatcher over these strategies — the current SQLAlchemy/single-file logic becomes *one strategy (`driver-import`)*, not the whole detector. **This converts "new persistence shape = code patch" into "new persistence shape = catalogue row selecting a strategy,"** matching the genericity discipline the rest of the pipeline already has. Where a truly new shape appears that none of the four strategies fit, *that* is a real code addition (a new strategy) — but it's added once, for a mechanism, not per repo.

### 3.2 Java framework onboarding cost — made explicit and bounded

"Add a Java framework" touches at most: (a) a `signal-catalogue.yml` row, (b) an `engine-capability-matrix.yml` routing row, (c) possibly a `persistence-detection-catalogue.yml` strategy if it's a persistence tech. No builder code, no extraction code, unless it needs a genuinely new *mechanism* (a fifth beyond native/decorates/import/structured-file) — which the Fidelity stack, mapped in §2, never does. This bound is the concrete answer to "does it patch per repo": for everything in Fidelity's stack, no.

### 3.3 Reconciler heuristics — replaced by scip-java precision for Java

The filePath+line-range reconciler is the design's most shape-fragile component. For Java specifically, scip-java's precise symbol resolution (available now, full build) replaces line-range guessing with exact reference edges. The Graphify reconciler stays for Python/Node (where no equivalent precise index is wired in) and as a fallback; for Java, scip-java resolves the cross-package edges the heuristic would otherwise guess at. This removes the per-repo-patch risk *for the language where the build makes a precise alternative available.*

## 4. Efficiency — extraction is the cost, and here's the Java plan

CALM generation is cheap (builders over ~5–15 nodes); all efficiency effort goes to extraction. Concrete measures, Java-weighted:

- **Don't run `extractFromSource()` on every file.** At Fineract's 7,062 files, per-file extraction is the second bottleneck after Graphify. Fix: run it **only on files the CodeGraph index flags as containing unresolved framework annotations** (JAX-RS/JPA/Security/resilience) — the annotated subset, typically a small fraction of a repo. Native-typed Spring MVC files and pure-logic files are skipped. This is a targeted narrowing, not a blanket pass.

- **CodeQL: build the database once, query every construct.** The DB-build is the expensive step; amortize it by extracting routes, persistence, *and* controls from the same database in one pass rather than re-scanning per concern. For a repeatedly-scanned repo (CI, iterative review) the DB can be cached and incrementally updated.

- **scip-java runs alongside the build that already happens.** Since the environment compiles the repo anyway (locked decision #1), scip-java's index is produced from build artifacts already being generated — it's not a separate full re-parse of source, which is where its scale advantage over a from-source generic tool comes from.

- **Graphify timeout is configuration, not redesign** (per your correction — Fineract runs succeed with adequate duration). Set an explicit generous timeout for Java-scale roots; keep it as the cross-package backbone. No architecture change needed.

- **Static OpenAPI ingestion is nearly free and replaces expensive controller parsing.** A checked-in `openapi.yaml` gives every route + schema + securityScheme in one structured read — cheaper than annotation-extracting every controller, and richer (it has the security schemes and response schemas the code annotations alone don't fully surface). For Spring services that ship a static spec, this is the primary route source, with annotation extraction as corroboration/fallback.

- **Incremental/caching, named as the standing efficiency backlog:** CodeGraph's incremental sync (flagged unused since the original critical review) and per-package result caching (skip re-scanning unchanged packages) are the repeat-scan efficiency story. Not built this round; named as the concrete next efficiency item after Slice 2's correctness is proven, so it isn't silently forgotten.

## 5. Auth / Security / Resiliency / Logging capture — the governance evidence you asked for, Java-concrete

Ties directly to v2 §5.5's control-builder and the CALM construct deep-dive (`docs/spikes/CALM_Construct_Reference_Deep_Dive_Spike.md`):

- **Authentication/authorization** → `controls` (security domain), three detection mechanisms converging: static OpenAPI `securitySchemes` (declared OAuth2/apiKey — the strongest, since it's the API's own contract), `@PreAuthorize`/`@Secured`/`@Authenticated` decorates (proven), and Spring Security config-class detection. Provenance via `evidence.json` shape, not just metadata.
- **Resiliency** → `controls` (resiliency domain), from resilience4j `@CircuitBreaker`/`@Retry`/`@Bulkhead` decorates, with the annotation's own parameters (backoff, wait-duration, max-attempts) rendered as `units.json` time/rate values inside the control's `config` — the concrete use of the `units.json` finding.
- **Logging/observability** → `x-aac-observability` metadata (not a first-class node — logging is cross-cutting, not an architectural component), from logging-framework import presence. Deliberately the cheapest mechanism: detecting *that* SLF4J/Logback/Log4j2 is present and roughly how consistently, not deep log-semantic analysis.
- **Scope honesty, carried forward:** this captures *evidence that controls exist in code* — not that they're correctly implemented, enforced on every path, or compliant. The `x-aac-scope-limitations` disclosure states this plainly, unchanged from v2.

## 6. Validation Plan — against the three proxies, Fidelity stack as yardstick

1. **Fineract** — the primary Java proxy: JAX-RS routes (CodeQL vs. extractFromSource quality comparison), JPA persistence, `@PreAuthorize` controls, Kafka messaging, Spring Batch. The 7,062-file scale test for the efficiency measures (§4).
2. **Waltz** — jOOQ persistence strategy (§3.1), Spring MVC routes.
3. **CALM Hub** — Quarkus/JAX-RS, MongoDB, `@Authenticated` controls, and (if it ships one) a static OpenAPI spec to exercise the api-contract provider.
4. ~~Route-path assembly check~~ — **DONE this session, see §1.6.** 19/19 real routes correctly assembled across `ChargesApiResource`/`SchedulerApiResource`/`DelinquencyApiResource`, with one real mechanism addition identified (literal-argument extraction via source-line read, since `UnresolvedReference` carries no argument value). Remaining action: merge this into `codegraph-provider.ts` and re-verify via `npm run build` + the pipeline's own test path, not just the standalone spike script used to prove it out.
5. **`calm validate`** after generation — unchanged discipline, real schema validation, every run.
6. **Phase 1 gap measurement, feeding the Phase 2 decision** — record concretely: how many cross-package Java edges Graphify's reconciler resolved vs. was unsure about, and whether route-path assembly (item 4) held. These two numbers are the entire evidence basis for adopting scip-java/CodeQL, and neither is guessable in advance.

**Phase 2 validation (only if item 4 or 6 shows a real gap):**
7. **scip-java precision check** — confirm it resolves cross-package edges the Graphify heuristic got wrong (§3.3's premise), against the measured Phase 1 baseline.
8. **CodeQL DB-build feasibility** — confirm a database actually builds against Fineract's Maven build, and its JAX-RS query pack output matches grep-verified routes better than Phase 1's assembly did.

## 7. Risks & Open Points

| Risk | Status |
|---|---|
| Java never run end-to-end — all Java claims are specified/evidenced, not built | **The dominant risk, unchanged.** This design is the plan to close it; nothing here is proven-in-Java until Slice 2 actually runs. Named first because it outweighs every item below. |
| CodeQL DB won't build for some real repos | **Substantially de-risked by phasing** (§1.5) — Phase 1 has no build dependency at all, so a repo that won't compile still produces full CALM output. CodeQL becomes an optional Phase 2 enhancement per repo, not an onboarding prerequisite. |
| scip-java integration cost (index format → reconciler) underestimated | Real, unspiked, and now **deferred to Phase 2** where it's evaluated against measured Phase 1 gaps rather than adopted speculatively. Worst case it's dropped and Graphify's reconciler stands — no critical-path dependency either way. |
| Phase 1's raw-annotation output insufficient for correct route paths (class-level `@Path` + method-level `@GET` composition) | **RESOLVED this session** (§1.6) — 19/19 real Fineract routes assembled correctly across 3 files, once a small literal-argument-extraction addition (source-line read + regex, since `UnresolvedReference` carries no argument value) is added to the existing mechanism. Real code addition identified, not yet merged into `codegraph-provider.ts` — that's the remaining action item, not open risk. |
| Persistence strategy table misses a real Java shape | The table converts most shapes to catalogue rows, but a genuinely novel shape is still a new *strategy* (code) — bounded to once-per-mechanism, not per-repo, and explicitly acknowledged rather than claimed away. |
| jQAssistant adds a second graph store if adopted | Held as spike-then-decide (§1), not adopted blind — no commitment until it beats CodeQL on real Fineract JAX-RS output. |
| Static OpenAPI assumption may not hold for every service | Locked decision #2 says specs are checked in; annotation extraction remains the fallback per §2, so a service without a spec still gets routes, just less richly. |

## 8. Decision Log

| Decision | Options | Choice | Why |
|---|---|---|---|
| Java engine strategy | Replace with scip-java primary; augment CodeGraph+Graphify; jQAssistant primary | **Augment** (locked) | Keeps proven Spring-MVC native typing and the working Graphify backbone; adds precision (scip-java) and framework-awareness (CodeQL) only where CodeGraph is documented-weak. Lowest-risk path to Java coverage. |
| Build-dependent tooling: adopt now or phase | (a) Use CodeQL/scip-java from the start since a build is available; (b) Phase 1 source-only, Phase 2 build-dependent once Phase 1 shows where it's actually needed | **(b), phased** (§1.5) | Build-dependent tools need per-repo inputs (resolvable deps, private-repo credentials, green compile) — onboarding friction that recreates the per-repo-patching problem in build config. Decisive factor: `extractFromSource()` is *proven against real Fineract Java source* while CodeQL/scip-java are researched-not-run, so the build-free path is also the better-evidenced one. Phase 1 then generates the evidence for whether Phase 2 is needed and precisely where. |
| OpenAPI ingestion | Build-time generate; static file; annotation-only | **Static file** (locked) | Simplest viable — file discovery + parse, no build step for this part. Highest value/cost ratio of any single Java extraction change. |
| Persistence detection | Keep single-shape detector; strategy table | Strategy table (§3.1) | The single biggest per-repo-patch risk; a strategy table converts most Java persistence shapes to catalogue rows, matching the pipeline's existing genericity discipline. |
| Cross-package Java edges | Graphify reconciler heuristic only; add scip-java precision | Add scip-java for Java (§3.3) | The full build makes a precise index available; replacing a line-range heuristic with exact resolution removes the design's most shape-fragile component for the language where it's feasible. |
| jQAssistant | Adopt now (build available); spike-then-decide; drop | Spike-then-decide (§1) | Newly runnable, purpose-built for Java, but carries a Neo4j integration cost — earns adoption only by beating CodeQL on real output, not by availability alone. |
| extractFromSource at scale | Run on every file; run on annotated subset only | Annotated subset (§4) | Per-file at 7,062 files is a real bottleneck; CodeGraph's index already identifies annotated files, so narrowing is free and large. |

---

## Sources

`Architecture_as_Code_Solution_Design_v2.md` (parent); `docs/spikes/CALM_Construct_Reference_Deep_Dive_Spike.md`; `docs/spikes/CodeGraph_vs_Graphify_Comparison.md`; `docs/requirements/CALM_Generator_Requirements_v0_11.md`/`v0_12.md`/`v0_14.md` (Java framework + Fidelity evidence); `memory/fidelity_fintech_evidence.md`; real evidence repos `spikes/fineract`, `spikes/waltz`, CALM Hub (sparse-cloned, prior sessions); the four locked decisions from this session's clarifying questions. scip-java and CodeQL: researched, pending the Slice 2 spike (§6) — evidence level stated honestly as researched-not-yet-run for both, consistent with this project's discipline of not treating a tool as proven until executed.
