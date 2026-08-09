# Pilot-Ready Scorecard

**Product:** Weaver. **Purpose:** a single, structured bar for "is Weaver ready to run against a real enterprise pilot repo," replacing feature-list vibes with a checklist tied directly to `Claim_Register.md`'s own cell statuses.

**Authority:** `Claim_Register.md` remains the source of truth for what each cell's status actually is. This file only defines what bar each cell must clear before Weaver is called pilot-ready — it does not restate or override cell statuses itself.

**Explicit, load-bearing rule:** a green `npm test` suite and a lab-core "ALL PASS" are **not**, on their own, evidence of pilot readiness. Lab core fixtures assert **L1** (unit/interface recall) almost exclusively — see `coe-lab/docs/validation-approach-vnext.md`. Pilot readiness is an **L2** (architecture story) and **L3** (silence/completeness) bar, which lab-core green does not by itself demonstrate. This is exactly the failure mode `Architecture_Relation_Evidence_Completeness.md` and the Fineract finding (`coe-lab/docs/fineract-gold-vs-platform-finding.md`) named: lab L1 passing while a real layered monorepo's L2 story failed, with nothing in the test output distinguishing the two.

---

## 1. Mandatory disconfirming samples

Before any pilot claim, Weaver must have been run against **at least these two shapes** (generic descriptions — see §4 for which real evidence repos currently fill each role; the roles are what matter, not the specific repos):

| Shape | Why mandatory | Currently filled by (evidence only, not the product target) |
|---|---|---|
| **Shallow, one-hop** — a service directly imports/calls its own persistence layer, single module | Proves the deterministic base case (R1) works at all | A two-service Python sample with a directly-owned DB class per service |
| **Layered, multi-module** — HTTP resource → interface → implementation class → persistence entity, implementation may live in a different module than the resource | Proves (or honestly disproves) the realistic enterprise shape R2/R2b targets — this is the shape that broke the "lab L1 green = done" assumption | A real, large, multi-module Java monorepo sample |

A pilot readiness claim resting on only ONE of these two shapes is not valid — per Claim Register Q5 ("Disconfirming samples for relationship claims," decided (process)), whose current wording names the two specific evidence repos that filled these roles when it was decided ("BoA shallow + Fineract layered required before 'Java rels complete'"); this scorecard generalizes that decision to the SHAPE, not the specific repos, per §4 below.

---

## 2. Required claim cell status, by pillar

