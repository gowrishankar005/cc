# Agent task list — Residual review session (RS-1…RS-5)

**Single source of truth** for implementing architect residual review (session pack + VS Code Copilot Chat + Decision Record / Override apply).

**Product:** Weaver.  
**Design authority:** [`Architect_Residual_Review_Session.md`](./Architect_Residual_Review_Session.md) (full UX, taxonomy, effective IR, safety).  
**Backlog:** **B-review-session** (portable IR may track separately as **B-calm-portable-ir**).  
**Owner:** **Gowri**  
**RS-0 sign-off:** **2026-08-08** — go-ahead granted; **do not skip safety** (chat-mode must not autonomously run apply / run-slice / override-applier).

**Phase IDs are `RS-*` only.** Do **not** confuse with layered-story **`L0–L4`** in [`AGENT_TASKS_Layered_Architecture_Story.md`](./AGENT_TASKS_Layered_Architecture_Story.md).

---

## 0. How to use this file (mandatory)

### 0.1 Phase order — hard

```
RS-0  Design sign-off          ── DONE (Gowri, 2026-08-08)
  → RS-1  Session pack + triage + choice-card templates + chat-mode (no LLM draft required)
  → RS-2  validate_drafts + effective IR (MVP)  [ir-to-calm may defer to B-calm-portable-ir]
  → RS-3  apply.py + apply-report + initial --baseline
  → RS-4  Optional Tier B LLM drafting (system prompt §5.1) + fabricate traps
  → RS-5  Eval traps, pilot scorecard note, optional prose rewrite, portable IR if deferred
```

| Rule | |
|---|---|
| **Do not start RS-4 LLM drafting** before RS-1 + human apply path (RS-3) works without LLM | Safety + debuggability |
| **Do not put residual code on `run-slice` call graph** | Determinism |
| **Do not redefine standing exams** via residual success | §0.1 of design doc / H1 |
| **Do not invent control_add** unless override-applier already supports a clear shape | H4 v1 limit |

### 0.2 Why this program exists (agent orientation)

| Pain | Response |
|---|---|
| Post-scan residuals are correct but architect-hostile (many JSON files + hand Override JSON) | One **Session Pack** + Copilot chat + choice cards |
| Architects hate blank free-text | **Fixed choice cards** per residual class |
| LLM risk to TypedFacts / catalogues | Drafts only under `drafts/`; apply is human-confirmed; no catalogue auto-merge |
| Confusion with Fineract L2 / layered story | Residual is **L5 completion of deliverable**, not primary multi-hop recovery |

### 0.3 Integrity / safety (reject PR if violated) — **DO NOT SKIP**

| # | Rule | Required | Reject |
|---|---|---|---|
| S1 | No LLM in core path | Residual tools never imported by `run-slice.ts` | Any import of pack/apply into orchestration |
| S2 | TypedFacts immutable | Never write/edit `typed-facts.json` | Agent or tool mutates facts |
| S3 | Only DR + Override write path | All CALM changes via `override-applier` after validate | Direct CALM edits, silent apply from chat |
| S4 | **No autonomous apply** | Chat-mode: no unrestricted terminal; apply requires explicit human confirm | Chat agent runs `apply.py` / `run-slice` without confirmation |
| S5 | Evidence-first | Drafts only from pack evidence / listed file:line | Prior knowledge invents nodes/edges/paths |
| S6 | Non-fabricate | Tier B bar fails → `cannot_decide`; Tier C never invents | relationship_add without both endpoints in facts |
| S7 | No sample hardcodes | Generic residual classes | Fineract/BoA class names in residual logic |
| S8 | Secrets | Redact snippets before pack write; test with fake secret | Raw secrets in `evidence/packs.json` |
| S9 | Bulk-apply audit | One Decision Record **per residual**, not one blanket DR | Single DR covering N units without per-id records |
| S10 | Standing exams | Residual pilot does not claim E-charge-single-L2 product green | STATUS/Claim language that residual “fixed” layered L2 |
| S11 | Catalogue discipline | Unmapped ≥5 → catalogue proposal only | Auto-merge `signal-catalogue.yml` |
| S12 | Controls v1 | Prefer catalogue / leave open for missing auth | Fake control_add without platform support |

