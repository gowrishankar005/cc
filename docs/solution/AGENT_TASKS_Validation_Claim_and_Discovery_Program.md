# AGENT TASKS — Validation, Claim Register & Pattern Discovery Program

**Status:** planned (process / investigation only — **not** detector or product fixes)  
**Origin:** Fineract hand-gold vs platform RCA (2026-08-07); user-approved phase plan  
**Master sequence:** See `AGENT_TASKS_Master_Sequence_Claim_Honesty_and_AREC.md` (Wave 1 = this program; Wave 2–3 = AREC pillar). **Blocked on user** until they clear G0.  
**Authority:** Complements `STATUS.md` and CoE lab eval; does **not** authorize catalogue/detector implementation unless Wave 3 is opened after Wave 2 lock.

---

## Plan review (refined)

### What the original plan got right

| Strength | Why keep it |
|---|---|
| Claim register before more “built” language | Stops STATUS/docs from overclaiming |
| Validation layers L0–L5 | Separates schema-valid from architecture-complete |
| Cheap stratified probes | Finds pattern density without full-repo pipeline |
| HITL/LLM boundary map | Avoids false hope that overrides replace detectors |
| Wild-type gold policy in coe-lab | Keeps eval contract out of `spikes/` |
| Design-phase gates | Prevents next lock without disconfirming samples |

### Gaps / refinements after review

| Gap in first draft | Refinement |
|---|---|
| Phases 0–7 looked sequential forever | **Track A (governance)** can finish without **Track B (sampling)** blocking claim freeze |
| Easy to read as “this fixes Fineract relationships” | Explicit **non-goals** and **does / does not solve** section below |
| No owners or exit evidence | Each todo has **exit evidence** (artefact path or decision recorded) |
| Phase 1 “spike note” location ambiguous | Prefer **`coe-lab/docs/`** for eval-facing findings; link from `STATUS.md` |
| Silence probes (L3) need definition without becoming fixes | Define **metrics + thresholds only**; implementation of probes is a later optional thin script under lab, not platform detectors |
| Open questions Q1–Q12 unbounded | Phase 0 must **decide or park** each Q with owner |

### Two tracks (parallel where useful)

```text
Track A — Claims & validation honesty (must complete first for “green means something”)
  A0 Claim register → A1 Fineract finding record → A2 Validation approach vNext
  → A5 Wild gold policy → A6 Design-phase gates → A7 Q register living

Track B — Discovery (can start after A0 draft exists)
  B3 Pattern matrix + stratified probes + trap gold backlog

Track C — Review-flow fit (after A2)
  C4 HITL/LLM capability map
```

### Non-goals (this program)

- Implementing multi-hop relationship detection, call-based auth extractors, or new signal-catalogue rows  
- Changing platform generators to pass Fineract story gold  
- Replacing hand gold with generator output  
- Full-org monorepo scans  

---

## Does completing this program naturally solve the identified issues?

### Short answer: **No — not the technical misses.**  
**Yes — the process and false-confidence misses**, if exits are enforced.

| Identified issue | Solved by this program? | What actually changes |
|---|---|---|
| Missing service→db relationships (Fineract layered) | **No** | Becomes a **named claim gap** with validation that **fails or discloses**, not a silent pass |
| Wrong entity–entity `connects` mesh | **No** | Characterized; may get L2/L3 rules that **flag** noise vs story gold — still not removed from generator |
| Missing call-based controls on HTTP APIs | **No** | Recorded as specified-unbuilt or OOS with gates; controls still absent until a later build program |
| Weak control payload (no expression text) | **No** | Documented as known limitation of current mechanism claim |
| Design-phase overgeneralization (BoA ≠ Fineract) | **Yes (process)** | Disconfirming samples + claim cells required before “relationships work on Java” |
| Soft lab “all pass” hiding wild gaps | **Yes (eval)** | Layered validation + wild gold policy + expected-fail scenarios |
| Unknown volume of hidden patterns | **Partially** | Density estimates + ranked families; **not** a complete inventory |
| HITL/LLM expectation ambiguity | **Yes (clarity)** | Written capability map: what review can complete vs cannot discover |
| Dual-unit gate as silent product boundary | **Yes (decision)** | Forced claim decision — still not a code change |

