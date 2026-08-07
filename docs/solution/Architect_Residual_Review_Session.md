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

### Product end-state (what you asked for)

**Yes — the residual session’s intended end artefact is a single IR document that presents the *semantically correct architecture* after architect + evidenced-LLM residual work** — not only the raw deterministic extract.

That end document is the **effective architecture IR** (name TBD in implementation; conceptually distinct from today’s facts-only notebook body):

| Document | Role |
|---|---|
| **`intelligence-ir.md` (today)** | Deterministic notebook: TypedFacts units/edges, silence, unmapped — “what the scanner found” |
| **`architecture.calm.json` (today)** | Machine CALM model; **includes overrides** after apply |
| **Effective architecture IR (required end-state of this design)** | Human-readable **reviewed** model: nodes, relationships, controls/auth evidence, residual decisions — **aligned with post-override CALM**, plus decision log. This is what an architect should hand a stakeholder as “the architecture we agree on for this run.” |

Implementation options (pick at Phase 2/3; product requirement is the end-state, not a particular filename):

1. **Preferred:** regenerate IR with a first-class section **“Effective architecture (post-override)”** listing CALM nodes/relationships/controls after apply, plus applied override ids / decision refs. Keep a collapsible or trailing appendix for raw TypedFacts/silence (honesty).  
2. **Alternative:** write `effective-architecture-ir.md` in the session pack / out-dir, generated only after residual apply.  
3. **Non-goal:** rewriting TypedFacts so silence metrics lie about what analysis found.

### What the platform does *today* (without B-review-session code)

| Layer | Updated after residual apply? | How |
|---|---|---|
| **`intelligence-ir.md` file** | **Yes — rewritten** on `--from-facts` + `--overrides` | `finishRun` re-renders after modules |
| **IR body (units / relationships)** | **No semantic change from overrides alone** | Still from **TypedFacts** |
| **IR completeness / S1–S2** | **Still facts-based** | Override edges do not clear S1 in coverage alone |
| **IR “Module projections”** | **Yes — CALM counts** | Post-override `architecture.calm.json` |
| **`architecture.calm.json`** | **Yes** | Authoritative reviewed machine model today |

### Design commitment for residual-session v1+

When **B-review-session** ships, **Definition of Done for a residual session** includes:

1. Post-override `architecture.calm.json` (calm validate 0 errors under project mapping).  
2. **`effective-architecture-ir.md` (or equivalent section)** containing:
   - Service / API nodes and discovered endpoints (interfaces)  
   - Database / messaging / external connections (relationships)  
   - Control / auth evidence attached to nodes (decorator, call-site, contract) where known  
   - Explicit “residual open / OOS” list (what was *not* decided)  
   - Pointers to Decision Records (who decided what)  
3. Session `decisions-log.md` audit trail.

Raw TypedFacts IR may still exist for engineers debugging the scanner; **architect-facing deliverable is the effective IR.**

### Recommended apply loop

```bash
node dist/orchestration/run-slice.js \
  --from-facts ./out/my-run/typed-facts.json \
  --overrides ./review-sessions/my-run/drafts/overrides \
  --out ./out/my-run-reviewed \
  --strict-overrides

# Target after residual session tooling:
# - architecture.calm.json           → machine model
# - effective-architecture-ir.md     → semantically correct reviewed architecture (human)
# - intelligence-ir.md               → still shows extract honesty (facts + silence)
# - overrides-applied-report.json    → apply audit
```

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
| **Effective architecture IR** lists reviewed nodes, edges, auth/controls, open residuals | Architect deliverable |
| Insufficient-evidence trap: no fabricated relationship_add | Honesty |
| Facts-IR honesty preserved (S1/S2 still explain extract gaps) | No silent rewrite of analysis |

---

## 12. Queryable architecture model (flows, auth methods) — answer

### Can we question the architecture after a run?

| Need | Today | After residual session (designed) | Optional later product |
|---|---|---|---|
| **Machine model** | **Yes** — `architecture.calm.json` + `typed-facts.json` are structured JSON | Same + overrides applied; effective IR is markdown projection | — |
| **“What services and endpoints exist?”** | **Yes** — CALM nodes + interfaces; TypedUnits with http-entry-point evidence | Same, residual-corrected | Query CLI/API over CALM |
| **“What DB / messaging / external deps?”** | **Partial–strong** — relationships `connects` / grades; messaging partial (Kafka yes, SQS open) | Stronger after residual fills known gaps | Query by relationship kind / grade |
| **“What auth methods / controls on a service?”** | **Partial** — CALM `controls` from C-dec / C-call / C-contract where catalogue matched; not every call-site vocab | Residual can attach overrides or catalogue rows; still not unbounded inference | Query: list controls by node id |
| **“Walk the request flow end-to-end”** | **Limited** — static connects/calls graph, not runtime traces; command-bus OOS | Residual can add missing static edges if evidenced | Graph query / path search over CALM edges |
| **Conversational Q&A** | **Not productized** — architect uses IR + CALM manually (or ad-hoc IDE agent) | Session agent is residual-focused, not a general chat over whole architecture | Thin **query layer**: load reviewed CALM (+ controls) into agent or `jq`/graph tool with a fixed schema prompt |

### Honest product stance

1. **You already have a queryable *data* model:** CALM JSON is the architecture model. Anything that can read JSON (scripts, IDE agent, BI, graph DB import) can ask “nodes with controls”, “service→database connects”, “interfaces on node X”.  
2. **You do *not* yet have a first-class Weaver “ask architecture questions” product** (no dedicated query API, no stored graph DB, no guaranteed full flow/auth coverage).  
3. **Auth methods in the model** only appear when extraction/catalogue/residual put them in `controls` (or related evidence). Unlisted call-site patterns stay silent — residual session + catalogue intake are the growth paths.  
4. **Flows** are **static architecture relationships**, not distributed-tracing request paths. Good for “service depends on DB/topic/HTTP client”; weak for “runtime call order through command bus.”  
5. **Recommended build order if you want Q&A:**  
   - ship residual session → **effective IR + reviewed CALM**  
   - then a small **`query-architecture` helper** (CLI): inputs = reviewed `architecture.calm.json`; outputs = answers to fixed templates (“list auth on node”, “outbound stores for service”, “paths service→database depth≤2”)  
   - optional: VS Code agent playbook that **only** reads that CALM + effective IR (same bound discipline as residual agent)

So: **yes, a queryable model is realistic and mostly already present as CALM; full “question any flow/auth” depends on residual completeness + an optional thin query/Q&A layer, not on re-scanning with an LLM.**

---

## Changelog

| Date | Note |
|---|---|
| 2026-08-08 | Product end-state: **effective architecture IR** required after residual; §12 queryable model / flows / auth Q&A answered |
| 2026-08-08 | Initial proposed design from residual-UX discussion; IR post-HITL behaviour spelled out; backlog row: review before implement |