### 0.4 MVP cut (what “RS-1…RS-3 done” means without boiling the ocean)

**Must ship for first pilot:**

1. `pack.py` + `triage.py` → Session Pack from a real `run-slice` out-dir  
2. Choice-card generation for Tier A classes (fixed templates)  
3. `validate_drafts.py` (DR ↔ Override integrity, endpoints exist)  
4. `apply.py` wrapping `run-slice --from-facts --overrides` with **strict** validation first  
5. Chat-mode instructions file with **no autonomous apply**  
6. `decisions-log.md` / `apply-report.md`  
7. Redaction fixture test  
8. `review-sessions/` gitignored (or packs not committed by default)

**May defer to later RS / B-calm-portable-ir (say so on BACKLOG when deferred):**

- Full `ir-to-calm.ts` + checksum round-trip  
- Full 8-section effective IR with every calm-node fence  
- Rich `--baseline` multi-run accumulation  
- Tier B LLM auto-draft (RS-4)  
- Prose rewrite (RS-5)  

**Deferred work must not block** “architect can pack → choose → apply → valid CALM.”

### 0.5 Design decisions locked at RS-0 (do not re-litigate)

| ID | Decision |
|---|---|
| Owner | **Gowri** |
| Safety | **Do not skip** S1–S12; chat-mode no autonomous apply |
| Delivery | VS Code + GitHub Copilot **chat-mode only** (no custom extension, no MCP required for v1) |
| Language for pack tools | Python under `tools/review-session/` preferred; Node OK if schema shared — pick one and stay consistent |
| Apply engine | Existing `override-applier` via `run-slice --from-facts --overrides` only |
| Boundary | Layered multi-hop product claims → **B-layered-story**, not this program |

### 0.6 Every phase completion

1. Integrity home named.  
2. BACKLOG **B-review-session** status updated.  
3. STATUS / design doc note if behaviour ships.  
4. `npm test` (pipeline) still green — residual is additive offline.  
5. Any new residual tests green.  
6. PR template filled (§0.7).  
7. Explicit list of **deferred** items if MVP cut used.

### 0.7 PR template

```markdown
## Weaver residual-review-session delivery
- Phase: <RS-1|RS-2|RS-3|RS-4|RS-5>
- Task IDs: <T-RS1-1, …>
- Safety checklist: S1–S12 (list any N/A with reason)
- Chat-mode: autonomous apply impossible? <yes + how>
- Paths: <…>
- BACKLOG: B-review-session / B-calm-portable-ir
- Tests: <…>
- Deferred: <…>
- Standing exams: residual does NOT claim E-charge-single-L2 green
```

### 0.8 Reference shapes (implement against real platform)

| Artefact | Location |
|---|---|
| Decision Record / Override types | `pipeline/src/types/overrides.ts` |
| Apply integrity | `pipeline/src/modules/calm-generator/override-applier.ts` |
| HITL queue (S1/S2/low arch-cov) | `pipeline/src/analysis/ir/hitl-review-trigger.ts` |
| Evidence packs / redaction patterns | `pipeline/src/analysis/ir/evidence-packs.ts` (reuse ideas; residual pack has its own redaction test) |
| CALM types | `pipeline/src/types/calm.ts` |
| Design taxonomy / prompts | `Architect_Residual_Review_Session.md` §2–§7 |

---

# RS-0 — Sign-off (complete)

| Item | Status |
|---|---|
| Design H1–H4 applied | done |
| Owner **Gowri** | done |
| Go-ahead + **do not skip safety** | done 2026-08-08 |
| Agent task list (this file) | done |

**No further RS-0 work required** unless owner revokes go-ahead.

---

# Phase RS-1 — Pack, triage, choice cards, chat-mode

**Goal:** Architect can open one pack and answer Tier A via choices; drafts directory ready; **no LLM required**.