### What “naturally” follows if the program succeeds

1. **You stop believing green means complete.**  
2. **You know which pattern families are high risk** before writing more code.  
3. **A later fix program** can be scoped to ranked claim cells (separate decision).  
4. **You do not automatically get correct CALM for Fineract.** That requires an explicit implementation program after A/B exits.

If anyone treats this todo list as “fix relationships,” reopen scope — that is a **different** program.

---

## Todo list

### Status legend

| Status | Meaning |
|---|---|
| `todo` | Not started |
| `doing` | In progress |
| `done` | Exit evidence exists |
| `parked` | Explicitly deferred with reason |

---

### Track A — Claims & validation honesty

#### A0 — Claim register (Phase 0)

| ID | Todo | Exit evidence | Status |
|---|---|---|---|
| **A0-1** | Draft mechanism-class claim register (decorator auth, call-site auth, one-hop import edge, multi-hop layered, messaging consumer/producer, OpenAPI security, env/k8s trust, …) | `docs/solution/Claim_Register.md` (or under `coe-lab/docs/` if eval-only preferred — pick one home in A0-1) | todo |
| **A0-2** | For each class: status = proven / specified-unbuilt / unevidenced / OOS; evidence pointer (repo+path or doc §); validation layer allowed to green | Same file, filled matrix | todo |
| **A0-3** | Record product decision: dual-unit Graphify relationships = **intended architecture product** vs **code-graph interim approximation** (decision only, no code) | Claim register decision box + date | todo |
| **A0-4** | Map open questions Q1–Q12: decide / park / owner / “needed by” | Section in claim register or `docs/solution/Open_Questions_Validation.md` | todo |
| **A0-5** | Add STATUS.md pointer: “relationship/control completeness claims → Claim_Register; do not invent STATUS rows that contradict it” | One row or link in `STATUS.md` | todo |

#### A1 — Package Fineract finding (Phase 1)

| ID | Todo | Exit evidence | Status |
|---|---|---|---|
| **A1-1** | Write eval-facing note: hand gold vs platform (charge/core), RCA summary, not a fix plan | `coe-lab/docs/fineract-gold-vs-platform-finding.md` | todo |
| **A1-2** | Link from `coe-lab/docs/BASELINES.md` and `gold/calm/FINERACT_GOLD.md` | Links present | todo |
| **A1-3** | Record as known **validation/design** gap in STATUS or claim register (not “fixed”) | Cross-link | todo |

#### A2 — Validation approach vNext (Phase 2)

| ID | Todo | Exit evidence | Status |
|---|---|---|---|
| **A2-1** | Define L0–L5 (schema, unit recall, story recall, silence probes, scope honesty, HITL residual) with pass meaning each | `coe-lab/docs/validation-approach-vnext.md` | todo |
| **A2-2** | Define which packages use which layers (lab core soft vs wild Fineract strict story) | Same doc table | todo |
| **A2-3** | Specify **silence invariants on paper** (e.g. service+db units, zero service-touching rels → must not count as story-pass; HTTP + threat finding without matching scope id → review flag). Metrics only — implement later if at all | Same doc § Silence probes | todo |
| **A2-4** | Align semantic gold + full CALM gold + score-calm + validate-calm-pair roles; mark expected-fail packages | Same doc + note in `calm-snapshot-validation.md` | todo |
| **A2-5** | Stakeholder/read-through: “all pass” meaning written in ≤10 lines for operators | § Executive definition in vNext doc | todo |

#### A5 — Wild-type gold policy (Phase 5)

| ID | Todo | Exit evidence | Status |
|---|---|---|---|
| **A5-1** | Policy: location (`coe-lab/gold/calm/fineract-*` only), owner role, refresh cadence, no spikes as gold | `coe-lab/gold/calm/FINERACT_GOLD.md` extended or `coe-lab/docs/wild-type-gold-policy.md` | todo |
| **A5-2** | Compare mode for Fineract packages: L1 vs L2 required; extras policy for entity over-count | Written policy | todo |
| **A5-3** | Document that lab core green does **not** supersede wild gold | Explicit sentence in policy + README | todo |

#### A6 — Design-phase gates (Phase 6)

