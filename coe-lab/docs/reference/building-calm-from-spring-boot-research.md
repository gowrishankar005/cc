# Research: the smart way to build CALM JSON from a Java Spring Boot repo

**Scope note:** deliberately greenfield — this asks "what is the best way to do this, full stop," ignoring Weaver's existing architecture and mechanisms. Where a conclusion happens to agree or disagree with Weaver's approach, that's noted at the end (§6), not baked into the reasoning.

**Method:** everything below was checked against real sources this session — FINOS's own repo contents fetched via `gh api` (including their architecture-discovery skill file, read in full, and the draft 1.3 schema), plus web research on the Spring-side tooling (Actuator, Spring Modulith, jQAssistant). Claims from search summaries were verified against the underlying repo where they mattered.

---

## 1. The key finding first: FINOS itself has no deterministic code→CALM generator — their official answer is an LLM skill

The `finos/architecture-as-code` repo contains no static-analysis tool, no bytecode scanner, no Spring integration. Their entire "generate CALM from source code" story is **`docs/static/calm-skills/architecture-discovery-skill.md`** — a markdown *prompt* for a coding agent (Claude Code / Copilot-style), fetched and read in full this session. It instructs the agent to scan a repo for evidence (build files, Dockerfiles, k8s manifests, `application.yml`, route annotations, DB clients, message-queue clients, HTTP clients, auth config), emit nodes/relationships tables, and save a CALM 1.2 JSON — behind an explicit warning banner: *"initial discovery… by an LLM. It may contain inaccuracies or omissions. Please review and validate."*

