# AGENT TASKS — Fact Semantics

**Lane:** P1 · **Depends on:** T-P0-1 (E2), T-P0-6 (E5)
**Governance/DoD:** `AGENT_TASKS_Semantic_Model_Extension.md`

The core of the extension: what counts as a fact, how confident we are, and
how disagreement is handled.

| Task | Status | Depends on | Acceptance |
|---|---|---|---|
| **T-FS-1 Tier-B residual class** | **Done** — `multi-hop-bridge-detector.ts`'s `tier-b-single-candidate` ignored-item + `hitl-review-trigger.ts`'s `multi-hop-single-candidate-below-threshold` trigger + `tools/review-session/triage.py`'s new Tier B mapping + `cards.py`'s accept/reject template. See `Claim_Register.md`'s `T-FS-1-tier-b-residual` row for the claim triple and honest evidence limit (synthetic fixture only, no real `spikes/` instance found yet). | — | A detector emits a "medium-confidence, needs a human decision" class the review tooling can act on. *Already a P1 backlog item here; converges with the extension's status vocabulary* |
| **T-FS-2 Graded fact admission** | **Done** — E2 shipped live in `DEFAULT_PASSES` (round 3, 2026-08-14, `E2-graded-fact-admission-experiment.md`). No separate productionise step remains. | T-P0-1 pass | Productionise E2. Trap holds, R1 lock intact, no fabricated edges |
| **T-FS-3 Contradiction detection** | **Done** — `contradiction-detector.ts` + `contradiction-pass.ts` (opt-in, `--k8s-manifests`) + `hitl-review-trigger.ts`'s `contradicting-evidence-force-review` trigger + `triage.py`'s Tier A `contradicting-evidence` mapping + `cards.py`'s trust-config/trust-manifest choice card. See `Claim_Register.md`'s `T-FS-3-contradiction-detection` row — synthetic-fixture-evidenced only, scope is Java/Spring-config-only (`scope-limitations.yml`). | — | Conflicting assertions on one fact force review status; never averaged. Regression test uses a real stale-manifest-vs-config case |
| **T-FS-4 Secondary-source fact introduction** | Not started | T-FS-2 | A non-primary source can introduce a fact at its own tier without being promoted |
| **T-FS-5 Probabilistic confidence** | **Skipped (E5 negative, 2026-08-14)** — `E5-confidence-replay-experiment.md`. 22 of 617 units change band under probabilistic-OR, all reviewed as less correct. Do not replace additive weights on the current evidence shape. Reopen only if a real independent-evidence shape changes a decision the other way. | T-P0-6 pass | Replaces additive weights. **Skip if E5 showed no decision changes** — E5 showed changes, in the wrong direction; same skip |
| **T-FS-6 Status vocabulary** | Not started | T-FS-1 | Review-state semantics alongside existing grades/bands. Hard rule: an external-system node never auto-promotes on code evidence alone |

**Watch:** admitting more facts is the change most likely to break the
must-not-detect trap. If the trap breaks, tighten admission criteria — never
relax the trap.
