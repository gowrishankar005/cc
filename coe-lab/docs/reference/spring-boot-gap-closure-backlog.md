# Consolidated backlog: closing Weaver's Spring Boot config/build/container gap

**Purpose:** this file turns three prior research/audit passes into a single, backlog-ready build list, in this project's own `BACKLOG.md` convention (thin index table → detailed task breakdown → explicit non-scope). It supersedes the standalone remediation sketches in the two source documents below — read them for the evidence trail, read this one for what to actually queue.

**Source chain (read in this order for the "why"):**
1. `building-calm-from-spring-boot-research.md` — the greenfield A–F approach matrix
2. `spring-boot-approach-audit-of-weaver.md` — Weaver graded against it (findings A1/A2/A3/A13, B5/B9)
3. `spring-config-blind-spot-root-cause-and-fix.md` — root cause for A1/A3 confirmed against CodeGraph/Graphify source
4. `existing-tools-for-spring-config-gap.md` — reuse-vs-build check against cdxgen/OpenRewrite/jQAssistant/Konveyor, which **changed the build plan** (this file reflects the post-reuse-check plan, not the original two-provider sketch)

**Not in scope for this consolidation:** A13 (runtime-verification lane) — real and ranked highest-value in the audit, but architecturally a different kind of work (needs a bootable app) and was explicitly not part of the reuse-check this list closes out. Tracked separately, see `spring-boot-approach-audit-of-weaver.md` finding A13.

---

## Thin index

| ID | Item | Closes | Size | Priority | Depends on |
|---|---|---|---|---|---|
| **B-spring-config** | New `scanner/spring-config-provider.ts` — deterministic `application.yml`/`.properties` reader | A1 (biggest miss), contributes to B9 (protocol) and B5 (formal interfaces) | M | **P0** | none |
| **B-cdxgen-reuse** | Shell out to `cdxgen` (npm) for build-file + container/compose facts instead of hand-rolling parsers | A2, A3 | S–M | P1 | none (independent of B-spring-config) |
| **B-protocol-populate** | Wire `spring.datasource.url`'s JDBC scheme into `relationship-type-mapping.yml`'s currently-always-`null` `protocol` field | B9 | XS | P0 (bundled with B-spring-config, not standalone) | B-spring-config |
| **B-formal-interface-port** | Emit `server.port` as a formal `interface-definition` (`tcp-host-port`) | B5 | XS | P1 (bundled with B-spring-config) | B-spring-config |
| **B-spring-vocab-mining** | One-time research task: extract the Spring config key vocabulary + profile-resolution rules from `rewrite-spring`'s recipe catalogue | Informs B-spring-config's catalogue rows | XS | P0 (do first, blocks nothing but de-risks everything) | none |

Sizes: XS = data/catalogue-row change, no new mechanism · S = small new file, existing pattern · M = new provider + catalogue wiring + fixture · L = new mechanism class (not needed for any item here).

---

## B-spring-config — new deterministic Spring config provider

**Statement:** Weaver has no reader for `application.yml`/`application-*.yml`/`application.properties` in any package root. This is Pass 1 of the greenfield research doc's own pipeline and the single richest, cheapest evidence source for Spring Boot specifically (`spring.datasource.url` names DB tech + host + protocol in one config line). Root cause confirmed against both engines' real source (see doc 3): CodeGraph doesn't attempt YAML/properties at all; Graphify classifies `.yml` as a document type only reachable through its LLM path, which Weaver's `--code-only` flag explicitly and correctly skips to avoid an LLM dependency; `.properties`/`Dockerfile` fall into Graphify's `unclassified` bucket in every mode. Neither engine can close this without an LLM. Mechanism class: identical to the two providers Weaver already has for structured, non-code files (`k8s-manifest-provider.ts`, `openapi-provider.ts`) — a fourth instance of a proven pattern, not a new mechanism.

