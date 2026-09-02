# Architect residual review session (VS Code agent + session pack)

**Status:** **RS-0…RS-5 CLOSED, 2026-08-09; §3 redesigned 2026-08-23; recommendation/turn-taking hardened 2026-08-26; Decision Record schema/validation/apply chain hardened 2026-09-02 (Entry 25 — a real full session's drafts were all schema-invalid and silently failed to apply until this fix); §3.2 (`unresolved-outbound-target`) designed 2026-09-02, NOT YET IMPLEMENTED** — a real design decision + design-doc §7.1 revision, closing the `CROSS_DOMAIN_UNRESOLVED` gap that section previously flagged as "not yet evaluated," but no code exists yet for the trigger wiring, batch-drafting mode, or preview/merge tool it describes; see §3.2's own "what's actually new" breakdown for the exact build list — real, tested, working code in `tools/review-session/` + `.github/agents/residual-review.agent.md` (83 tests; migrated from `.github/chatmodes/*.chatmode.md` 2026-08-25, see Changelog — current VS Code Copilot Chat no longer discovers the old location/format). `T-RS5-2`/`T-RS5-3` explicitly deferred (owner decision, reasons stated — see AGENT TASKS Residual Review Session's Program DoD). **`B-tier-b-detector` is partially closed, not open** — T-FS-1 (see `draft_tier_b.py`'s own docstring and §8's RS-4 row for the date and detail) gave `triage.py` one real Tier B producer (`multi-hop-single-candidate-below-threshold`); this line previously said the opposite and was corrected on review, see Changelog. **Corrected 2026-08-26 (previously contradicted this doc's own 2026-08-23 changelog row below it):** `draft_tier_b.py`/`advisory.py` **were** already exercised against a real key by T-1 (2026-08-23) — that part of the "never exercised" claim was stale. What's still real and current: `draft_tier_b.py` has not been re-verified since today's dossier work, and `dossier.py` itself got its **first-ever live `claude` CLI run today** (2026-08-26, commit `21b966c`, real success against a reference Java microservices banking sample's pack — see Changelog and `Architect_Pilot_Feedback_Notes.md` Entry 23).  
**Product:** Weaver  
**Related:** design v2 §7.1 (LLM advisory), §5.4 (overrides), intelligence IR (`intelligence-ir.md`); `coe-lab/docs/review-flow-capability-map.md`; `BACKLOG.md` **B-review-session** + **B-calm-portable-ir** + **B-tier-b-detector**; layered recovery **AGENT TASKS Layered Architecture Story** (**B-layered-story**); **implementation tasks:** AGENT TASKS Residual Review Session.  
**Owner:** **Gowri**  
**RS-0 sign-off:** **2026-08-08** — go-ahead granted; **do not skip safety** (no autonomous chat apply of `apply.py` / `run-slice` / override-applier — the real guarantee is `apply.py`'s own explicit confirmation gate, not any chat host's `tools:` allowlist; see Changelog 2026-08-23 and §4.4).

**Phase IDs in this document are `RS-*` (Residual Session), not `L*`.**  
`L0–L4` in this repo mean the **layered-architecture-story** agent program only. Do not conflate them.

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

### 0.1 Boundary with layered-architecture-story (H1 — do not re-litigate)

Residual session **completes a delivered artefact** (post-override CALM + effective IR). It is **not** the primary product path for intermediate-layer recovery, and it must **not** be used to redefine standing exams.

| Concern | Owns it | Residual session may… | Residual session must **not**… |
|---|---|---|---|
| Dual-unit / R2 / R2b / store-terminal / multi-root scan mode | **B-layered-story** (agent tasks) | Surface S1 / unresolved-multi-hop as Tier A/C cards; suggest multi-root rescan; after apply, document reviewed edges in effective IR | Claim “single-root charge gold L2 is green” because an architect overrode an edge; mark Claim Register R2 “closed” without standing exam IDs |
| **E-charge-single-L2** (single-root gold L2) | Standing exams (layered-story L0) | Leave open or human-authorize a one-off override for **this pilot’s** CALM | Treat override as proof the scanner recovered the story under the original exam protocol |
| **E-charge-multi-story** (multi-root access-layer) | Layered-story + multi-root gold | Help review/name residual after multi-root run | Substitute residual for multi-root mechanism work |
| One-off wrong kind / missing connects **with both endpoints in TypedFacts** | **This doc (B-review-session)** | Choice cards + DR/Override | Invent endpoints not in the pack |

**Rule of thumb:** systematic intermediate layers → **AREC / multi-root / catalogues**. One-off residual after that → **this session**. Using residual to paper over an expected-fail exam is a **process failure** (same class as RCA #2), not a successful residual pilot.

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

### 2.1 Choice-driven UX — the agent asks, it never hands the architect a blank box

The single biggest adoption risk in the original design is that Tier A "architect must decide" items were implicitly free-text prompts ("what is this?"). An architect facing 15 of those in a row is exactly the JSON-editing chore this session is supposed to remove. Instead, **every Tier A item is presented as a choice card**: a short question, 2-4 concrete options synthesized *from the run's own evidence* (never invented), and a mandatory escape hatch.

```
┌─ Residual R-014 (Tier A: ontology judgment) ───────────────────────────┐
│ Unit: PrismaService  (services/prisma/prisma.service.ts:1)             │
│                                                                          │
│ This class extends PrismaClient (external base, confirmed via source   │
│ read-back) and is imported by 6 other units. How should it be typed?   │
│                                                                          │
│  [1] database        — owns the DB client directly (default here;      │
│                         matches ownerBaseClass evidence)                │
│  [2] service          — a thin wrapper/facade, not the persistence     │
│                         boundary itself                                 │
│  [3] Leave open (S1)  — insufficient confidence, flag for later        │
│  [4] Other…            — free text (requires 1-line rationale)          │
│                                                                          │
│  Evidence: class-ownership-resolver match (PrismaClient, source L1-L4) │
│                                                                          │
│  My read (not a decision): [only present if an evidence dossier was    │
│  built for this residual — pack.py --with-dossier, see §3.0] ...       │
│                                                                          │
│  Similar decisions this session: none yet                              │
└──────────────────────────────────────────────────────────────────────┘
```

Rules for building a choice card, not just its look:

- **A dossiered card's "My read" line is rendered into the card at
  pack-build time, from `dossier.py`'s validated response — never authored
  live by the chat model reading the card.** Found live (`Architect_Pilot_
  Feedback_Notes.md` Entries 21/22): asking the chat model to freshly write
  an evidence-grounded recommendation on top of an already-presented card,
  in two different instruction phrasings, failed both times in real
  reproduction. `cards.py`'s `_dossier_block` closes this by making the
  recommendation part of the card itself, so the model's job stays
  "reproduce verbatim" — the one thing it already does reliably. No dossier
  built (no `--with-dossier`, or no backend at pack-build time) → the card
  says so plainly; the chat model must never supply its own recommendation
  to fill the gap.
- **Evidence citations show a clickable, workspace-relative path**
  (`file:line` relative to the repo root, not the bare package-root-relative
  scan ref) whenever the cited source file resolves inside the repo — see
  `evidence/paths.json`, §4.1.
- **Options come from a fixed generator per residual class** (§3's Tier A table maps 1:1 to a card template — ontology judgment always offers `{typeA, typeB, leave-open, other}`; multi-candidate bridge always offers `{each candidate, none-of-these, leave-open, other}`), never from the LLM inventing plausible-sounding categories on the fly. This keeps Tier A answerable in seconds and keeps the option set auditable — the same card template produces the same options given the same evidence, independent of model variance.
- **"Other…" always requires one line of rationale**, captured verbatim into the Decision Record's `rationale` field — never silently defaulted.
- **Every card must show its evidence inline** (the file:line / class-ownership / import match that produced the options) so the architect is deciding from what the tool found, not trusting a summary.
- **Repeat answers are surfaced, not asked twice**: if the architect already resolved the same class/pattern earlier in this session (e.g. "all NestJS `*.service.ts` extending a Prisma/TypeORM client → database"), the agent offers `[1] Apply my earlier answer to all N similar cases]` before falling back to asking one-by-one. This is the concrete mechanism that keeps a 50-residual run from being 50 individual clicks. **Bulk-apply integrity (found on review — a blanket record would let one wrong first answer silently propagate to 49 others):** accepting a bulk-apply option must still list every affected unit id before commit, and must still write **one Decision Record per residual**, not one blanket record for the batch — each one references the same rationale text but keeps its own id, so any single item can later be superseded/corrected via its own new Decision Record without touching the other 49. The chat turn is one click; the audit trail is still per-item.
- Tier B drafts are shown the same way but framed as **confirm, not decide** — "Agent proposes X, evidence below. [Accept] [Reject] [Edit rationale]" — never silently auto-applied even when the evidence bar is met (Guided mode, §5's default for v1).

---

## 3. Residual taxonomy

**Redesigned 2026-08-23** (see Changelog) — this section is now the single
authoritative source of truth for every residual a Session Pack can ever
show an architect, and is meant to be kept mechanically in sync with the
code that produces residuals (see `CLAUDE.md`'s "Working in this repo"
rule and the `check-residual-taxonomy-sync.js` follow-on task in
`AGENT_TASKS_Residual_Assist_Redesign.md`). **A change to a producer listed
in the table below is not done until this section is updated in the same
diff.**

### 3.0 Two independent axes, not one conflated question

Earlier versions of this taxonomy conflated "how much evidence-grounded
reasoning does the architect get for this residual" with "is the LLM
allowed to write an Override for it." They're different questions, answered
separately:

- **Tier (A/B/C)** — a **write-permission ceiling**. It answers only:
  may the LLM ever propose a Decision Record + Override for this residual,
  and under what evidence bar. It says nothing about how much the LLM is
  allowed to *explain*.
- **Evidence Dossier** — an **explanation**, applicable to **every**
  residual regardless of tier, when an LLM backend is available (in-chat
  Copilot, or a headless run — see below for what "headless" means here).
  It is never a second, independent corroborating signal for a fact — a
  human accepting a dossier's hypothesis via a card is one human judgment,
  not two — and it never counts toward Tier B's own evidence bar on its
  own. This is what makes "informed decision" real instead of aspirational:
  a Tier A card isn't just a bare menu, a Tier C card explains *why*
  nothing can be invented instead of silently refusing. **Decided
  2026-08-23, with real evidence, not asserted**: the headless dossier pass
  is **opt-in behind an explicit flag**, not automatic whenever a backend
  is available — `AGENT_TASKS_Residual_Assist_Redesign.md`'s T-1 (real
  live runs, the first ever in this project) measured $0.08–$0.32 and
  40–132 seconds per residual, which rules out running it unprompted on
  every `pack.py` build, matching the `--auto-codeql` precedent this
  section anticipated before T-1 ran. T-1 also found the "headless backend"
  in practice can be the `claude` CLI itself (already authenticated,
  no `ANTHROPIC_API_KEY` needed) — the same secret-free convenience
  in-chat Copilot already has, not a separate managed-secret requirement.
  See that document's own T-1 row for the full real-run evidence.
  **Corrected 2026-08-26 (`Architect_Pilot_Feedback_Notes.md` Entry 23):**
  when a dossier is built, its `{explanation, hypotheses, evidenceRefsUsed}`
  is not just "available for the chat model to narrate" — `cards.py`
  renders it directly into the residual's own `card` markdown (a `**My
  read (not a decision):**` section, §2.1) before the chat model ever sees
  it. This was a real gap, not a design choice stated here and simply
  unbuilt: `cards.py` never read `residual["dossier"]` until this date,
  which is why two earlier attempts to get the recommendation to appear by
  instructing the chat model to author it live both failed in real,
  reproduced sessions.

### Tier A — Architect must decide, LLM may only explain

| Class | Examples | Choice-card options (generator-fixed; not LLM-invented) |
|---|---|---|
| Ownership / boundary | Domain ownership, system naming | Context-specific labels from pack + leave-open + other |
| Ontology judgment | Prisma / ORM service-vs-database | `{typeA, typeB, leave-open, other}` (e.g. database vs service) |
| Multi-candidate / zero-candidate bridges | R2 ambiguous skip | `{each in-scope candidate unit, none-of-these, leave-open, other}` — **not** free invention of missing modules |
| Security authority / policy | What *should* be required | Policy options + leave-open + other (does not invent controls without override support — see H4) |
| Promote large clusters to product claim | "Claim SQS for this pilot?" | Promote / defer / leave-open / other |
| Contradicting evidence (T-FS-3) | Two evidence sources disagree on a value | `{source A's value, source B's value, leave-open, other}` — deliberately never Tier B even with exactly two candidates, since picking between two *equally* evidenced sources is exactly what Tier B's own bar refuses |

**Command-bus / dynamic dispatch** is **not** Tier A "pick an edge." It is **Tier C / permanent OOS** for inventing relationships: choice card if shown at all is only `{document as OOS, leave open, (optional) multi-root rescan if roots incomplete}` — never `relationship_add` without both endpoints already in TypedFacts.

**AP-4 (Architect_Pilot_Feedback_Notes.md Entry 8) — the `leave-open` card option maps to `final_decision.action: "accepted"`, by design, not by inference.** `DecisionRecord`'s `action` enum has no dedicated `leave-open` value; `"accepted"` is the designated one for this outcome — it means "the scan's finding (nothing real to connect/change here) is confirmed correct," not "a proposed edit was accepted." No Override is written alongside it (nothing in CALM changes) — the Decision Record alone is the audit trail. Stated explicitly here after this was found to be the single most common real Tier A outcome across two pilot sessions (3/3 residuals in both the reference Java/JAX-RS banking platform and the reference Python microservices banking app runs), and had to be inferred rather than looked up. **This is also this design's stated completion bar going forward: an architect "completes" a Session Pack by *reviewing* every residual to a real decision — including `leave-open`/document-as-OOS — not by driving open-residual count to zero.**

### Tier B — LLM may draft if evidence bar met, else falls through to Tier A

| Class | Minimum evidence | Allowed draft |
|---|---|---|
| Missing `connects` between **existing** units | Both unit ids in TypedFacts; file:line or import/call/edge supports the pair; single unambiguous pair | `relationship_add` (connects only — current `override-applier` support) |
| Wrong/duplicate `connects` between existing units (found on 2026-08-09 review — `relationship_remove` is already fully implemented in `override-applier.ts`, just never named as a residual class) | Existing relationship id is provably wrong/duplicate (e.g. contradicted by stronger evidence, or a literal duplicate `unique-id` case); replacement pair (if any) meets the row above's own bar | `relationship_remove` (+ optional `relationship_add` for the correct pair, as two separate Overrides referencing the same Decision Record) |
| Wrong kind with strong evidence | Category + source annotation/import | `type_change` |
| Promote ignored item with clear signal | Snippet maps to known category | `node_add` (+ optional connects) |
| Auth present but not matched | Prefer **catalogue proposal** if recurring | Catalogue lane first (`suggest-rules` / proposed-updates) |

**If the bar fails, this is a real, named state transition, not a silent reclassification**: the residual stays `tier: "B"` in `residuals.json` (its class doesn't change — it's still the same evidence shape), but gains `draftOutcome: "bar-not-met"` and is presented to the architect exactly like a Tier A card (fixed-option menu, no draft attached). A future reader of `residuals.json` should be able to tell "this was eligible for LLM drafting and the bar wasn't met" apart from "this was never eligible at all" — that distinction is real information (it tells the architect the evidence was close, not absent).

#### H4 — v1 residual closes nodes/relationships better than controls

First-class Override types today emphasize **nodes** and **connects** (`node_add` / `type_change` / `node_rename` / `node_remove` / `relationship_add` / `relationship_remove`). There is **no** dedicated `control_add` override UX wired as a residual card.

| Residual need | v1 residual session |
|---|---|
| Wrong/missing **node kind** or **connects** between existing units | **In scope** (Tier A/B → DR + Override) |
| Missing **security-control** on HTTP unit (S2) when catalogue already has a row but detection missed | Prefer **re-scan / catalogue** fix; residual may leave open or document OOS |
| New auth vocabulary not in catalogue | **Catalogue lane**, not one-off control invent |
| Rich control config / authority | Partial via product C-rich path; not residual free-form |

**Effective IR §4** still **lists** control evidence (and HTTP-without-control silence) from post-override CALM — honesty about controls does not require v1 residual to *write* controls. When control override exists later, add a Tier B class; until then this is a named v1 limitation, not a silent gap.

### Tier C — Never drafts, but still gets a dossier explaining why

| Class | Action |
|---|---|
| Missing intermediates not in scan | Multi-root rescan or layered-story strategy — not fabricate units from names; see §0.1 |
| Command-bus / dynamic dispatch | Permanent OOS — document, do not invent edges |
| Unresolvable external HTTP | Leave unresolved / ignored |
| Entity–entity structural noise | Grade/filter policy — not free-form LLM cleanup |
| Unmapped ≥5 occurrences | Catalogue session (`suggest-rules` or equivalent proposal file) |

### 3.1 Producer registry — every real source of a residual, checked against current code (2026-08-23)

This table is the mechanically-enforced link between "a residual exists in
the code" and "an architect can find out about it here." Populated by
grepping the actual producers, not carried forward from an earlier draft
of this doc. **The enforcement is real, not aspirational**: `pipeline/scripts/check-residual-taxonomy-sync.js`
(CI-wired via `.github/workflows/residual-taxonomy-sync.yml`) fails a diff
that changes `coverage-report.ts`'s `silenceFlags`, `typed-facts.ts`'s
`IgnoredItem.reason` union, or `triage.py`'s `_TRIGGER_MAP` without this
section also changing in the same diff.

**`coverage-report.ts`'s `silenceFlags`** (surfaced via `review-queue.json`, `hitl-review-trigger.ts`):

| Flag | Producer | Tier | Class |
|---|---|---|---|
| `S1-zero-service-touching-relationships` | `coverage-report.ts` `computeCompleteness` | A | multi-candidate-bridge |
| `S2-http-without-security-control` | `coverage-report.ts` `computeCompleteness` | A | security-authority-policy |
| `S5-zero-service-units-with-store-present` | `coverage-report.ts` `computeCompleteness` | A | ontology-judgment |
| `S5-cfn-routes-found-but-unbound` | `coverage-report.ts` `computeCompleteness` | C | missing-intermediates-not-in-scan |
| `S6-isolated-nodes` | `coverage-report.ts` `computeCompleteness` | — (soft flag, informational; not a `review-queue.json` residual trigger today — `--strict-isolated-nodes` is the hard-gate opt-in, not a pack input) | — |
| `S0-cross-package-backbone-incomplete` | `coverage-report.ts` `computeCompleteness` | — (soft flag, informational; not a `review-queue.json` residual trigger today — same pattern as `S6` above) | — |
| `low-architecture-coverage` | `hitl-review-trigger.ts` | A | multi-candidate-bridge |

**`typed-facts.ts`'s `IgnoredItem.reason` union** — only two of the eight declared reasons are actually pulled into a Session Pack today (`triage.py`'s `_IGNORED_REASONS` frozenset); the rest are either filtered as noise or currently unused by any producer, checked directly, not assumed:

| Reason | Producer(s) | Reaches a pack? |
|---|---|---|
| `INSUFFICIENT_EVIDENCE` | `ignored-items.ts` (`ignoreUnknownSignal`) | Yes — ambiguous residual |
| `AMBIGUOUS_BOUNDARY` | `cdxgen-corroboration-pass.ts` | Yes — ambiguous residual |
| `TEST_CODE` | `passes.ts`, `messaging-pass.ts`, `cross_package/outbound-http-detector.ts` | No — deliberately filtered as noise (real, expected exclusions, not review candidates) |
| `CROSS_DOMAIN_UNRESOLVED` | `cfn-route-pass.ts`, `cross_package/outbound-http-detector.ts`, `cross_package/k8s-deployment-detector.ts`, `cross_package/k8s-trust-detector.ts`, `cross_package/env-soft-graph-detector.ts`, `cross_package/multi-hop-bridge-detector.ts` | **Split, 2026-09-02 (was: "not yet evaluated" — now evaluated, see §3.2).** Two sub-shapes carrying a specific, citable piece of evidence (`unresolved-http-target` from `outbound-http-detector.ts`, `unresolved-env-target` from `env-soft-graph-detector.ts`) now reach a pack as the new `unresolved-outbound-target` Tier B class — §3.2. Every other sub-shape (`unresolved-multi-hop`'s zero/2+-candidate cases, `unresolved-k8s-deployed-in`) stays filtered as noise, unchanged — genuine absence/ambiguity, not an evidence question |
| `GENERATED_CODE` | None — declared in the type, never produced by any pass | N/A |
| `PURE_UTILITY` | None — declared in the type, never produced by any pass | N/A |
| `EXCLUDED_BY_CONFIG` | None — declared in the type, never produced by any pass | N/A |
| `OTHER` | None — declared in the type, never produced by any pass | N/A |

**`triage.py`'s `_TRIGGER_MAP`** (the actual tier/class dispatch table — this is the literal source `residuals.json` is built from, so this row of the table is the one most likely to drift and the one the mechanical sync check watches most closely):

| Trigger | Tier | Class |
|---|---|---|
| `S1-zero-service-touching-relationships` | A | multi-candidate-bridge |
| `low-architecture-coverage` | A | multi-candidate-bridge |
| `S2-http-without-security-control` | A | security-authority-policy |
| `S5-zero-service-units-with-store-present` | A | ontology-judgment |
| `S5-cfn-routes-found-but-unbound` | C | missing-intermediates-not-in-scan |
| `multi-hop-single-candidate-below-threshold` | B | single-candidate-below-threshold |
| `contradicting-evidence-force-review` | A | contradicting-evidence |
| `unresolved-outbound-target` (new, 2026-09-02) | B | unresolved-outbound-target |

Plus two producers not routed through `_TRIGGER_MAP` at all: **unmapped-signal clusters** (`unmapped-signals-report.json`, ≥5 occurrences → catalogue lane, <5 → Tier C noise) and **multi-hop bridge zero/2+-candidate refusals** (`multi-hop-bridge-detector.ts`'s own ignored items, folded into the `S1`/`low-architecture-coverage` Tier A class above rather than a separate trigger).

### 3.2 `unresolved-outbound-target` — real evidence, no distinguishable owner, batch-drafted

**Closes the `CROSS_DOMAIN_UNRESOLVED` gap §3.1 flagged as "not yet evaluated."** Found reviewing a live scan (a reference Java microservices banking sample): a service's own `RestTemplate`/`requests` call, or a ConfigMap value shaped like `service-name:port`, is real, concrete evidence of an intended outbound relationship — the deterministic pipeline correctly refuses to fabricate the edge (no distinguishable target owner, per `outbound-http-detector.ts`/`env-soft-graph-detector.ts`'s own "never guess" rule), but until now that refusal was also never resurfaced for review. Confirmed real via the same scan: the 3 most architecturally central edges in that repo's own published reference diagram were silently missing from the generated CALM for exactly this reason.

**Eligibility (design doc §7.1's revised rule, applied concretely):** an `IgnoredItem` with `reason: 'CROSS_DOMAIN_UNRESOLVED'` and `detail` starting with `unresolved-http-target:` or `unresolved-env-target:` — both carry one specific, citable evidence string (the call site, or the ConfigMap value) — is eligible. `unresolved-multi-hop`'s zero/2+-candidate cases and `unresolved-k8s-deployed-in` are **not** — no specific evidence to cite, still filtered as noise, unchanged.

**Tier B, not Tier A** — a real candidate target usually exists (the evidence itself often names it, e.g. a ConfigMap value literally containing the target's k8s Service name), matching `single-candidate-below-threshold`'s own shape more than a genuine multi-candidate judgment call. When no real candidate correlates at all, this falls through to Tier A exactly like any other Tier B item whose evidence bar isn't met (`draftOutcome: "bar-not-met"`, §3 Tier B row above) — never a guessed `relationship_add`.

**What's actually new, mechanically — and what isn't:**
- **Not new:** the draft shape (`relationship_add`, same `override-applier.ts` support every other Tier B class already uses), the card template (reuses `single-candidate-below-threshold`'s "accept the identified candidate / reject / other" shape, `cards.py`), the apply gate (`apply.py`'s explicit-confirmation requirement, unchanged), and the "draft sitting unapplied in `drafts/` is the inferred-not-yet-confirmed state" mechanism — that's just what an unapplied draft already means today, no new artefact or `x-aac-status` value required.
- **New:** permission for `draft_tier_b.py` (or a new sibling batch entry point in `tools/review-session/`, reusing `llm_common.py`) to draft the **entire eligible set in one non-interactive pass**, rather than the one-residual-at-a-time interactive flow every other tier/class still uses. Justification is the same one design doc §7.1 states: real accountability for an individually low-stakes, evidence-thin item is thin, so gating *generation* behind a synchronous per-item human decision is friction with no matching safety benefit — application still requires the same explicit confirmation as always. **Hard Rule 10 (§5, one-residual-at-a-time) is unchanged for every other class** — this is a narrow, named carve-out for this one class, not a general loosening.
- **New, and not yet built:** a preview/merge step — canonical `architecture.calm.json` plus the current `drafts/` directory's pending `relationship_add` overrides, rendered as one merged CALM document with drafted-but-unconfirmed relationships tagged distinctly (e.g. `x-aac-draft: true` metadata — deliberately not a `FactStatus`/`x-aac-status` value, since these relationships don't exist in `typed-facts.json`'s deterministic sense; they're synthesized purely for preview) so an architect can see the *complete*, semantically-marked picture before confirming anything, not just a text list of pending drafts. Read-only, never touches the canonical file or `drafts/` itself. Not yet built — a real gap this section names, not a silent one.

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

**Concurrency (found on review, not previously named):** v1 is scoped to **one architect per Session Pack, no concurrent editing story**. `pack.py` should refuse to build a new pack over an existing, not-yet-applied `review-sessions/<run-id>/` directory (fail loud: "a pack for this run already exists and has unapplied drafts — apply or discard it first") rather than silently overwriting in-progress work. Two architects wanting to split one run's residuals is explicitly **out of scope for v1** — not solved, not silently broken either; named here so it doesn't get assumed as "probably fine" during a team pilot.

### 4.1 Session Pack layout

```
review-sessions/<run-id>/
  SESSION.md                 # only file the architect must open first
  AGENTS.md                  # bound agent playbook for this pack -- also
                              # embeds the real DecisionRecord/Override JSON
                              # shape verbatim (added 2026-09-02, Entry 25:
                              # the agent cannot read pipeline/src/types/
                              # overrides.ts, so a bare citation to it isn't
                              # enough -- see §4.4)
  manifest.json              # out-dir, package roots, contractVersion
  residuals.json             # unified A/B/C queue + status
  evidence/
    packs.json               # redacted snippets where available
    paths.json                # ref -> REPO_ROOT-relative "path:line" map
                               # (source resolves inside the repo only,
                               # added 2026-08-26, Entry 20)
    unit-index.json          # thin unitId → kind, confidence, refs
  drafts/
    decisions/               # DecisionRecord JSON
    overrides/               # Override JSON (platform schema)
  decisions-log.md
  apply-report.md            # after apply
```

Do **not** dump full Graphify graphs into the pack (tokens + privacy).

**Redaction, made concrete (found on review — "redacted" was asserted with no mechanism, the exact "specified vs proven" gap this project's own CLAUDE.md principle warns about):** `pack.py` (§8 **RS-1**) must run every source snippet it writes into `evidence/packs.json` through a fixed, testable redaction step before it ever lands on disk, not a documentation promise:
- A literal secret-pattern scan (reuse an existing scanner if one is already vendored — e.g. a `gitleaks`/`trufflehog`-style ruleset — rather than hand-rolling regexes; if none is available, a documented, checked-in minimal pattern set: AWS-style keys, bearer tokens, private-key headers, connection-string password segments) runs over every snippet before it's written.
- A match redacts the value in place (`"AKIA****REDACTED****"`, not silent deletion — the architect should still see *that* something was there and why the line is evidence, just not the value).
- `pack.py`'s own regression test includes a fixture snippet with a known fake secret pattern and asserts it comes out redacted in `packs.json` — this is a testable claim now, not an assertion in a design doc.
- Session Packs are **scratch state by default, not committed** (same convention as `spikes/<name>/repo` per CLAUDE.md) — `review-sessions/` should be gitignored unless an architect deliberately archives one for audit; `decisions-log.md`/`apply-report.md` (the audit-relevant, non-source-bearing outputs) are the pieces worth checking in, not the evidence packs.

### 4.2 Inputs (already produced by Weaver)

| Input | Use |
|---|---|
| `typed-facts.json` | Units, relationships, evidence |
| `coverage-report.json` | silenceFlags, architecture coverage |
| `review-queue.json` | S1/S2/S5/low-architecture-coverage residuals (generate if missing via hitl-review-trigger; S5 wired in 2026-08-09, see changelog) |
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

### 4.4 Delivery vehicle: VS Code + GitHub Copilot Chat (not a bespoke extension)

Confirmed direction: architects interact via **GitHub Copilot Chat inside VS Code**, not a custom-built VS Code extension. That changes the implementation shape of "the agent" — it isn't a new UI, it's a **bound Copilot Chat configuration** pointed at the Session Pack:

- **Decided: chat-mode/instructions file only, no MCP server.** `.github/agents/residual-review.agent.md` (or a repo `.github/prompts/residual-review.prompt.md`) is `AGENTS.md` (§4.1) expressed in Copilot Chat's own instructions format — scopes a chat session to the playbook rules in §5: "read `SESSION.md` + `residuals.json` first, never scan the whole repo, never edit `typed-facts.json`, write only under `drafts/`."
- **Correction (found on review, was wrong as originally written): "drafts/ is inert until a human runs apply.py" is not true by default in Copilot Chat's agent mode.** Agent mode can execute terminal commands and edit arbitrary workspace files when the user has granted tool/terminal permissions — which is precisely the mode a chat-mode/instructions file is built to enable. Without an explicit restriction, nothing stops the chat agent from invoking `apply.py`/`run-slice`/`override-applier` itself, mid-conversation, which collapses the separation this design's integrity story depends on. This is now a **hard requirement of the chat-mode configuration, not an assumption**:
  1. The chat-mode file's declared tool/permission set **must not** include unrestricted terminal execution. Either deny terminal tools entirely for this mode, or require VS Code's per-command confirmation prompt (never "auto-approve") for any command touching `run-slice`, `apply.py`, or `override-applier`.
  2. `apply.py` (§8 **RS-3**) itself is the actual backstop, and it re-validates every draft against the Decision Record/Override JSON schema and the integrity rules already in `override-applier.ts` (active-decision-only, no dangling refs) before calling anything real — so even a permitted invocation still gets rejected there if a draft is malformed. But rule 1 is what keeps that invocation an explicit, confirmed architect action rather than something the model did on its own initiative. **This re-validation claim was found FALSE in practice, then fixed, 2026-09-02 (`Architect_Pilot_Feedback_Notes.md` Entry 25):** a decision file missing `decision_id` — the exact real shape a live chat session invented when it had no way to learn the real schema — was silently DROPPED from validation instead of rejected, so a pack's worth of schema-invalid drafts validated as "0 errors" and silently failed to apply. `validate_drafts.py`'s new shared `load_decisions_by_id()` (used by both `apply.py`'s own re-validation and the standalone `validate_drafts.py` CLI) closes this for real — verified against the exact malformed shape found on disk, `apply.py` now refuses immediately, naming the real missing field.
  3. This is an **RS-0 exit condition**, not a later hardening pass: the chat-mode file's tool permissions must be reviewed and confirmed (e.g. screenshot, config export, or checked-in chat-mode file + checklist in the RS-0 sign-off record) to have no autonomous terminal-execution path, before RS-1 begins.
  4. Degraded-fallback, stated explicitly rather than left implicit: if an organization's Copilot policy disables agent-mode tool execution entirely, the workflow still works — the architect reads `SESSION.md`/choice cards conversationally, then hand-authors the Decision Record + Override JSON exactly as today's pre-B-review-session flow does. Nothing in this design removes that path; the chat mode is a convenience layer over it, not a replacement for it.
- **Choice cards (§2.1) render as ordinary Copilot Chat markdown** — numbered options, an evidence blockquote, and a follow-up architect reply of `1`/`2`/`other: ...`. No custom webview needed for v1; a richer picker UI is a legitimate RS-5+ nice-to-have, not a blocker.

### 4.5 CALM viewer — reused, not built

The architect views the generated/reviewed architecture in an **existing CALM viewer plugin** (the FINOS CALM Studio / draw.io↔CALM converter tooling already referenced in `CLAUDE.md`'s CALM Studio contract note), pointed at `architecture.calm.json`. This design adds no new viewer code — its only two obligations toward that plugin are:

1. Keep `architecture.calm.json` at the stable, namespaced path it already has post-apply (true today per Wave M's module-output namespacing) so the viewer's pointed-at file doesn't move between runs.
2. Note the manual refresh step in `SESSION.md`'s closing instructions ("open `architecture.calm.json` in the CALM viewer; reload after Step 8 apply") — since most static-file viewers don't file-watch by default. If the specific plugin in use *does* support watch-reload, this step disappears; not assumed here.

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
10. **Present exactly one residual's card at a time, then stop** — do not
    draft, decide, or move to the next residual until the architect replies
    to that specific one (a reply of `1`/`2`/`leave-open`/`other: ...`, or an
    explicit bulk-apply request per §2.1). Added 2026-08-26 after a real,
    live failure (`Architect_Pilot_Feedback_Notes.md` Entry 24): asked to
    "start the review," the chat agent decided all 23 residuals in one reply
    without ever presenting a card. An open-ended request to "start" or
    "review everything" means show the first card — it is never permission
    to decide on the architect's behalf.

### Interaction modes

| Mode | v1? | Behaviour |
|---|---|---|
| **Guided** | **Yes (default)** | Ask each Tier A item **one at a time** — present its card, architect replies, then the next is shown (§5 item 10); draft Tier B; architect approves apply |
| Semi-auto | Later | Tier B auto-draft; one “approve all B” |
| Auto-B | Later opt-in | Auto-apply only allowlisted, high-evidence relationship_add |

### 5.1 Tier B system prompt (draft, for RS-4)

This is the bound instruction set for the *drafting* half of the agent only — Tier B items, where evidence already clears the bar in §3. It is deliberately narrow and repeats its own limits rather than trusting a single instruction to hold across a long chat session (a real failure mode of long-context agent prompts). Not used for Tier A — those are choice cards answered by the architect, never auto-decided.

```
You are the Tier B drafting assistant for a Weaver residual review session.
You draft ONLY. You never apply, never edit typed-facts.json, never touch
the catalogues. Every draft you write goes to drafts/ and is reviewed by
the architect before anything is applied.

INPUTS you may read for this residual, and nothing else:
  - residuals.json entry for this residual ID
  - evidence/packs.json entries referenced by this residual ID
  - evidence/unit-index.json entries for the specific unit ids involved
  - source file:line spans explicitly listed as this residual's evidence
    refs (bounded window; do not open any other file)

HARD RULES (violating any of these means: do not draft, return
"cannot_decide" instead):
  1. You may only propose a decision if EVERY evidence field required by
     this residual's Tier B class (see taxonomy) is present and
     unambiguous. Partial evidence is not evidence.
  2. You may never introduce a node, relationship, unit id, file path, or
     line number that does not already appear in your inputs. If the
     right answer requires something not in the pack, output
     "cannot_decide: missing <what>" instead of guessing.
  3. You may never use prior knowledge of this codebase, this framework,
     or "codebases like this" to fill a gap the evidence doesn't cover.
     Cite only what's in the pack.
  4. If more than one candidate fits the evidence equally well, output
     "cannot_decide: ambiguous between <candidates>" — do not pick one.
  5. Every draft must cite its evidence explicitly in the Decision
     Record's rationale field (residual id, evidence ref, one sentence).
  6. Never blend your own confidence into x-aac-confidence. That field is
     computed by the deterministic pipeline; you do not set it.
  7. Output format is fixed: a Decision Record JSON + an Override JSON,
     matching the schemas in drafts/decisions and drafts/overrides. No
     prose outside the rationale field.

For each residual you are asked to draft, respond with exactly one of:
  - a completed Decision Record + Override pair (evidence bar met), or
  - "cannot_decide: <reason>" (evidence bar not met — this is a correct,
    expected, non-failure outcome, not something to avoid).

You are being run on a fixed, closed set of residuals for one session.
Do not summarize, do not suggest catalogue changes, do not comment on
residuals outside your assigned batch.
```

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

Implementation options (pick at RS-2/RS-3; product requirement is the end-state, not a particular filename):

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

### 7.1 Effective Architecture IR — template (target schema)

§7 committed to an effective-architecture-ir.md end-state without specifying its shape. Proposed template, so "comprehensive" is a checklist, not a feeling:

```markdown
# Effective Architecture — <system/domain name>

## Provenance
| Field | Value |
|---|---|
| Run id | <run-id> |
| Generated | <date>, from run <run-id>, baseline <prior effective-ir run-id or "none — first pass"> |
| Package roots scanned | <paths + source commit sha per root> |
| contractVersion | <typed-facts contract version> |
| Reviewed by | <architect id(s)>, session <session-id> |
| Residuals resolved this run | <N Tier A, N Tier B, N left open> |

## 1. System overview
One-paragraph, evidence-only summary (node/relationship counts by kind,
no narrative not traceable to CALM). Not hand-written prose — templated
from counts + any architect-supplied one-line system description
captured during the session (optional field, clearly marked as
architect-authored, not inferred).

## 2. Node inventory
Grouped by kind (service / database / network / system / …). Per node, a
short prose line **plus a fenced block that is the node's literal CALM
JSON fragment** (see §7.4 — not a paraphrase, the actual object that
belongs in `architecture.calm.json`'s `nodes[]`):

  `AccountService` — HTTP entry point, JWT-authenticated. (decision: D-014)
  ```calm-node
  {
    "unique-id": "svc-account-service",
    "node-type": "service",
    "name": "AccountService",
    "description": "…",
    "interfaces": [
      { "unique-id": "…", "type": "path-interface", "path": "GET /…" }
    ],
    "controls": { },
    "metadata": [
      { "key": "x-aac-provenance", "value": [ "…" ] },
      { "key": "x-aac-decision-ref", "value": "D-014" },
      { "key": "x-aac-ir-checksum", "value": "sha256:1f3a…" }
    ]
  }
  ```
  (Real generator emits **complete** objects — no `...` placeholders. Namespaced
  keys live in `metadata[]` as `{key,value}` entries, matching CALM metadata
  shape and existing builders — not free-form top-level fields invented only for IR.)

## 3. Relationship inventory
Grouped by **`x-aac-relationship-grade`** values the pipeline actually emits
(`structural` | `architecture` | `trust` — AREC T-A2 / relationship-builder).
Do **not** invent alternate grade enums (e.g. bare `"R1"`/`"R2"` as CALM values).
Story labels (S-shallow / S-layered-access / …) may appear in **prose** only unless
a future metadata key is productized.

  `AccountService` connects to `AccountsDb` (grade: architecture; decision: none — deterministic)
  ```calm-relationship
  {
    "unique-id": "rel-account-service-db",
    "description": "imports relationship (same-package, source: graphify)",
    "relationship-type": {
      "connects": {
        "source": { "node": "svc-account-service" },
        "destination": { "node": "db-accounts" }
      }
    },
    "protocol": "JDBC",
    "metadata": [
      { "key": "x-aac-provenance", "value": "graphify" },
      { "key": "x-aac-cross-package", "value": false },
      { "key": "x-aac-relationship-grade", "value": "architecture" },
      { "key": "x-aac-ir-checksum", "value": "sha256:9c2e…" }
    ]
  }
  ```

**Note — any `{...}` elision in this design doc is illustration-only.** The real generator must emit complete CALM objects aligned with `pipeline/src/types/calm.ts` and calm-generator builders (full `connects.source`/`destination`, `interfaces`, `controls`; metadata as `{key,value}` arrays; `x-aac-relationship-grade` not `x-aac-grade`). **RS-2** exit: round-trip a fixture through `calm validate`, not eyeball markdown.

**`x-aac-ir-checksum` (found on review — nothing detected a hand-edited block before this):** a checksum of the canonical CALM fragment at generation time, stamped onto every emitted node/relationship/control both in `architecture.calm.json` and in its markdown mirror. `ir-to-calm.ts` recomputes and compares before trusting a block; a mismatch is a loud, named failure ("block for `svc-account-service` does not match its checksum — was it hand-edited?"), never a silent pass-through. This is what actually makes §7.4's "hand-editing is not a supported write path" a checked rule instead of a stated one.

## 4. Controls & auth evidence
Per node carrying control evidence: mechanism class (decorator /
call-site / contract), requirement id, evidence ref, plus its literal
CALM `controls` fragment. Nodes with http-entry-point evidence and NO
control evidence are listed explicitly here too (mirrors the
threat-signals module's own check) — silence is shown, not omitted.

## 5. Persistence & messaging dependencies
Table: unit -> {store/topic, direction (producer/consumer/owner),
mechanism, evidence ref}.

## 6. Open residuals / out-of-scope
Every Tier A item left unanswered and every Tier C item — with reason
("no fixture evidence", "ambiguous, deferred", "permanent OOS: command
bus"). This section existing and being non-empty is not a defect in the
document; a session that silently has no open items after resolving
everything Tier A/B is the anomaly to double-check, not the goal.

## 7. Decision log (this run)
Table: decision id -> residual id -> chosen option -> reviewer
(architect:<id> or llm-advisory:<model>) -> rationale (one line) ->
timestamp. Full detail lives in decisions-log.md; this is the
architect-facing summary.

## 8. Revision history (cumulative — see §7.2)
Table: run id -> date -> nodes added/changed -> relationships
added/changed -> residuals resolved -> net open-residual count.
```

Generation is templated (deterministic string assembly from CALM +
decisions-log + residuals.json), **not** free LLM prose, for sections
1-7. Section headers/table shapes are fixed; only the "System overview"
one-line architect-supplied description (explicitly marked as such) is
free text, and only because the architect wrote it, not the model.

### 7.2 A goal state reached over many scans, not one run

A single scan-and-review session will not produce a "comprehensive" effective architecture IR for a real system — real systems get scanned incrementally (new packages onboarded, code changes between releases, residuals resolved a few at a time). The template above is designed to **accumulate**, not restart, across runs:

- Each run's effective IR is generated **against a baseline**: the prior run's effective-architecture-ir.md / CALM (`--baseline <path>`, new CLI input, not yet built). Nodes/relationships/decisions carried forward from the baseline are preserved verbatim unless this run's facts or an explicit new Decision Record supersedes them — a node the architect already typed correctly last time is never silently re-asked.
- **Never regress a decided item without a new Decision Record.** If this run's deterministic extract disagrees with a prior human decision (e.g. source changed shape), that's surfaced as a **new residual** ("previously decided as X, this run's evidence now suggests Y — re-confirm?"), not an automatic overwrite — matches P7 (loud residual stays loud) applied to drift, not just first-pass gaps.
- §7.1's Revision History table (§8 of the template) is the visible trace of this accumulation — a stakeholder can see the system's reviewed-architecture picture getting more complete run over run, and exactly which run resolved which residual.
- This directly answers your framing: the effective IR is realistically a **living document reaching comprehensiveness over multiple scans and HITL rounds**, not a single-session deliverable — the template and baseline mechanism above is what makes that incremental path concrete instead of aspirational.

### 7.3 Optional: LLM rewrite of the effective IR into readable prose — strictly evidence-bound

Sections 1-7 of §7.1's template are template-assembled, which is correct but reads like a report, not a document you'd hand to a stakeholder unedited. An optional, separate pass can ask an LLM to **rewrite the templated sections into connected prose**, under the same non-negotiable evidence discipline as Tier B drafting — this is a *presentation* transform, never a source of new architectural claims, and runs **after** apply, never in place of the templated version (the templated version stays as the audited source of truth; the prose version is generated from it, never the reverse).

```
You are rewriting a Weaver effective-architecture-ir.md into prose for a
stakeholder audience. You are a formatter, not an analyst.

INPUT: the fully-assembled templated effective-architecture-ir.md
(sections 1-8) for this run, and nothing else — no source code, no
typed-facts.json, no prior knowledge of this system.

HARD RULES:
  1. Every sentence you write must be traceable to a specific row/cell in
     the input document. If you cannot point to which table row a
     sentence came from, delete the sentence.
  2. You may not add any node, relationship, control, or dependency not
     already listed in the input. You may not infer purpose, business
     context, or criticality unless the input explicitly states it
     (e.g. an architect-authored system-overview line).
  3. You may not soften or omit the "Open residuals / out-of-scope"
     section content — reduced detail is fine, dropped items are not.
  4. Preserve every decision ref and evidence ref as inline citations
     (e.g. "(see D-042)") so a reader can trace prose back to the
     templated source.
  5. Output is a drop-in replacement for sections 1-7 only. Do not alter
     section 8 (Revision history) — keep it as the exact table.
  6. If the input document is internally inconsistent (a node referenced
     in §3 not listed in §2, etc.) stop and report the inconsistency
     instead of writing around it — that's a template-generation bug to
     fix upstream, not something to paper over in prose.

Do not use any fact, framework convention, or architectural pattern
knowledge not present in the input document, even if you believe it to
be true of systems like this one.
```

Positioned as an **RS-5+ nice-to-have**, not part of the RS-0–RS-3 core — the templated version alone satisfies §7's Definition of Done; this is purely about readability for a non-technical stakeholder audience, and the extra LLM call is one more thing that can go wrong (rule 6 exists specifically because a rewrite pass is also a place a template bug could get silently smoothed over instead of caught).

### 7.4 Is the template CALM-compatible, and can CALM be rebuilt from it alone?

Direct answer: **yes, by design, as of the `calm-node`/`calm-relationship` fenced blocks added to §7.1 above** — but only because those blocks are made to literally *be* CALM, not a paraphrase of it. Worth being precise about what that does and doesn't buy you.

**Why fenced literal CALM, not a custom IR schema.** The earlier draft of §7.1 described nodes/relationships/controls in prose-table form only. Prose is lossy — reconstructing valid `architecture.calm.json` from a table description would mean writing a second, bespoke parser that has to re-derive exact CALM shapes (the `interacts` vs `connects` distinction, `interface-definition` shapes, `control-requirement`/`evidence` objects) from human-readable text, which is exactly the kind of duplicated, drift-prone logic this whole project has spent effort designing *out* (`build-calm.ts`'s catalogue-driven builders exist for this reason). Embedding the real JSON fragment inline instead means:

- **A reconstruction tool (`ir-to-calm.ts`, not yet built) is nearly trivial** — it collects every `calm-node`/`calm-relationship`/`calm-control` block out of the markdown, assembles them into `{nodes, relationships, ...}`, and runs the result through `calm validate` exactly like any other Weaver output. No translation step to get wrong.
- **It is genuinely usable without re-scanning the repo.** Once a session's effective IR is filled in, anyone with just that one markdown file — no source access, no `typed-facts.json`, no Weaver installed — can extract a real, schema-valid `architecture.calm.json` from it. That's a real, concrete answer to "can someone build a CALM json independently from the filled template": yes, mechanically, from the document alone.
- **It stays honest about round-trip direction.** The blocks are a generated *mirror* of CALM + applied Overrides, not an independent input an architect edits by hand to change the architecture — editing a `calm-node` block directly in the markdown would be a fourth, ungoverned write path into CALM, which breaks P3 (§1: Decision Record + Override is the *only* legal write path). So: **CALM → template is round-trippable and is the supported direction; template → CALM by hand-editing the fenced blocks is explicitly not supported** — a change still has to go back through a Decision Record + Override and a regenerated template, same governance as everything else in this design. This is the same "one-way rendering, never a second source of truth" discipline `intelligence-ir.md` already committed to (design v2 §13) — extended here so the *reviewed* IR gets the same discipline, not a looser one.

**What this doesn't remove: you still need one real scan to start.** The template can only contain nodes/relationships that a prior Weaver run + residual session actually produced. It's a portable, self-contained *snapshot* of an already-built architecture model, not a way to originate one from nothing — "independent of further scans" means independent of re-scanning to *use* the model downstream, not independent of ever having scanned at all.

**Why this matters for your multi-purpose model plan (security, green engineering, …).** This is the part worth being deliberate about. Today's stated plan (`CLAUDE.md`, design v2) is that future modules — a threat modeller, a green analyser — consume `typed-facts.json`, the *raw, pre-residual* contract. That's fine for signals a module can re-derive itself, but a security or sustainability module built on raw facts inherits every open residual and false-positive the architect hasn't reviewed yet. Once a residual session exists, the **reviewed** artifact (post-override CALM + this template) is strictly higher-quality input for exactly those downstream modules — an architect-confirmed node/control set, not a pre-review guess. Concretely, that argues for a small addition to the module contract, not a new one: modules should be able to declare whether they consume `typed-facts.json` (raw, always available, no review dependency) or `architecture.calm.json` + effective-IR (reviewed, higher trust, only available after a residual session has run) — a real design fork worth naming now rather than discovering later when the first security/green module is actually built, but **not something to build in this round**; flagging it here as a forward-looking implication of making the IR CALM-compatible, for a future module-contract revision to pick up.

---

## 8. Implementation phases — **`RS-*` only** (H2; not layered-story `L*`)

**Do not start until this doc is reviewed and RS-0 is signed off.**  
**Do not confuse with** AGENT TASKS Layered Architecture Story phases **L0–L4**.

| Phase | Deliverable | Exit |
|---|---|---|
| **RS-0** | This design accepted | **DONE 2026-08-08** — owner **Gowri**; go-ahead + do not skip safety; agent tasks AGENT TASKS Residual Review Session. Chat-mode no-autonomous-apply remains a **hard exit of RS-1 (T-RS1-5)**, not waived. |
| **RS-1** | `tools/review-session/pack.py` + `triage.py` + schema, `.github/chatmodes/residual-review.chatmode.md` | **DONE 2026-08-09.** Pack builds on real out-dir; no network; choice-card generator (§2.1) produces cards from a fixed template per residual class; redaction fixture test. All real, all tested. |
| **RS-2** | Agent playbook + `validate_drafts.py` + templated effective IR (§7.1) with literal CALM fragments matching `types/calm.ts` | **DONE 2026-08-09, MVP scope.** Drafts pass schema + endpoint checks; effective IR from real post-apply CALM. Full `ir-to-calm.ts` **deferred to B-calm-portable-ir** as this row's own MVP-defer clause allows — tracked separately, not silently dropped. |
| **RS-3** | `apply.py` wrapper + apply-report + initial `--baseline` (§7.2) | **DONE 2026-08-09.** Before/after CALM validate proven with a real applied override (0 errors); second run genuinely carries forward a prior decision, proven with a real two-pack run. |
| **RS-4** | Optional scripted LLM for Tier B only (§5.1) | **DONE 2026-08-09, primary path corrected to in-chat Copilot drafting after owner feedback** (not the standalone script, which is now the secondary/headless alternative). Drafts only; trap: no fabricate; `cannot_decide` is a passing outcome — 100% on refusal fixtures, against synthetic responses (no live model tested here, honestly disclosed). Real gap: no detector currently produces a Tier B residual (**B-tier-b-detector**). |
| **RS-5** | Eval traps + pilot scorecard note; optional prose rewrite (§7.3); complete B-calm-portable-ir if deferred | **CLOSED 2026-08-09 — 2 of 4 tasks done, 2 explicitly deferred (owner decision).** Pilot scorecard note done (Pilot Ready Scorecard §3.1); Program DoD done (every item re-verified against real code). Prose rewrite and full portable IR both deferred with stated reasons, tracked at their own rows. |

**Suggested first build slice (after RS-0):** RS-1 pack + choice cards → validate_drafts + apply (thin) → one Copilot pilot → then effective IR / baseline / portable IR as capacity allows.

---

## 9. Non-goals

- LLM inside `run-slice`
- Auto-merge into `signal-catalogue.yml`
- Free-form monorepo RAG as primary input
- Claiming residual session replaces R2/C-call/catalogue work **or layered-story exams** (§0.1)
- Using residual overrides to mark **E-charge-single-L2** (or any standing exam) as “product green”
- Requiring every S1 to clear after a session
- Replacing `suggest-rules` (catalogue lane stays separate; session may *point* to it)
- **v1 inventing or bulk-writing security controls** without a first-class control override path (H4)
- Building a new CALM viewer/editor (§4.5 — reuse the existing plugin, view-only)
- A general-purpose "chat with your whole codebase" experience (Copilot Chat is bound to the Session Pack, per §4.4 and §5's playbook rules — not free-form monorepo chat)
- LLM-authored prose in the effective IR replacing the templated, evidence-cited version (§7.3 is presentation-only, generated from the template, never the source of record)
- Autonomous chat-agent execution of `apply.py`/`run-slice`/`override-applier` without an explicit, confirmed architect action (§4.4 — the chat mode must not be granted unrestricted terminal tool access)
- Multi-architect concurrent editing of one Session Pack (§4 — v1 is single-architect; `pack.py` refuses to overwrite an unapplied pack rather than silently allowing concurrent writes)

---

## 10. Backlog linkage

Tracked as **`B-review-session`** in [`BACKLOG.md`](./BACKLOG.md).

**RS-0…RS-5 CLOSED, 2026-08-09** per AGENT TASKS Residual Review Session's own Program DoD (T-RS5-4).  
**Also tracked separately:** **B-calm-portable-ir** (§7.1–§7.4 full portability, explicitly deferred at T-RS5-3) and **B-tier-b-detector** (the real gap behind "no residual is ever classified Tier B" — a new, evidenced detector, not yet built).

---

## 11. Success criteria

| Criterion | Measure |
|---|---|
| Architect starts from one command + `SESSION.md` | UX |
| All applied changes go through DR + Override | Integrity |
| TypedFacts unchanged by session | Determinism |
| One real residual session produces valid post-override CALM | Evidence — **found genuinely failing 2026-09-01, fixed 2026-09-02** (Entry 25): a real 23-residual session produced only schema-invalid Decision Records that silently validated clean and silently failed to apply; see the 2026-09-02 changelog row |
| **Effective architecture IR** lists reviewed nodes, edges, auth/controls **evidence present in CALM**, open residuals | Architect deliverable |
| Insufficient-evidence trap: no fabricated relationship_add | Honesty |
| Facts-IR honesty preserved (S1/S2 still explain extract gaps) | No silent rewrite of analysis |
| Standing exams / Claim Register R2 not redefined by residual pilot alone | Process (§0.1 / H1) |
| Architect never faces a blank free-text prompt for a Tier A item | UX (§2.1 choice cards) |
| v1 residual does not pretend to fully author controls | Honesty (H4) |
| A second run against updated source carries forward prior decisions via `--baseline` | Cumulative IR (§7.2) — full bar may trail thin apply MVP |
| Any LLM-rewritten prose (if RS-5 built) traces every sentence to a template citation | Honesty (§7.3) |
| `ir-to-calm.ts` rebuilds a `calm validate`-clean file from the effective IR alone, no repo access | CALM compatibility (§7.4) — may live under **B-calm-portable-ir** |
| Chat-mode tool permissions audited: no autonomous apply | Integrity (§4.4) |
| Fixture secret redacted in `evidence/packs.json` | Data sensitivity (§4.1) |
| Bulk-apply: one Decision Record per residual | Auditability (§2.1) |
| Checksum rejects hand-edited fenced blocks | Drift detection (§7.1/§7.4) |

---

## 12. Queryable architecture model (flows, auth methods) — answer

### Can we question the architecture after a run?

| Need | Today | After residual session (designed) | Optional later product |
|---|---|---|---|
| **Machine model** | **Yes** — `architecture.calm.json` + `typed-facts.json` are structured JSON | Same + overrides applied; effective IR is markdown projection | — |
| **“What services and endpoints exist?”** | **Yes** — CALM nodes + interfaces; TypedUnits with http-entry-point evidence | Same, residual-corrected | Query CLI/API over CALM |
| **“What DB / messaging / external deps?”** | **Partial–strong** — relationships `connects` / grades; Kafka + SQS import evidence partial; SNS still weaker | Stronger after residual fills known gaps | Query by relationship kind / grade |
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
| 2026-09-02 | **New §3.2, `unresolved-outbound-target` — closes the `CROSS_DOMAIN_UNRESOLVED` gap §3.1 flagged as "not yet evaluated."** Found reviewing a real, live scan (a reference Java microservices banking sample): the 3 most architecturally central relationships in that repo's own published reference diagram were silently missing from the generated CALM — each one had real, citable evidence (a real `RestTemplate`/`requests` call, a ConfigMap value literally naming the target service) that a deterministic correlation mechanism couldn't resolve, and the resulting `unresolved-http-target`/`unresolved-env-target` ignored-items were never resurfaced for review at all. Design doc §7.1's blanket "exclude `CROSS_DOMAIN_UNRESOLVED`" eligibility rule was revised to key on evidence-specificity per sub-shape instead of the reason code as a whole (`tier-b-single-candidate` already carried this same reason code and was already treated as draftable — proof the blanket rule was already inconsistent with the codebase's own practice). New Tier B class, same draft/apply mechanism every other Tier B class already uses; the one new mechanical permission is batch (non-interactive) drafting across the whole eligible set for this class specifically, justified by the same evidence-thin/low-per-item-stakes reasoning §7.1 states — Hard Rule 10 (one-residual-at-a-time) stays unchanged for every other tier/class. A canonical-plus-drafts preview/merge capability is named as needed but not yet built. |
| 2026-09-02 | **A full, real residual-review session produced 23 schema-invalid Decision Records that silently "validated" clean and silently failed to apply** (`Architect_Pilot_Feedback_Notes.md` Entry 25). Three independent, chained defects, all found by reading the real code and the real files on disk: (1) the chat agent had no readable source for the real `DecisionRecord`/`Override` shape — Hard Rule 6.1.9 only cited `pipeline/src/types/overrides.ts`, a file outside the pack the agent is forbidden from opening, so it invented its own fields (`residual_id`/`construct`/`option`). (2) `validate_drafts.py`'s own re-validation gate (the claim in §4.4 rule 2 above) was defeated at its file-loading step, duplicated identically in `validate_drafts.py`'s `main()` and `apply.py`'s `_run_validation()` — a decision missing `decision_id` was silently dropped instead of reported, so an all-malformed pack validated as "0 errors." (3) `apply.py` correctly detected the resulting isolated-module crash but its message ("no overrides were passed through?") read as benign rather than as a crash. Fixed at all three layers: `AGENTS.md` now embeds the real schema verbatim (§4.1); a new shared `load_decisions_by_id()` closes the validation gate for both duplicated call sites; `apply.py` now surfaces the real crash stderr. Verified against the exact real malformed shape found on disk (not a synthetic case) — `apply.py` now refuses immediately. 9 new regression tests. |
| 2026-08-26 | **Real pilot findings against a reference Java microservices banking sample's pack closed five real gaps in one session** (`Architect_Pilot_Feedback_Notes.md` Entries 20–24; commits `037e572`..`4a9abca`). (1) **Entry 20** — evidence citations were relative to whichever scanned package root produced them, not the VS Code workspace root the architect has open, so they weren't clickable; `pack.py` now writes a companion `evidence/paths.json` (§4.1) and `cards.py` shows the resolved, REPO_ROOT-relative path when it resolves inside the repo. (2) **Entries 21/22** — architect asked for the agent to recommend an answer, not just present a bare menu, since they often don't own the code under review; Hard Rule 4 was widened to require a `**My read (not a decision):**` paragraph, then a real live-reproduced rule conflict (the "present verbatim" instruction from Entry 18 read as forbidding any addition) was found and patched — **superseded by (3) below**, kept for the record since it documents a real, reproduced failure mode. (3) **Entry 23** — the widened-instruction approach still failed live a second time (the model never produced the paragraph, even in a fresh session); per this repo's own "two failed fix attempts is a stop signal" convention, the mechanism was re-derived instead of the prose patched a third time: `cards.py`'s new `_dossier_block` renders the recommendation deterministically from `dossier.py`'s already-validated `{explanation, hypotheses, evidenceRefsUsed}` response (§3.0), attached before cards are built when `--with-dossier` is set — the chat model's job shrinks back to verbatim reproduction. Verified against a real, first-ever live `claude` CLI dossier run for this project. (4) **Entry 24** — with the recommendation now working, a more serious live failure surfaced: asked to "start the review," the agent silently decided all 23 residuals itself in one reply, never presenting a single card. New hard rule (§5 item 10) requires presenting exactly one residual at a time and stopping until the architect replies to that specific one; "Guided" mode's table cell (§5) tightened to state this explicitly, since the previous "Ask all Tier A" wording didn't rule out the failure that occurred. Status line and §2.1/§3.0/§4.1 corrected in the same pass to reflect all of the above and to fix a separate, pre-existing contradiction between the status line and this doc's own 2026-08-23 row (the "never exercised against a real key" claim was stale for `draft_tier_b.py`/`advisory.py`, which T-1 had already run live). |
| 2026-08-25 | **Migrated `.github/chatmodes/residual-review.chatmode.md` → `.github/agents/residual-review.agent.md`.** Found by the architect trying the guide hands-on in real VS Code (per Changelog's own 2026-08-23 correction, which flagged the chat-mode `tools:` allowlist claim as host/version-fragile but didn't yet know the file's whole location/format had itself gone stale): the screenshot showed the mode picker not offering this agent at all — confirmed via direct fetch of current VS Code docs (not secondhand search) that `.chatmode.md`/`.github/chatmodes/` is no longer a documented discovery location; current Copilot Chat only reads `.agent.md` files under `.github/agents/`, with an explicit migration note in VS Code's own docs. `description`/`tools` frontmatter fields map directly (confirmed against VS Code's own field reference before assuming) — same content, same S4 safety framing, same §5.1 hard rules, only the file's name/location/extension changed, plus an added `name:` field for a clean picker label. All cross-references updated (`apply.py`, `draft_tier_b.py`, `pack.py`, `test_chatmode_safety.py`'s `CHATMODE_PATH`, `tools/review-session/README.md`, `Architect_Guide_Scan_To_Signoff.md`, this doc's §4.4/status line) — dated historical records (`Architect_Pilot_Feedback_Notes.md` Entries 9/16, this doc's own pre-2026-08-25 changelog rows, `AGENT_TASKS_Architect_Pilot_Fixes.md`) deliberately left referencing the old path, since they're accurately describing what was true when each was written, not the current state. |
| 2026-08-23 | **T-1 (`AGENT_TASKS_Residual_Assist_Redesign.md`) closed — the first real live-model run of `draft_tier_b.py`/`advisory.py` in this project's history.** Backend used: the `claude` CLI itself (already authenticated in this environment) — deliberately the ONLY backend, no raw-`ANTHROPIC_API_KEY`-from-environment fallback at all (owner directive, 2026-08-23: this project's fintech target-customer profile doesn't leave API keys in environment variables for an LLM to pick up). Three real bugs found and fixed from real responses, not hypothesized: a bare markdown JSON fence around the model's answer; a second case where the model prefixed a paragraph of prose BEFORE the fence, which the first fix didn't catch (fixed by searching for a fenced block anywhere in the text, both files); and a 120s subprocess timeout that was too short for a real Tier B drafting call (one real call measured 131.75s) — raised to 240s with the real number as justification. Real costs/latencies captured: `advisory.py` (dossier-shaped, explanation only) ≈ $0.08/40–49s per residual; `draft_tier_b.py` (Tier B drafting) up to $0.32/47–132s per residual — both non-trivial, and the same synthetic Tier B residual run twice produced two different real outcomes (a full draft, then `cannot_decide`), a genuine reliability finding, not a bug. §3.0 corrected from "left open" to a real decision: **the dossier pass is opt-in behind an explicit flag, not automatic** — T-1's numbers are why. Full evidence in `AGENT_TASKS_Residual_Assist_Redesign.md`'s T-1 row; T-2 (shared evidence-assembly module, dossier wiring) is now unblocked. Test suite hygiene fix in the same pass: `test_draft_tier_b.py`/`test_advisory.py`'s own "no key" tests were unintentionally exercising the real `claude` CLI on any machine that has it on `PATH` (this one included) once the CLI-preferring change landed — fixed by neutralizing `PATH` in those specific subprocess tests so they stay deterministic regardless of what's installed on the machine running them. |
| 2026-08-23 | **`AGENT_TASKS_Residual_Assist_Redesign.md` resequenced before any task started, and §3.0's dossier description corrected to match.** Caught on review, same day as the redesign below: the original task order built the shared evidence-assembly module and wired a dossier pass into every `pack.py` run *before* the live-key verification — designing a mechanism, and asserting it runs "by default," ahead of the one real data point (an actual model run) that should inform both. Reordered so the live-key smoke test (unmodified `draft_tier_b.py`/`advisory.py`, no refactor) runs first and its captured latency/cost/quality data feeds the shared-module design and the default-on-vs-opt-in decision, instead of the reverse. §3.0 corrected from "attempted for every residual... when an LLM backend is available" (asserted default-on) to naming that as an open, cost-sensitive decision this repo already has precedent for treating cautiously (`--auto-codeql`'s own reasoning) — to be closed with real evidence, not asserted in this doc first. |
| 2026-08-23 | **§3 (Residual taxonomy) redesigned — two independent axes instead of one conflated question, plus a fully code-verified producer registry.** Prompted by two real findings: (1) this doc's own top status line said "no detector produces Tier B" while §8's RS-4 row and `draft_tier_b.py`'s own docstring said T-FS-1 already closed that gap — a real, caught drift between this doc and the code, now fixed at the source (line 3 corrected) and structurally guarded going forward (see below). (2) Tier A/B/C was conflating "how much LLM-explained evidence does the architect get" with "may the LLM write an Override" — only the second was actually designed; the first (an evidence-grounded explanation for every residual, not just the ones someone remembers to run `advisory.py` against) is now a named, orthogonal **Evidence Dossier** concept (§3.0), decoupled from tier. Tier B's "if the bar fails" path is now a named state (`draftOutcome: "bar-not-met"`), not a silent reclassification to Tier A. **New §3.1 producer registry** enumerates every real `silenceFlags` push (`coverage-report.ts`), every `IgnoredItem` reason (`typed-facts.ts` — checked directly: `GENERATED_CODE`/`PURE_UTILITY`/`EXCLUDED_BY_CONFIG`/`OTHER` are declared but never produced by any pass today, `TEST_CODE`/`CROSS_DOMAIN_UNRESOLVED` are produced but deliberately filtered out of every pack as noise), and every `triage.py` `_TRIGGER_MAP` row — checked against real code, not carried forward from the prior draft of this table. **Governance, not just a one-time fix**: new CLAUDE.md rule requires this section to be updated in the same diff as any change to a residual producer; `AGENT_TASKS_Residual_Assist_Redesign.md` (new) breaks the follow-on build (a mechanical CI sync check modeled on `check-generalization.js`, a `fetch-span --anchor/--context-lines` extension, merging `advisory.py`'s evidence-assembly logic into a shared step the dossier and Tier-B-draft paths both call, and — the one exit condition that can't be faked — actually running `draft_tier_b.py`/the new dossier step against a real `ANTHROPIC_API_KEY` for the first time) into session-sized tasks, not attempted in this same pass. |
| 2026-08-23 | **The 2026-08-10 row below is superseded, not deleted — its "structurally true in VS Code" conclusion was itself an overclaim, caught on review.** That row correctly moved off one universal "genuinely can't" claim to a per-host one, but "the model genuinely had no terminal tool available" (VS Code) and "the chat mode's `tools:` allowlist is the enforcement mechanism" both still treated a chat host's declared-tool restriction as a safety guarantee. It isn't, in either host: Copilot Chat can propose invoking any tool made available to it (including a terminal/run-command tool) in any host — normal behavior, not a bug — and even where a per-action confirmation prompt gates that by default, VS Code documents settings that turn the prompt off entirely (`chat.tools.autoApprove` / `chat.tools.terminal.autoApprove` allow/deny lists, and a sandboxed-terminal mode that auto-approves with no prompt at all — `code.visualstudio.com/docs/agents/run/approvals`). None of that is this repo's to control or verify per architect. **The one guarantee this design actually gets to make**: `apply.py` — the only code path that ever writes to `architecture.calm.json` from a Session Pack — is this repo's own code, not an IDE preference, and refuses to run without its own separate, explicit confirmation (a typed prompt, or `--i-confirm-apply`) regardless of what any chat client, host, or auto-approve setting did upstream. `.github/chatmodes/residual-review.chatmode.md`'s header comment, `tools/review-session/README.md` rule 4, `pack.py`'s embedded `SESSION.md`/`AGENTS.md` text, and `test_chatmode_safety.py`'s docstring all corrected to state this once, consistently — the chat-mode `tools:` allowlist is now described as defense-in-depth friction, never as proof anything is impossible. **`B-chatmode-host-enforcement-gap` removed as a "gap to close"** (there's no gap once the guarantee is correctly placed on `apply.py`) — see `BACKLOG.md` for the reframed, lower-priority follow-on question this leaves open. |
| 2026-08-10 | **§4.4's safety claim tested live in a second real host — confirmed host-scoped, not universal.** A real architect pilot (`Architect_Pilot_Feedback_Notes.md` Entries 9, 16) ran the chat mode in both VS Code + GitHub Copilot Chat (safety claim held — the model genuinely had no terminal tool available, architect ran `apply.py` manually) and Claude Code chat (safety claim did NOT hold — the model had live `Bash` access despite the identical `tools:` frontmatter). `.github/chatmodes/residual-review.chatmode.md`'s header comment corrected to state this explicitly per-host rather than as one universal "genuinely can't" claim (**B-chatmode-host-enforcement-gap**, `AGENT_TASKS_Architect_Pilot_Fixes.md` Phase AP-2). Structurally closing the gap for non-VS-Code hosts (e.g. a pre-flight check in `apply.py`/`override-applier.ts`) is a separate, not-yet-decided follow-on, not part of this correction. |
| 2026-08-09 | **Program CLOSED — RS-0 through RS-5, this document's own header/§8/§10 updated to stop saying "not yet code."** Real, tested implementation now exists (`tools/review-session/`, `.github/chatmodes/residual-review.chatmode.md`, 83 tests) — see this program's Program DoD for the closure evidence. Two real, named gaps remain, tracked as their own backlog items: **B-tier-b-detector** (no detector currently produces a Tier B residual) and the live-model API path (never exercised against a real key in this dev environment — works normally for a pilot operator with their own Copilot/API access). Two items explicitly deferred, owner decision, reasons stated at their own task rows. |
| 2026-08-09 | **Finding (2) from the post-sign-off review closed**: §3 Tier B taxonomy now lists `relationship_remove` as a real class ("wrong/duplicate connects between existing units") — `override-applier.ts` already fully implements it, it was just never named in the taxonomy a future choice-card generator would read from. Finding (3) (pack.py scale risk) closed separately instead, since it's an implementation-exit-criteria change, not a design-taxonomy one. |
| 2026-08-09 | **Post-sign-off review, findings checked against real current code (not a re-read of this doc).** Nothing has been built yet (RS-1 not started — confirmed, no `tools/review-session/`, no chatmode file). Findings: (1) **fixed** — §4.2's input table claims `review-queue.json` surfaces silence-flag residuals, but `hitl-review-trigger.ts` had never been updated to read **S5** (`S5-zero-service-units-with-store-present`, `S5-cfn-routes-found-but-unbound`), even though S5 was built in `coverage-report.ts` the same day RS-0 was signed off — a real, verified drift between this design's stated input and the platform's actual newest silence-flag capability. Closed: both S5 conditions now emit `ReviewQueueItem`s (`unitId`/`unitKind`/`confidence` made optional on the type, since `S5-cfn-routes-found-but-unbound` is genuinely run-level — by definition no unit was matched, so none can be named); the CFN-unbound item cites the real `unresolved-cfn-route:` ignored-item details, same enrichment pattern §L3-3 already used for S1's `unresolved-multi-hop`. New locked regression test, full suite 61/61 green. (2) **named, not yet fixed** — Tier B's own table (§3) doesn't list `relationship_remove` as a residual class even though `override-applier.ts` already fully implements it (verified — only `boundary_change` remains genuinely `not yet implemented`); a "wrong/duplicate connects" class costs nothing to add later. (3) **named, not yet fixed** — `pack.py`'s planned inputs (`typed-facts.json`, `ignored-items-report.json`) are exactly the artifacts **B-scale-oom** (found the same day, unrelated work) proved can grow large enough to crash the Node pipeline; `pack.py` should be tested against a real large out-dir before RS-1 is called done, not assumed safe by extrapolation from small fixtures. (4) **named, not yet fixed** — RS-4 (the one phase with a live LLM in the loop) has the thinnest exit criteria of any phase in §8's table; no trap fixture set, sample size, or pass/fail threshold defined yet, unlike every other phase. |
| 2026-08-08 | **RS-0 signed off** — owner **Gowri**, go-ahead, do not skip safety; agent tasks AGENT TASKS Residual Review Session created (RS-1…RS-5). |
| 2026-08-08 | **H1–H4 review fixes:** §0.1 boundary with **B-layered-story** / standing exams (residual ≠ redefine E-charge-single-L2); phases renamed **RS-0…RS-5** (not L*); §7.1 CALM fragments aligned with real `types/calm.ts` / `x-aac-relationship-grade` + metadata[]; H4 v1 controls limitation; command-bus moved to Tier C OOS options; MVP may defer full ir-to-calm to **B-calm-portable-ir**. |
| 2026-08-08 | Honest pre-mortem review (rubric reuse) fixes applied: **[blocks pilot]** §4.4 corrected — "drafts/ is inert until human apply" was false by default under Copilot Chat agent mode; now a hard Phase 0 exit condition (no autonomous terminal execution, explicit degraded-fallback path stated). Should-fix items closed: §2.1 bulk-apply now writes one Decision Record per affected item; §4.1 redaction given a concrete, testable mechanism (pattern scan + fixture test + packs not committed by default); §7.1/§7.4 given `x-aac-ir-checksum` drift detection + explicit no-elision requirement for real generator output; §4 concurrency scoped to single-architect v1 (pack.py refuses to overwrite unapplied packs); owner/timeline flagged as an open Phase 0 item. **`B-calm-portable-ir` split out of `B-review-session`** in `BACKLOG.md` — §7.1-§7.4 solve architecture-model portability, a distinct problem from residual UX, reviewable independently. |
| 2026-08-08 | Follow-up: MCP server option dropped (§4.4 — decided chat-mode file only, guardrail is the human-run `apply.py` gate, not a server); §7.1 node/relationship/control entries now embed literal `calm-node`/`calm-relationship`/`calm-control` JSON fragments; new §7.4 answers CALM-compatibility directly — `ir-to-calm.ts` (not yet built) can rebuild a schema-valid CALM file from the filled template alone with no repo/scan access, CALM→template is the supported direction (template hand-edits are not a legal write path, same P3 discipline), and names a forward-looking module-contract fork (raw typed-facts vs. reviewed CALM+IR) relevant to future security/green-engineering modules, explicitly not built this round |
| 2026-08-08 | UX + template round: §2.1 choice-card interaction pattern (no free-text Tier A prompts); §4.4 delivery vehicle confirmed as VS Code + GitHub Copilot Chat (chat-mode file, optional MCP server for structural write-path enforcement); §4.5 CALM viewer reused not built; §5.1 Tier B system prompt (draft); §7.1 effective-architecture-ir.md target template (8 sections); §7.2 cumulative/baseline model across scans; §7.3 optional strictly-evidence-bound LLM prose rewrite + its system prompt; phases/non-goals/success-criteria updated to match |
| 2026-08-08 | Product end-state: **effective architecture IR** required after residual; §12 queryable model / flows / auth Q&A answered |
| 2026-08-08 | Initial proposed design from residual-UX discussion; IR post-HITL behaviour spelled out; backlog row: review before implement |
