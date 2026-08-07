# Architect residual review session (VS Code agent + session pack)

**Status:** **PROPOSED — review before implementing.**  
**Product:** Weaver  
**Related:** design v2 §7.1 (LLM advisory), §5.4 (overrides), intelligence IR (`intelligence-ir.md`); `coe-lab/docs/review-flow-capability-map.md`; `BACKLOG.md` **B-review-session**.  
**Not yet code.** Do not treat this file as shipped capability.

---

## 0. Why this exists

Post-scan residual handling today is **correct but architect-unfriendly**:

```
run-slice → many JSON artefacts → hitl-review-trigger → review-queue.json
         → human reads IR / coverage / unmapped
         → hand-author Decision Record + Override JSON
         → re-run with --overrides / --from-facts
         → (optional) suggest-rules for catalogue only
```

An architect wants one residual workspace and an IDE agent that:

1. Surfaces what is still open for **this run**
2. Asks the architect only what **must** be human judgment
3. Drafts evidenced fixes for the rest (from facts / graph-derived evidence / worst-case source at extract refs)
4. Writes back **only** through Decision Records + Overrides (never TypedFacts)

This document productizes §7.1 + HITL for **how architects actually work** (VS Code agent), without putting an LLM on the deterministic core path.

---

## 1. Design principles (non-negotiable)

| # | Principle |
|---|---|
| P1 | **Deterministic spine stays pure** — `run-slice` never calls an LLM; same source → same TypedFacts |
| P2 | **LLM never writes TypedFacts** and never silently mutates catalogues |
| P3 | **Only legal write path = Decision Record + Override** (`override-applier.ts`) |
| P4 | **Evidence-first, source-last** — facts, coverage, review-queue, evidence packs; open source only via path:line already in extract data |
| P5 | **Systematic pattern ≠ residual** — recurring unmapped → catalogue lane, not eternal per-run overrides |
| P6 | **Split architect-must-decide vs LLM-may-decide** |
| P7 | **Loud residual stays loud** if neither human nor LLM has evidence — do not fabricate to clear L2 |

Rule of thumb (unchanged from review-flow map):

> **Systematic patterns → AREC / catalogue.**  
> **One-off residual → HITL session.**  
> **LLM proposes (or drafts under policy); never writes TypedFacts.**

---

## 2. Target experience

```
1. Architect runs Weaver scan → CALM (unchanged)
2. One command builds a Review Session Pack from the out-dir
3. Architect opens VS Code chat/agent on that pack
4. Agent presents agenda:
      A. Architect-only items
      B. Evidence-clear items (LLM may draft)
      C. Escalations / OOS (do not invent)
5. Architect answers A
6. Agent drafts Decision Records + Overrides for A (after answers) and B
7. Architect reviews drafts (Guided v1)
8. Apply: run-slice --from-facts … --overrides <session/drafts/overrides>
9. Validate CALM + inspect re-rendered IR / apply report
```

**Mental model:** Session Pack = residual workspace; Agent = residual analyst; Overrides = only write-back into CALM.

---

## 3. Residual taxonomy

### Tier A — Architect must decide

LLM may **prepare context**, not finalise alone.

| Class | Examples |
|---|---|
| Ownership / boundary | Domain ownership, system naming |
| Ontology judgment | Prisma service-vs-database (Q13) |
| Multi-candidate / zero-candidate bridges | R2 ambiguous skip |
| Command-bus / dynamic dispatch | Permanent OOS for inventing edges |
| Security authority / policy | What *should* be required |
| Promote large clusters to product claim | “Claim SQS for this pilot?” |

### Tier B — LLM may draft if evidence bar met

| Class | Minimum evidence | Allowed draft |
|---|---|---|
| Missing `connects` between **existing** units | Both unit ids in TypedFacts; file:line or import/call/edge supports the pair; single unambiguous pair | `relationship_add` (connects) |
| Wrong kind with strong evidence | Category + source annotation/import | `type_change` |
| Promote ignored item with clear signal | Snippet maps to known category | `node_add` (+ optional connects) |
| Auth present but not matched | Prefer **catalogue proposal** if recurring; one-off only if product later supports control override UX | catalogue lane first |

If bar fails → **do not decide** → Tier A or leave open.

### Tier C — Do not invent

| Class | Action |
|---|---|
| Missing intermediates not in scan | Multi-root rescan or strategy — not fabricate units from names |
| Unresolvable external HTTP | Leave unresolved / ignored |
| Entity–entity structural noise | Grade/filter policy — not free-form LLM cleanup |
| Unmapped ≥5 occurrences | Catalogue session (`suggest-rules` or equivalent proposal file) |

