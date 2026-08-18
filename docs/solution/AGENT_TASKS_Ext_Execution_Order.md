# AGENT TASKS — what is due, and in what order

**Audit:** 2026-08-15. Companion: `Business_Requirements_Coverage.md`.

Use this to pick the next session. Do not start a file marked **in flight**.

---

## 0. Closed or parked — not due

| File | Why not due |
|---|---|
| `AGENT_TASKS_Ext_P0_Experiments.md` | Gate closed (E1–E5 reported; E3 deprioritised; E5 skipped T-FS-5) |
| `AGENT_TASKS_Architect_Pilot_Fixes.md` | Prior cycle; not this extension's queue |
| T-FS-2 / T-FS-5 / T-LR-1 / T-LR-2 / T-LM-0 | Done or skipped inside their lane files |
| NFR-50 / NFR-60 / E3 / T-FS-5 | Deferred or skipped with a written trigger |

---

## 1. In flight — do not start another copy

| Order | File | Session | Tasks |
|---|---|---|---|
| — | `AGENT_TASKS_Ext_Lens_Modules.md` | **A** | `T-LM-1`…`4` |
| — | `AGENT_TASKS_Ext_Fact_Semantics.md` | **B** | `T-FS-1` → `T-FS-3` → `T-FS-6` (not T-FS-4) |
| — | `AGENT_TASKS_Ext_Layered_Recovery.md` | **C** | `T-LR-3`, `T-LR-4` only |

---

## 2. Due for implementation (not started, not in A/B/C)

Execute in this order. Waves can overlap only when the "parallel with" column
says so **and** the file sets do not collide (A = `modules/`, B =
`passes.ts` / grading / ignored-items, C = multi-hop / persistence).

| Wave | When | File | Tasks | Parallel with |
|---|---|---|---|---|
| **Now** | No gate; no collision with A/B/C | `AGENT_TASKS_Ext_Contract_Lifecycle.md` — **T-CL-5 only** | Emission-coverage report (`NFR-40`) | A, B, C |
| **Now** | No gate | `AGENT_TASKS_Ext_MultiRepo_Deployment.md` — **T-MR-3, T-MR-5** `[B]` | k8s `deployed-in`; boundary-change overrides | A, B, C |
| **Now** | T-FS-2 already done | `AGENT_TASKS_Ext_Fact_Semantics.md` — **T-FS-4** | Secondary source may introduce a fact at its own tier | A, C. **Not B** if B is still in `passes.ts` — wait until B finishes or park until after B |
| **Now** | Evidence-gated `[B]` | `AGENT_TASKS_Ext_Review_Throughput.md` — **T-RT-3** | More call-site auth vocabularies (not unbounded inference) | A, C. Same B-collision caution |
| **Now** | Evidence-gated `[B]` | `AGENT_TASKS_Ext_MultiRepo_Deployment.md` — **T-MR-4** | Remaining driver-import ownership shapes | C caution (persistence detectors) — prefer after C |
| **After B lands T-FS-1** | Review queue has Tier-B input | `AGENT_TASKS_Ext_Review_Throughput.md` — **T-RT-1** | Bulk residual-decision authoring (`NFR-80`) | A, C |
| **After B lands T-FS-6** | Status vocabulary exists | `AGENT_TASKS_Ext_Contract_Lifecycle.md` — **T-CL-1 → T-CL-2 → T-CL-3 → T-CL-4** | Fact identity, incremental merge, history, contract bump (`BR-70`, `NFR-20`) | A. Not C if C still editing analysis |
| **After B lands T-FS-6** | Same | `AGENT_TASKS_Ext_Review_Throughput.md` — **T-RT-2**, then **T-RT-4** | Consequence-ranked queue; advisory reviewer assist (`BR-80` stays off `run-slice`) | After T-RT-1 |
| **After C** | T-LR-3/4 designed; do not merge into C | `AGENT_TASKS_Ext_CodeQL_Engine.md` | **T-LR-5** (DI first) then **T-LR-6** | After a written scope decision. GHAS before private-repo production |
| **After A** | Second module exists to score | `AGENT_TASKS_Ext_Lens_Modules.md` — **T-LM-5** | Per-lens fitness declaration (`BR-110`) | — |
| **After A** | Do not fold into A | `AGENT_TASKS_Ext_Remaining_Lenses.md` | **T-LM-8** decision first, then **T-LM-6**, **T-LM-7** if still wanted | — |
| **After T-CL-2** | Incremental merge proven | `AGENT_TASKS_Ext_MultiRepo_Deployment.md` — **T-MR-1**, **T-MR-2** | Cross-repo manifest + ranked joins (`BR-20`, success #4) | — |
| **After T-CL-2** | Same | `AGENT_TASKS_Ext_Contract_Lifecycle.md` — **T-CL-6** | Determinism test (`NFR-10`) | — |

---

## 3. Recommended next session (if opening a fourth)

Pick **one**:

1. **T-CL-5** (emission coverage) — smallest, no session collision.
2. **T-MR-3** (`deployed-in`) — already-designed `[B]`, k8s provider only.
3. **Wait for B's T-FS-1**, then **T-RT-1**.

Do **not** open CodeQL (`AGENT_TASKS_Ext_CodeQL_Engine.md`) until Session C
is done and the 7-item checklist is accepted in writing.

---

## 4. File index

| File | Role |
|---|---|
| `AGENT_TASKS_Semantic_Model_Extension.md` | Cross-cutting gates, not a work queue |
| `AGENT_TASKS_Ext_P0_Experiments.md` | Closed |
| `AGENT_TASKS_Ext_Lens_Modules.md` | Session A + T-LM-5 later |
| `AGENT_TASKS_Ext_Fact_Semantics.md` | Session B + leftover T-FS-4 |
| `AGENT_TASKS_Ext_Layered_Recovery.md` | Session C only (T-LR-3/4) |
| `AGENT_TASKS_Ext_CodeQL_Engine.md` | T-LR-5/6 — new, after C |
| `AGENT_TASKS_Ext_Contract_Lifecycle.md` | T-CL-5 now; T-CL-1…4 after B |
| `AGENT_TASKS_Ext_Review_Throughput.md` | T-RT-3 now (careful); T-RT-1 after B |
| `AGENT_TASKS_Ext_MultiRepo_Deployment.md` | T-MR-3/5 now; T-MR-1/2 after T-CL-2 |
| `AGENT_TASKS_Ext_Remaining_Lenses.md` | T-LM-6/7/8 — new, after A |
| `AGENT_TASKS_Ext_Execution_Order.md` | This file |