| Sub-task | Description | Verify |
|---|---|---|
| T-SC-1 | Read every `application.yml`/`application-*.yml` per package root (reuse the `yaml` npm dependency already present for `k8s-manifest-provider.ts`) | Parses a real multi-profile fixture (`application.yml` + `application-prod.yml`) without error |
| T-SC-2 | Read `application.properties`/`application-*.properties` (flat key=value; no new dependency needed, ~20-line parser) | Parses a real fixture; confirms `.properties`-only Spring apps (no YAML at all) aren't silently zero-evidence |
| T-SC-3 | Extract `spring.datasource.url`/`.username` → corroborating `database`-kind evidence + JDBC scheme | Real fixture: `jdbc:postgresql://host:5432/db` → tech = postgresql, host captured |
| T-SC-4 | Extract `spring.kafka.bootstrap-servers` / `spring.rabbitmq.*` / `spring.activemq.broker-url` → `network` node corroboration | Real fixture per broker type — at least Kafka + one of Rabbit/ActiveMQ |
| T-SC-5 | Extract `spring.data.redis.host`/`.port`, `spring.cache.type` → new cache/database-shaped corroboration (no existing detector covers this at all today — genuinely new coverage, not just a second source for existing coverage) | Real fixture with `spring.data.redis.*` set |
| T-SC-6 | Extract `server.port` → feeds **B-formal-interface-port** | Real fixture, non-default port (not just the 8080 default) |
| T-SC-7 | New `Evidence.category: 'spring-config'` (alongside existing `http-entry-point`/`persistence`/`framework-bootstrap`/… categories), and new catalogue rows: `persistence-detection-catalogue.yml` (a `spring-config-datasource` strategy, alongside existing `driver-import`/`jpa-entity`, distinct from the still-`not-implemented` `spring-data-repository` row) and `messaging-detection-catalogue.yml` (a `spring-config-broker` strategy) | Catalogue loader accepts the new rows without a code change elsewhere (proves the catalogue-driven discipline held) |
| T-SC-8 | New test fixture: a package with `application.yml` (datasource + kafka) and a sibling with `application.properties` only, checked into `pipeline/test/fixtures/` | `npm test` gains real assertions, not smoke-shaped, matching this project's own regression-suite standard |

**Explicitly not in T-SC scope**: placeholder resolution (`${DB_HOST}`-style Spring property indirection) — real Spring apps resolve these from env vars/Vault/Config Server at runtime, which is exactly the class of fact only the deferred runtime-verification lane (A13) can resolve correctly; **don't guess-resolve placeholders statically** — emit the unresolved literal as low-confidence evidence or skip, consistent with this project's "don't fabricate" discipline. Name this limitation in the provider's own scope-limitations output, don't silently drop it.

## B-cdxgen-reuse — replace the planned hand-written build/container parsers

**Statement:** the original remediation sketch (doc 3) proposed two new Weaver-native parsers for `pom.xml`/`build.gradle` and Dockerfile/compose. The reuse check (doc 4) found `cdxgen` (OWASP, npm, actively maintained) already does both, more completely — it shells to real Maven/Gradle for resolved dependency trees (covering `sbt`/`bazel`/`mill` too, ecosystems not worth hand-rolling) and has a dedicated Docker/compose/k8s/kustomize/skaffold project type. It's npm-installable — same runtime family as Weaver, no JVM bridge required (unlike jQAssistant/OpenRewrite, both rejected for that reason). **This item replaces, not adds to, the original A2/A3 plan.**