---

## 4. System shape

```
Weaver core (unchanged)
  run-slice → typed-facts, coverage, unmapped, intelligence-ir, CALM
  hitl-review-trigger → review-queue.json
  override-applier via --overrides / --from-facts
        │
        ▼ reads out-dir
tools/review-session/  (NEW, offline — Python recommended)
  pack / triage / validate_drafts / apply wrapper
        │
        ▼
review-sessions/<run-id>/   Session Pack
  SESSION.md, residuals.json, evidence/, drafts/, decisions-log.md
        │
        ▼ VS Code LLM Agent (playbook-bound)
  drafts/decisions + drafts/overrides
        │
        ▼ apply
  run-slice --from-facts --overrides → new out-dir + re-rendered IR appendix
```

**Python prepares and drafts; Weaver still applies.** Do not reimplement `override-applier` in Python.

### 4.1 Session Pack layout

```
review-sessions/<run-id>/
  SESSION.md                 # only file the architect must open first
  AGENTS.md                  # bound agent playbook for this pack
  manifest.json              # out-dir, package roots, contractVersion
  residuals.json             # unified A/B/C queue + status
  evidence/
    packs.json               # redacted snippets where available
    unit-index.json          # thin unitId → kind, confidence, refs
  drafts/
    decisions/               # DecisionRecord JSON
    overrides/               # Override JSON (platform schema)
  decisions-log.md
  apply-report.md            # after apply
```

Do **not** dump full Graphify graphs into the pack (tokens + privacy).

### 4.2 Inputs (already produced by Weaver)

| Input | Use |
|---|---|
| `typed-facts.json` | Units, relationships, evidence |
| `coverage-report.json` | silenceFlags, architecture coverage |
| `review-queue.json` | S1/S2 units (generate if missing via hitl-review-trigger) |
| `unmapped-signals-report.json` | Catalogue candidates |
| ignored-items / evidence packs | Ambiguous residuals |
| `intelligence-ir.md` | Narrative context |
| `architecture.calm.json` | Optional current CALM targets |
| Package roots | Worst-case source open at ref path:line |

### 4.3 Outputs (legal only)

| Output | Consumer |
|---|---|
| Decision Records | Override integrity |
| Overrides | `--overrides <dir>` |
| `decisions-log.md` | Audit / pilot disclosure |
| Catalogue proposal file (optional) | Human promote to `signal-catalogue.yml` — never auto-merge |

---

## 5. Agent protocol (VS Code)

Bound playbook (not free-form monorepo chat):

1. Read `SESSION.md` + `residuals.json` first — do not scan the whole repo.
2. For each open item: use listed evidence; if needed open **only** file:line from residual (bounded window, redact secrets).
3. Classify: `architect_required` | `llm_decide` | `cannot_decide` | `catalogue_candidate`.
4. **Never** edit `typed-facts.json` by hand.
5. Write proposals only under `drafts/`.
6. Every override must reference an active Decision Record with rationale + `evidence_snapshot`.
7. `reviewer`: `architect:<id>` or `llm-advisory:<model>` (and whether architect pre-authorized Tier B).
8. Weak multi-hop → `cannot_decide`, leave S1 honest.
9. Prefer catalogue when same unknown signal ≥5 times.

### Interaction modes

| Mode | v1? | Behaviour |
|---|---|---|
| **Guided** | **Yes (default)** | Ask all Tier A; draft Tier B; architect approves apply |
| Semi-auto | Later | Tier B auto-draft; one “approve all B” |
| Auto-B | Later opt-in | Auto-apply only allowlisted, high-evidence relationship_add |

---

## 6. Evidence rules

**Priority:** TypedUnit evidence → TypedRelationships → review-queue/coverage → evidence-pack snippets → thin unit-index → **last resort** source at extract ref (±K lines, redacted).

**Forbidden:** model prior knowledge of a codebase without a ref in this run; gold mining; inventing intermediate classes outside units/source window; blending LLM self-confidence into `x-aac-confidence`.

**relationship_add rule:** both endpoints exist in this run’s facts/CALM (or are `node_add`’d in the same draft pack with evidence); shape is `connects` (current platform support).

---

## 7. What happens to the Intelligence IR after HITL / LLM residual work?

### Short answer