| ID | Todo | Exit evidence | Status |
|---|---|---|---|
| **A6-1** | Checklist: disconfirming sample per relationship claim; joint units∧rels∧controls claim; call vs decorator status; L0–L4 assigned; premortem “green but wrong” | `docs/solution/Design_Phase_Validation_Gates.md` | todo |
| **A6-2** | Require checklist citation before next STATUS “built” on extraction/relationship/control claims | Process note in STATUS or CLAUDE.md working principles (one paragraph) | todo |

#### A7 — Living open-questions register (Phase 7)

| ID | Todo | Exit evidence | Status |
|---|---|---|---|
| **A7-1** | Maintain Q1–Q12 (and new Qs) with state; close A0-4 parks when decided | Living section or file from A0-4 | todo |
| **A7-2** | Review cadence (e.g. when claim register or wild gold changes) | One sentence in same file | todo |

---

### Track B — Pattern discovery (Phase 3)

| ID | Todo | Exit evidence | Status |
|---|---|---|---|
| **B3-1** | Refresh mechanism × domain coverage matrix (desk + existing evidence docs, no new full pipeline) | `coe-lab/docs/pattern-coverage-matrix.md` or update requirements matrix pointer | todo |
| **B3-2** | Define stratified sample list (N≈5–15 packages/modules; FINOS landscape + existing clones) | Sample list with rationale | todo |
| **B3-3** | Run **cheap static probes only** (grep/counts): API/entity same-file import ratio; PreAuthorize vs validateHasReadPermission / jwt.decode / Authenticated counts | Probe results table in same doc | todo |
| **B3-4** | Rank pattern families by estimated density / risk to claims | Ranked list top N | todo |
| **B3-5** | Trap / negative-gold backlog cards (one per family): intent, fixture or wild module, which L* must fail if completeness claimed | `coe-lab/docs/trap-gold-backlog.md` | todo |
| **B3-6** | Explicitly **do not** run full platform on all samples unless a single probe justifies one deep dive | Note in sample list | todo |

---

### Track C — HITL / LLM fit (Phase 4)

| ID | Todo | Exit evidence | Status |
|---|---|---|---|
| **C4-1** | Map gap classes → HITL override / LLM advisory / neither / needs mechanism work (class only) | `coe-lab/docs/review-flow-capability-map.md` | todo |
| **C4-2** | Assess whether “high-confidence unit, empty relationship neighborhood” should be an advisory/IR **review trigger** (decision only) | Decision recorded in map or claim register | todo |
| **C4-3** | Document IR limitation: intermediates/Graphify not in default review surface | Same map § Limitations | todo |

---

### Optional later (out of this program — do not start under these IDs)

| ID | Item | Why separate |
|---|---|---|
| **Z-impl-*** | Any detector, catalogue row, multi-hop, call-auth extraction | Implementation program after A0–A2 + B rank |
| **Z-probe-script** | Automate L3 silence metrics in coe-lab scripts | Thin tooling after A2-3 definitions stable |
| **Z-strict-compare** | Harden validate-calm-pair for Fineract L2 | Eval engineering after A2/A5 |

---

## Suggested order of work

```text
1. A0-1 … A0-5     (claim freeze)
2. A1-1 … A1-3     (record Fineract miss)
3. A2-1 … A2-5     (validation meaning)
4. A5 + A6 + A7    (policy + gates + Q living)  // can parallelize with B after A0
5. B3-1 … B3-6     (discovery)
6. C4-1 … C4-3     (HITL/LLM fit)
```

**Minimum viable program (if time-boxed):** A0 + A1 + A2 + A5-3 + A6-1.  
That alone does **not** fix Fineract CALM; it makes overclaim and soft green much harder.

---

## Definition of program done

- [ ] Claim register exists and STATUS cannot contradict it without an edit  
- [ ] Fineract finding is written and linked from lab baselines  
- [ ] “All pass” is defined per validation layer  
- [ ] Wild gold policy exists  
- [ ] Design-phase gate checklist exists  
- [ ] At least one stratified probe pass produced a ranked risk list  
- [ ] HITL/LLM capability map exists  
- [ ] No implementation tasks marked done under this program’s IDs  

---

## Changelog

| Date | Note |
|---|---|
| 2026-08-07 | Initial program from phase plan review + user request for todo list and “does this solve issues?” honesty |