**Phase RS-1 done when:** pack builds from real out-dir; residuals.json tiers A/B/C; choice cards generated; chat-mode file exists with no autonomous apply; redaction test green; review-sessions gitignored.

### T-RS1-1 — Repo layout + gitignore

| | |
|---|---|
| **Deliverable** | `tools/review-session/` (or agreed path); `review-sessions/` in `.gitignore`; short README in tools dir |
| **Exit** | Packs not accidentally committed; `npm test` unaffected |

### T-RS1-2 — `pack.py` (or `pack.ts`)

| | |
|---|---|
| **CLI** | `pack --out-dir <run-slice-out> --session-dir <review-sessions/<run-id>> [--roots …]` |
| **Reads** | `typed-facts.json`, `coverage-report.json`, `review-queue.json` (run hitl-review-trigger if missing), `unmapped-signals-report.json`, ignored/evidence if present, `intelligence-ir.md` path ref, `architecture.calm.json` optional |
| **Writes** | Layout per design §4.1: `SESSION.md`, `AGENTS.md`/`manifest.json`, `residuals.json`, `evidence/`, empty `drafts/decisions|overrides` |
| **Safety** | Refuse overwrite if session dir has unapplied drafts (fail loud); never write TypedFacts |
| **Redaction** | All snippets through redaction before disk; fixture test with fake secret |
| **Exit** | Pack on NestJS fixture or BoA out-dir succeeds offline |

### T-RS1-3 — `triage.py` + residual schema

| | |
|---|---|
| **Deliverable** | Build `residuals.json`: id, tier A/B/C, class, unit ids, evidence refs, status `open` |
| **Sources** | silenceFlags / review-queue; unresolved-multi-hop ignored items; low confidence; unmapped clusters (catalogue_candidate); ontology-ish kind conflicts if detectable generically |
| **Exit** | Schema documented (JSON Schema preferred); real pack non-empty on a silent/S1 run if available |

### T-RS1-4 — Choice-card generator (fixed templates)

| | |
|---|---|
| **Deliverable** | Deterministic card per Tier A class (design §2.1 + §3): options from generator, not LLM; evidence inline; Other requires rationale |
| **Output** | e.g. `cards/` markdown or embedded in `SESSION.md` / `residuals.json` `card` field for Copilot |
| **Bulk-apply** | If same pattern key repeated: offer apply-to-all but **list unit ids** and require **one DR per residual** when later drafted |
| **Command-bus / OOS** | Options only document OOS / leave open / multi-root rescan — **never** invent relationship_add |
| **Exit** | Unit tests: same residual + evidence → same options |

### T-RS1-5 — Copilot chat-mode file (safety critical)

| | |
|---|---|
| **Deliverable** | `.github/chatmodes/residual-review.chatmode.md` and/or `.github/prompts/residual-review.prompt.md` |
| **Must include** | Read SESSION.md + residuals first; never edit typed-facts; write only drafts/; never run apply.py/run-slice/override without human; Tier B later; link design playbook |
| **Must prove S4** | Tool/terminal permissions: **no unrestricted terminal**, or confirm-every-command; document in chat-mode file header “SAFETY: no autonomous apply” |
| **Degraded path** | Works if agent tools disabled: architect still uses pack + hand-authors DR/Override |
| **Exit** | File checked in; PR notes how S4 is enforced |

### T-RS1-6 — SESSION.md / AGENTS.md templates

| | |
|---|---|
| **Deliverable** | Generated SESSION: steps 1–9, path to CALM viewer, “do not redefine standing exams”, apply is human step |
| **Exit** | Readable by non-agent human |

**RS-1 exit checklist**

- [ ] T-RS1-1…T-RS1-6 done  
- [ ] S4/S8/S9 addressed  
- [ ] No network required for pack  
- [ ] Pipeline suite green  

---

# Phase RS-2 — validate_drafts + effective IR (MVP)

**Goal:** Drafts are schema-valid and apply-ready; effective IR at least partially real.

### T-RS2-1 — `validate_drafts.py`

