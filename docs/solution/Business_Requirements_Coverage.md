# Business requirements coverage

**Source of requirements:** `research/codeintel/Architecture Model/docs/01-business-challenge.md` §7 (BR / NFR / CON) and §13 (success criteria).

**Purpose:** one place to see whether each requirement is already built on the Weaver platform, tasked in an `AGENT_TASKS*.md` file, in a running session, knowingly deferred, or missing. Use this to pick the next session, not to re-derive scope.

**Last audit:** 2026-08-19. Status of record for *how far along* remains `Capabilities.md` / `Claim_Register.md` / `BACKLOG.md`. This file only traces §7 IDs onto those. Due-list: `AGENT_TASKS_Ext_Execution_Order.md`.

---

## 1. Sessions A / B / C — closed (2026-08-19)

Do not reopen these three as in-flight work. Leftovers stay gated.

| Session | Built | Addressed without building |
|---|---|---|
| **A — Lens Modules** | `T-LM-0`, `T-LM-2`, `T-LM-5` | `T-LM-1` no CVE feed; `T-LM-3` no classification facts; `T-LM-4` no cost feed |
| **B — Fact Semantics** | `T-FS-1`, `T-FS-2`, `T-FS-3`, `T-FS-4`, `T-FS-6` | `T-FS-5` skipped (E5 negative) |
| **C — Layered Recovery** | `T-LR-1`, `T-LR-2`, `T-LR-3`; `T-LR-4` closed via T-LR-5 | Exception-as-bridge noise stays BACKLOG |

**Now unblocked (see `AGENT_TASKS_Ext_Execution_Order.md`):**

| Item | Why it is free |
|---|---|
| `T-CL-2`…`T-CL-4` Contract & Lifecycle | T-CL-1 done (2026-08-20) — BR-70 / NFR-20 critical path |
| `T-CL-5` Emission-coverage | No gate |
| `T-RT-1`, `T-RT-2` Review Throughput | T-FS-1 and T-FS-6 done |
| `T-LR-6` Per-(engine, fact-type) trust tiers | T-LR-5 done; this is the remainder in the CodeQL file |
| `T-MR-3`, `T-MR-5` | Independent `[B]` items |
| `T-LM-8` Pattern-conformance stance | Written decision; do not wait for T-LM-1/3/4 |

---

## 2. Scorecard (2026-08-19)

| Bucket | Count | Meaning |
|---|---|---|
| Implemented on the platform | 16 | Requirement is already satisfied enough to use; residual work is honesty/partial, not “unstarted” |
| Tasked and **in a running session** | 0 | A/B/C closed 2026-08-19 |
| Tasked, not started, no session | 14 | In an `AGENT_TASKS*.md` file, free or gated |
| Knowingly deferred | 2 | Named in `AGENT_TASKS_Semantic_Model_Extension.md` §5b with a reopen trigger |
| Missing from AGENT_TASKS | 3 | Required in §7, no execution row |
| Constraint / process (not a build task) | 6 | Bind how we work; already encoded in OOS / isolation / claim register |

Must-priority items still unbuilt: BR-20 (cross-repo), BR-70 (incremental merge), NFR-20 (review history), NFR-40 (emission coverage). All four are tasked and unblocked (T-CL / T-MR). The three BR-50 remaining lenses are tasked in `AGENT_TASKS_Ext_Remaining_Lenses.md`.

---

## 3. Business / functional requirements (BR)