Format: cell ID → **minimum status required for pilot** → what "pilot-ready" means for that cell (may be stricter than the cell's current real status — gaps are the punch list, not hidden).

### Unit formation (U-*)

| Cell | Minimum for pilot | Notes |
|---|---|---|
| U-http | `proven` | Route/entry-point detection across the pilot's real languages |
| U-entity | `proven` | Persistence-entity detection (decorator/annotation path) |
| U-persist-import | `partial` acceptable | Import-only detection; ontology ambiguity (Q13) must be a NAMED limitation the pilot operator sees, not silent |
| U-msg-consumer | `partial` acceptable if pilot doesn't lean on messaging | `specified-unbuilt` unacceptable if the pilot repo has real messaging |
| U-msg-producer | `partial` acceptable | Must not be `specified-unbuilt` if pilot repo has real producers in its dominant language |
| U-spring-data / U-jooq | `partial` acceptable for whichever ORM the pilot repo doesn't use; the ORM it DOES use must not be `specified-unbuilt` |

### Relations (R*)

| Cell | Minimum for pilot | Notes |
|---|---|---|
| R0 | `proven` (as structural, graded) | Entity-mesh noise must be labeled `structural`, never presented as architecture |
| R1 | `partial, regression-locked` minimum | One-hop must never silently regress |
| R2 | `partial` acceptable **only if** the pilot's own layered residual is explicitly measured and reported — see §3 | `specified-unbuilt` is disqualifying for any pilot with real layered services |
| R-k8s | `partial` acceptable if pilot doesn't use k8s manifests; otherwise must be exercised on the pilot's real manifests before claiming |

### Controls (C-*)

| Cell | Minimum for pilot | Notes |
|---|---|---|
| C-dec | `proven` | |
| C-call | `partial` acceptable, but the pilot's OWN call-site auth vocabulary must be checked against `signal-catalogue.yml`'s call-site rows first (the catalogue intake rule, Phase R2, governs adding a new one) — a pilot using an unlisted vocabulary gets silent false negatives |
| C-contract | `partial` acceptable if pilot has no OpenAPI/Swagger; otherwise must be exercised on the pilot's real spec |
| C-rich | `partial` acceptable | Raw text richness only; no structured-authority requirement for pilot v1 |

### Silence / completeness (S)

| Cell | Minimum for pilot | Notes |
|---|---|---|
| S-silence | `partial` minimum, **and S1/S2 must be run against the pilot repo itself before any completeness claim** | This is the single most important gate — see §3 |

---

## 3. The actual pilot-readiness procedure (not just a table)

1. Run Weaver against the pilot repo (module-root scans; multi-root only if the pilot's own layering needs it — see `coe-lab/docs/multi-root-l2-protocol.md`).
2. Read `coverage-report.json`'s `completeness` block for the pilot's own run. If `silenceFlags` includes S1, the architecture story is genuinely incomplete for THIS repo — this must be disclosed to the pilot stakeholder before any "architecture recovered" claim, not smoothed over because the cell table above says R2 is `partial`.
3. Run the pilot's output through the real residual review session (`tools/review-session/pack.py` → choice cards in VS Code Copilot Chat or `SESSION.md` directly → `validate_drafts.py` → `apply.py`) and hand the resulting Session Pack to a human reviewer — this is the residual-completion step, not optional polish. (`hitl-review-trigger.js` alone, without the Session Pack around it, is the pre-`B-review-session` fallback — still valid, just the harder-to-use path §4.4's own "degraded path" describes.)
4. Only after 1–3 does a "Weaver ran against `<pilot>`, here is what it found AND did not find" report become honest.

**A pilot readiness claim without step 2 having actually been performed against the pilot's own repo is not a valid claim, regardless of what this table says about lab/sample-repo cell statuses.**

### 3.1 What the residual session is and isn't (T-RS5-1, RS-1–4 real and closed — `AGENT_TASKS_Residual_Review_Session.md`)

The residual session (`B-review-session`) is an **L5 finishing step**: it completes a delivered artefact (post-override CALM + effective IR) for *this specific run*, through human choice cards and, optionally, evidence-gated LLM drafting — never a substitute for step 2's own architecture-recovery mechanisms (R1/R2/R2b). Concretely:

- **It may not be used to claim a cell status moved.** Answering a residual (e.g. confirming `PrismaService` is `database` not `service`) is a pilot-scoped correction for this run's CALM, not evidence that R2's own multi-hop mechanism now recovers that shape automatically. If `coverage-report.json`'s S1 fires for the pilot repo, that stays a real, disclosed R2 gap (step 2) — a residual session that lets an architect manually connect the same two units does **not** clear S1 for future runs or move R2 to `proven`.
- **It does not redefine any standing exam** (`E-charge-single-L2`, or any other Claim Register–backed exam) — same rule the tool's own chat-mode/`SESSION.md` state to the architect every session.
- **What it DOES add to pilot readiness**: a real, tested, human-in-the-loop path for an architect to correct known-ambiguous residuals (S1/S2/S5/low-architecture-coverage) into a usable, reviewed CALM document for *this* pilot run — proven end-to-end (a real hand-authored override changes a real CALM node's type, `calm validate` reports 0 errors). This closes the "residual-completion step, not optional polish" bar in step 3 above with a real, usable tool instead of raw JSON hand-editing.
- **Two honestly-named open gaps, neither blocking pilot use of steps 1–3**: no detector in this pipeline currently classifies a residual as Tier B (`B-tier-b-detector`), so Tier B/LLM-assisted drafting has no real production input yet — pilot use today is Tier A/C only, which is the fully-proven path regardless; and the live-LLM Tier B path (both `draft_tier_b.py` and in-chat Copilot drafting) has never been exercised against a real model in this project's own dev environment (works the same either way for a pilot operator with their own Copilot/API access — this is a development-environment limitation, not a product one).

---

## 4. Evidence repos are not the product

Every real-repo path cited anywhere in this project (Bank of Anthos, Fineract, Ghostfolio, Waltz, calm-hub, lab fixtures) exists to **prove or falsify** a mechanism. None of them is the product target. A pilot is a **different, real** customer repo — this scorecard's bar must be re-applied to that repo specifically; passing against the evidence repos above is necessary (it's how the mechanisms got proven) but not sufficient.

---

## Changelog

| Date | Note |
|---|---|
| 2026-08-09 | T-RS5-1 — §3 step 3 updated to point at the real, now-closed residual review session (`tools/review-session/`, RS-1–4) instead of the raw `hitl-review-trigger.js` CLI it predated. New §3.1 states plainly what the residual session is (an L5 finishing step, real and proven end-to-end) and isn't (never moves a Claim Register cell status, never redefines a standing exam) — the exact overclaim boundary `Architect_Residual_Review_Session.md` §0.1 already enforces at the tool level, now also stated where a pilot-readiness reviewer would actually look for it. |
| 2026-08-08 | T-R0-1 — initial scorecard, derived from Claim_Register.md's real cell statuses at the time of writing |
