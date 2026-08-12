# AGENT TASKS — P0: Experiments (the gate)

**Lane:** P0 · **Blocks:** every other extension lane except Lenses
**Governance, gates, isolation, DoD:** `AGENT_TASKS_Semantic_Model_Extension.md` — read first.

Nothing in P1+ is committed until E2 and E1 report. **Both failing is a valid,
cheap outcome** that shrinks the extension to lenses + governance; report it as
a result, not a setback.

| Task | Depends on | Parallel? | Acceptance |
|---|---|---|---|
| **T-P0-0 Baseline** | — | — | `npm test` 64/0/25 + scoreboard committed as `baseline-<date>.md`. Nothing else starts first |
| **T-P0-1 E2 fact admission** | T-P0-0 | Yes (with T-P0-2) | Recall ↑ at L2 measured; **must-not-detect trap holds**; R1 lock intact; `E-charge-single-L2` still fails *for the right reason* (no fabricated edge); false-positive cost stated as a number |
| **T-P0-2a Engine licensing check** `CON-20` | — | Yes | **Do this before T-P0-2 spends effort.** Confirm the engine's licence permits use against private/commercial source at the target's scale. Free for public/OSS repos does not imply free for an enterprise monorepo. A licence blocker here invalidates the whole E1 lane — cheapest possible thing to check first |
| **T-P0-2 E1 prerequisites** | T-P0-2a | Yes | CodeQL CLI installed and verified; sample cloned to `spikes/` (never committed); `graphifyy` on PATH; **Java build of the sample succeeds** (`CON-10` — the step that blocked prior attempts) |
| **T-P0-3 E1 engine evaluation** | T-P0-2 | No | Reproduces the hand-verified dispatch join on a real database **and** the detector is generic — no sample-repo class/package names (`OOS-sample-repo-detectors`). This fires `OOS-command-bus`'s revisit trigger; report in its terms |
| **T-P0-4 E3 buildless/AST engine** | T-P0-0 | Yes | Detects routes current engines miss, at a trust tier **below** semantic engines |
| **T-P0-5 E4 catalogue-as-data stress** | T-P0-0 | Yes | One untested framework added via catalogue row only. **Passes only with zero builder code changes** |
| **T-P0-6 E5 confidence replay** | T-P0-0 | Yes | ≥1 fact changes status in a way a reviewer agrees is more correct. **If nothing changes, deprioritise the confidence work** |

**Report format:** every experiment result names the claim triple
`{rootSet, terminalGrain, evalArtefact}` and obeys the forbidden-phrase table.

## Operational impact if an engine is adopted (scope before productionising)

Adding a structural engine is not only a code change:

| Surface | Impact |
|---|---|
| `.github/workflows/pipeline-test.yml` | CI needs the engine installed, or tests that use it must skip gracefully — follow the existing precedent where a missing optional dependency degrades with a warning rather than failing the run |
| `pipeline/Dockerfile` | Image needs the engine, or must document it as an external prerequisite |
| Build time | Build-mode analysis needs a compiling target repo; CI cost is materially different from the current buildless path |
