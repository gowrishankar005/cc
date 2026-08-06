# Critical Review — Architecture-as-Code Solution Design v1.0 (+ Companion Playbook)

**Reviewed documents:** `Architecture_as_Code_Solution_Design_v1.docx`, `Architecture_as_Code_V1_Playbook.md`
**Review date:** 26 July 2026

---

## 1. Verdict Summary

"Proceed with Version 1" (Section 16) is **directionally right but premature as literally written**. The overall shape — deterministic pipeline, explicit ignored-items handling, durable overrides, Decision Records, no LLM in the generation path — is sound and well-reasoned, and Appendix A shows real self-awareness about scope discipline. But three items currently sitting in "Open Points for Review" (Section 15) are not peripheral details — they are **load-bearing for the document's own "core integrity rule"** (Section 6.7) and for the Success Metrics (Section 9): the Decision Record/Override schema, the confidence-threshold methodology, and the Ignored Items taxonomy. Proceeding without at least draft resolution of these risks rework and data-loss during the pilot itself.

**Condition for a clean "proceed":** re-scope Section 15 items 1, 2, and 5 as **Phase 1 exit criteria** in the Playbook (not open questions that can silently drift into Phase 2 build), and resolve the "Phase" naming collision between the two documents before either is circulated further.

---

## 2. Findings by Dimension

### 2.1 Objective & Problem-Statement Alignment

