# AGENT TASKS — due-list after T-CL-1

**Audit:** 2026-08-20. Does **not** replace `AGENT_TASKS_Ext_Execution_Order.md`.
Companion: `Business_Requirements_Coverage.md`.
Sources: `01-business-challenge.md` §7 / §13, `02-solution-architecture.md`.

**T-CL-1 is treated as complete.** Implementation lives on
`feature/contract-lifecycle` (worktree
`/Users/gowri/Innovation/arch_weaver-contract-lifecycle`, uncommitted as of
this audit; claim row `T-CL-1-fact-identity`). This checkout
(`feature/semantic-model-extension` @ `ed41720`) does **not** yet contain
that code. **Merge that worktree before starting T-CL-2 here.**

---

## Brief coverage summary

`01` §7 business/functional, NFR, and CON items are either implemented on
Weaver, tasked in an `AGENT_TASKS*.md` file, parked in Phase 2 with a
revisit trigger, or knowingly deferred (`NFR-50` / `NFR-60` in
`AGENT_TASKS_Semantic_Model_Extension.md` §5b).

`02` names a hexagonal research design. Weaver is the harvest of that
design (`BR-150`), not a second copy of every port. Every `02` component
maps onto something already built, a T-* row, a deferred trigger, or an
intentional non-literal (Weaver’s *how* differs — see §5).

Must-priority still unbuilt — all four are on the execute-next list:

| Requirement | Still unbuilt | Task | Hand this file to the agent |
|---|---|---|---|
| **BR-70** | Incremental merge (identity done) | **T-CL-2** | `docs/solution/AGENT_TASKS_Ext_Contract_Lifecycle.md` |
| **NFR-20** | Review history | **T-CL-3** | `docs/solution/AGENT_TASKS_Ext_Contract_Lifecycle.md` |
| **NFR-40** | Emission coverage | **T-CL-5** | `docs/solution/AGENT_TASKS_Ext_Contract_Lifecycle.md` |
| **BR-20** | Cross-repo joins (multi-root exists) | **T-MR-1** now; **T-MR-2** after T-CL-2 | `docs/solution/AGENT_TASKS_Ext_MultiRepo_Deployment.md` |

Also give the agent `docs/solution/AGENT_TASKS_Semantic_Model_Extension.md` as governance/DoD (not a work queue). Merge `feature/contract-lifecycle` before T-CL-2.

**One gap remains unowned:** `01` §13 success criterion #3 — CI blocks merge
when an unconfirmed fact touches PII / a service. T-FS-6 status exists; no
T-* row owns the gate.

---

## Closed — do not reopen as sessions

| Session / item | Built | Addressed without building |
|---|---|---|
| **A** Lens Modules | `T-LM-0`, `T-LM-2`, `T-LM-5` | `T-LM-1/3/4` **Phase 2** (`BACKLOG.md`) |
| **B** Fact Semantics | `T-FS-1`…`4`, `T-FS-6` | `T-FS-5` skipped / **Phase 2** only if a different combination rule is researched |
| **C** Layered Recovery | `T-LR-1`…`3`. `T-LR-4` **closed via T-LR-5** (`6173b36`) | Exception-as-bridge noise stays BACKLOG. Remainder is `T-LR-6`, not a second DI engine |
| **T-CL-1** Fact identity | Content-derived `TypedRelationship.id` (`kind\|from\|to\|mechanism-or-source`); `TypedUnit.id` audited already content-derived; positional `rel-${i}` / `iface-port-${i}` counters fixed | Endpoint rename is a new fact + a disappeared one, by design |

**Newly unblocked by T-CL-1:** `T-CL-2`, `T-CL-3` (then `T-CL-4` after both).
`T-CL-5` was already free. `T-CL-6` still waits on T-CL-2.
`T-MR-1` design can start; `T-MR-2` still waits on T-CL-2.

---

## Do not execute

| File | Why |
|---|---|
| `AGENT_TASKS_Ext_P0_Experiments.md` | Closed |
| `AGENT_TASKS_Architect_Pilot_Fixes.md` | Prior cycle |
| `AGENT_TASKS_Semantic_Model_Extension.md` | Gates only |
| `AGENT_TASKS_Ext_Layered_Recovery.md` | C finished what it can |
| `AGENT_TASKS_Ext_Fact_Semantics.md` | B finished (T-FS-5 parked) |
| `AGENT_TASKS_Ext_Lens_Modules.md` | A finished. `T-LM-1/3/4` are Phase 2, not due |

---

## Execute next — priority order

| Priority | File | Do now | Then / wait |
|---|---|---|---|
| **1** | `AGENT_TASKS_Ext_Contract_Lifecycle.md` | **T-CL-2 Incremental merge** (BR-70). **T-CL-3 Review history** can run in parallel (depends only on T-CL-1). **T-CL-4** after 2 **and** 3 | **T-CL-5** still parallel, no gate. **T-CL-6** after T-CL-2. Merge `feature/contract-lifecycle` first |
| **2** | `AGENT_TASKS_Ext_Review_Throughput.md` | **T-RT-1** then **T-RT-2** | **T-RT-4** after those two. **T-RT-3** anytime with real evidence |
| **3** | `AGENT_TASKS_Ext_CodeQL_Engine.md` | **T-LR-5 done** (`6173b36`, DI only). Do **not** start a second DI engine | **T-LR-6** (per-fact-type trust matrix) is the remainder |
| **4** | `AGENT_TASKS_Ext_MultiRepo_Deployment.md` | **T-MR-3**, **T-MR-5** now. **T-MR-1** (manifest) may be designed now | **T-MR-2** after T-CL-2 **and** T-MR-1. **T-MR-4** carefully / after CodeQL |
| **5** | `AGENT_TASKS_Ext_Remaining_Lenses.md` | **T-LM-8** written decision (recommend external `calm validate -p`) | **T-LM-6 / T-LM-7** Phase 2 — only with a real consumer + gold |

