# AGENT TASKS — Fact Semantics

**Lane:** P1 · **Depends on:** T-P0-1 (E2), T-P0-6 (E5)
**Governance/DoD:** `AGENT_TASKS_Semantic_Model_Extension.md`

The core of the extension: what counts as a fact, how confident we are, and
how disagreement is handled.

| Task | Depends on | Acceptance |
|---|---|---|
| **T-FS-1 Tier-B residual class** | — | A detector emits a "medium-confidence, needs a human decision" class the review tooling can act on. *Already a P1 backlog item here; converges with the extension's status vocabulary* |
| **T-FS-2 Graded fact admission** | T-P0-1 pass | Productionise E2. Trap holds, R1 lock intact, no fabricated edges |
| **T-FS-3 Contradiction detection** | — | Conflicting assertions on one fact force review status; never averaged. Regression test uses a real stale-manifest-vs-config case |
| **T-FS-4 Secondary-source fact introduction** | T-FS-2 | A non-primary source can introduce a fact at its own tier without being promoted |
| **T-FS-5 Probabilistic confidence** | T-P0-6 pass | Replaces additive weights. **Skip if E5 showed no decision changes** |
| **T-FS-6 Status vocabulary** | T-FS-1 | Review-state semantics alongside existing grades/bands. Hard rule: an external-system node never auto-promotes on code evidence alone |

**Watch:** admitting more facts is the change most likely to break the
must-not-detect trap. If the trap breaks, tighten admission criteria — never
relax the trap.
