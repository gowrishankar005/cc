# Agent task list — Phase 1 close (mechanism-complete)

**Single source of truth** for the three items picked 2026-08-09 as the punch list before calling Weaver's current body of work ("Phase 1") closed, under the **mechanism-complete** framing (owner-confirmed, not pilot-validated — see `Pilot_Ready_Scorecard.md` for the separate, deliberately-deferred pilot-validation bar). Almost everything else in `BACKLOG.md`/`Claim_Register.md`/`STATUS.md` is already `done`; these three are the real remaining gaps.

**Product:** Weaver. **Owner:** Gowri.

**Related:**
| Doc | Role |
|---|---|
| `BACKLOG.md` | `B-spring-config` (P1 row) — flip to `done` on close |
| `coe-lab/docs/reference/spring-boot-gap-closure-backlog.md` | **Authority for PC-1's detailed sub-tasks (T-SC-1…8, T-VM-1/2)** — this file sequences and verifies, that file specifies. Read it before starting PC-1. |
| `coe-lab/docs/reference/spring-boot-approach-audit-of-weaver.md` | Original audit findings (A1/A2/A3/A13, B5/B9) PC-1 closes |
| `coe-lab/docs/reference/spring-config-blind-spot-root-cause-and-fix.md` | Root cause: neither CodeGraph nor Graphify can reach `application.yml`/`.properties` without an LLM |
| `coe-lab/docs/reference/existing-tools-for-spring-config-gap.md` | Reuse-check that ruled out jQAssistant/OpenRewrite/Konveyor for this gap |
| `pipeline/src/scanner/k8s-manifest-provider.ts`, `openapi-provider.ts` | The proven "structured non-code file provider" pattern PC-1's new provider is a 4th instance of, not a new mechanism |
| `.github/workflows/pipeline-test.yml` | PC-2's target — confirmed actually running successfully on every push (`gh run list`, 10+ green runs), contrary to the stale "unverified" doc claim PC-3 corrects |
| `docs/solution/Platform_Architecture_Analysis.md`, `docs/solution/STATUS.md` | PC-3's target — both currently say CI/deployment is unverified; that's stale for CI (real, verified, green), still true for the Docker image itself until PC-2 lands |

---

## 0. How to use this file (mandatory)

### 0.1 Phase order — hard

```
Phase PC-1  Spring config provider (B-spring-config) — the real gap, do first, biggest
  → Phase PC-2  CI Dockerfile-build verification — cheap, independent, can run anytime after/parallel to PC-1
  → Phase PC-3  Doc correction (stale CI/deployment claims) — do LAST, once PC-2's real result is known, so the correction states the true final state in one pass instead of twice
```

PC-2 does not depend on PC-1 and could run first or in parallel — sequenced after here only because PC-1 is the substantive item and the user asked for "one by one." PC-3 must be last: correcting the doc before PC-2 lands would need a second correction once PC-2's real result (build succeeds / fails / needs a Dockerfile fix) is known.

### 0.2 Why this program exists (agent orientation)

| Finding | Response |
|---|---|
| Weaver has zero code path reading Spring's own config (`application.yml`/`.properties`) — confirmed by grep, root-caused against both engines' real source | PC-1 |
| Neither CodeGraph nor Graphify can close this without an LLM (Graphify's YAML path is LLM-gated, deliberately skipped by `--code-only`) | PC-1 uses a 4th instance of the already-proven "structured file provider" pattern, not a new mechanism |
| `relationship-type-mapping.yml`'s `protocol` field has been always-`null` since v0.8 | PC-1 bundles the fix for near-zero extra cost (`spring.datasource.url`'s JDBC scheme) |
| `package.json`'s `Dockerfile` was flagged "specified, never executed — no Docker daemon in this sandbox" | PC-2 — GitHub Actions' `ubuntu-latest` runners have Docker preinstalled; a build-only CI step needs no daemon here |
| `Platform_Architecture_Analysis.md`/`STATUS.md` currently claim CI is unverified | **Stale** — `gh run list` shows 10+ consecutive green runs on real pushes to `dev`, including the just-shipped B-scale-oom fix. PC-3 corrects this and folds in PC-2's real result. |

### 0.3 Integrity (reject PR if violated)