Three design choices in that skill are worth taking seriously (they encode FINOS's hard-won opinions):

1. **"DO NOT rely on documentation or comments as primary evidence"** — READMEs, ARCHITECTURE.md, diagrams, comments are all explicitly banned as primary sources; only executable code and configuration count. (Independently, this matches the conclusion this repo reached from its own evidence work.)
2. **Node = separate deployable unit / runtime process** — two classes in one service are never two nodes. A clean, defensible grain rule.
3. **"DO NOT define `composed-of` and `deployed-in`"** and **"DO NOT capture protocols, this has been deprecated"** — surprising, and the second claim is **not supported by their own schema**: verified this session that the draft 2026-03 (1.3) `core.json` still has `protocol` on `relationship` with the full enum. So the skill is either ahead of an unpublished decision or internally inconsistent with the published schema. Treat "protocol deprecated" as unconfirmed; the `composed-of`/`deployed-in` exclusion reads as a scope choice for *discovery* (grouping is an architect's judgment call), not a schema stance.

**Implication:** whoever builds a deterministic Spring Boot→CALM generator is not competing with a FINOS tool — they're filling a hole FINOS currently papers over with an LLM + human-review loop.

## 2. Why Spring Boot is a special case — the framework is unusually self-describing

The generic problem ("extract architecture from arbitrary code") is hard. The *Spring Boot* problem is much softer, for two reasons that most generic approaches under-exploit:

**(a) The programming model is declarative.** Routes (`@RestController`/`@RequestMapping`/`@GetMapping`), persistence (`@Entity`, `Spring Data` repository interfaces), messaging (`@KafkaListener`, `@RabbitListener`, `@JmsListener`), scheduled jobs (`@Scheduled`), outbound HTTP (`@FeignClient`, `RestTemplate`/`WebClient` beans), security (`@PreAuthorize`, `SecurityFilterChain`) — nearly every architecturally interesting fact is an annotation or a well-known bean type, not free-form logic.

**(b) The truth is centralized in configuration.** `application.yml`/`application.properties` is the single richest architecture file in any Spring Boot repo: `spring.datasource.url` names the database technology, host, and schema in one line; `spring.kafka.bootstrap-servers`, `spring.data.redis.host`, `spring.rabbitmq.*`, feign client URLs, `server.port` — most *external* edges of the architecture are sitting in one parseable file, no code analysis required. This is exactly the config-mediated relationship class that pure code-graph approaches famously miss.

And beyond static artifacts, Spring has a third property almost no other mainstream stack has:

**(c) The runtime will tell you the answer.** A booted Spring context knows, post-resolution, everything the annotations and config *meant*: Actuator's `/actuator/mappings` returns every real route (after profiles, conditional beans, and property placeholders resolved); `/actuator/beans` returns the wiring graph; `/actuator/configprops` + `/env` return resolved connection strings; `/actuator/health` enumerates live backing services (each health indicator — db, kafka, redis — is a real dependency). This is ground truth, not inference.

## 3. The candidate approaches, honestly compared

| # | Approach | Needs | Grain | Trust level | Key weakness |
|---|---|---|---|---|---|
| A | **Config-first parse** — `application*.yml` + build files (`pom.xml`/`build.gradle`) + `docker-compose`/k8s | Just the repo | External deps + edges | High (config is executable truth) | Says nothing about internal structure or routes |
| B | **Annotation-level static scan** — parse source for the Spring annotation vocabulary (JavaParser/Spoon/tree-sitter or plain structured grep) | Just the repo | Routes, entities, listeners, clients, controls | High for what it finds | Misses everything resolution-dependent: profiles, conditional beans, placeholder-mediated URLs, programmatic routes (`RouterFunction`) |
| C | **Bytecode graph** — jQAssistant (Maven/Gradle plugin → Neo4j graph, Cypher query → emit CALM; Spring/JPA-aware, and a `jqassistant-c4-plugin` already exists as precedent) | A successful build | Full class/dependency graph | High | Heavyweight (Neo4j, build integration); still pre-resolution — same blindness to profiles/placeholders as B |
| D | **Spring Modulith test-time** — `ApplicationModules.of(App.class)` + a custom `Documenter`-style CALM emitter, run as a JUnit test in CI | Build + Modulith conventions | Module boundaries + verified module deps | High | Module grain only (no routes/db detail); only fits codebases adopting Modulith's package conventions |
| E | **Runtime self-description** — Actuator endpoints, or better, an in-process exporter (a small starter that walks `RequestMappingHandlerMapping`, the JPA metamodel, `KafkaListenerEndpointRegistry`, `DataSource` metadata at startup and emits CALM directly) | The app must boot (dev profile / Testcontainers) | Everything, post-resolution | **Highest** — this is the resolved truth | Boot is a real cost (deps, credentials, containers); captures one profile's truth per run; Actuator exposure is a security surface |
| F | **LLM discovery** — FINOS's skill approach | An agent + the repo | Whatever it notices | Low-to-medium, unverifiable per-claim | Non-deterministic, non-reproducible, can hallucinate; FINOS themselves banner it as unreliable |

The single most important structural observation: **A+B are cheap and deterministic but pre-resolution; E is post-resolution truth but needs a bootable app.** These aren't competitors — they're a cross-check pair. Anything A/B claims that E contradicts is a real finding (dead config, disabled bean, profile-gated route); anything E shows that A/B missed is a detection gap with a precise repro.

## 4. The smart answer: a layered pipeline, ordered by cost, with runtime as the verifier

For a single given Spring Boot repo, the recommended shape:

1. **Pass 1 — config-first (always).** Parse `application*.yml`/`.properties` (all profiles), `pom.xml`/`build.gradle` dependency list, `docker-compose`/k8s manifests. This alone yields: the service node, its port, every database/broker/cache/external-API dependency as nodes, and the `connects` edges to them — with technology identified (`jdbc:postgresql://…` names both the protocol `JDBC` and the db tech). Cheapest pass, highest edge-yield per effort.
2. **Pass 2 — annotation scan (always).** The Spring annotation vocabulary is small and stable; extract routes → CALM `interfaces` (informal `path-interface` convention), `@Entity`/repository interfaces → `database`-node corroboration, `@KafkaListener`+`KafkaTemplate` → messaging edges with direction, `@FeignClient`/`WebClient` base-URLs → service-to-service edges, `@PreAuthorize`/`SecurityFilterChain` → CALM `controls` with file:line evidence.
3. **Pass 3 — runtime verification (when the app can boot).** Boot with a dev/test profile (Testcontainers where backing services are needed) and read the resolved truth — either via Actuator or, better, an **in-process exporter**. Reconcile against passes 1–2; emit the diffs as first-class review findings, not silent corrections.
4. **Pass 4 — LLM only at the edges (optional).** Naming, descriptions, grouping proposals (`composed-of` is a judgment call — notably the thing FINOS's own skill refuses to auto-generate), and triage of ambiguous evidence. Proposals for human review, never silent writes. This is exactly the positioning FINOS's skill itself takes, and it's the right one.

**And the genuinely smart long-term move for Spring specifically — the gap nobody has filled:** a **`calm-spring-boot-starter`** that emits `architecture.calm.json` from inside the running application context, the way **springdoc-openapi** emits OpenAPI from the real handler mappings rather than from parsing source. Precedents prove each piece: springdoc (runtime introspection → spec file), Spring Modulith's `Documenter` (test-time context walk → architecture diagrams), Actuator (the introspection surfaces all exist). A starter that walks `RequestMappingHandlerMapping` → interfaces, `EntityManagerFactory` metamodel → database nodes, registered `DataSource`s → `connects` with `JDBC` protocol and real host, `KafkaListenerEndpointRegistry` → messaging edges, and `SecurityFilterChain`/method-security metadata → controls, then writes CALM 1.2 JSON at startup or on a test hook, would produce the highest-fidelity CALM any approach can achieve for this stack — because it reads the same resolved state the framework itself executes. FINOS ships nothing like it; neither does anyone else found in this research.

Two honest limits of the starter idea, named up front: it documents **one application at a time** (system-of-systems composition stays a separate aggregation step), and it documents **the profile it booted with** (run per-profile if profiles change the architecture).

## 5. Grain and construct mapping (what goes where in CALM)

Applying the reference example's construct lessons (`rich-calm-example/README.md`) to the Spring case:

| Spring evidence | CALM construct |
|---|---|
| The deployable app itself | one `service` node (FINOS grain rule: node = deployable unit — not one node per controller) |
| `spring.datasource.url` / `@Entity` corroboration | `database` node + `connects` (`protocol: JDBC`) |
| Kafka/Rabbit/JMS config + listener/template annotations | `network` node (topic/broker) + directional `connects`; leave `protocol` unset for Kafka (enum has no honest value) |
| `@Get/Post/RequestMapping` composed paths | informal `path-interface` interfaces on the service node |
| `server.port`, container image from Dockerfile/jib | formal `interface-definition` (`tcp-host-port`, `container-image` — FINOS-published schemas) |
| `@FeignClient`/`WebClient` with resolved base URL | peer `service` node + `connects` (`HTTPS`) |
| `@PreAuthorize`, `SecurityFilterChain`, OAuth2 client config | node-level `controls` with file:line evidence in `config` |
| k8s manifests (if present) | `deployed-in` + a runtime-boundary `system` node — noting FINOS's discovery skill deliberately leaves this to humans |
| Multi-module Gradle/Maven or Modulith modules | `composed-of` under a logical `system` node — also human-confirmed grain |

## 6. Postscript: what this implies for Weaver (kept separate from the greenfield reasoning)

- Weaver's catalogue-driven static passes are essentially passes 1–2 — the right cheap-and-deterministic base. The genuinely new idea this research surfaces is **pass 3**: a runtime-verification lane (Actuator scrape or in-process exporter) used as a *cross-check oracle* against static output, converting static/runtime diffs into named findings. Nothing in Weaver occupies that lane today, and for Spring Boot specifically it's the highest-fidelity evidence source available.
- FINOS's discovery skill is, in effect, a competitor validation of Weaver's LLM-positioning: LLM proposals bannered for human review, never trusted as truth — the same boundary Weaver draws with `suggest-rules.ts` and the advisory layer.
- The "protocol deprecated" claim in FINOS's skill vs. their own 1.3 draft schema still carrying `protocol` is worth tracking — if protocol really is leaving `relationship`, Weaver's relationship-builder output shape is affected.