| Sub-task | Description | Verify |
|---|---|---|
| T-CDX-1 | Evaluate `cdxgen` as a shelled dependency (license: Apache-2.0, compatible; footprint; whether `npx cdxgen` at scan time is acceptable or it needs to be a pinned devDependency like `@finos/calm-cli` already is) | Decision recorded, not just assumed — matches this project's own "verify the real tool" discipline before adopting |
| T-CDX-2 | New `scanner/cdxgen-provider.ts` — shells `cdxgen -t java -o bom.json <root>` (and the equivalent for Node/Python roots, matching Weaver's existing polyglot scope), parses the CycloneDX JSON | Real run against a Fineract module and the NestJS fixture, both produce a parseable BOM |
| T-CDX-3 | Map cdxgen's dependency components → **corroborating** evidence only (raises confidence on a signal another lane already found — e.g. a `postgresql` JDBC driver dependency corroborating T-SC-3's datasource-URL finding), not a primary detection source on its own | Confirms this doesn't duplicate or fight with the existing `driver-import` persistence strategy |
| T-CDX-4 | Map cdxgen's "Container File" project-type output (image names, compose service names) → corroborate/extend `k8s-manifest-provider.ts`'s existing container/image facts, or feed the formal `container-image` `interface-definition` construct named in the audit's B5 finding | Real run against a fixture with a `docker-compose.yml` |
| T-CDX-5 (stretch, separate sizing) | Evaluate `evinse` (cdxgen's companion occurrence/reachability/data-flow evidence tool for Java) as a future confidence-grading upgrade | Explicitly **not** sized into this pass — flag as its own future backlog item if pursued, since it's a materially larger scope (call-graph analysis) than this consolidation covers |

## B-spring-vocab-mining — do this first, it's free and de-risks everything else

**Statement:** rather than reconstructing the Spring property vocabulary (which keys exist, what they mean, how profiles override each other) from memory or ad hoc research while writing T-SC-3 through T-SC-6, mine it from `openrewrite/rewrite-spring`'s real recipe catalogue (`MigrateDatabaseCredentialsForToolYaml`/`...Properties`, `AddSpringProperty`, `SeparateApplicationPropertiesByProfile`, `UseTlsJdbcConnectionString`, and the versioned `spring-boot-*-properties.yml` recipe-migration files, current through Spring Boot 4.1). This is read-only reference use of a mature, actively-maintained OSS project — not a runtime dependency (rejected for that role in doc 4 because it's a JVM library) — so it costs nothing but research time and produces a more authoritative key list than guessing.

| Sub-task | Description | Verify |
|---|---|---|
| T-VM-1 | Extract the canonical property-key list this backlog's T-SC-3–T-SC-6 target from `rewrite-spring`'s resources, cross-checked against Spring's own public docs | A short reference table (key → meaning → CALM construct it feeds), committed alongside `spring-config-provider.ts` as its design doc, not left implicit in code comments only |
| T-VM-2 | Note profile-resolution rules (`application-{profile}.yml` overrides `application.yml`; property precedence order) so T-SC-1 doesn't silently pick the wrong value when multiple profiles are present | Confirmed against a real multi-profile fixture, not assumed from documentation alone (this project's own "verify the real tool" discipline) |

---

## Explicitly rejected / deferred (named, not silently dropped)

| Option | Why not | Where it's discussed |
|---|---|---|
| Hand-written `pom.xml`/`build.gradle` parser | Superseded by B-cdxgen-reuse — cdxgen does this more completely already | doc 4 |
| Hand-written `Dockerfile`/`docker-compose.yml` parser | Superseded by B-cdxgen-reuse | doc 4 |
| OpenRewrite as a runtime dependency (JVM subprocess bridge) | Real architectural cost (new dependency class Weaver has consistently avoided — same reason jQAssistant stayed deferred); reference-only use captured in B-spring-vocab-mining instead | doc 4 |
| jQAssistant / Konveyor-Windup as the config reader | Neither reaches `application.yml`/`.properties` either (verified, not assumed); both are JVM tools with the same environment constraint | doc 4 |
| Reading `spring-configuration-metadata.json` from resolved dependency jars | Real and authoritative, but requires either a build step or dependency-jar access Weaver doesn't have today — same cost tier as the deferred runtime-verification lane (A13), not a pass-1-cheap win | doc 4 |
| Static resolution of `${PLACEHOLDER}`-style config values | Only the (separately-tracked, not-in-this-list) runtime-verification lane can resolve these correctly; guessing would violate this project's "don't fabricate" discipline | named under B-spring-config's T-SC scope note above |
| A13 (Actuator/in-process runtime-verification lane) | Real, ranked highest-value in the original audit, but a different kind of work (needs a bootable app) — not part of this reuse-driven consolidation | `spring-boot-approach-audit-of-weaver.md` |

## Suggested execution order

1. **B-spring-vocab-mining** (T-VM-1/2) — free, blocks nothing, de-risks B-spring-config's catalogue rows.
2. **B-spring-config** (T-SC-1…8) — the P0 item; closes the audit's single highest-severity finding (A1) and bundles B9/B5 for near-zero extra cost once the provider exists.
3. **B-cdxgen-reuse** (T-CDX-1…4) — independent of (1)/(2), can run in parallel; lower severity (A2/A3 were graded "medium," not "highest," in the original audit) but cheap once the adoption decision (T-CDX-1) is made.
4. T-CDX-5 (evinse) — explicitly not scheduled; revisit as its own item if reachability/data-flow evidence becomes a named priority later.
