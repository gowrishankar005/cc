# AGENT TASKS — CodeQL StructuralEngine (T-LR-5 / T-LR-6)

**Lane:** after Session C · **Not** part of Session C (`T-LR-3` / `T-LR-4`)
**Governance/DoD:** `AGENT_TASKS_Semantic_Model_Extension.md`
**Prior evidence:** `E1-codeql-engine-evaluation.md`,
`E1b-codeql-di-resolution-experiment.md`, T-P0-2a licensing summary in
`AGENT_TASKS_Ext_P0_Experiments.md`.

Session C may *consume* E1b findings to design T-LR-3/T-LR-4. It must **not**
wire CodeQL into `run-slice`. That is this file.

| Task | Status | Depends on | Acceptance |
|---|---|---|---|
| **T-LR-5 CodeQL engine, generic** | **Not started — 7-item checklist below, none done.** | T-P0-3, E1b; GHAS before any private-repo production use (`CON-20`) | Second `StructuralEngine`, one call site. Mechanism-class detector only |
| **T-LR-6 Per-(engine, fact-type) trust tiers** | Not started | T-LR-5 | Matrix becomes evidence-earned per fact type, not config-declared per framework. CodeQL is never automatically primary |

### T-LR-5 expanded acceptance — production integration, not an experiment repeat

Copied from `AGENT_TASKS_Ext_Layered_Recovery.md` so Session C's file stays
about T-LR-3/4. The checklist is authoritative here.

1. **Detector stays generic** — `OOS-sample-repo-detectors` at full force.
   No sample-repo class/package name in detector logic.
2. **Build lifecycle handled explicitly** — DB creation failure degrades like
   missing `graphifyy`: warn, continue, never crash (`CON-10`).
3. **CI/Docker impact resolved, not deferred** — install in
   `.github/workflows/pipeline-test.yml` **or** skip tests when the engine is
   absent. State which.
4. **Report names the claim triple it moves** —
   `R2-gold-charge-single` and/or `R2-multi-root-access-terminal`. If
   `R2-gold-charge-single` becomes a pass, ask first whether an edge was
   fabricated (`E-charge-single-L2`).
5. **Trust tier, not blind trust** — via T-LR-6. Not automatically primary.
6. **Second real-repo instance** — Waltz (`spikes/waltz/repo`), structurally
   different DI convention, before either capability counts as a
   mechanism-class fix (`Catalogue_Intake.md`).
7. **Scope decision first** — ship **DI resolution** (E1b, 2106 bindings)
   before command-bus (E1, 7 edges), unless a written note says why both
   together is still the smallest safe unit.

**Recommended first ship:** DI only. T-LR-3/T-LR-4 then become consumers of
this engine, not a third Graphify detector.

**Landmines:** JDBC ownership may only retag `database` → `service`, never
drop the unit. Hop bound stays at 2 (`OOS-unbounded-multihop`).
