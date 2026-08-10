# Weaver — Backlog

What's left to build. For what's already built, see [`Capabilities.md`](./Capabilities.md). For completeness-claim rules, see [`Claim_Register.md`](./Claim_Register.md). For permanent non-goals (with reasons), see [`OOS_Registry.md`](./OOS_Registry.md).

**Update rule:** when an item ships, remove its row here and reflect it in `Capabilities.md` / `Claim_Register.md` as appropriate.

## P1 — Correctness and coverage gaps

| Item | Description |
|---|---|
| **Tier-B residual detection** | The residual-review tooling can present a "medium-confidence, needs a human decision" card, but no detector currently produces that class of input — every real detection today is either high-confidence (auto-emitted) or too ambiguous to rank (multiple candidates). A detector that separates "one high-confidence candidate just under the auto-emit threshold" from "genuinely many candidates" would give the review tooling real input to act on. |
| **`@Configuration` classes mis-typed `database` via driver-import evidence** | Evidenced during Bug 3's Phase A evidence pass (`soln/bug3-jdbc-ownership-phase-a-memo.md`): a `@Configuration`/`@Bean`-wiring class referencing a driver-import library only as a factory-method parameter type (never actually querying with it) is architecturally never a table owner, regardless of which library. Real evidence: 35 of 156 real Fineract files importing `org.springframework.jdbc.core` are `@Configuration` classes (e.g. `AccountingJournalEntryConfiguration`). Cheap, general, ready-to-implement fix — same class of mechanism as the existing annotation read-back (`class-ownership-resolver.ts`), generalizes past JDBC to any driver-import catalogue library. |
| **JDBC read-service-vs-table-owner ambiguity — remains a documented limitation, not yet a scoped fix** | Already a named, disclosed limitation (`persistence-import-vs-ownership-ambiguous` in `scope-limitations.yml`); Phase A investigated further (`soln/bug3-jdbc-ownership-phase-a-memo.md`) and found no reliable, corroborated signal: `RowMapper<T>` presence is FALSIFIED as a distinguishing signal (present on the flagship false-positive class itself, `ChargeReadPlatformServiceImpl`, and on 55% of JdbcTemplate-importing files overall — doesn't separate real owners from read-only query services); a bare `@Service`/`@Component` stereotype does NOT already exclude a class either (confirmed via `JournalEntryRunningBalanceUpdateServiceImpl`, `@Service`-annotated and still typed `database`); a naming convention (`*ReadPlatformServiceImpl`) is single-repo-sourced, not corroborated. **Constraint for any future attempt**: `ChargeReadPlatformServiceImpl` has no other mechanism giving it unit existence at all — `Claim_Register.md`'s gold-scored `R2-multi-root-access-terminal` row depends on it resolving to a unit; a fix must only ever change `kind` from `database` to `service`, never suppress unit creation, or it regresses that claim. |
| **Direct-delegate bridge detection** | Multi-hop architecture-bridge detection currently requires an `implements` edge between a candidate bridge class and its interface. A common real pattern — a concrete service class referenced directly, with no interface at all, that itself imports exactly one persistence/messaging unit — is invisible to the current detector. Real evidence exists (28 real candidates found in a public sample, 0 resolved); not yet built. |
| **Possible bare-identifier collision inside multi-hop bridge detection — NOT YET REPRODUCED** | Flagged by review of the stereotype-name-collision fix (`graphify-reconciler.ts`'s `isBareNameCollision`), not independently confirmed with real evidence. `multi-hop-bridge-detector.ts` walks the same raw Graphify `imports`/`references` edges via its own separate loop, using the identical bare-label-only node resolution the collision bug is rooted in — but its bridge-candidacy gate (`if (nodeToUnit.has(bridgeNodeId)) continue`) requires the target to have ZERO existing units, which the evidenced collision shape (`Component`/`Response`, both real `@Entity` classes with existing units) structurally cannot satisfy — so the fixed mechanism's exact evidenced shape cannot reach this path. A theoretically-reachable variant (a bare-name collision landing on a genuinely zero-unit interface that is itself `implements`-ed elsewhere by a real persistence/messaging unit) has not been reproduced against a real repo. Needs its own real-evidence pass before scoping a fix, per this project's own discipline — do not extend the collision check here speculatively. |
| **Bulk residual-decision authoring** | The residual-review UI suggests answering once and applying the decision to a whole class of similar residuals, but no such batch mechanism exists — every residual currently needs its own individually-authored decision record. At real scale this is a real throughput problem (tens of near-identical residuals from a single module in one real dry run). |
| **Plain-interface bridge detection** | Interface classes with no framework marker at all (no route annotation, no persistence annotation, no security annotation) are structurally invisible even when they sit exactly on a real service boundary. Candidate mechanism: promote a plain interface to a placeholder unit when it's a field-injected dependency of an already-typed service — needs its own evidence pass before building. |
| **Bean-factory / stereotype-free wiring detection** | A common real convention — components wired via `@Configuration`/`@Bean` factory methods with no class-level stereotype annotation on the implementation — produces zero detection signal today. Generic `@Service`/`@Component` stereotype detection and DI-based interface-to-implementation resolution are both real, related gaps. |

## P2 — Detection breadth

| Item | Description |
|---|---|
| **Kinesis stream detection** | Evidenced as a real pattern in job-posting research; no catalogue coverage yet. |
| **Deeper OAuth2 evidence** | Currently only detected via OpenAPI security schemes; library-import/config-level detection not yet built. |
| **Container/compose corroboration** | The dependency-manifest corroboration lane (via an external SBOM tool) covers build-file dependencies; Docker/compose/Kubernetes container facts from the same tool are not yet wired in. |
| **ADR ingestion** | Linking existing Architecture Decision Record documents into the generated CALM output's `adrs[]` array — not yet built. |

## P3 — Platform

| Item | Description |
|---|---|
| **Portable, CALM-round-trippable IR** | The current human-readable architecture summary is one-way (facts → markdown). A portable version that round-trips real CALM node/relationship fragments would let it double as a distribution format — proposed, needs review before implementation. |
| **Third-party plugin discovery / embed API** | The module boundary (contract version, module registry) exists; external plugin discovery and a library embed API do not. |
| **Two-tier (global + domain) mapping configuration** | Not yet built. |
| **Additional engines on measured gaps only** | Static-analysis engines beyond the current pair should only be added where a real, measured coverage gap justifies it — not speculatively. |
| **Scope-limitations ↔ claim-register consistency** | Ongoing discipline: every new detection gap named in generated-output metadata should have a matching completeness-claim entry, checked each time scope changes. |

## Explicitly out of scope, near-term

- **Helm/Kustomize template resolution** — only flat, pre-rendered Kubernetes manifests are read today; template/overlay resolution is a materially larger problem.
- **Additional languages / frontend frameworks** (Go, .NET/C#, React/Angular, etc.) — no evidenced near-term need.

See [`OOS_Registry.md`](./OOS_Registry.md) for permanent (not just near-term) non-goals and their reasoning.