| Layer | Updated after residual apply? | How |
|---|---|---|
| **`intelligence-ir.md` file** | **Yes — rewritten** when you re-run `run-slice` with `--from-facts` + `--overrides` (or a full rescan with overrides) | `finishRun` always re-renders IR **after** modules (including override apply) |
| **IR body (units / relationships / ignored / unmapped)** | **No semantic change from overrides alone** | Rendered from **TypedFacts**, which overrides **must not** mutate |
| **IR completeness / S1–S2 block** | **Usually still reflects pre-override facts** | Completeness is computed from TypedFacts relationships + unit evidence, not from post-override CALM |
| **IR “Module projections” appendix** | **Yes — reflects post-override CALM counts** | Reads `architecture.calm.json` after calm-generator + override-applier |
| **`architecture.calm.json`** | **Yes** | This is what overrides actually change |
| **Session pack `decisions-log.md` / `apply-report.md`** | **Yes (session side)** | Residual audit trail lives here, not only in IR |

### Implications (honest)

1. **Overrides improve the CALM artefact**, not the TypedFacts “ground truth” notebook.
2. After a successful residual session, the architect should look at:
   - **CALM** (and `calm validate`) for the corrected architecture model  
   - **IR module projection line** for updated node/relationship **counts**  
   - **Session `decisions-log.md`** for who decided what  
3. **Clearing S1 in `coverage-report` / IR completeness via override alone is not guaranteed** today: adding a service→DB edge only in CALM does **not** add a TypedRelationship. That is intentional for determinism, but it means residual review is **L5 completion of the delivered model**, not a silent rewrite of analysis completeness metrics.
4. **If product later wants IR to show “effective architecture after overrides”**, that is a **separate, small IR enhancement** (e.g. appendix: applied overrides + effective CALM relationship list) — recommended as a follow-on once the session pack ships; not required for v1 apply.

### Recommended apply loop (IR-aware)

```bash
# After drafts approved:
node dist/orchestration/run-slice.js \
  --from-facts ./out/my-run/typed-facts.json \
  --overrides ./review-sessions/my-run/drafts/overrides \
  --out ./out/my-run-reviewed \
  --strict-overrides

# Then:
# - architecture.calm.json  → authoritative reviewed model
# - intelligence-ir.md      → regenerated; facts body same; CALM projection updated
# - modules/calm-generator/overrides-applied-report.json → apply audit
```

Optional full rescan (same overrides) if catalogue/source changed; not required for pure residual overrides.

---

## 8. Implementation phases (**do not start until this doc is reviewed**)

| Phase | Deliverable | Exit |
|---|---|---|
| **0** | This design accepted | Product owner sign-off on taxonomy + IR behaviour |
| **1** | `tools/review-session/pack.py` + `triage.py` + schema | Pack builds on real out-dir; no network |
| **2** | Agent playbook + `validate_drafts.py` | Drafts pass schema + endpoint checks; apply cleanly |
| **3** | `apply.py` wrapper + apply-report | Before/after CALM validate + report |
| **4** | Optional scripted LLM for Tier B only | Drafts only; trap: no fabricate |
| **5** | Eval traps + pilot scorecard note | Honesty under residual session |

**Suggested first build slice (after review):** Phase 0 sign-off → Phase 1 pack → Phase 2 validate_drafts → one manual VS Code pilot → Phase 3 apply wrapper.

---

## 9. Non-goals

- LLM inside `run-slice`
- Auto-merge into `signal-catalogue.yml`
- Free-form monorepo RAG as primary input
- Claiming residual session replaces R2/C-call/catalogue work
- Requiring every S1 to clear after a session
- Replacing `suggest-rules` (catalogue lane stays separate; session may *point* to it)

---

## 10. Backlog linkage

Tracked as **`B-review-session`** in [`BACKLOG.md`](./BACKLOG.md).

**Gate:** **Review this document before any implementation.** Status remains `proposed / review-before-implement` until product owner unblocks Phase 1.

---

## 11. Success criteria

| Criterion | Measure |
|---|---|
| Architect starts from one command + `SESSION.md` | UX |
| All applied changes go through DR + Override | Integrity |
| TypedFacts unchanged by session | Determinism |
| One real residual session produces valid post-override CALM | Evidence |
| Insufficient-evidence trap: no fabricated relationship_add | Honesty |
| IR behaviour documented and understood (this §7) | No false expectation that S1 “disappears” from facts-IR solely via overrides |

---

## Changelog

| Date | Note |
|---|---|
| 2026-08-08 | Initial proposed design from residual-UX discussion; IR post-HITL behaviour spelled out; backlog row: review before implement |
