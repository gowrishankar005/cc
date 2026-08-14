# AGENT TASKS — P0: Experiments (the gate)

**Lane:** P0 · **Blocks:** every other extension lane except Lenses
**Governance, gates, isolation, DoD:** `AGENT_TASKS_Semantic_Model_Extension.md` — read first.

Nothing in P1+ is committed until E2 and E1 report. **Both failing is a valid,
cheap outcome** that shrinks the extension to lenses + governance; report it as
a result, not a setback.

**Status update, 2026-08-14:** E1 and E2 have both reported — the gate
condition in the sentence above is satisfied. E1 reported positive
(`T-P0-3`). E2 reported negative-with-a-clear-path twice
(`T-P0-1` — safe-but-unproven round 1, real-conflicts round 2), then a third
round designed and built the actual fixes for round 2's three named
conflicts and **shipped** (93/93 `npm test`, 0 skip, every populated
`spikes/` repo). E3/E4/E5 are still outstanding; nothing in P1+ beyond E2 has
started. Per this file's own framing, E2 alone reporting negative would
already have been a valid basis to proceed past the gate — it did, twice —
and the extension proceeded to `AGENT_TASKS_Ext_Layered_Recovery.md`'s
`[B]`-marked tasks in the meantime, not blocked on E3/E4/E5.

| Task | Status | Depends on | Parallel? | Acceptance |
|---|---|---|---|---|
| **T-P0-0 Baseline** | **Done** — `baseline-2026-08-13.md` | — | — | `npm test` 64/0/25 + scoreboard committed as `baseline-<date>.md`. Nothing else starts first |
| **T-P0-1 E2 fact admission** | **Done, shipped 2026-08-14 (round 3)** — `E2-graded-fact-admission-experiment.md` | T-P0-0 | Yes (with T-P0-2) | Recall ↑ at L2 measured (yes — real facts recovered against Fineract/Ghostfolio); **must-not-detect trap holds**; R1 lock intact; `E-charge-single-L2` still fails *for the right reason* (no fabricated edge); false-positive cost stated as a number (0, full suite green) |
| **T-P0-2a Engine licensing check** `CON-20` | **Done** — resolved for OSS eval + confirmed enterprise procurement path, `soln/codeql-licensing-check-memo.md` | — | Yes | **Do this before T-P0-2 spends effort.** Confirm the engine's licence permits use against private/commercial source at the target's scale. Free for public/OSS repos does not imply free for an enterprise monorepo. A licence blocker here invalidates the whole E1 lane — cheapest possible thing to check first |
| **T-P0-2 E1 prerequisites** | **Done** — CodeQL 2.26.3, `spikes/` populated, CON-10 resolved | T-P0-2a | Yes | CodeQL CLI installed and verified; sample cloned to `spikes/` (never committed); `graphifyy` on PATH; **Java build of the sample succeeds** (`CON-10` — the step that blocked prior attempts) |
| **T-P0-3 E1 engine evaluation** | **Done, positive** — `E1-codeql-engine-evaluation.md`, 7/7 real edges, 0 false positives, fully generic | T-P0-2 | No | Reproduces the hand-verified dispatch join on a real database **and** the detector is generic — no sample-repo class/package names (`OOS-sample-repo-detectors`). This fires `OOS-command-bus`'s revisit trigger; report in its terms |
| **T-P0-4 E3 buildless/AST engine** | **Not started** | T-P0-0 | Yes | Detects routes current engines miss, at a trust tier **below** semantic engines |
| **T-P0-5 E4 catalogue-as-data stress** | **Not started** | T-P0-0 | Yes | One untested framework added via catalogue row only. **Passes only with zero builder code changes** |
| **T-P0-6 E5 confidence replay** | **Not started** | T-P0-0 | Yes | ≥1 fact changes status in a way a reviewer agrees is more correct. **If nothing changes, deprioritise the confidence work** |

**Report format:** every experiment result names the claim triple
`{rootSet, terminalGrain, evalArtefact}` and obeys the forbidden-phrase table.

## Operational impact if an engine is adopted (scope before productionising)

Adding a structural engine is not only a code change:

| Surface | Impact |
|---|---|
| `.github/workflows/pipeline-test.yml` | CI needs the engine installed, or tests that use it must skip gracefully — follow the existing precedent where a missing optional dependency degrades with a warning rather than failing the run |
| `pipeline/Dockerfile` | Image needs the engine, or must document it as an external prerequisite |
| Build time | Build-mode analysis needs a compiling target repo; CI cost is materially different from the current buildless path |
