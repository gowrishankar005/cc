# AGENT TASKS — what is due, and in what order

**Audit:** 2026-08-19. Companion: `Business_Requirements_Coverage.md`.

A/B/C **and the B leftovers** are now addressed in the task files
(`047d458` T-FS-4 + T-LM-5; `1cc876e` T-FS-6). This file is the due-list
only.

---

## 0. A / B / C — closed as sessions (what “addressed” means)

| Session | Built | Addressed without building |
|---|---|---|
| **A** | `T-LM-0`, `T-LM-2`, `T-LM-5` | `T-LM-1/3/4` **Phase 2** (research, inputs, validation — `BACKLOG.md`) |
| **B** | `T-FS-1`, `T-FS-2`, `T-FS-3`, `T-FS-4`, `T-FS-6` | `T-FS-5` skipped / **Phase 2** only if a different combination rule is researched |
| **C** | `T-LR-1`, `T-LR-2`, `T-LR-3`. Weak-service/messaging duplicate-node **fixed**. `T-LR-4` **closed via T-LR-5** (`6173b36`) | Exception-as-bridge noise: evidence pass 2026-08-19 falsified “any `inherits` edge” — stays BACKLOG. Remainder is `T-LR-6` (trust matrix), not a second DI engine |

**Newly unblocked by T-FS-6:** `T-CL-1…4`, `T-RT-2`.
**Newly unblocked by T-FS-1 (already):** `T-RT-1`.
**Newly unblocked by T-LM-2+5:** remaining-lens fitness pattern is proven.

---

## 1. Do not execute

| File | Why |
|---|---|
| `AGENT_TASKS_Ext_P0_Experiments.md` | Closed |
| `AGENT_TASKS_Architect_Pilot_Fixes.md` | Prior cycle |
| `AGENT_TASKS_Semantic_Model_Extension.md` | Gates only |
| `AGENT_TASKS_Ext_Layered_Recovery.md` | C finished what it can |
| `AGENT_TASKS_Ext_Fact_Semantics.md` | B finished (T-FS-5 parked) |
| `AGENT_TASKS_Ext_Lens_Modules.md` | A finished. `T-LM-1/3/4` are Phase 2, not due |

---

## 2. Execute next — priority order

| Priority | File | Do now | Then / wait |
|---|---|---|---|
| **1** | `AGENT_TASKS_Ext_Contract_Lifecycle.md` | **T-CL-1 → T-CL-2 → T-CL-3 → T-CL-4** — T-FS-6 is done, this is now the BR-70 / NFR-20 critical path | **T-CL-5** can run in parallel (no gate). **T-CL-6** after T-CL-2 |
| **2** | `AGENT_TASKS_Ext_Review_Throughput.md` | **T-RT-1** then **T-RT-2** (both unblocked) | **T-RT-4** after those two. **T-RT-3** anytime with real evidence |
| **3** | `AGENT_TASKS_Ext_CodeQL_Engine.md` | **T-LR-5 done** (`6173b36`, DI only). Do **not** start a second DI engine | **T-LR-6** (per-fact-type trust matrix) is the remainder. Waltz second-instance and `E-charge-single-L2` re-score with CodeQL on are disclosed, not due |
| **4** | `AGENT_TASKS_Ext_MultiRepo_Deployment.md` | **T-MR-3**, **T-MR-5** now | **T-MR-1 / T-MR-2** after T-CL-2. **T-MR-4** carefully / after CodeQL |
| **5** | `AGENT_TASKS_Ext_Remaining_Lenses.md` | **T-LM-8** written decision (recommend external `calm validate -p`) | **T-LM-6 / T-LM-7** only with a real consumer + gold |

---

## 3. Recommended next session (pick one)

1. **Contract Lifecycle T-CL-1** — highest BR leverage now that status vocabulary exists.
2. **Review Throughput T-RT-1 → T-RT-2** — NFR-80, both gates green.
3. **T-CL-5** — smallest, parallel with either of the above.

Do not start T-LM-1/3/4/6/7 (Phase 2). Do not start a second CodeQL DI session. Do not start T-MR-1/2 or T-CL-6 before T-CL-2.

---

## 4. Business-requirements cross-check (2026-08-19)

| ID | Status now | Next file |
|---|---|---|
| BR-10 | Stronger (T-LR-3). Bean-factory **wired via T-LR-5** (opt-in CodeQL DI) | T-LR-6; command-bus not shipped |
| BR-20 | Multi-root only | MultiRepo after T-CL-2 |
| BR-30 | Built | — |
| BR-40 | **Built** (`FactStatus` + `x-aac-status`) | — |
| BR-50 | Security + resilience scored + fitness declared. Vuln/lineage/green + workflow/obs are **Phase 2** | T-LM-8 decision only this phase |
| BR-60 | Contradiction, secondary-source introduction, **and opt-in CodeQL DI** built. Trust matrix not | **T-LR-6** |
| BR-70 / NFR-20 | Still unbuilt — **now unblocked** | **T-CL-1…4** |
| BR-80 | Still OOS on core path | T-RT-4 after T-RT-1/2 |
| BR-90 / 120 / 140 / 150 | Built | — |
| BR-100 | Partial (no incremental fact-diff) | T-CL-2 |
| BR-110 | threat-signals + resilience **declared** | Remaining new lenses must carry `fitness.json` |
| BR-130 | Ledger process exists | Keep logging |
| NFR-10 | No identity-stable repeated-run test | T-CL-6 after T-CL-2 |
| NFR-40 | No emission-coverage report | **T-CL-5** (parallel) |
| NFR-50 / 60 | Deferred | — |
| NFR-80 | Queue + Tier-B + contradiction cards exist; bulk apply + ranking **not** | **T-RT-1**, **T-RT-2** |
| NFR-90 / CON-* | Hold | — |