| ID | Requirement (short) | Platform | AGENT_TASKS | Session | Decision |
|---|---|---|---|---|---|
| **BR-10** | Model from Java / TS / Python source + config | **Implemented** (routes, persistence, messaging, controls, config, OpenAPI, k8s trust). Layered Java now includes `T-LR-4` (bean-factory wiring, via T-LR-5's CodeQL engine, 2026-08-19) | Residual: `T-MR-4` remaining drivers | C closed, T-LR-5 closed | Do not start a fourth “language coverage” session |
| **BR-20** | Single- and multi-repo, including **cross-repo** joins | Multi-**root** (co-scanned) **implemented**. Cross-**repo** (not co-scanned) **not** | `T-MR-1`, `T-MR-2` | — | Wait for T-CL-2, or only design T-MR-1 (manifest) now |
| **BR-30** | Every fact traces to evidence | **Implemented** (file:line / structured pointer, IgnoredItems) | — | — | No new task |
| **BR-40** | Explicit confidence / **review status**; nothing gates until confirmed | **Implemented** — confidence + `FactStatus` (`observed`/`inferred`/`requires-review`/`reviewed`/`externally-verified`), `x-aac-status` CALM metadata, hard rule tested (2026-08-18) | `T-FS-6` — **done** | **B** | Closed. `T-CL-*`/`T-RT-2` may now start |
| **BR-50** | Open lens set. Minimum named: security, vulnerability, data flow, **workflow/feature**, **observability**, resilience, **pattern conformance**, sustainability | Security + resilience scored; fitness declared. Vuln/lineage/green gated (no feed). Workflow/obs/pattern tasked, not built | `T-LM-1`…`4` in Lens Modules (1/3/4 gated). `T-LM-6`…`8` in Remaining Lenses | A closed | Do not invent T-LM-1/3/4. T-LM-8 is a written decision |
| **BR-60** | Multiple techniques, explicit reconcile, no irreversible single tool | Dual-engine + structured-file + SBOM **partial, secondary-source introduction done** (T-FS-4). Contradiction **done** (T-FS-3). CodeQL **DI resolution shipped** (T-LR-5, 2026-08-19, opt-in/local-only — command-bus dispatch not shipped). Trust-tier PLACEMENT done; full per-fact-type MATRIX (`T-LR-6`) still stub | `T-LR-6` | — | — |
| **BR-70** | Incremental re-extract; preserve human review; flag don’t overwrite | Overrides persist. **T-CL-1 (fact identity) done, 2026-08-20** — real `unique-id` run-scoped-counter bug found and fixed (`Claim_Register.md`'s `T-CL-1-fact-identity` row). Incremental merge itself (T-CL-2) still **not** built | `T-CL-2`…`4` | — | T-CL-1 done — T-CL-2 (incremental merge) now unblocked |
| **BR-80** | LLM never writes facts; advisory only | **Implemented as a permanent non-goal** (`OOS-llm-core-path`). `suggest-rules.ts` + residual-review are offline | `T-RT-4` (advisory layer) | — | Do not put any LLM on `run-slice` |
| **BR-90** | Versionable, schema-validatable representation for CI / review | **Implemented** (`calm validate`, CALM 1.2). In-repo CI workflow existence ≠ a required product CI gate | — | — | No new task |
| **BR-100** | Human-reviewable “what changed and why” | **Partial** — IR + coverage + review queue exist; no incremental diff-of-facts yet | `T-CL-2` + IR; review session pack | — | Blocked on incremental merge |
| **BR-110** | Per-lens fitness measured; unmeasured lenses must not gate | Architecture gold + L0–L4 **implemented**. Module gold: `threat-signals` (`T-LM-0`) + `resilience-lens` (`T-LM-2`), both **done**. Machine-readable declaration mechanism **done** (`T-LM-5`) | Any new lens authors gold from fixture source (CON-40) | A closed | Remaining new lenses must carry `fitness.json` |
| **BR-120** | Versioned consumer contract; break loudly | **Implemented** (`contractVersion` 11, registry skip) | `T-CL-4` when identity/merge lands | — | No new task until T-CL-1..3 |
| **BR-130** | Value/cost ledger every validation pass | **Process implemented** (research `docs/04-value-ledger.md`; E2/E4/E5 logged). Not a code task | Named in extension §5c, not a T-* row | — | Keep logging; no AGENT_TASKS gap |
| **BR-140** | Claim register + frozen disconfirming exams | **Implemented** (`Claim_Register.md`, standing exams) | Discipline, not a build task | — | No new task |
| **BR-150** | Harvest before rebuild | **Implemented** — this platform *is* the harvest | — | — | No new task |

---

## 4. Non-functional requirements (NFR)

| ID | Requirement (short) | Platform | AGENT_TASKS | Session | Decision |
|---|---|---|---|---|---|
| **NFR-10** | Determinism (semantic identity, ignore timestamps) | **Partial** — deterministic core; no repeated-run identity test; CodeGraph same-process degradation is a known P1 | `T-CL-6` | — | After T-CL-2. Do not invent a scale target to “fix” CodeGraph |
| **NFR-20** | Status-change history retrievable | **Not built** | `T-CL-3` | — | After T-CL-1 (T-FS-6 done) |
| **NFR-30** | Add engine / language / lens without rewriting the core | **Implemented** (catalogues, pass/module registries, `StructuralEngine`). E4 confirmed catalogue-as-data with a real matcher caveat | New lens: Remaining Lenses. New engine: `T-LR-5` | — | Refuse metadata-stuffing |
| **NFR-40** | Representation replaceable; loss reported | CALM-only emitter. Loss not a required report | `T-CL-5`. Second emitter **deferred** (§5b) | — | T-CL-5 can start without T-FS-6 |
| **NFR-50** | Stated scale target for per-PR CI | **Not set** (honest gap) | **Knowingly deferred** §5b | — | Do not invent a number |
| **NFR-60** | Access to model governable independently of source | **Not designed** | **Knowingly deferred** §5b | — | Reopen when the model is shared outside the source-readers |
| **NFR-70** | Requirements stay tool-agnostic | Process (`01` §9) | — | — | Authoring rule, not a build task |
| **NFR-80** | Bounded, triaged review queue; size/age queryable | Queue + Tier-B + contradiction cards exist. Ranking / aging / bulk apply **not** | `T-FS-1` done. `T-RT-1`, `T-RT-2` unblocked | B closed | Start T-RT-1 then T-RT-2 |
| **NFR-90** | Do not persist secrets in evidence | **Implemented** (IR redaction; k8s Secret **names** only; review-session redact) | — | — | No new task. Keep `OOS-secret-values` |

---

## 5. Constraints (CON)

| ID | Constraint | Captured? | Notes |
|---|---|---|---|
| **CON-10** | Build-based extraction needs a working build | **Yes** — `T-P0-2` / `T-LR-5` degrade-like-graphifyy | CodeQL session must not assume a live CodeQL DB |
| **CON-20** | Some techniques need a commercial licence for private repos | **Yes** — `T-P0-2a` durable summary; BACKLOG CodeQL row | OSS eval OK; enterprise needs GHAS before T-LR-5 production |
| **CON-30** | Human review is permanent | **Yes** — Decision Records; `T-RT-*`; `OOS-llm-core-path` | Review throughput feeds the queue; it does not automate the gate away |
| **CON-40** | Gold must not inform detectors | **Yes** — `coe-lab/ISOLATION.md`, CLAUDE.md | New lenses author gold from fixture source only |

---

## 6. Gaps — required in §7, not a T-* row

These are the only §7 items that are **neither implemented nor tasked**. Everything else is built, tasked, or deferred with a trigger.

| Gap | Why it matters | Suggested decision |
|---|---|---|
| **BR-50 — workflow / feature-traceability lens** | Named in the minimum lens set | **Tasked** as `T-LM-6` in `AGENT_TASKS_Ext_Remaining_Lenses.md`. Needs a real consumer + gold |
| **BR-50 — observability lens** | Same | **Tasked** as `T-LM-7` in the same file. Needs a real consumer + gold |
| **BR-50 — architectural-pattern conformance lens** | `calm validate -p` is explicitly *external* governance in the platform design | **Tasked** as `T-LM-8` in `AGENT_TASKS_Ext_Remaining_Lenses.md` — default (a) external, write the choice down |

NFR-50 and NFR-60 are gaps in the product sense but are **already captured** as deferred with reopen triggers — not missing.

---

## 7. Success criteria (§13) — are they tasked?

| # | Criterion | Status |
|---|---|---|
| 1 | Each in-scope framework validated on a real repo | **Partial / ongoing** — Claim_Register cells. Not a single task |
| 2 | Schema-valid model before review | **Implemented** (`calm validate`) |
| 3 | CI blocks merge when an unconfirmed fact touches PII / a service | **Not tasked.** T-FS-6 status exists; CI gate is still unowned |
| 4 | One multi-repo relationship via ranked join, real two-repo pair | **Tasked** — `T-MR-2`. Not started |
| 5 | Every active lens queryable on one real model | **Partial** — `threat-signals` + `resilience-lens` + CALM |
| 6 | One new lens as a query, no schema redesign | **Done** — resilience-lens. `threat-signals` already proved the module boundary |
| 7 | One fact from a non-primary technique at its own trust tier | **Partial** — OpenAPI / k8s / SBOM / E2 placeholders exist; earned per-fact-type tiers are `T-LR-6` |
| 8 | Re-run identical; incremental update does not silently overwrite confirmed facts | **Tasked** — `T-CL-2` + `T-CL-6` |
| 9 | One lens with a real fitness measurement; others marked not-fit-to-gate | **Done** for the two built lenses (`T-LM-0` + `T-LM-5`). New lenses must carry `fitness.json` |
| 10 | Review queue triaged; backlog size/age queryable | **Tasked** — `T-RT-2` unblocked |
| 11 | Value ledger has ≥1 value event and is checked for cost events | **Implemented** (research ledger; E2 cost + E2/E4/E5 value) |

---

## 8. Decision list (next session)

Pick at most one. Authoritative order: `AGENT_TASKS_Ext_Execution_Order.md`.

1. **T-CL-2 → 3 → 4** — T-CL-1 done (2026-08-20); highest BR leverage remaining (BR-70 / NFR-20).
2. **T-RT-1 then T-RT-2** — NFR-80, both gates green.
3. **T-CL-5** — smallest, parallel with either of the above.
4. **T-LR-6** — remaining CodeQL work (per-fact-type trust matrix). Do not start a second DI engine. GHAS before private-repo production use of T-LR-5.
5. **Do not start:** NFR-50/60 (deferred), T-FS-5 (skipped), E3 (deprioritised), T-LM-1/3/4 without a real feed, T-MR-1/2 or T-CL-6 before T-CL-2.

---

## 9. File map

| Need | File |
|---|---|
| What / why | research `docs/01-business-challenge.md` |
| Built vs backlog | `Capabilities.md`, `BACKLOG.md`, `Claim_Register.md` |
| P0 experiments | `AGENT_TASKS_Ext_P0_Experiments.md` (closed) |
| Session A | `AGENT_TASKS_Ext_Lens_Modules.md` |
| Session B | `AGENT_TASKS_Ext_Fact_Semantics.md` |
| Session C | `AGENT_TASKS_Ext_Layered_Recovery.md` |
| Next after B | `AGENT_TASKS_Ext_Contract_Lifecycle.md`, `AGENT_TASKS_Ext_Review_Throughput.md` |
| Cross-repo | `AGENT_TASKS_Ext_MultiRepo_Deployment.md` |
| After A (remaining BR-50 lenses) | `AGENT_TASKS_Ext_Remaining_Lenses.md` |
| After C (CodeQL wiring) | `AGENT_TASKS_Ext_CodeQL_Engine.md` |
| Due-list / wave order | `AGENT_TASKS_Ext_Execution_Order.md` |
| Cross-cutting gates | `AGENT_TASKS_Semantic_Model_Extension.md` |