| | |
|---|---|
| **Checks** | DR JSON matches DecisionRecord fields; Override has `decision_record_ref` to active DR; override_type supported; relationship_add is connects-shaped; endpoints exist in typed-facts/CALM nodes; no typed-facts paths written |
| **Exit** | Good fixture passes; bad fixtures fail with clear reasons |

### T-RS2-2 — Manual draft path documented

| | |
|---|---|
| **Deliverable** | Example DR + Override pair in `tools/review-session/examples/` (synthetic ids) + how architect pastes from choice answer |
| **Exit** | Human can create drafts without LLM |

### T-RS2-3 — Effective IR MVP generator

| | |
|---|---|
| **Minimum** | After apply (or from out-dir + overrides report): markdown with provenance, node/rel counts, open residuals, decision log summary |
| **Preferred** | §7.1 sections 1–7 templated; fenced calm fragments only if complete and schema-aligned (`x-aac-relationship-grade`, metadata arrays) |
| **Defer OK** | Full ir-to-calm + checksum → **B-calm-portable-ir** if called out on BACKLOG |
| **Exit** | Real post-apply CALM produces non-empty effective IR; facts-IR honesty not overwritten |

### T-RS2-4 — (Optional same phase) `ir-to-calm` + checksum

| | |
|---|---|
| **Only if** | Not deferring portable IR |
| **Exit** | Round-trip calm validate; hand-edit fails checksum |

**RS-2 exit checklist**

- [ ] validate_drafts green  
- [ ] Effective IR MVP or explicit defer of portable IR  
- [ ] No TypedFacts mutation  

---

# Phase RS-3 — Apply path

**Goal:** One command applies drafts safely.

### T-RS3-1 — `apply.py`

| | |
|---|---|
| **Flow** | validate_drafts → copy/point overrides dir → `node …/run-slice.js --from-facts <facts> --overrides <drafts/overrides> --out <new-out> [--strict-overrides]` |
| **Safety** | Refuse if validate fails; refuse if chat-invoked without `--i-confirm-apply` flag **or** interactive confirm; log command line to apply-report |
| **Exit** | Nest/BoA-style run: override type_change or relationship_add applies; calm validate 0 errors on reviewed out |

### T-RS3-2 — `apply-report.md` / overrides-applied-report

| | |
|---|---|
| **Deliverable** | Summarize applied/rejected/orphans from platform report; decisions-log append |
| **Exit** | Architect can see what applied |

### T-RS3-3 — Initial `--baseline` (thin)

| | |
|---|---|
| **Minimum** | Document + optional flag: if baseline session dir provided, mark residuals already decided as `carried_forward` and do not re-card them unless facts contradict (contradiction → new residual “re-confirm”) |
| **Full multi-scan polish** | May continue in RS-5  
| **Exit** | At least documented behaviour; code preferred |

**RS-3 exit checklist**

- [ ] Human apply path works end-to-end  
- [ ] S4: apply not silent from agent  
- [ ] Pipeline tests green  

---

# Phase RS-4 — Optional Tier B LLM draft

**Goal:** LLM drafts only when evidence bar met; never applies.

### T-RS4-1 — Offline draft CLI

| | |
|---|---|
| **Deliverable** | e.g. `draft_tier_b.py` using design §5.1 system prompt; env API key optional (no key → print residual ids only) |
| **Writes** | Only `drafts/decisions` + `drafts/overrides`  
| **Exit** | Trap fixture: insufficient evidence → `cannot_decide`, no file or empty proposal with reason |

### T-RS4-2 — Fabricate traps

| | |
|---|---|
| **Tests** | Invented node id rejected by validate_drafts; ambiguous two-endpoint case → cannot_decide  
| **Exit** | Traps automated  

### T-RS4-3 — Guided confirm UX note

| | |
|---|---|
| **Deliverable** | SESSION/chat instructions: Tier B shown as Accept/Reject/Edit — never auto-apply  
| **Exit** | Documented  

**RS-4 exit checklist**