| Sev | Ref | Finding | Why it matters | Suggested fix |
|---|---|---|---|---|
| Medium | §1 vs §9 | Primary goal claims "minimal manual rework," but no Success Metric measures rework volume — Metric 3 only says "reasonable effort." | The headline value proposition isn't falsifiable by the pilot as designed. | Add a rework/effort metric (e.g., overrides-per-100-nodes, or SME hours per service reviewed). |
| Medium | §2 | Problem Statement asserts current docs are "expensive to keep aligned," but no baseline cost/time comparison is captured anywhere, including the Playbook's outcome-recording step (Playbook §3, "Outcomes to record"). | Without a baseline, the pilot can't actually prove the value claim, only assert plausibility. | Add "current-state baseline effort" as a Phase 0 precondition or a Phase 3 outcome to record. |
| Medium | §3 | "Practicality (prefer draw.io)" is listed as a top-tier Solution Goal alongside Accuracy/Traceability/Honesty — a UX preference is a different kind of thing than a success criterion. | Elevating a tooling preference to "goal" status risks it distorting tradeoffs (e.g., picking draw.io over a better review UX purely because it's a "goal"). | Reclassify as a constraint/preference, not a goal. |
| Low | §4.1 vs Exec Summary | "Application architecture" in the Executive Summary vs. the broader "Architecture-as-Code" framing in the title may create stakeholder expectation mismatch (infra/deployment architecture vs. structural/application only). | Naming sets expectations before anyone reads Section 4. | One clarifying sentence up front: "this covers structural/application architecture only; infrastructure topology is out of scope for V1." |

### 2.2 Requirements & Scope Traceability

| Sev | Ref | Finding | Why it matters | Suggested fix |
|---|---|---|---|---|
| High | §15 item 5, §6.3, §6.6 | "Minimum confidence thresholds for automatic inclusion vs. review" is an open point, yet the entire Review & Decision Layer architecturally depends on this threshold existing. | This isn't a loose end — it's the mechanism the "Honesty" and "Human Agency" goals run on. | Resolve at least an initial value + calibration method before Playbook Phase 2 begins, not during it. |
| High | §15 item 2, §6.7 | "Exact schema for Decision Records and Overrides" is open, yet Section 6.7 calls "Final CALM = Generation + Overrides" a "core integrity rule." | A core integrity rule resting on an undefined schema is a real risk — Playbook 2.9 even says "even if form-based," implying schema will be improvised during build. | Draft a minimal schema now (see §5 below); ratify formally in Playbook Phase 1, not after. |
| Medium | §9 | All five Success Metrics are qualitative ("reasonable effort," "acceptable"), with no numeric thresholds. | Playbook Phase 4's pass/fail decision has nothing objective to score against, risking disagreement exactly when a go/no-go call matters most. | Attach directional numeric targets even if rough. |
| Medium | §4.1 | "Lightweight companion review interface" is in-scope but has zero NFRs — no auth model, no hosting stance, nothing beyond the general Section 13 access-control principle. | An access-control *principle* ("restricted to designated architects") isn't an access-control *mechanism*. | Add one sentence on how "designated" is technically enforced (SSO group, allow-list, etc.), even at a V1-appropriate level. |
| Low | §4.2 vs Appendix B | "Non-code artefact enrichment" is out of scope, but Appendix B signals include Dockerfiles/CI config — arguably non-code. | Ambiguous boundary between "signals used to inform boundary detection" and "enrichment," could cause scope disputes mid-build. | One clarifying line distinguishing "config used as boundary evidence" from "non-code artefacts modeled as first-class architecture." |
| Low | Playbook §0 vs Design §4.2 | Design excludes "multi-repo federation," but neither document confirms whether the target organization actually operates a single monorepo or multiple repos. | If the real landscape is polyrepo, V1's core assumption may not hold at the org the pilot is run in. | Add "confirm repo topology (mono vs. poly)" as an explicit Phase 0 precondition. |

### 2.3 Enterprise Solution Design Quality

| Sev | Ref | Finding | Why it matters | Suggested fix |
|---|---|---|---|---|
| High | §6.2, §13, §12 row 7 | Mapping-config is solely owned by Enterprise Architecture — flagged as a risk in the doc's own risk table, but the mitigation ("treat as governed artefact") doesn't address throughput if EA later supports many domains at once. | Single point of ownership becomes a bottleneck exactly when the pilot succeeds and demand grows — the doc's own success path creates its own risk. | Note a scaling plan for mapping-config review capacity as a post-pilot precondition, even if just "revisit staffing after pilot." |
| Medium | §14, §14.2 | The Module Contract (inputs/outputs/deterministic-or-LLM/review-model) is described conceptually with no actual interface spec, and only one module (Architecture) exists to validate it against. | The "intentionally modular" claim is aspirational, not proven — readers may assume more maturity than exists. | Label §14 explicitly as forward-looking design intent rather than delivered capability. |
| Medium | §6.3 | Confidence scoring is described as "derived from multiple signals" with no stated aggregation method (weighted sum? rules cascade?). | Core to "Honesty" and "Human Agency" — currently a black box, which undercuts the "evidence over assertion" principle (§11.1) applied to the scoring mechanism itself. | State the aggregation approach at a conceptual level, even if simple (e.g., "weighted signal count against a threshold, per Appendix B.7"). |
| Low | §13 | No mention of pipeline monitoring — is a failed CodeGraph sync or a failed generation run detectable/alertable? | Silent failures undercut "trustworthy baseline" if nobody notices a stale or broken run. | Add one line to Non-Functional Considerations on run-failure visibility. |
| Low | §12 row 6 | "Leverage CodeGraph incremental sync" as mitigation for large-monorepo performance risk is somewhat circular — it assumes the very capability being risked. | No independent fallback if CodeGraph itself is the bottleneck. | Note a degradation/fallback stance (e.g., scoped/selective runs) independent of CodeGraph's own performance. |

### 2.4 Output / Artefact Quality for Engineering Handoff

| Sev | Ref | Finding | Why it matters | Suggested fix |
|---|---|---|---|---|
| High | §7 | None of `architecture.calm.json` (beyond "valid CALM 1.2"), `ignored-items-report.json`, or `provenance.json` have example schemas or field lists anywhere in either document. | Engineers building Playbook Phase 2 will invent schemas ad hoc, risking rework once Decision Record/Override schemas (currently open) are finalized and need to reconcile with whatever provenance.json turned out to look like. | Add minimal draft schemas as an appendix, marked "draft — ratify in Phase 1." |
| High | §15 item 2, §6.7 | (Repeated from §2.2 — flagging again here because it's simultaneously a scope gap and an artefact-quality gap.) | — | — |
| Medium | §6.6, §12 row 4 | The "custom CALM shape library" for draw.io is referenced repeatedly as a deliverable, but nobody is named as owning its design or its versioning relative to CALM itself. | If CALM moves to 1.3, does the shape library also need an owner to update it? Currently unassigned. | Name an owner (even "TBD — EA" is better than silent). |
| Medium | §6.5, §15 item 1 | The Ignored Items taxonomy is explicitly "suggested" and listed as an open point, yet it "directly supports" a named success metric (§6.5). | Given Playbook §1.2 ("Define the expected ignored set") looks like the intended closure point, Section 15 should reflect that resolution path rather than reading as a generically unresolved question. | Cross-reference Playbook 1.2 from Design §15, or remove the item once Playbook 1.2 is run. |
| Low | §15 item 6 | Naming conventions/storage location for artefacts is open — reasonable to defer, but it isn't listed as a Phase 0/1 precondition anywhere in the Playbook, so it may get decided informally mid-build. | Minor but avoidable inconsistency risk. | Add as a Phase 1 or early Phase 2 decision point in the Playbook. |

---

## 3. Cross-Document Consistency Issues

| Sev | Finding |
|---|---|
| Medium | **"Phase" naming collision.** Design §10 uses "Version 1 / Version 2 / Version 3" as *delivery phases*, while the Playbook uses "Phase 0–5" as *execution steps within V1*. Both are called phases, but they mean different things. In a meeting, "Phase 2" could mean either "V1 minimal pipeline build" (Playbook) or accidentally get conflated with "Version 2 — Review Experience" (Design). Recommend renaming the Playbook's sequence to "Steps 0–5" or similar to remove the collision. |
| Medium | **Duplicated Deferred Enhancements content.** Design Appendix C and the Playbook's closing "Deferred Smart Enhancements" section are near-verbatim duplicates. Maintaining the same content in two places creates drift risk if one is updated and the other isn't. Recommend the Playbook reference Appendix C rather than repeating it. |
| Low | **Open Point already answered.** Design §15 item 4 ("Pilot monorepo selection criteria and success thresholds") appears to already be resolved by Playbook §0.1 and the "Pilot selection criteria" section — but the Design still lists it as open. A reader of the Design alone would think this is unresolved. Recommend updating §15 to reference the Playbook as the resolution, or removing the item. |
| Low | Playbook Phase 1 is titled "Worked Example Design (Still no code)" and is clearly meant to lock down definitions before build — yet Decision Record schema (a Design Open Point) is pushed into Phase 2.9 as "even if form-based" rather than being a Phase 1 deliverable. This is a soft inconsistency in intent: Phase 1's whole purpose is to avoid exactly this kind of "figure it out during build" drift. |

---

## 4. Full Risk Table Stress-Test (Section 12)

| # | Risk (as written) | Mitigation (as written) | Stress-test verdict |
|---|---|---|---|
| 1 | Weak initial heuristics | Focused pilot domains; iterate mapping-config quickly | Reasonable, backstopped by Playbook Phase 4. Doesn't define "quickly" or a time-box for iteration before declaring failure. |
| 2 | Architect review fatigue | Strong evidence presentation, ignored-items report, confidence filtering | Restates intended UX quality rather than a concrete mitigation. Also doesn't address that Playbook §0.4 only requires "1–2 architects" — a single unavailable SME could stall the whole pilot with no named backup. |
| 3 | Override complexity | Keep override model simple, well-documented, versioned | This is a design principle, not a mitigation mechanism — no discussion of *how* complexity is actually prevented. |
| 4 | Draw.io generation quality | Invest in custom shape library + layout defaults | Reasonable, but ownership of that investment is unassigned (see §2.4). |
| 5 | Scope creep into full visual product | Strictly stage visual sophistication | Well mitigated — consistent with Appendix A's lessons learned. No further action needed. |
| 6 | Large monorepo performance | Leverage CodeGraph incremental sync; selective processing | Partially circular — assumes the capability being risked. No independent fallback if CodeGraph itself underperforms. |
| 7 | Mapping-config becomes a product | Governed artefact; version, review, test; document ownership | Directionally right, but "document ownership in operating model" references an operating model document that doesn't appear to exist yet. |

**Risks missing from the table entirely:**
- **Vendor/dependency risk on CodeGraph** — it's the sole structural engine (§6.1); no fallback discussed if it's discontinued, re-licensed, or can't handle a stack in the pilot repo.
- **Data sensitivity of generated artefacts** — `calm.json`/`provenance.json` describe internal system structure in detail; no classification or handling stance beyond the document's own "Internal" footer.
- **Single-SME bottleneck** — distinct from "review fatigue" (row 2): this is a resourcing/availability risk, not a UX-quality risk.
- **Schema-change rework risk** — if Decision Record/Override schema is finalized only during build, early captured decisions may need migration.
- **CALM spec version drift** — pinned to CALM 1.2 with no stated upgrade stance.

---

## 5. Prioritized Action List

**Must resolve before pilot (Playbook Phase 0–1):**
- Draft Decision Record & Override schema (even minimal) — don't leave to "form-based" improvisation in Phase 2.
- Define confidence-threshold methodology + initial values.
- Finalize Ignored Items taxonomy via Playbook 1.2, and update Design §15 to reflect this as the closure mechanism.
- Fix the "Phase" naming collision between the two documents.
- Confirm repo topology (mono vs. poly) as an explicit precondition.

**Must resolve before enterprise rollout:**
- Data classification/handling policy for generated artefacts.
- Concrete access-control mechanism for the companion interface (beyond process-based trust).
- Mapping-config governance process detail: submission, SLA, rejection criteria, backlog handling.
- CodeGraph vendor-risk fallback stance.
- CALM version-drift stance.

**Should fix before scale-out:**
- Attach numeric targets to Success Metrics.
- Add a backup SME reviewer to pilot resourcing.
- Add pipeline run-failure monitoring/alerting.
- Define a testing/regression strategy for heuristics accuracy over time (golden dataset or equivalent).

**Polish / nice-to-have:**
- Reclassify "practicality/draw.io" as a constraint, not a top-tier goal.
- Clarify the "non-code enrichment" scope boundary vs. Appendix B's config-based signals.
- De-duplicate Appendix C vs. the Playbook's own deferred-enhancements section.

---

## 6. Everything Else Worth Flagging

- No baseline cost/time comparison against current manual documentation practice is planned to be captured, which weakens the ability to prove the core value proposition after the pilot.
- No mention of a testing/QA strategy for the Heuristics Engine itself — accuracy currently rests entirely on ad hoc SME review each run, with nothing regression-tested between runs.
- No named build team/timeline/budget for Phase 2 (Minimal Pipeline Build) — the Playbook names reviewers ("You + EA") but not who builds the pipeline.
- No stated behavior for what happens to previously-approved CALM output when mapping-config changes underneath existing Overrides — does regeneration silently reshape approved boundaries, or trigger re-approval?
- No backup/disaster-recovery stance for the Decision Store/Override Store, despite both being described as "durable" and "versioned."
- No training/enablement plan for architects unfamiliar with reading confidence scores or provenance evidence.
- No mention of how the pilot's success gets communicated to stakeholders beyond architects (budget owners, security, compliance) — Section 16's "proceed" recommendation is written for an architect audience, not a broader sign-off audience.
- Multi-language monorepo support is implicitly assumed (Appendix B examples span Spring, Express, FastAPI) but never stated as a tested requirement.
- No description of what happens operationally if Playbook Phase 4 results in "Stop" — are captured Decision Records retained for a future attempt, or discarded?
