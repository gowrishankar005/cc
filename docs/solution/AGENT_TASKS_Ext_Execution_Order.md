# AGENT TASKS — what is due, and in what order

**Audit:** 2026-08-18. Companion: `Business_Requirements_Coverage.md`.
**A/B/C sessions:** merged and pushed (`e21747a` / `6e1823f` / `9f358e8`).
They are **no longer in flight**. What they actually closed is below — not
every row in those three files.

Use this to pick the next session.

---

## 0. What A / B / C actually closed

| Session | Closed | Still open in the same file |
|---|---|---|
| **A** Lens | `T-LM-2` resilience lens (scored). `T-LM-0` already done | `T-LM-1` no CVE feed; `T-LM-3` no data-classification facts; `T-LM-4` no cost feed; `T-LM-5` not started (**now unblocked** — a second module exists) |
| **B** Fact Semantics | `T-FS-1` Tier-B residuals; `T-FS-3` contradiction detection; `T-FS-6` status vocabulary (done 2026-08-18, own commit — not part of the original A/B/C merge). `T-FS-2` was already done; `T-FS-5` skipped | `T-FS-4` not started (B's only remaining item) |
| **C** Layered Recovery | `T-LR-3` stereotype-disambiguated bridges (+ Waltz second instance) | `T-LR-4` **confirmed blocked on T-LR-5** (neither engine sees `@Bean` `new X(...)`) |

---

## 1. Closed or parked — do not execute

| File | Why |
|---|---|
| `AGENT_TASKS_Ext_P0_Experiments.md` | Gate closed |
| `AGENT_TASKS_Architect_Pilot_Fixes.md` | Prior cycle |
| `AGENT_TASKS_Semantic_Model_Extension.md` | Gates only, not a work queue |
| `AGENT_TASKS_Ext_Layered_Recovery.md` | Session C finished what it can. Remainder is CodeQL |
| NFR-50 / NFR-60 / E3 / T-FS-5 | Deferred or skipped with a trigger |

---

## 2. Execute next — priority order

| Priority | File | Do now | Wait / do not do yet | BR / NFR |
|---|---|---|---|---|
| **1** | `AGENT_TASKS_Ext_Fact_Semantics.md` | **T-FS-6 done, 2026-08-18** — `FactStatus` vocabulary + hard rule, see `Claim_Register.md`'s `T-FS-6-status-vocabulary` row. `T-FS-4` is B's only remaining item | `T-FS-4` as a small follow-on | **BR-40 closed**, unblocks BR-70 / NFR-20 / NFR-80 ranking / success #3 |
| **2** | `AGENT_TASKS_Ext_Review_Throughput.md` | **T-RT-1** bulk residual authoring — **unblocked** (T-FS-1 done). **T-RT-2**/**T-RT-4** now also unblocked (T-FS-6 done) | **T-RT-3** anytime if evidence exists | **NFR-80**, CON-30 |
| **3** | `AGENT_TASKS_Ext_Contract_Lifecycle.md` | **T-CL-5** emission-coverage. **T-CL-1 → 2 → 3 → 4** now unblocked (T-FS-6 done) | **T-CL-6** after T-CL-2 | **NFR-40** now; **BR-70** / **NFR-10** / **NFR-20** now unblocked |
| **4** | `AGENT_TASKS_Ext_CodeQL_Engine.md` | Start the 7-item checklist; ship **DI first** | Do not also rebuild T-LR-4 in Graphify. GHAS before private-repo production | **BR-60**, unblocks **T-LR-4** / bean-factory |
| **5** | `AGENT_TASKS_Ext_Lens_Modules.md` | **T-LM-5** fitness declaration — **unblocked** (resilience + threat-signals) | `T-LM-1/3/4` stay gated on a real feed / new extraction. Do not invent schemas | **BR-110** |
| **6** | `AGENT_TASKS_Ext_MultiRepo_Deployment.md` | **T-MR-3** `deployed-in`, **T-MR-5** boundary overrides | **T-MR-1/2** after T-CL-2. **T-MR-4** after CodeQL or as a careful catalogue-only pass | BR-10 residual; **BR-20** later |
| **7** | `AGENT_TASKS_Ext_Remaining_Lenses.md` | **T-LM-8** written decision (recommend external `calm validate -p`) | **T-LM-6 / T-LM-7** after T-LM-8 and a real consumer; same gold/CON-40 bar as A | **BR-50** remaining three lenses |

**Still in #1's file:** `T-FS-4` secondary-source fact introduction (BR-60) — B's only remaining item, now that T-FS-6 is done.

---

## 3. Recommended next session (pick one)

1. **T-CL-1 → 2 → 3 → 4** — now unblocked by T-FS-6; largest unlock left (BR-70/NFR-10/NFR-20).
2. **T-RT-1/T-RT-2** — review throughput, both now unblocked (T-FS-1 and T-FS-6 done).
3. **T-CL-5** — small, no gate, NFR-40.
4. **T-LR-5** — only if you are ready for the CodeQL shipping checklist (now more valuable: T-LR-4 is empirically blocked on it).
5. **T-FS-4** — small, B's own last remaining item.

Do not open T-LM-6/7 or T-MR-1/2 before their gates.

---

## 4. Business-requirements cross-check (after A/B/C)

| ID | After A/B/C | Next file |
|---|---|---|
| BR-10 | Stronger (T-LR-3). Bean-factory still missing | CodeQL (#4) then T-LR-4 |
| BR-20 | Unchanged — multi-root only | MultiRepo after T-CL-2 |
| BR-30 | Built | — |
| BR-40 | **Built** — confidence + review-status vocab (T-FS-6, 2026-08-18) | — |
| BR-50 | Security + **resilience** scored. Vuln/lineage/green still gated. Workflow/obs/pattern still unbuilt | T-LM-5, then Remaining Lenses |
| BR-60 | Contradiction **done**. CodeQL still not wired | T-FS-4; CodeQL |
| BR-70 / NFR-20 | Still unbuilt, now unblocked (T-FS-6 done) | T-CL-1…4 |
| BR-80 | Still OOS on core path | T-RT-4 after T-RT-1/2 |
| BR-90 / 120 / 140 / 150 | Built | — |
| BR-100 | Partial (no incremental diff) | T-CL-2 |
| BR-110 | threat-signals + **resilience** scored | **T-LM-5** |
| BR-130 | Ledger process exists | Keep logging |
| NFR-10 | No repeated-run identity test | T-CL-6 after T-CL-2 |
| NFR-40 | No emission-coverage report | **T-CL-5** |
| NFR-50 / 60 | Still deferred | — |
| NFR-80 | Queue exists; bulk apply + ranking not | **T-RT-1**, **T-RT-2** — both now unblocked |
| NFR-90 / CON-* | Hold | — |