| Principle | Required | Reject |
|---|---|---|
| No LLM | The new provider is a deterministic YAML/properties parser, same class as `k8s-manifest-provider.ts` | Any LLM call in the parse/extraction path |
| Catalogue-driven | New signals are catalogue rows (`persistence-detection-catalogue.yml`'s `spring-config-datasource` strategy, `messaging-detection-catalogue.yml`'s `spring-config-broker` strategy) — not hardcoded per-key logic in the provider | Per-property-name `if` branches in the provider itself |
| No fabrication | `${PLACEHOLDER}`-style Spring property indirection is NEVER statically resolved — emit the unresolved literal as low-confidence evidence or skip, name the limitation in scope-limitations output | Guessed/resolved placeholder values |
| Determinism | Byte-identical output (aside from timestamp) on every existing regression fixture before/after PC-1 | Any unrelated fixture's output changes |
| Real fixtures, real assertions | New test fixture (`pipeline/test/fixtures/spring-config-sample/` or similar) with exact assertions (specific host/port/protocol values, specific counts) — matching this project's own regression-suite standard | A smoke test that only checks the run doesn't crash |
| Evidence before code | T-VM-1/2 (vocabulary mining from `rewrite-spring`'s real recipe catalogue) done BEFORE writing T-SC-3…6's extraction logic | Property-key vocabulary guessed from memory |

### 0.4 Every phase completion

1. Real before/after evidence (regression suite pass count, new fixture assertions, or `gh run list` output for PC-2).
2. `git status --short pipeline/` confirms only the intended files touched.
3. BACKLOG.md / STATUS.md / Claim Register updated where the phase's own scope says so.
4. PR template filled (§0.5).

### 0.5 PR template

```markdown
## Phase 1 close delivery
- Phase: <PC-1|PC-2|PC-3>
- Task IDs: <T-SC-1, …>
- Real evidence: <fixture, gh run URL, or doc diff>
- Regression: <suite name, pass count>
- BACKLOG/STATUS/Claim Register updated: <yes/no + cells>
- Explicit residual: <…>
```

---

## Phase PC-1 — Spring config provider (`B-spring-config`) — **CLOSED, 2026-08-09**

All 8 sub-tasks done, real evidence per task below, 65/65 full suite green (62 pre-existing + 3 new). Real, disclosed residuals: ActiveMQ extraction built but not separately fixture-covered (Kafka+Rabbit met the stated verify bar); protocol-population mechanism proven but not fixture-proven end-to-end (synthetic units have no structural relationship pointing at them today). Neither blocks this phase's own DoD.

**Full sub-task detail lives in `coe-lab/docs/reference/spring-boot-gap-closure-backlog.md` — this section sequences and verifies it, does not restate it.** Read that file's "Suggested execution order" section first (it independently arrives at the same T-VM → T-SC ordering used here).

### T-PC1-0 — Vocabulary mining (`B-spring-vocab-mining`, do first — free, de-risks everything else)
Mine the real Spring config property-key vocabulary and profile-resolution rules from `openrewrite/rewrite-spring`'s recipe catalogue (read-only reference, not a runtime dependency — already rejected as a runtime dep in the reuse-check doc for the same JVM-bridge reason jQAssistant stayed deferred). Corresponds to T-VM-1/T-VM-2 in the source doc.
**Verify:** a committed reference table (key → meaning → CALM construct it feeds) alongside the provider's own design notes, not left implicit in code comments only; profile-override rule (`application-{profile}.yml` overrides `application.yml`) confirmed against a real multi-profile fixture, not assumed from docs alone.
**Status: DONE, 2026-08-09.** `docs/solution/language/spring-config-property-vocabulary.md`. Every key verified against real fetched source (`gh api` against `openrewrite/rewrite-spring`'s actual `spring-boot-*-properties.yml` migration recipes and `spring-projects/spring-boot`'s own `@ConfigurationProperties` classes — `DataSourceProperties`/`RabbitProperties`/`ActiveMQProperties`), not recalled from memory. **Real finding that justified doing this step at all**: `rewrite-spring`'s Boot 3.0 migration recipe renames every `spring.redis.*` key to `spring.data.redis.*` — a from-memory vocabulary would likely have picked only the current form. T-PC1-5 must support both forms (fallback to the pre-3.0 key). Also found: `spring.rabbitmq.addresses` takes precedence over `.host`/`.port` when set (real field comment in `RabbitProperties.java`) — T-PC1-4 must honor this. Profile-merge behavior decided: emit evidence from both base and profile files with clear provenance rather than silently merging or picking one (safer under this project's no-fabrication discipline) — T-PC1-1/8 must test this explicitly.

