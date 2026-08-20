# AGENT TASKS — Review Throughput

**Lane:** P4 · **Depends on:** Fact Semantics (T-FS-1) · Partially parallel
**Governance/DoD:** `AGENT_TASKS_Semantic_Model_Extension.md`
**Status (updated 2026-08-20):** T-RT-1, T-RT-2, and T-RT-4 done — see
`Claim_Register.md`'s `T-RT-1-bulk-residual-authoring`,
`T-RT-2-consequence-ranked-queue`, and `T-RT-4-reviewer-assistance-advisory`
rows for evidence and honest scope limits. T-RT-3 not started.

Human review is a permanent gate (`CON-30`), so its throughput is a real
scaling constraint — not a nice-to-have. An unbounded queue nobody services
turns the model back into the stale artifact it replaced.

| Task | Depends on | Acceptance |
|---|---|---|
| **T-RT-1 Bulk residual-decision authoring** `[B]` | T-FS-1 | **Done** — `tools/review-session/bulk_apply.py`. Answer once, apply to a class of similar residuals. **Already a P1 backlog item — tens of near-identical residuals from one module in a real dry run** |
| **T-RT-2 Consequence-ranked queue** | T-FS-6 | **Done** — `tools/review-session/consequence.py` + `queue_rank.py`. Highest-consequence first: PII-touching, external-system identity, trust-boundary edges. Backlog size and age queryable |
| **T-RT-3 Call-site security controls** `[B]` | — | Beyond the 4 named vocabularies. Not unbounded call-graph auth inference — extend the vocabulary set with evidence |
| **T-RT-4 Reviewer assistance (advisory)** | T-RT-1, T-RT-2 | **Done** — `tools/review-session/advisory.py`. Explains evidence, proposes hypotheses for flagged unknowns, drafts catalogue-rule candidates. **Never writes a fact.** Candidates surface only in the review queue; on acceptance recorded as the human's claim. Records model/version + input context; logs each episode as a candidate for a deterministic rule |

**Hard boundary:** `OOS-llm-core-path` has revisit trigger "Never". Nothing in
this lane may enter `run-slice`'s call graph. A reviewer accepting a
hypothesis is **one** human judgement, not two independent signals — it never
satisfies corroboration for a hard-gated fact.