---

## Recommended next session (pick one)

1. **T-CL-2 Incremental merge** — highest remaining BR leverage (BR-70, BR-100, success criterion #8). Unblocks T-CL-6 and T-MR-2. Merge the contract-lifecycle worktree first.
2. **T-RT-1 → T-RT-2** — NFR-80, both gates green; independent of T-CL-2.
3. **T-CL-5** — smallest, parallel with either of the above (NFR-40).
4. **T-CL-3** — NFR-20; parallel with T-CL-2, not a substitute for it.

Do not start T-LM-1/3/4/6/7 (Phase 2). Do not start a second CodeQL DI session. Do not start T-MR-2 or T-CL-6 before T-CL-2. Do not start T-CL-4 before T-CL-2 and T-CL-3.

---

## `01` §7 / §13 cross-check

| ID | Status now | Next file |
|---|---|---|
| BR-10 | Stronger (T-LR-3). Bean-factory **wired via T-LR-5** (opt-in CodeQL DI) | T-LR-6; command-bus not shipped |
| BR-20 | Multi-root only | T-MR-1 design now; T-MR-2 after T-CL-2 |
| BR-30 | Built | — |
| BR-40 | **Built** (`FactStatus` + `x-aac-status`) | — |
| BR-50 | Security + resilience scored + fitness declared. Vuln/lineage/green + workflow/obs are **Phase 2** | T-LM-8 decision only this phase |
| BR-60 | Contradiction, secondary-source introduction, **and opt-in CodeQL DI** built. Trust matrix not | **T-LR-6** |
| BR-70 | Identity **done** (T-CL-1). Incremental merge **not** | **T-CL-2** (then 3, 4) |
| BR-80 | Still OOS on core path | T-RT-4 after T-RT-1/2 |
| BR-90 / 120 / 140 / 150 | Built | T-CL-4 when merge/history land |
| BR-100 | Partial (no incremental fact-diff) | T-CL-2 |
| BR-110 | threat-signals + resilience **declared** | Remaining new lenses must carry `fitness.json` |
| BR-130 | Ledger process exists | Keep logging |
| NFR-10 | No identity-stable repeated-run test | T-CL-6 after T-CL-2 |
| NFR-20 | **Not built** | **T-CL-3** (unblocked by T-CL-1) |
| NFR-40 | No emission-coverage report | **T-CL-5** (parallel) |
| NFR-50 / 60 | Deferred (`AGENT_TASKS_Semantic_Model_Extension.md` §5b) | — |
| NFR-80 | Queue + Tier-B + contradiction cards exist; bulk apply + ranking **not** | **T-RT-1**, **T-RT-2** |
| NFR-90 / CON-* | Hold | — |

**§13 success criteria:** 2, 6, 9, 11 implemented. 1, 5, 7 partial. 4, 8, 10
tasked (`T-MR-2`, `T-CL-2`+`T-CL-6`, `T-RT-2`). **#3 (CI blocks merge when an
unconfirmed fact touches PII / a service) is still neither implemented nor a
T-* row.**

---

## `02-solution-architecture.md` components — Weaver mapping

| `02` component | Weaver | Capture |
|---|---|---|
| Topology Resolver / `archdisc` CLI | `run-slice.js` takes package roots; no separate `TopologyPort` | Existing. Not a missing task |
| Extractor adapters | CodeGraph + Graphify + k8s / OpenAPI / Spring config / cdxgen + CodeQL DI | Built (T-LR-5). Command-bus query not shipped — BACKLOG, not a second DI session |
| Review Assistant | Off generation path | **T-RT-4** after T-RT-1/2 |
| Evidence normalizer + redaction | Analysis passes; IR redaction; Secret names only | Built (`NFR-90`) |
| Reconciliation + fact identity (`02` §4.3) | `T-CL-1` **done**; merge is `T-CL-2`; contradiction is `T-FS-3` | T-CL-2 next |
| Model assembler + emission coverage (`02` §4.6) | `calm-generator` | **T-CL-5** |
| Governance gate | `calm validate`; Decision Records | T-LM-8 (pattern stance). **CI PII/service merge gate (`01` §13 #3) unowned** |
| Derived SQLite index (`02` §4.4) | Lenses read `typed-facts.json` / CALM JSON directly | **Not tasked.** 02 *how*; Weaver modules already query without SQL. Reopen only if a consumer needs declarative SQL lenses |
| Lens engine | Module registry (`threat-signals`, `resilience-lens`) | Built. Remaining named lenses are Phase 2 / T-LM-8 |
| Review gate | Decision Records + `tools/review-session` | Built; throughput is T-RT-* |
| Review UI (`02` §12 Phase 2) | `02` itself defers this | Not a Weaver build this phase. review-session is the current adapter |
| Multi-repo (`02` §11) | Multi-**root** built | **T-MR-1 / T-MR-2** |
| Access governance (`02` §12 / NFR-60) | — | Knowingly deferred §5b |
| CALM `timelines` (`02` §10) | — | Not tasked. T-CL-3 (review history on facts) is the NFR-20 path; timelines are a representation convenience on top |