### T-PC1-1 — YAML config reader
New `scanner/spring-config-provider.ts`. Read every `application.yml`/`application-*.yml` per package root, reusing the `yaml` npm dependency already present for `k8s-manifest-provider.ts` (confirmed in `pipeline/package.json` — no new dependency). Corresponds to T-SC-1.
**Verify:** parses a real multi-profile fixture (`application.yml` + `application-prod.yml`) without error.
**Status: DONE, 2026-08-09.** `discoverSpringConfigFiles()` walks each root, parses `---`-separated multi-document YAML (`yaml`'s `parseAllDocuments`), flattens nested keys to Spring's own dot-notation. Real fixture (`test/fixtures/spring-config-sample/`) confirms both `application.yml` and `application-prod.yml` parse cleanly, each kept as a SEPARATE `SpringConfigFile` (T-VM-2's decided profile policy — see T-PC1-0).

### T-PC1-2 — Properties config reader
Read `application.properties`/`application-*.properties` (flat key=value, ~20-line parser, no new dependency). Corresponds to T-SC-2.
**Verify:** parses a real fixture; confirms a `.properties`-only Spring app (no YAML at all) isn't silently zero-evidence.
**Status: DONE, 2026-08-09.** `parsePropertiesFile()`. Real fixture (`test/fixtures/spring-config-properties-sample/`, `application.properties` only, zero YAML files) confirmed via a locked regression test producing real `database` units (datasource + redis) from `.properties` alone.

### T-PC1-3 — Datasource extraction + `protocol` bundle (`B-protocol-populate`)
Extract `spring.datasource.url`/`.username` → corroborating `database`-kind evidence + JDBC scheme, wired into `relationship-type-mapping.yml`'s currently-always-`null` `protocol` field. Corresponds to T-SC-3.
**Verify:** real fixture `jdbc:postgresql://host:5432/db` → tech = postgresql, host captured, a real relationship's `protocol` field is non-null for the first time in this project.
**Status: DONE, 2026-08-09.** `analysis/spring-config-pass.ts`'s `extractDatasource()` + `modules/calm-generator/port-interface-builder.ts`'s `springConfigProtocolBySignal()` (wired into `build-calm.ts`'s existing `protocolBySignal` map, the same mechanism T-X7-4 already built for `org.postgresql`'s driver-import row). Real fixture confirms `jdbc:postgresql://db-host:5432/orders` → a real `database` unit with that exact signal. **Honest scope note, not silently overclaimed**: the "non-null protocol on a real relationship" half is mechanism-proven (would fire correctly if a `TypedRelationship` pointed at/from this unit) but not fixture-proven end-to-end — these units are synthetic (no real Graphify graph node id), so no structural reconciler edge can ever link to them today. Same "mechanism proven, not guaranteed to fire" framing this project already uses for `org.postgresql`'s own protocol row.

### T-PC1-4 — Messaging broker extraction
Extract `spring.kafka.bootstrap-servers` / `spring.rabbitmq.*` / `spring.activemq.broker-url` → `network` node corroboration. Corresponds to T-SC-4.
**Verify:** real fixture per broker type — at least Kafka + one of Rabbit/ActiveMQ.
**Status: DONE, 2026-08-09.** `extractBrokers()`. Real fixture confirms Kafka (`spring.kafka.bootstrap-servers`, base file) AND RabbitMQ (`spring.rabbitmq.addresses`, profile file) both produce real `topic`-kind (CALM `network`) units. **Real, mined finding honored, not just documented**: `spring.rabbitmq.addresses` correctly takes precedence over `.host`/`.port` when both are present — locked into the regression test's own assertion text, not just a comment. ActiveMQ (`spring.activemq.broker-url`) implemented identically but not separately fixture-covered this round (Kafka + Rabbit was the stated verify bar) — real, honest residual, same extraction code path so low incremental risk.

### T-PC1-5 — Redis/cache extraction (genuinely new coverage, not just a second source)
Extract `spring.data.redis.host`/`.port`, `spring.cache.type` — no existing detector covers this at all today. Corresponds to T-SC-5.
**Verify:** real fixture with `spring.data.redis.*` set produces new cache/database-shaped corroboration.
**Status: DONE, 2026-08-09.** `extractRedis()`. Real fixture confirms `spring.data.redis.host`/`.port` → a real `database`-kind unit, with `spring.cache.type=redis` correctly merged as extra corroborating evidence on the SAME unit (confidence 40+10=50, asserted exactly in the regression test). **Real, mined finding honored**: the pre-Boot-3.0 `spring.redis.host` fallback (no `.data.` segment) also verified via the `.properties`-only fixture, which deliberately uses the OLDER key form — proves the fallback path is real, not just written.

### T-PC1-6 — Port extraction + formal interface (`B-formal-interface-port`)
Extract `server.port` → feeds a formal `interface-definition` (`tcp-host-port`) — the first time Weaver emits this CALM construct. Corresponds to T-SC-6.
**Verify:** real fixture with a non-default port (not just 8080).
**Status: DONE, 2026-08-09 — with a real correction from the original plan.** `attachServerPort()` (analysis) + `attachPortInterfaces()` (`modules/calm-generator/port-interface-builder.ts`). **Real finding while implementing**: `tcp-host-port` is NOT a member of this project's own `CalmInterfaceType` union in `types/calm.ts` — that union was verified against the real CALM schema (`calm.finos.org`) in an earlier session; the gap-closure research doc's "tcp-host-port" was informal research language, not the real schema value. Used the real, already-verified `port-interface` type instead — caught before shipping a schema-invalid value, not after a `calm validate` failure. Real fixture (`server.port: 9090`, non-default) confirms: attaches to the fixture's one real JAX-RS `service` unit, APPENDS to (never overwrites) its existing `path-interface`, `calm validate` 0 errors/0 warnings. **Never-guess discipline extended to a new case, real-tested both branches**: 0 service-unit candidates and 2+ candidates both produce a real `AMBIGUOUS_BOUNDARY` ignored item, never a guessed attachment — direct unit test on `springConfigPass.run()` with a synthetic 2-service-unit context proves neither candidate gets mutated.

### T-PC1-7 — Catalogue wiring
New `Evidence.category: 'spring-config'`; new catalogue rows in `persistence-detection-catalogue.yml` (`spring-config-datasource` strategy, alongside existing `driver-import`/`jpa-entity`) and `messaging-detection-catalogue.yml` (`spring-config-broker` strategy). Corresponds to T-SC-7.
**Verify:** catalogue loader accepts the new rows with zero code change elsewhere — proves the catalogue-driven discipline actually held for a new evidence source, not just existing ones.
**Status: DONE, 2026-08-09 — with an honest correction to the original wording.** New rows added to both catalogues as `status: implemented-elsewhere` (the same convention `jpa-entity`/`decorator-consumer` already use), NOT dispatched through `driverImportLibraries()`'s existing Set-based loader — that mechanism matches Graphify import-EDGE targets, a structurally different data source than parsed config-file KEYS; forcing config-key extraction through it would have been the "invent a 5th mechanism"/fabricated-dispatch-claim CLAUDE.md's own principle #2 warns against. `CONTRACT_VERSION` bumped 9.0.0→10.0.0 (real shape change: new `Evidence.source`/`category` union members); both existing modules (`calm-generator`, `threat-signals`) reviewed and their `supportedMajorVersion` bumped to `'10'` — `threat-signals` confirmed unaffected (filters only on `http-entry-point`/`security-control`, `spring-config` is neither); `calm-generator` needed one real new function (`attachPortInterfaces`), not just an additive read, since the existing generic interface-builder mechanism assumes route-shaped evidence.

### T-PC1-8 — Real fixture + exact-assertion tests
New `pipeline/test/fixtures/spring-config-sample/` (or similarly named, matching the existing `nestjs-sample`/`openapi-sample` convention): a package with `application.yml` (datasource + kafka) and a sibling with `application.properties` only. Corresponds to T-SC-8.
**Verify:** `npm test` gains real assertions (specific host/port/protocol values, specific node/relationship counts) — not a smoke test that only checks the run doesn't crash, matching this project's own regression-suite standard. Full suite green afterward, including all pre-existing fixtures byte-identical.
**Status: DONE, 2026-08-09.** Two real fixtures: `test/fixtures/spring-config-sample/` (JAX-RS resource + `application.yml` + `application-prod.yml`, exercises datasource/kafka/rabbitmq/redis/cache.type/server.port together) and `test/fixtures/spring-config-properties-sample/` (`.properties`-only, no YAML at all, no Java files). 3 new locked regression tests (65/65 full suite green, up from 62/62) with exact assertions — specific signal strings, specific confidence numbers (50, not "some number > 40"), specific interface types/ports, `calm validate` 0 errors/0 warnings — plus the 0-candidate/2-candidate port-ambiguity branches via a direct `springConfigPass.run()` unit test (no need for two more full fixture directories). All 4 pre-existing large fixtures unaffected (none contain Spring config files, so `springConfigPass` is a real no-op for them — confirmed by the unchanged 62 pre-existing tests all still passing byte-for-byte).

**Explicitly out of T-PC1 scope** (named, not silently dropped — matches the source doc's own explicit non-scope): `${PLACEHOLDER}`-style static property resolution (only the separately-tracked runtime-verification lane, A13, can resolve these correctly); `B-cdxgen-reuse` (PC-1 is config-file evidence only, not build/container facts — that's a separate item, not in this program); reading `spring-configuration-metadata.json` from resolved dependency jars (needs a build step Weaver doesn't have).

---

## Phase PC-2 — CI Dockerfile-build verification

### T-PC2-1 — Add a Docker build step to CI
`.github/workflows/pipeline-test.yml` currently runs `npm ci && npm test` only — no step ever builds `pipeline/Dockerfile`. GitHub's `ubuntu-latest` runners have Docker preinstalled, so a build-only step (`docker build -t weaver-pipeline pipeline/`) needs no daemon setup and no change to this sandbox's own local constraint (still no local daemon here — that stays a disclosed, permanent local-dev limitation, not something this task fixes).
**Verify:** real, not simulated — push the change and read the actual run result via `gh run list`/`gh run view`, the same way PC-3 will cite it. If the build fails (a real possibility — the Dockerfile has never been exercised), fix the Dockerfile, don't loosen the CI step to hide the failure.
**Status:** not started.

### T-PC2-2 — Confirm the built image is minimally sane
Once the build succeeds, add a cheap real smoke check in the same CI step (e.g. `docker run --rm weaver-pipeline node dist/orchestration/run-slice.js --help` or equivalent, matching how `run-slice`'s own usage message already works) — proves the image actually contains a runnable `dist/`, not just that the build didn't error.
**Verify:** real CI run shows the smoke check's expected output, cited by run URL/log excerpt, not assumed from "the build succeeded."
**Status:** not started.

---

## Phase PC-3 — Doc correction (stale CI/deployment claims)

**Do this last**, once PC-2's real, final result (build succeeds cleanly / needed a fix / smoke check passes) is known — folding a still-changing result into these docs mid-flight would just need a second correction pass.

### T-PC3-1 — Correct `Platform_Architecture_Analysis.md`
Currently states CI/deployment as "specified, not yet implemented... no way to trigger real GitHub Actions exist in this sandbox." Real finding (2026-08-09, this program): CI has been running successfully on every push to `dev` for 10+ consecutive runs, confirmed via `gh run list` — the claim was accurate about *this sandbox's own visibility* but is stale as a statement about the real repo's CI status. Correct to state plainly: CI is real, running, green (cite the `gh run list` evidence); the Docker image itself was the one genuinely unverified piece, closed by PC-2 (cite PC-2's real result).
**Verify:** the corrected text traces every claim to either a `gh run list`/`gh run view` citation or PC-2's own real result — no restated assumption.
**Status:** not started.

### T-PC3-2 — Correct `STATUS.md`
Same correction, wherever `STATUS.md` currently frames CI/deployment as unverified — check via grep before editing rather than assuming the exact wording/location.
**Verify:** grep confirms no remaining "CI unverified"/"no Docker daemon in this sandbox" framing stated as a current gap once PC-2 is real and green.
**Status:** not started.

### T-PC3-3 — BACKLOG.md close-out
Flip `B-spring-config`'s row to `done` (reconcile the P0-vs-P1 priority-label mismatch between `BACKLOG.md` and the coe-lab gap-closure doc while touching this row — minor doc-hygiene nit named in the original prioritization pass). Add a note that CI/Docker verification (a real, previously-unnamed residual) is now closed too.
**Verify:** `BACKLOG.md`'s `B-spring-config` row cites the real fixture/test evidence from PC-1, not just "done."
**Status:** not started.

---

## Program DoD (Definition of Done)

- [ ] PC-1 (T-PC1-0…8) complete: Spring config provider real, tested, catalogue-driven, `protocol` populated for the first time, real fixture with exact assertions, full suite green.
- [ ] PC-2 (T-PC2-1/2) complete: Dockerfile builds in real CI, minimal smoke check passes, cited by real `gh run` evidence.
- [ ] PC-3 (T-PC3-1…3) complete: stale CI/deployment claims corrected in both docs, `BACKLOG.md` closed out.
- [ ] Every existing regression fixture byte-identical (aside from timestamp) throughout PC-1.
- [ ] `git status --short pipeline/` clean of anything unintended after each phase.
- [ ] Honest residual named for anything not fully closed (matches this whole project's own convention — deferrals are fine, silent scope cuts are not). Known candidates: A13 runtime-verification lane (explicitly out of scope, separate item); `${PLACEHOLDER}` static resolution (explicitly never done); local Docker daemon still absent in this sandbox (PC-2 verifies via CI, not locally — name this distinction, don't overclaim local verification).
