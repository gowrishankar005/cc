# Enterprise-Readiness Review — CALM Generator Requirements (v0.1 → v0.9)

**Reviewed:** `docs/requirements/CALM_Generator_Requirements_v0.1.md` through `_v0_9.md`, plus `docs/spikes/Gap_Closure_Build_Ready_Specs_v0.1.md` (still authoritative for Decision Records, two-tier mapping-config, and confidence-scoring weights — every later version references it as "unchanged," which means its open items are still open, not resolved).

**Method:** Applies the dimensions and rigor of `docs/spikes/AaC_Solution_Design_Critical_Review_Prompt.md` (this project's reusable review rubric), adapted to this document set rather than the original Solution Design/Playbook pair it was written for — those documents aren't in this repo, and this requirements series has its own structure. Every finding is anchored to a specific document/section, not a general impression.

---

## Verdict Summary

As a **technical foundation**, this is a genuinely strong start — stronger than most POCs get to. The evidence discipline is real (every claim traces to an actual repo, an actual schema fetch, an actual test run), and the project has twice caught and corrected its own drift in public (the jQAssistant hybrid idea in v0.4, the `interacts`/`connects` schema bug in v0.9). That habit is worth more than any individual finding below.

As an **enterprise deployment plan specifically**, it is not there yet, and the gap isn't "more frameworks" or "more languages" — it's four things that were identified as open in the *very first* substantive document (`Gap_Closure_Build_Ready_Specs_v0.1.md`, written before v0.1 of the requirements series) and have not been revisited in any of the nine subsequent versions: **data classification/handling policy, a numeric success metric, an access-control mechanism, and the Decision Record/Override audit trail that the docs themselves call a "core integrity rule."** None of these are backlog nice-to-haves. They're the kind of gap a real enterprise security or governance review stops at on day one, and right now they're not even flagged as open anymore — they've silently dropped out of view because later versions' "unchanged from vX" chains don't re-surface them.

**Conditional verdict:** good enough to keep building the extraction/construction engine on (that part is sound and improving), **not** good enough to present as an enterprise rollout plan without closing the four items above and the mapping-config/review-interface drift noted below.

---

## Findings by Dimension

### 1. Objective & Problem-Statement Alignment

| Sev | Ref | Finding | Why it matters | Suggested fix |
|---|---|---|---|---|
| Medium | v0.9 §4 | "Language/framework-agnostic" is stated as a satisfied "hard requirement," but the evidence given is that the *type system* is generic (`TypedUnit.kind`, `TypedRelationship.kind` don't encode Python concepts) — not that the *pipeline* has been proven generic by actually running a second language through it. Slice 2 (Java) is still "specified, not built." | Conflating "the types are generic" with "the pipeline is generic" is exactly the kind of claim an enterprise architecture review will test by asking for a second live example — and there isn't one yet. | Rephrase as "designed for genericity, proof pending Slice 2" until Java actually runs end-to-end. Don't let the claim harden into settled fact before it's tested the same way every other claim in this project has been. |
| Low | v0.6 §"scope-limitations" fix | `x-aac-confidence` measures certainty about the signals found, not completeness of the picture — correctly caught and disclosed in the artefact's own metadata after the first accuracy audit. | Good self-correction, but the disclosure lives in one metadata array; nothing prevents a downstream consumer from reading a 100-confidence score as "this is the whole architecture." | Consider surfacing the caveat more prominently (e.g. a top-level doc comment, not just buried metadata) if this becomes a multi-architect-facing tool. |

### 2. Requirements & Scope Traceability

| Sev | Ref | Finding | Why it matters | Suggested fix |
|---|---|---|---|---|
| **High** | Gap_Closure §8 | Three explicit "Still Need From You" items — a numeric success-metric target, a data-classification policy owner, and the companion interface's auth mechanism — were asked for before v0.1 of this requirements series and **have never been answered in any of the nine subsequent versions**. No later version even re-lists them as still-open; they've fallen out of view entirely. | These are exactly the "load-bearing unknown, not a loose end" category this project's own rubric warns about. Silence isn't resolution. | Explicitly re-open these three items in the next requirements version, even if the answer is "still pending" — the point is to keep them visible, not let them age out by omission. |
| **High** | Gap_Closure §6 | Decision Record / Override schemas are drafted and explicitly called a mechanism that makes the "core integrity rule" (final CALM = generation + overrides) "mechanically enforceable, not just a stated principle" — but **no code implementing this exists anywhere in `pipeline/src`**, and no version since has mentioned building it. | Without this, there is no sanctioned way for an architect to correct a wrong classification without hand-editing generated JSON — which breaks the "generation + overrides = final" model the docs themselves call load-bearing. | Either build a minimal version of this before calling any slice "enterprise-ready," or explicitly demote it to backlog with a stated reason — right now it's neither built nor acknowledged as deferred. |
| **High** | Gap_Closure §4 | The two-tier mapping-config (`global/` + `domains/<domain>/`) is specified as the resolution to "mapping-config becomes a governance bottleneck" — but the actual code (`pipeline/src/rules/signal-catalogue.yml`) is a single flat file with no per-domain layer at all. | The requirements describe federated governance; the implementation has none. This is a real scope/implementation mismatch, not just an unbuilt feature — anyone reading the requirements docs would reasonably assume this exists. | State plainly in the next requirements version that the two-tier structure is unbuilt and single-catalogue is the current reality, so nobody designs against the assumption that it's already there. |
| Medium | Gap_Closure §3 | The "companion review interface" (draw.io round-trip, CALM Studio integration contract) — a named architectural component with its own integration contract — has had **zero mention in any version from v0.2 through v0.9**. Not marked done, not marked backlog, just absent. | This is the *same failure mode* the project's own methodology caught once already (jQAssistant, v0.4's "dropped by omission, not a reasoned rejection"). It recurred, undetected, for a different component. | Add an explicit backlog/status line for the review-interface component in the next version, the same way jQAssistant got one — don't let a second silent drift stand uncorrected. |

### 3. Enterprise Solution Design Quality

| Sev | Ref | Finding | Why it matters | Suggested fix |
|---|---|---|---|---|
| **High** | *(gap — not in any version)* | **No document anywhere states where this pipeline actually runs, or who has access to its outputs and caches.** It parses proprietary source code and writes `.codegraph/`, `graphify-out/`, and `architecture.calm.json` (itself a structural map of internal systems) to disk. Local-only execution is asserted repeatedly as a *tool* property (CodeGraph/Graphify both confirmed to make no network calls in code-only mode) — but never as a *deployment* property (where does "local" mean in an enterprise CI/laptop/shared-runner context, and who can read the resulting artefacts). | This is the kind of gap a real security review stops at before discussing anything else. It's answerable cheaply (state the intended execution environment and artefact-retention stance) but currently isn't answered at all. | Add a short "Execution & Data Handling" section to the next requirements version — even a minimal stance ("runs on architect's own machine or a dedicated CI runner with no shared storage of outputs, pending a real policy owner per Gap_Closure §8") is better than silence. |
| Medium | Gap_Closure §4 risk table (implicit) | Mapping-config ownership bottleneck was named as a risk with the two-tier structure as mitigation — but per finding above, the mitigation doesn't exist in code. The risk is therefore fully live, not mitigated. | A risk with an unbuilt mitigation should read as "open," not "resolved." | Reflect real status, not intended status, in the next risk accounting. |
| Low | v0.6 §4 / v0.9 §4 | Extensibility-for-Java claims are well-reasoned on paper (signal-catalogue rows, generic typed-facts) — a genuine strength of the design, worth crediting, not just critiquing. | — | — |

### 4. Output / Artefact Quality for Engineering Handoff

| Sev | Ref | Finding | Why it matters | Suggested fix |
|---|---|---|---|---|
| **High** | v0.9 §1 | The `interacts`/`connects` relationship-type bug is a concrete instance of a general risk this dimension exists to catch: an artefact that passes `calm validate` while being subtly wrong, because the specific shape that would expose the bug was never exercised. The bug was found by luck of asking "is this really right" against the authoritative schema, not by any test. | The same pattern almost certainly applies elsewhere: `deployed-in`, `composed-of`, and `options` relationship types are fully specified in this project's understanding of CALM but **never used or tested** — same "specified, never exercised" risk shape. | Before calling any construct "supported," require it to have been generated at least once against real data and schema-validated, the same discipline already applied to `connects`. Treat "in the type definitions but never emitted" as equivalent to "not built" for readiness purposes. |
| Medium | *(gap)* | No versioning/compatibility stance for `typed-facts.json` itself — the *internal* module contract between Analysis and any downstream module. The project's own stated ambition is a multi-module platform ("CALM Generator is the first module"), which means a second module will eventually depend on this contract's stability. | Without a stated compatibility policy, a future module could silently break when typed-facts.json's shape changes for the CALM Generator's own reasons. | State a minimal versioning stance (e.g. `runVersion` already exists — clarify whether it also governs the typed-facts schema itself, not just the rule catalogue). |
| Medium | Gap_Closure §8 (repeated) | No numeric or qualitative acceptance threshold for output quality beyond the confidence bands — the same still-open item from finding #2 above, relevant here too since "artefact quality" ultimately needs a stated bar. | — | Same fix as above — this is one unresolved item surfacing under two review dimensions, which is itself a signal of how central it is. |

### 5. Gaps Not Listed as Open Points, But Should Be

- **No testing/regression strategy for heuristics accuracy** (flagged as open in `Gap_Closure §1` itself, never resolved in nine later versions). There is no golden dataset and no automated regression suite — only manual runs against two proxy repos and one NestJS fixture. This is precisely the gap category the `interacts`/`connects` bug slipped through; without a regression suite, a future change to `signal-catalogue.yml` or the construct-mapping layer has no automated way to catch a silent regression.
- **No incremental/repeat-scan story.** Nothing addresses what happens when the same package is scanned again after code changes — whether `unique-id`s stay stable (v0.8 §4 raises this for Pattern-matching purposes but not for diffing/drift-detection, which is literally CALM's own stated value proposition per "Why use CALM").
- **The pipeline's newest feature (shared-Secret trust-relationship detection, v0.7 §3) never explicitly states that it only reads Secret *references* (`secretName`, `items[].key` names), never Secret *values*.** The design as specified appears safe by construction, but this safety property is never stated as a guarantee anywhere — for a feature whose entire subject matter is credentials, that should be an explicit, auditable claim, not an implicit consequence of how the code happens to be written.
- **No run-failure monitoring plan** — same still-open item from `Gap_Closure §1`, never addressed since.

---

## Risk Stress-Test

| Risk | Stated mitigation | Real status |
|---|---|---|
| Mapping-config becomes a governance bottleneck | Two-tier global/domain structure | **Mitigation unbuilt** — current code is a single flat catalogue. Risk is fully live. |
| CodeGraph/Graphify vendor risk | Hybrid dual-engine design, version-pinning, documented fallback reasoning | **Well mitigated** — a genuine strength, consistently reasoned across every version. |
| Silent `detect()`-gate failures | Per-package smoke-test | **Well mitigated and actually built** (`scanner/detect-gate-smoketest.ts` is real, running code) — worth crediting explicitly as a concrete enterprise-grade safeguard, not just a paper mitigation. |
| Cross-package edge loss | Graphify structural-backbone reconciliation | Actively being solved, real progress, real evidence (6 relationships recovered in the accuracy-audit fix). |
| **Missing from any version's risk accounting**: data privacy/compliance exposure of generated artefacts | — | `Gap_Closure §8` asked who owns this decision; nobody has answered across nine versions. |
| **Missing**: single-reviewer risk | — | Every requirements round this session has had one author and one reviewer (the user and this assistant). No evidence any second stakeholder (security, a second domain architect) has reviewed anything yet, despite the documents' own framing implying a broader organization is involved. |

---

## Prioritized Action List

**Must resolve before any enterprise pilot (not backlog — these block a real first rollout):**
1. Answer or explicitly re-open Gap_Closure §8's three items (success metric, data-classification owner, auth mechanism) — silence is not resolution.
2. State an execution/data-handling stance: where this runs, who can access generated artefacts and scanner caches, retention policy.
3. Build a minimal Decision Record/Override mechanism, or explicitly demote the "core integrity rule" framing until one exists — right now the docs call it load-bearing and the code has nothing.
4. Fix the `interacts`/`connects` bug (already scoped, v0.9 §1) before generating any relationship type that would exercise it — the Kubernetes trust-relationship layer is about to.

**Should fix before scale-out beyond a single pilot slice:**
5. Either build the two-tier mapping-config or state plainly that single-catalogue is current reality — don't leave the mismatch implicit.
6. Add a status line for the companion review interface (done/backlog/dropped) — don't let it stay silently absent the way jQAssistant briefly did.
7. Stand up a minimal regression suite (even just re-running the existing proxy-repo + fixture tests automatically on every change) before trusting future catalogue/construct-mapping edits not to silently regress.

**Polish / lower urgency, correctly deprioritized already:**
8. CALM schema version-drift stance (pinned to 1.2, no migration plan) — low urgency per the docs' own reasoning, no objection to that call.
9. typed-facts.json internal versioning — matters more once a second module actually exists.

---

## Everything Else Worth Flagging

- **A real strength worth naming, not just gaps**: this project has caught its own drift in public twice (jQAssistant in v0.4, the relationship-type bug in v0.9) by going back to primary sources rather than trusting earlier session notes. That habit is rarer and more valuable than any single fix on this list, and an enterprise review board would generally trust a team that visibly self-corrects more than one that's never wrong on paper.
- **Adoption/change management is unaddressed anywhere in this document series** — how architects get trained to read confidence scores and ignored-items reports, what happens to their existing workflow. This was presumably covered in the original Playbook (referenced but not in this repo), but nothing in the CALM Generator requirements series tracks it forward.
- **No named owner or effort/timeline estimate** for this work anywhere across nine versions — reasonable for a fast-moving technical spike, but worth flagging before "enterprise deployment" framing is used seriously.
- **Confidence-weight change control** — the weights are stated (`Gap_Closure §7`) but nothing says who can change them in production or what process governs a change. Currently it's an editable table with no described guardrail.