- [ ] LLM path off-core, drafts only  
- [ ] Fabricate traps green  
- [ ] RS-3 apply still human  

---

# Phase RS-5 — Hardening & portability

### T-RS5-1 — Eval / pilot scorecard note

| | |
|---|---|
| **Deliverable** | Pilot_Ready_Scorecard or residual section: residual is L5; does not replace E-charge-single-L2  
| **Exit** | Linked from design or BACKLOG  

### T-RS5-2 — Optional prose rewrite

| | |
|---|---|
| **Per** | design §7.3 — presentation only  
| **Exit** | Or explicitly OOS  

### T-RS5-3 — Complete B-calm-portable-ir if deferred

| | |
|---|---|
| **Deliverable** | ir-to-calm + checksum + BACKLOG flip  
| **Exit** | calm validate from markdown alone  

### T-RS5-4 — Program DoD

All true:

- [ ] Pack → choice → (optional LLM draft) → validate → **human** apply → valid CALM  
- [ ] TypedFacts unchanged by session tools  
- [ ] Chat-mode cannot silently apply  
- [ ] Secrets redacted in pack tests  
- [ ] Bulk-apply = one DR per residual  
- [ ] No standing-exam product claim via residual  
- [ ] Controls v1 limitation still stated if control_add not built  
- [ ] B-review-session status updated honestly (`partial` OK if portable IR deferred)  

---

## Task ID index

| ID | Phase | Summary |
|---|---|---|
| T-RS1-1 | RS-1 | Layout + gitignore |
| T-RS1-2 | RS-1 | pack |
| T-RS1-3 | RS-1 | triage + residuals schema |
| T-RS1-4 | RS-1 | choice-card generator |
| T-RS1-5 | RS-1 | Copilot chat-mode (**safety**) |
| T-RS1-6 | RS-1 | SESSION/AGENTS templates |
| T-RS2-1 | RS-2 | validate_drafts |
| T-RS2-2 | RS-2 | Manual draft examples |
| T-RS2-3 | RS-2 | Effective IR MVP |
| T-RS2-4 | RS-2 | Optional ir-to-calm |
| T-RS3-1 | RS-3 | apply.py |
| T-RS3-2 | RS-3 | apply-report |
| T-RS3-3 | RS-3 | baseline (thin) |
| T-RS4-1 | RS-4 | Tier B draft CLI |
| T-RS4-2 | RS-4 | Fabricate traps |
| T-RS4-3 | RS-4 | Guided confirm docs |
| T-RS5-1 | RS-5 | Pilot/scorecard note |
| T-RS5-2 | RS-5 | Optional prose rewrite |
| T-RS5-3 | RS-5 | Portable IR if deferred |
| T-RS5-4 | RS-5 | Program DoD |

---

## Agent start instructions (copy-paste)

```text
You are implementing Weaver residual review session per:
  docs/solution/AGENT_TASKS_Residual_Review_Session.md
  docs/solution/Architect_Residual_Review_Session.md

Owner: Gowri. RS-0 signed off 2026-08-08. DO NOT SKIP SAFETY (S1–S12).

Hard rules:
1. Phase order RS-1 → RS-2 → RS-3; do not start RS-4 LLM until apply works without LLM.
2. Never import residual tools into run-slice. Never write typed-facts.json.
3. Chat-mode must not autonomously run apply.py / run-slice / override-applier.
4. Residual success must not claim E-charge-single-L2 or layered-story R2 "closed".
5. No sample-repo hardcodes. No catalogue auto-merge. No fabricate edges.
6. Bulk-apply = one Decision Record per residual.
7. Redact secrets in evidence packs; add a fixture test.
8. Update BACKLOG B-review-session on phase complete.
9. Prefer MVP cut: pack + cards + validate + human apply before full ir-to-calm.

Start at first incomplete RS-1 task (T-RS1-1) unless the user names a later phase.
```

---

## Changelog

| Date | Note |
|---|---|
| 2026-08-08 | Initial agent task list. RS-0 signed off: owner **Gowri**, go-ahead, **do not skip safety**. |
