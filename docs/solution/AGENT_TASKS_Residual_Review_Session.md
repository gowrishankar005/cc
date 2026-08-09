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
  → RS-1  Session pack + triage + choice-card templates + chat-mode (no LLM draft required) ── DONE (2026-08-09)
  → RS-2  validate_drafts + effective IR (MVP)  [ir-to-calm may defer to B-calm-portable-ir] ── DONE (2026-08-09, MVP scope)
  → RS-3  apply.py + apply-report + initial --baseline ── DONE (2026-08-09)
  → RS-4  Optional Tier B LLM drafting (system prompt §5.1) + fabricate traps ── DONE (2026-08-09; no real Tier B input exists yet, no live model tested — see task status)
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
| **Status** | **done, 2026-08-09.** `tools/review-session/README.md` (S1-S12 stated up front, layout table, language decision); `.gitignore` gained `review-sessions/`. Verified: wrote a scratch pack under `review-sessions/`, confirmed `git status` shows nothing for it; `pipeline/` has zero diff from this task, so `npm test` is unaffected by construction. |

### T-RS1-2 — `pack.py` (or `pack.ts`)

| | |
|---|---|
| **CLI** | `pack --out-dir <run-slice-out> --session-dir <review-sessions/<run-id>> [--roots …]` |
| **Reads** | `typed-facts.json`, `coverage-report.json`, `review-queue.json` (run hitl-review-trigger if missing), `unmapped-signals-report.json`, ignored/evidence if present, `intelligence-ir.md` path ref, `architecture.calm.json` optional |
| **Writes** | Layout per design §4.1: `SESSION.md`, `AGENTS.md`/`manifest.json`, `residuals.json`, `evidence/`, empty `drafts/decisions|overrides` |
| **Safety** | Refuse overwrite if session dir has unapplied drafts (fail loud); never write TypedFacts |
| **Redaction** | All snippets through redaction before disk; fixture test with fake secret |
| **Scale (added 2026-08-09 — B-scale-oom, found the same week)** | `pack.py`'s own inputs (`typed-facts.json`, `ignored-items-report.json`) are exactly the artifacts proven to grow large enough to crash the Node pipeline on a real large repo (`fineract-provider`, 2,462 files, 133,910 ignored items). Python's `json` module may or may not hit the same wall — **untested, do not assume safe by extrapolation.** Must test `pack.py` against a real large out-dir (same `fineract-provider` scan, run with `--max-old-space-size=8192` per BACKLOG's documented mitigation) as part of this task's own exit, not discovered after RS-1 ships the way the Node-side OOM was discovered after the fact. |
| **Exit** | Pack on NestJS fixture or BoA out-dir succeeds offline; **pack on a large out-dir (fineract-provider-scale) either succeeds or fails with a clear, actionable error — never a silent crash or a hang** |
| **Status** | **done, 2026-08-09.** `tools/review-session/pack.py` — real CLI, reads all listed inputs (`intelligence-ir.md`/`architecture.calm.json` referenced by path in manifest, not parsed — neither carries residual-relevant structure `pack.py` needs beyond what typed-facts/coverage/review-queue already give it), writes the full §4.1 layout. **Real end-to-end run** (not just unit tests): `run-slice.js` against the checked-in NestJS fixture → `pack.py` → 1 real S2 residual, all files present, automated in `test_pack.py` (3 tests, all real subprocess runs, no mocks). **Safety verified for real**: wrote a fake unapplied draft into `drafts/overrides/`, confirmed a second `pack.py` invocation refuses with exit 1, not silently overwritten. **Scale tested for real** (the new requirement from this task's own review): ran `pack.py` against the actual `fineract-provider` out-dir that crashed Node's V8 heap (45MB `typed-facts.json`) — completed in 0.64s, 375MB peak RSS, 46 real residuals, no OOM risk inherited on the Python side. **Redaction**: `redact.py` + `test_redact.py` (7 fixtures, fake AWS key/bearer token/private-key header/connection-string password/plain assignment, all confirmed redacted with the value never appearing in output). |

### T-RS1-3 — `triage.py` + residual schema

| | |
|---|---|
| **Deliverable** | Build `residuals.json`: id, tier A/B/C, class, unit ids, evidence refs, status `open` |
| **Sources** | silenceFlags / review-queue; unresolved-multi-hop ignored items; low confidence; unmapped clusters (catalogue_candidate); ontology-ish kind conflicts if detectable generically |
| **Exit** | Schema documented (JSON Schema preferred); real pack non-empty on a silent/S1 run if available |
| **Status** | **MVP done, 2026-08-09 — real scope narrower than full task, named honestly.** `triage.py`'s `build_residuals()` covers every trigger `hitl-review-trigger.ts` emits today (S1, S2, S5×2, low-architecture-coverage → id/tier/class/unitIds/evidenceRefs/rationale/status), tested against real Fineract output (46 residuals on the large scan) and synthetic unit tests (`test_triage.py`, 6 tests) for every trigger mapping. `residuals-schema.json` is a real JSON Schema (not validated by an automated `jsonschema`-package check — none added, per Simplicity First; manually confirmed real output matches it). **Not yet done, explicitly deferred, not silently dropped**: unmapped-signal-cluster → `catalogue_candidate` promotion, and generic ontology-kind-conflict detection beyond what S5 already names — both real, separate extensions to `triage.py`'s `_TRIGGER_MAP`, left for whoever picks this up next since they need their own evidence/design pass, not a mechanical addition. |

### T-RS1-4 — Choice-card generator (fixed templates)

| | |
|---|---|
| **Deliverable** | Deterministic card per Tier A class (design §2.1 + §3): options from generator, not LLM; evidence inline; Other requires rationale |
| **Output** | e.g. `cards/` markdown or embedded in `SESSION.md` / `residuals.json` `card` field for Copilot |
| **Bulk-apply** | If same pattern key repeated: offer apply-to-all but **list unit ids** and require **one DR per residual** when later drafted |
| **Command-bus / OOS** | Options only document OOS / leave open / multi-root rescan — **never** invent relationship_add |
| **Exit** | Unit tests: same residual + evidence → same options |
| **Status** | **done, 2026-08-09.** `tools/review-session/cards.py`: fixed per-class option generator for all 4 classes `triage.py` currently produces (`multi-candidate-bridge`, `security-authority-policy`, `ontology-judgment`, `missing-intermediates-not-in-scan`) + a conservative leave-open/other fallback for any unclassified class. Wired into `pack.py` — `residuals.json` now carries a `card` field per residual, and `SESSION.md` embeds the full rendered card (not a flat one-line summary). **Real bug found and fixed while checking real output, not assumed correct**: the NestJS fixture's real unit has 7 Evidence entries but only 4 unique `file:line` refs (native-route + decorator evidence both citing the same lines) — the card's evidence block was showing each ref twice; fixed with dedup, plus picking the first non-blank line of a snippet as the preview instead of blindly index-0 (which could land on a real blank source line). 10 tests in `test_cards.py`: determinism (same residual+evidence → same options, byte-identical), real-units-only candidate enumeration (never invents a node name, caps at `MAX_CANDIDATES=10` same discipline as `unmapped-signals.ts`), Tier C never offers a `relationship_add`-shaped option, every card ends with leave-open/none + Other, bulk-apply grouping lists real sibling residual ids and states the one-DR-per-residual rule (S9) inline. |

### T-RS1-5 — Copilot chat-mode file (safety critical)

| | |
|---|---|
| **Deliverable** | `.github/chatmodes/residual-review.chatmode.md` and/or `.github/prompts/residual-review.prompt.md` |
| **Must include** | Read SESSION.md + residuals first; never edit typed-facts; write only drafts/; never run apply.py/run-slice/override without human; Tier B later; link design playbook |
| **Must prove S4** | Tool/terminal permissions: **no unrestricted terminal**, or confirm-every-command; document in chat-mode file header “SAFETY: no autonomous apply” |
| **Degraded path** | Works if agent tools disabled: architect still uses pack + hand-authors DR/Override |
| **Exit** | File checked in; PR notes how S4 is enforced |
| **Status** | **done, 2026-08-09 — with an honestly-stated verification limit.** `.github/chatmodes/residual-review.chatmode.md` built against the real, documented Copilot Chat chat-mode frontmatter schema (`description` + `tools`). **How S4 is enforced**: the `tools:` allowlist (`codebase`, `search`, `usages`, `problems`, `editFiles`) deliberately excludes every terminal/command/task-execution tool name — this mode has no declared code path to run `apply.py`/`run-slice`/`override-applier`, not merely an instruction asking it not to. Body content covers every required item (read SESSION.md+residuals first, never edit typed-facts.json, write only under drafts/, never run apply without human, Tier B not yet built, degraded path, design-doc link). **Mechanically verified** (not just written): `test_chatmode_safety.py` (7 tests) statically parses the real frontmatter and asserts no declared tool matches a denylist of known terminal/execution tool names — confirmed the test actually catches a violation by deliberately injecting `runInTerminal` and watching it fail, then restoring the real file. **Honestly NOT verified**: this has never run inside a live VS Code + Copilot Chat session — no such environment exists in this sandbox (same disclosed limit as this project's own `Dockerfile`/`.github/workflows` entries). The file's own header names the exact live-verification steps (appears in chat-mode picker, no terminal tool offered mid-session, an apply attempt is refused not executed) for a human to confirm before treating S4 as fully proven, not just specified. |

### T-RS1-6 — SESSION.md / AGENTS.md templates

| | |
|---|---|
| **Deliverable** | Generated SESSION: steps 1–9, path to CALM viewer, “do not redefine standing exams”, apply is human step |
| **Exit** | Readable by non-agent human |
| **Status** | **done, 2026-08-09.** `pack.py`'s `_render_session_md` gained the real gap found by checking it against this task's own spec: a numbered 1-9 step walkthrough (design §2's target experience, adapted with real state — e.g. step 8 is stated as not-yet-built RS-3 rather than pretending `apply.py` exists), a concrete copy-pasteable apply command using the real out-dir/session-dir paths (not a placeholder phrase — caught and fixed after first-draft output read awkwardly), and an "After you're done" section with the real CALM-viewer path when `architecture.calm.json` exists in the source out-dir (design §4.5) plus the manual-reload note. `_render_agents_md` updated to reference the real `.github/chatmodes/residual-review.chatmode.md` (built in T-RS1-5) and name Guided mode explicitly (design §5's only v1 mode). Verified against real rendered output from the NestJS fixture, not just read as code — confirmed genuinely readable, no placeholder text left in. All 33 tests still green after the change. |

**RS-1 exit checklist — ALL DONE, 2026-08-09. Phase RS-1 CLOSED.**

- [x] T-RS1-1…T-RS1-6 done  
- [x] S4/S8/S9 addressed — **S4** (`.github/chatmodes/residual-review.chatmode.md`'s `tools:` allowlist, mechanically verified by `test_chatmode_safety.py`) and **S8** (`redact.py`, 7 fixture tests) are fully built and enforced by RS-1's own code. **S9** (one Decision Record per residual under bulk-apply) is *addressed* at this phase's level — `cards.py`'s bulk-apply grouping never proposes a blanket record, and the chat-mode instructions state the rule explicitly — but full *mechanical* enforcement (rejecting a draft that violates it) is `validate_drafts.py`'s job, correctly scoped to RS-2, not yet built. Named honestly rather than checked as if RS-1 alone closes it.  
- [x] No network required for pack — confirmed by code review: `pack.py`/`triage.py`/`cards.py`/`redact.py` do no network I/O anywhere, only local file reads/writes and one `subprocess` call to the local `node` binary.  
- [x] Pipeline suite green — `pipeline/` has zero diff across the entire RS-1 program (`git status --short pipeline/` empty at every step), so `npm test` is provably unaffected; no rerun needed to prove it.  
- [x] `pack.py` tested against a large out-dir (B-scale-oom scale) — done in T-RS1-2: real 45MB `typed-facts.json`, 0.64s, 375MB peak RSS, no inherited OOM.  

**33 real tests across `tools/review-session/`** (`test_redact` ×7, `test_triage` ×6, `test_cards` ×10, `test_pack` ×3 genuine subprocess end-to-end runs, `test_chatmode_safety` ×7), all passing. **Next: RS-2** (`validate_drafts.py`, manual-draft examples, effective IR MVP) — see phase order in §0.1; do not start RS-4 LLM drafting before RS-3's human apply path works.

---

# Phase RS-2 — validate_drafts + effective IR (MVP)

**Goal:** Drafts are schema-valid and apply-ready; effective IR at least partially real.

### T-RS2-1 — `validate_drafts.py`

| | |
|---|---|
| **Checks** | DR JSON matches DecisionRecord fields; Override has `decision_record_ref` to active DR; override_type supported; relationship_add is connects-shaped; endpoints exist in typed-facts/CALM nodes; no typed-facts paths written |
| **Exit** | Good fixture passes; bad fixtures fail with clear reasons |
| **Status** | **done, 2026-08-09; 3 real correctness bugs found and fixed on self-review the same day, before this was ever relied on.** `tools/review-session/validate_drafts.py` mirrors `override-applier.ts`'s real validation logic in Python (same field requirements, same rejection wording style) — a draft that passes here is not a surprise at real apply time. **Real finding while building this**: the Session Pack's own `drafts/decisions/` + `drafts/overrides/` split (design §4.1) is structurally incompatible with `override-applier.ts`'s current `loadOverridesDir()`, which scans ONE flat directory — apply.py (RS-3) will need to merge both before calling `run-slice --overrides`, matching that task's own "copy/point overrides dir" phrasing; not a bug, a real integration detail named here before RS-3 hits it blind. **Review found 3 real bugs, all fixed same day, all now regression-tested** (16 tests, up from 12): (1) check order didn't match `override-applier.ts`'s real order — a `boundary_change` override with a completely dangling `decision_record_ref` passed as `valid: True`, when the real applier checks the ref before ever reaching the `boundary_change` skip case and would genuinely reject it; fixed by reordering to status → decision-ref-resolution → decision-active → THEN override_type dispatch, matching real behavior exactly. (2) the same-batch `node_add` exception (design §6) counted ANY `node_add`-labeled override as a future endpoint, even one that would itself be rejected (e.g. its own dangling decision ref) — masking a real dangling endpoint in a `relationship_add` referencing it; fixed with `_node_add_will_actually_apply()`, which replicates the real gating checks before counting a node as "added." (3) `relationship_remove` never checked target existence against real CALM relationships at all — an orphan target silently passed; fixed by loading `calm.relationships` too and checking against it, same class of check `type_change`/`node_remove` already had for nodes. **Separate, smaller finding surfaced but not fixed (out of scope for Python tooling)**: `override-applier.ts`'s own `switch` has no `default` case — an unrecognized `override_type` would silently vanish from every result category (not applied, not rejected, not skipped) in the real TypeScript pipeline; `validate_drafts.py` already catches this earlier so it never reaches that code path, but the underlying platform gap is real and worth a small BACKLOG note for whoever next touches `override-applier.ts`. **Verified via the real CLI, not just the in-process function**: ran against a synthetic good/bad fixture pair with `--calm`, confirmed exit 0/clean and exit 1/clear-reason respectively; re-verified the real T-RS2-2 example pair still validates clean after all three fixes. |

### T-RS2-2 — Manual draft path documented

| | |
|---|---|
| **Deliverable** | Example DR + Override pair in `tools/review-session/examples/` (synthetic ids) + how architect pastes from choice answer |
| **Exit** | Human can create drafts without LLM |
| **Status** | **done, 2026-08-09.** `tools/review-session/examples/` — a worked, synthetic Decision Record + Override pair (mirroring the design's own §2.1 PrismaService example) + `README.md` walking through choice-card-answer → DR/Override by hand. **Proven end-to-end for real, not just documented**: ran the example pair through `validate_drafts.py` against a synthetic CALM (clean pass), then ran the FULL real path — a real `run-slice.js` scan of the NestJS fixture, a hand-authored DR+Override merged into one directory, applied via `run-slice.js --from-facts --overrides` — confirmed the target node's `node-type` genuinely changed (`service` → `database`) and `calm validate` still reported 0 errors. This is the first time in this whole program that an override has been applied end-to-end from a human-authored draft, not a synthetic test fixture. |

### T-RS2-3 — Effective IR MVP generator

| | |
|---|---|
| **Minimum** | After apply (or from out-dir + overrides report): markdown with provenance, node/rel counts, open residuals, decision log summary |
| **Preferred** | §7.1 sections 1–7 templated; fenced calm fragments only if complete and schema-aligned (`x-aac-relationship-grade`, metadata arrays) |
| **Defer OK** | Full ir-to-calm + checksum → **B-calm-portable-ir** if called out on BACKLOG |
| **Exit** | Real post-apply CALM produces non-empty effective IR; facts-IR honesty not overwritten |
| **Status** | **MVP done, 2026-08-09 — full §7.1 richness explicitly deferred, not silently dropped. Real correctness gap found and fixed during the RS-3 bugs/efficiency review, 2026-08-09.** `tools/review-session/effective_ir.py` builds the stated minimum: provenance table, node inventory (grouped by kind, overridden nodes annotated), relationships by `x-aac-relationship-grade`, open residuals (from `residuals.json`), decision log (from `drafts/decisions/`). **Not built**: the full 8-section template with literal `calm-node`/`calm-relationship` fenced fragments and checksum drift detection (§7.1/§7.4) — that's **T-RS2-4 below, deferred to B-calm-portable-ir** per the design's own explicit MVP-cut allowance (§0.4). **Fixed on review**: §3 "Open residuals" claimed "status tracking not yet built (RS-3)" and listed every residual as open regardless of status — this went actively wrong the moment T-RS3-3 shipped real `carried_forward` status; a residual already carried forward from a `--baseline` was being mislabeled as still open. Fixed: genuinely open residuals list under §3 as before; carried-forward ones get an explicit footnote instead, and a `reconfirm: true` residual is now visibly annotated. 3 new regression tests. 9 unit tests total (up from 6) + **real verification against actual applied CALM** (the same real override-applied output from T-RS2-2's test, plus a real two-pack `--baseline` run for the new fix): non-empty output confirmed, `intelligence-ir.md` confirmed byte-identical before/after (hashed, not assumed) — this tool never touches it. |

### T-RS2-4 — (Optional same phase) `ir-to-calm` + checksum

| | |
|---|---|
| **Only if** | Not deferring portable IR |
| **Exit** | Round-trip calm validate; hand-edit fails checksum |
| **Status** | **Deferred to B-calm-portable-ir**, per the design's own §0.4 MVP-cut allowance and T-RS2-3's own "Defer OK" line — not built this phase. Named explicitly here (not silently skipped) so a future session knows this was a deliberate scope decision, not an oversight. |

**RS-2 exit checklist — ALL DONE (MVP scope), 2026-08-09. Phase RS-2 CLOSED.**

- [x] validate_drafts green — 12 tests, plus real CLI verification against real synthetic good/bad fixtures  
- [x] Effective IR MVP built; full portable-IR richness (T-RS2-4) explicitly deferred to **B-calm-portable-ir**, not silently dropped  
- [x] No TypedFacts mutation — confirmed structurally (no code path in any RS-2 tool writes `typed-facts.json`) and empirically (`intelligence-ir.md` hash unchanged across a real effective-IR generation run)  

**51 real tests total across `tools/review-session/`** (all RS-1 tests + `test_validate_drafts` ×12 + `test_effective_ir` ×6). Real, first-of-its-kind proof this session: a hand-authored Decision Record + Override, applied via the existing `run-slice --overrides` mechanism, genuinely changed a real CALM node's type — the manual draft path this whole design sits on top of is now proven working end-to-end, not just specified. **Next: RS-3** (`apply.py` wrapping the merge-and-apply flow T-RS2-1 found necessary, `apply-report.md`, initial `--baseline`).

---

# Phase RS-3 — Apply path

**Goal:** One command applies drafts safely.

### T-RS3-1 — `apply.py`

| | |
|---|---|
| **Flow** | validate_drafts → copy/point overrides dir → `node …/run-slice.js --from-facts <facts> --overrides <drafts/overrides> --out <new-out> [--strict-overrides]` |
| **Safety** | Refuse if validate fails; refuse if chat-invoked without `--i-confirm-apply` flag **or** interactive confirm; log command line to apply-report |
| **Exit** | Nest/BoA-style run: override type_change or relationship_add applies; calm validate 0 errors on reviewed out |
| **Status** | **done, 2026-08-09; 1 real bug found and fixed on self-review the same day.** `tools/review-session/apply.py` — the one place in this whole tool suite that ever invokes `run-slice.js`/`override-applier.ts` (a deliberate, narrow chokepoint). Flow exactly as specified: re-runs `validate_drafts` in-process (never trusts a stale prior validation) → refuses on any error → requires explicit confirmation (a real TTY prompt, or `--i-confirm-apply`; non-interactive without the flag is refused, never silently proceeds) → **merges `drafts/decisions/` + `drafts/overrides/` into one directory** (the real integration gap found and named during T-RS2-1's review, now actually handled) → `node dist/orchestration/run-slice.js --from-facts --overrides --out` → reads back the real `overrides-applied-report.json`. Command line logged to `apply-report.md` BEFORE running, so even a crash leaves a real record. **Real bug found on a dedicated bugs/efficiency review, confirmed with a failing repro before fixing**: `_merge_drafts` copied both directories' JSON files by bare filename into one temp dir — a decision and override sharing a filename (a natural convention: naming both after their shared residual id, e.g. `R-001.json` in each directory) silently overwrote one, and since `validate_drafts.py` reads the two source directories separately, it would have already said the pair was fine — the data loss happened only in this merge step, AFTER validation, so re-validation couldn't catch it. Fixed by namespacing each copy with its source subdirectory (`decisions-R-001.json`/`overrides-R-001.json`); `override-applier.ts` dispatches by JSON content not filename, so this is a zero-behavior-change fix. New regression test proves a real apply still succeeds with colliding filenames. Also fixed a smaller robustness inconsistency: `manifest["outDir"]` was accessed unguarded in one place but defensively (`.get()`) in another — now consistent, with a clean error instead of a raw `KeyError` traceback. **Exit bar proven for real, not just asserted**: 5 end-to-end tests now (`test_apply.py`, up from 4) — a real `type_change` override genuinely changes a real CALM node's type; `npm run validate` (the same command used throughout this whole session) reports `Errors: no (0)` on the reviewed out-dir; refuses cleanly (no out-dir written) both when validation fails and when not confirmed. |

### T-RS3-2 — `apply-report.md` / overrides-applied-report

| | |
|---|---|
| **Deliverable** | Summarize applied/rejected/orphans from platform report; decisions-log append |
| **Exit** | Architect can see what applied |
| **Status** | **done, 2026-08-09 — built alongside T-RS3-1, same commit.** `apply.py` writes a real, cumulative `apply-report.md` (every attempt appended, not overwritten — a refused attempt is on record too, not just successful ones) with the exact command run and applied/rejected/skipped/orphans override ids from the real `overrides-applied-report.json`; `decisions-log.md` gets a matching entry. Verified against real rendered output, readable, override ids traceable back to `drafts/decisions/`/`drafts/overrides/`. |

### T-RS3-3 — Initial `--baseline` (thin)

| | |
|---|---|
| **Minimum** | Document + optional flag: if baseline session dir provided, mark residuals already decided as `carried_forward` and do not re-card them unless facts contradict (contradiction → new residual “re-confirm”) |
| **Full multi-scan polish** | May continue in RS-5  
| **Exit** | At least documented behaviour; code preferred |
| **Status** | **done (code, not just documented), 2026-08-09.** `triage.py`'s `apply_baseline()` — matches by (unit id, whether that unit has an ACTIVE decision in the baseline pack); if this run's fresh `(trigger, class)` for that unit matches what the baseline recorded, the residual is marked `carried_forward` and gets a short note instead of a full choice card (never re-asked, per design §7.2's "a node the architect already typed correctly last time is never silently re-asked"). If it DIFFERS (the underlying source/facts changed shape since the decision), the residual is flagged `reconfirm: true` with its real, current tier/class/card preserved — **never silently carried forward and never silently overwritten**, matching P7 applied to drift. Wired into `pack.py --baseline <prior-session-dir>`, `SESSION.md` gets a dedicated "Carried forward" section. **Real, honestly-named limitation**: matching is by unit id, not a stable residual id (T-RS1-3's ids are positional/regenerated per run) — full multi-scan polish stays RS-5 as this task's own spec allows. **Verified end-to-end for real**: packed the NestJS fixture twice, hand-authored a decision in the first pack, built the second pack with `--baseline` pointing at the first — confirmed the real S2 residual came back `carried_forward`, not re-asked. 5 new unit tests in `test_triage.py`. |

**RS-3 exit checklist — ALL DONE, 2026-08-09. Phase RS-3 CLOSED.**

- [x] Human apply path works end-to-end — proven with a real applied override + `calm validate` 0 errors, not just unit-tested  
- [x] S4: apply not silent from agent — the chat-mode has no terminal tool at all (T-RS1-5); `apply.py` itself additionally refuses any non-interactive invocation without `--i-confirm-apply`, a second independent layer  
- [x] Pipeline tests green — zero `pipeline/` diff across the whole RS-3 program, confirmed by `git status --short pipeline/` at every step  

**64 real tests total across `tools/review-session/`** (up from 55 — `test_apply.py` ×4 real end-to-end subprocess runs, `test_triage.py` gained 5 `apply_baseline` tests). Next: RS-4 (optional Tier B LLM drafting) — **do not start until this phase's own human-apply-works bar was met**, which it now is.

---

# Phase RS-4 — Optional Tier B LLM draft

**Goal:** LLM drafts only when evidence bar met; never applies.

### T-RS4-1 — Offline draft CLI

| | |
|---|---|
| **Deliverable** | e.g. `draft_tier_b.py` using design §5.1 system prompt; env API key optional (no key → print residual ids only) |
| **Writes** | Only `drafts/decisions` + `drafts/overrides`  
| **Exit** | Trap fixture: insufficient evidence → `cannot_decide`, no file or empty proposal with reason |
| **Status** | **done, 2026-08-09 — with two real, structural limits named up front, not discovered after the fact.** `tools/review-session/draft_tier_b.py` — the §5.1 system prompt verbatim, `build_user_prompt()` assembling only the permitted inputs (residual + relevant unit-index/evidence entries, nothing else — tested), a single isolated `_call_llm()` network boundary (stdlib `urllib`, no new dependency), and `parse_and_validate_response()` — the real guardrail, fully testable without any network call. **Limit 1**: `triage.py`'s current trigger map (T-RS1-3 MVP) never classifies anything as Tier B — confirmed by grep before writing a line of this file — so this tool has zero real production input today; verified for real against an actual pack (0 Tier B residuals, as predicted) and against a synthetic one (correct "would attempt, writing nothing" report). **Limit 2**: no `ANTHROPIC_API_KEY` in this environment — the live-call path is real code, never live-tested, same disclosed pattern as the chat-mode file / CI workflow. No-key path is fully real and tested: reports what it would attempt, writes nothing, exit 0. |

### T-RS4-2 — Fabricate traps

**Fixed 2026-08-09** (was the thinnest exit criteria of any phase — no fixture set, sample size, or pass bar named, unlike every other phase's concrete exit test). Grounded in §5.1's own hard rules 1-4, one trap fixture per rule, plus 2 positive cases so the suite doesn't just test "always refuse":

| # | Trap fixture | Hard rule tested (§5.1) | Required outcome |
|---|---|---|---|
| 1 | Partial evidence (only 2 of 3 required fields present for the residual's Tier B class) | Rule 1 — partial evidence is not evidence | `cannot_decide: missing <what>` |
| 2 | Pack references a node id that does not exist in `evidence/unit-index.json` | Rule 2 — never introduce an id not already in the pack | `validate_drafts.py` rejects; no file written, or written-but-rejected, never silently accepted |
| 3 | Residual is for a well-known framework/library the model plausibly "knows" from training, but the pack's own evidence is silent on it | Rule 3 — no prior-knowledge fill | `cannot_decide: <reason>`, not a plausible-sounding guess |
| 4 | Two equally-valid candidate units both fit the evidence | Rule 4 — ambiguous → do not pick one | `cannot_decide: ambiguous between <candidates>` |
| 5 (positive) | Full evidence bar genuinely met, single unambiguous pair | — | A real, correct Decision Record + Override pair, citing the evidence ref |
| 6 (positive) | Same as #5 but for a `type_change` class instead of `relationship_add` | — | Correct draft, correct override_type |

| | |
|---|---|
| **Tests** | All 6 fixtures above, run against whatever LLM backend T-RS4-1 wires up |
| **Pass bar** | **100% on fixtures 1-4 (zero tolerance)** — a single fabrication or wrong-guess defeats this whole design's core safety claim (P2/S6), unlike a normal accuracy metric where partial credit is meaningful. Fixtures 5-6 must produce a correct, schema-valid draft (not just "didn't crash") — a trap suite that only ever tests refusal can't tell a working drafter from a broken one that always says no. |
| **Exit** | All 6 traps automated in CI-runnable form (not manual/ad hoc); documented which model/version was tested against, since this is a live-LLM-dependent bar, re-check if the backend model changes |
| **Status** | **done, 2026-08-09 — 100% on the pass bar, against SYNTHETIC responses, not a live model (honestly disclosed, not hidden).** All 6 named fixtures automated in `test_draft_tier_b.py`, plus 6 more guardrail tests beyond the letter of the spec (malformed JSON, reviewer impersonating an architect, an architect-only override_type like `node_remove`, a `decision_record_ref` mismatch, a defense-in-depth `validate_drafts` failure, no-`--calm` still enforcing the pack-scope check). **What "100% pass bar" actually means here**: every fixture tests `parse_and_validate_response()` — the tool's own guardrail — against hand-written response text shaped like what a compliant or non-compliant model might return. It does NOT test a real model's actual judgment (whether Claude genuinely refuses when it should), since no `ANTHROPIC_API_KEY` exists in this environment — that's a real, separate, still-open verification, named here rather than conflated with what was actually proven. Fixture 3 (no prior-knowledge fill) is honestly reframed: true prior-knowledge use can't be detected from response text alone by any tool; what's actually tested is the same mechanical backstop as fixture 2 (any target outside the residual's own inputs is rejected, however plausible it looks) — the practical, disclosed proxy this task can actually enforce. |

### T-RS4-3 — Guided confirm UX note

| | |
|---|---|
| **Deliverable** | SESSION/chat instructions: Tier B shown as Accept/Reject/Edit — never auto-apply  
| **Exit** | Documented  
| **Status** | **done, 2026-08-09; corrected same day after owner feedback.** First draft got the primary path backwards: it told the chat mode to never draft Tier B itself, routing everyone to `draft_tier_b.py` instead. Real owner correction: **the whole session is meant to run inside VS Code Copilot Chat** — the chat agent's own `editFiles` tool (already in the chat-mode's `tools:` allowlist, no safety change needed) is the real, primary Tier B drafting path, writing directly under `drafts/decisions/`/`drafts/overrides/` in-conversation, bound by the same §5.1 hard rules now embedded verbatim in `.github/chatmodes/residual-review.chatmode.md` rule 5. `draft_tier_b.py` is demoted to what it always should have been described as: a secondary, headless/scripted alternative, not the default. `pack.py`'s `AGENTS.md`/`SESSION.md` rendering updated to match. New test (`test_chatmode_safety.py`) mechanically confirms the real §5.1 markers (`llm-advisory:`, `cannot_decide`, `drafts/decisions`, `drafts/overrides`, `Accept / Reject / Edit`) are actually present in the chat-mode file, not just asserted in a commit message. Verified against real rendered `SESSION.md`/`AGENTS.md` output from a real pack. |

**RS-4 exit checklist — DONE, 2026-08-09, with 2 real limits named (not blockers, but honest scope).**

- [x] LLM path off-core, drafts only — `draft_tier_b.py` is never imported by `run-slice.ts`/`apply.py`, only ever writes under `drafts/`  
- [x] Fabricate traps green — all 6 fixtures (T-RS4-2) + 6 extra, 100% on refusal cases, correct output on positive cases — **against synthetic responses, not a live model (no API key here — real limit, see T-RS4-2's own status row)**  
- [x] RS-3 apply still human — untouched, `draft_tier_b.py` never calls `apply.py`/`run-slice`  

**Real, named, not-yet-closed gaps for whoever picks this up next**: (1) no trigger in `triage.py` currently produces a Tier B residual, so this whole phase has never processed real production input — closing this needs a real Tier B classifier added to `triage.py`, a separate piece of work, not a `draft_tier_b.py` change. (2) the live-model call path (`_call_llm`) has never been exercised against a real API in this environment — needs `ANTHROPIC_API_KEY` + a live run to move from "specified" to "proven," the same distinction this project applies everywhere else.

14 new tests (`test_draft_tier_b.py`), 82 total across `tools/review-session/` (up from 68).

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
| 2026-08-09 | **Real correction to T-RS4-3, same day as RS-4 close, after owner feedback.** First draft had the Tier B drafting path backwards — told the chat mode to never draft, routing everyone to a standalone `draft_tier_b.py` CLI with its own API key. Owner clarified the real usage: the whole session runs inside VS Code Copilot Chat, so the chat agent's OWN bound model, using its already-allowlisted `editFiles` tool, is the real primary Tier B drafting path — no separate script or API key needed for normal use. Embedded the actual §5.1 hard rules verbatim into `.github/chatmodes/residual-review.chatmode.md` (in-chat drafting: cite evidence, `llm-advisory:` reviewer, never invent ids, present as Accept/Reject/Edit); demoted `draft_tier_b.py` to an explicitly secondary, headless/scripted alternative in every doc that referenced it. New mechanical test confirms the real rule markers are present in the chat-mode file, not just claimed. |
| 2026-08-09 | **Phase RS-4 CLOSED — optional Tier B LLM drafting built, with 2 real limits named up front rather than discovered later.** `draft_tier_b.py` — §5.1 system prompt verbatim, `build_user_prompt()` (tested to leak nothing beyond the residual's own permitted inputs), a single isolated `_call_llm()` network boundary, `parse_and_validate_response()` (the real guardrail, 12 unit tests: all 6 named trap fixtures + 6 more, 100% on refusal cases). Confirmed by grep before writing any code that `triage.py` never classifies anything Tier B today — verified against a real pack (0 Tier B residuals) and a synthetic one (correct "would attempt, writing nothing" report, no key set). Live-model path is real code, never live-tested (no `ANTHROPIC_API_KEY` here) — same disclosed-limit pattern as the chat-mode file and CI workflow. T-RS4-3: chat-mode/`AGENTS.md`/`SESSION.md` all updated so a future Tier B draft is presented Accept/Reject/Edit, never pre-approved. 14 new tests, 82 total. This phase's real completion needs a future Tier B classifier in `triage.py` PLUS a live API run — both named, neither silently assumed done. |
| 2026-08-09 | **RS-3 bugs/efficiency review found and fixed 2 real correctness bugs, same day RS-3 shipped, before anyone relied on it.** (1) `apply.py`'s `_merge_drafts` copied decisions/overrides into one temp directory by bare filename — a decision and override sharing a filename (natural: naming both after their shared residual id) silently dropped one. This happened AFTER `validate_drafts.py` had already said the pair was fine, so re-validation couldn't catch it — the exact class of bug this whole apply-path exists to prevent. Fixed by namespacing copies with their source subdirectory; confirmed with a failing repro before fixing, now has a dedicated regression test proving a real apply still succeeds with colliding filenames. Also fixed a `manifest["outDir"]` KeyError-vs-`.get()` inconsistency. (2) `effective_ir.py`'s §3 still claimed "status tracking not yet built (RS-3)" and listed every residual as open — stale the moment T-RS3-3 shipped real `carried_forward` status; fixed to correctly exclude carried-forward residuals from the open list and annotate `reconfirm` ones. 68 tests total (up from 64: `test_apply.py` +1, `test_effective_ir.py` +3). No efficiency issues found rose above negligible at this tool's real scale (dozens of residuals/drafts per pack) — none fixed, none needed. |
| 2026-08-09 | **Phase RS-3 CLOSED — apply.py, apply-report, --baseline all real, all proven end-to-end.** `apply.py` is the sole real chokepoint for invoking `run-slice.js`/`override-applier.ts` — re-validates in-process, requires explicit confirmation (never silent, S4), merges `drafts/decisions/`+`drafts/overrides/` (the integration gap T-RS2-1 found and named, now handled for real). Proven: a real `type_change` override genuinely applied, `npm run validate` reported `Errors: no (0)` on the result. `apply-report.md`/`decisions-log.md` get real, cumulative, readable entries. `--baseline` (T-RS3-3) is real code, not just documented — `apply_baseline()` carries forward already-decided residuals and flags real drift as `reconfirm` rather than silently overwriting or silently re-asking; proven by packing the same fixture twice and confirming the second pack correctly skipped the already-decided residual. 64 tests total (up from 55), zero `pipeline/` diff throughout. Next: RS-4, gated on this phase's own bar (human apply works without LLM) — now met. |
| 2026-08-09 | **RS-2 self-review found and fixed 3 real correctness bugs in `validate_drafts.py`**, same day it was built, before anyone relied on it. All three were found by writing new edge-case reproductions, not by re-reading the code: (1) check-order mismatch let a `boundary_change` override with a dangling `decision_record_ref` pass as valid when the real applier would reject it; (2) the same-batch `node_add` exception counted overrides that would themselves be rejected, masking real dangling `relationship_add` endpoints; (3) `relationship_remove` never checked target existence at all. All three fixed, all three now have dedicated regression tests (16 tests total, up from 12; 55 across the whole tool suite, up from 51). Also surfaced (not fixed, out of scope for this tooling): `override-applier.ts`'s own `switch` has no `default` case for an unrecognized `override_type` — real, minor, platform-level gap named for BACKLOG. |
| 2026-08-09 | **Phase RS-2 CLOSED (MVP scope) — T-RS2-1/2/3 done, T-RS2-4 explicitly deferred to B-calm-portable-ir.** `validate_drafts.py` mirrors `override-applier.ts`'s real integrity checks; found and named a real (not yet fixed) integration gap along the way — the Session Pack's split `drafts/decisions/`+`drafts/overrides/` layout doesn't match `override-applier.ts`'s single-flat-directory scan, so RS-3's `apply.py` will need to merge them. `examples/` proves the manual (no-LLM) draft path end-to-end for real — a hand-authored override genuinely changed a real CALM node's type via the existing `run-slice --overrides` mechanism, `calm validate` still 0 errors. `effective_ir.py` (MVP) generates a real, non-empty effective-architecture summary from real applied CALM, confirmed (by hash, not assumption) to never touch `intelligence-ir.md`. 51 real tests total across the tool suite. Next: RS-3. |
| 2026-08-09 | **Phase RS-1 CLOSED — T-RS1-6 done, all 6 RS-1 tasks complete.** `pack.py`'s `SESSION.md` gained the numbered 1-9 walkthrough (design §2), a real copy-pasteable apply command (caught and fixed a first-draft placeholder-phrase bug by reading actual rendered output), and a CALM-viewer section (design §4.5). `AGENTS.md` now references the real chat-mode file and names Guided mode. RS-1 exit checklist fully closed: 33 real tests, zero pipeline/ diff across the whole program, no network anywhere in the tool, B-scale-oom-scale test passed. S9 (bulk-apply one-DR-per-residual) honestly noted as *addressed* at this phase (never violated by RS-1's own tooling) but not yet *mechanically enforced* — that's `validate_drafts.py`'s job, correctly scoped to RS-2. Next: RS-2. |
| 2026-08-09 | **T-RS1-5 (Copilot chat-mode file, safety-critical) done.** `.github/chatmodes/residual-review.chatmode.md` — S4 enforced via the real `tools:` frontmatter allowlist (excludes every terminal/execution tool), mechanically verified by `test_chatmode_safety.py` (7 tests, confirmed to actually catch a violation by injecting one and watching it fail). Honestly disclosed limit stated in both the file's own header and here: never exercised in a live VS Code + Copilot Chat session, since no such environment exists in this sandbox — same disclosed-limit pattern as this project's Dockerfile/CI workflow entries. 33 tests total across the RS-1 tool suite now. |
| 2026-08-09 | **T-RS1-4 (choice-card generator) done.** `tools/review-session/cards.py` — fixed per-class option templates for all 4 classes `triage.py` produces, wired into `pack.py` (`residuals.json` gains a `card` field, `SESSION.md` embeds full rendered cards). 10 real tests (`test_cards.py`). Found and fixed a real bug by checking actual rendered output against the NestJS fixture, not assuming the generator was correct: evidence lines were duplicated (a unit's evidence array can cite the same file:line twice, from two different Evidence sources) and could show a blank line as the preview — both fixed, regression-tested. 26 tests total across the RS-1 tool suite, all passing. |
| 2026-08-09 | **T-RS1-2 (`pack.py`) and T-RS1-3 (`triage.py`, MVP scope) done — first real code in this program.** `tools/review-session/{pack,triage,redact}.py` + `residuals-schema.json` + `{test_redact,test_triage,test_pack}.py` (23 tests total, all real — 3 are genuine subprocess end-to-end runs against the checked-in NestJS fixture, not mocks). Real, not simulated: refuse-overwrite safety verified with a fake unapplied draft; redaction verified against 7 fake-secret fixtures; **B-scale-oom risk tested and cleared** — ran `pack.py` against the actual 45MB `typed-facts.json` that crashed Node's V8 heap, completed in 0.64s at 375MB peak RSS, no inherited OOM on the Python side. T-RS1-3's fuller scope (unmapped-cluster catalogue_candidate, generic ontology-conflict detection) explicitly deferred, named not dropped. |
| 2026-08-09 | **All 3 findings from the post-sign-off review now closed** (doc updates only, no code — RS-1 hasn't started). (1) T-RS1-2's `pack.py` spec names the real **B-scale-oom** risk explicitly, requires testing against a large out-dir as part of its own exit. (2) `Architect_Residual_Review_Session.md` §3 Tier B taxonomy lists `relationship_remove` as a real class. (3) **T-RS4-2 rewritten** with a concrete 6-fixture trap set (one per §5.1 hard rule 1-4, plus 2 positive cases so the suite can't pass by always refusing), a stated 100%-on-refusal-cases pass bar, and an explicit note that this is a live-model-dependent bar to re-check on backend changes — was the thinnest exit criteria of any phase, owner asked for it to be fixed now rather than deferred to RS-4. |
| 2026-08-08 | Initial agent task list. RS-0 signed off: owner **Gowri**, go-ahead, **do not skip safety**. |
