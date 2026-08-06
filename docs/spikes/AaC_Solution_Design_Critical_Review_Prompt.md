# Critical Review Prompt — Architecture-as-Code Solution Design

**Use:** Paste the *Role* block into Project Instructions (or the system prompt), then send the *Task* block as your message with both documents attached. Reusable for future versions (v2, v3) of the same design.

---

## ROLE (Project Instructions / System Prompt)

```
You are a Principal Enterprise Architect and platform engineering reviewer. 
You have led review boards for internal developer-platform and architecture-governance 
initiatives at large organizations, and have specific working knowledge of code-graph/static-analysis 
tooling, architecture-as-code formats (CALM, C4, ArchiMate), and enterprise change-governance models.

Your job in this conversation is to run a rigorous pre-mortem on a proposed Solution Design — 
not to validate it. You are respected precisely because you catch the gaps the author didn't 
think to ask about, and because you never trade rigor for agreeableness.
```

---

## TASK (User Message)

<instructions>
Critically review the attached **Solution Design v1.0** ("Deterministic Architecture-as-Code Generation from Monorepo") together with its companion **Version 1 Playbook**. Treat both as one system under review — they reference each other and must be internally consistent.

Evaluate the design against every dimension below. Be **exhaustive, not selective**: record every finding you identify, including minor ones — rate each by severity rather than dropping it for brevity. A short list of only the "top issues" is an incomplete review for this task.

For every finding:
- Anchor it to a specific section/number in the source document (e.g. "Section 6.5", "Risk table, row 3", "Open Points item 4") so it's traceable.
- State *why* it matters (impact if unaddressed).
- State what a stronger version would look like — don't just flag the problem, suggest the fix.
- Classify it as one of: **Blocks pilot** / **Blocks enterprise rollout** / **Should fix before scale-out** / **Polish / nice-to-have**.

Do not soften conclusions to be agreeable. If the recommendation section's "Proceed with Version 1" verdict is only conditionally justified, say so and state the conditions explicitly.

### Review dimensions (cover all of these)

1. **Objective & Problem-Statement Alignment**
   Does the proposed solution actually solve the stated problem (Section 2) and deliver the primary goal (Section 1)? Are there parts of the solution that solve a different or narrower problem than the one stated? Is the "trustworthy, evidence-based, machine-readable baseline" goal actually falsifiable/measurable as written?

2. **Requirements & Scope Traceability**
   Cross-check Section 4 (Scope), Section 9 (Success Metrics), and Section 15 (Open Points) against each other. Does every in-scope item have a corresponding success metric? Does every success metric have a concrete, testable definition (e.g., what counts as "reasonable effort" in metric 3)? Are any In-Scope V1 items actually dependent on Out-of-Scope items to function?

3. **Enterprise Solution Design Quality**
   Assess architecture soundness (Sections 5–8, 11, 14): separation of concerns, coupling between components, single points of failure (e.g., mapping-config owned solely by one team), governance model maturity, extensibility claims vs. actual module contract rigor (14.2), and whether the modular design in Section 14 is load-bearing or aspirational.

4. **Output / Artefact Quality for Engineering Handoff**
   Are the artefacts in Section 7 (calm.json, ignored-items-report, provenance.json, drawio, Decision Records, Overrides) specified precisely enough for another engineering team to build against without further clarification? Identify every artefact where schema, format, or versioning is not yet defined (cross-reference Section 15).

5. **Gaps — Including the Document's Own Open Points**
   For each of the 6 items in Section 15 "Open Points for Review," assess whether it is a minor loose end or a load-bearing unknown that should block sign-off. Then identify gaps the document does **not** list as open points but should.

6. **Risk Stress-Test**
   Take the Section 12 risk table and stress-test it: for each risk, is the mitigation actually sufficient, or does it just restate the risk in softer words? Identify risks that are missing entirely from the table.

7. **Enhancement Opportunities**
   Beyond Appendix C's deferred items, what would materially improve V1 without violating its stated integrity/practicality principles (Section 11)?

8. **Blind Spots / Other Material Concerns (not explicitly requested above)**
   This is the section where you think like a reviewer, not a checklist-follower. At minimum, form a view on each of the following, and add anything else you notice:
   - **Data sensitivity & access**: The system parses proprietary source code. Is there any mention of where CodeGraph runs, data residency, or access control for the companion review interface? (Section 13 touches this thinly.)
   - **Vendor/dependency risk**: CodeGraph is named as the sole structural engine (Section 6.1). What's the fallback if it's discontinued, re-licensed, or can't handle a specific tech stack in the pilot repo?
   - **Governance bottleneck**: Enterprise Architecture solely owns mapping-config (Section 6.2, Risk table). Is this a scaling bottleneck once V1 succeeds and more domains want onboarding?
   - **Validation methodology**: How will heuristic accuracy actually be measured/regression-tested over time — is there any golden-dataset or automated test strategy, or does correctness rely entirely on ad hoc SME review each run?
   - **Adoption & change management**: The design assumes architects will adopt draw.io + companion review workflows. Is there anything about training, incentive, or workflow disruption for the architects expected to do this review work?
   - **Team, ownership, and resourcing**: Is there a named owner/team for building V1, or only for mapping-config governance post-launch? Is effort/timeline/cost estimated anywhere?
   - **Exit/rollback plan**: Section 4 (Phase 4 in the Playbook) defines a "stop" condition if the pilot fails — but what happens operationally if V1 is stopped after partial rollout? Is there a defined unwind path?
   - **CALM schema evolution**: The design pins to CALM 1.2. What happens if the CALM spec changes upstream — is there a compatibility/versioning stance?
   - **Confidence threshold governance**: Section 6.3 and Playbook 2.4 mention configurable thresholds but never say who sets them initially or how they're validated against false positive/negative rates.
   - **Consistency between the two documents**: note any place the Playbook assumes a capability, schema, or decision that the Solution Design hasn't actually specified yet, or vice versa.
   - Anything else you notice that a real review board would raise.
</instructions>

<documents>
{{SOLUTION_DESIGN_DOCX}}
{{PLAYBOOK_MD}}
</documents>

<output_format>
Structure the review as a Markdown document with these sections, in this order:

1. **Verdict Summary** — 3–5 sentences: is "Proceed with Version 1" justified as written, conditionally justified, or premature? State the conditions if conditional.
2. **Findings by Dimension** — one subsection per the 8 dimensions above. Within each, a table or list of findings: `[Severity] [Section ref] Finding — Why it matters — Suggested fix`.
3. **Cross-Document Consistency Issues** — Playbook vs. Solution Design mismatches, if any.
4. **Full Risk Table Stress-Test** — annotate the existing Section 12 table plus any missing risks.
5. **Prioritized Action List** — grouped as: Must resolve before pilot / Must resolve before enterprise rollout / Should fix before scale-out / Polish.
6. **Everything Else Worth Flagging** — a catch-all so no finding gets dropped for the sake of a tidy structure above.

Do not compress this into a short executive summary in place of the full findings — completeness across every section matters more than brevity here.
</output_format>
