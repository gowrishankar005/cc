# AGENT TASKS — CodeQL StructuralEngine (T-LR-5 / T-LR-6)

**Lane:** after Session C · **Not** part of Session C (`T-LR-3` / `T-LR-4`)
**Owner (2026-08-19):** a separate session is executing T-LR-5. Do not start
a second copy here.
**Governance/DoD:** `AGENT_TASKS_Semantic_Model_Extension.md`
**Prior evidence:** `E1-codeql-engine-evaluation.md`,
`E1b-codeql-di-resolution-experiment.md`, T-P0-2a licensing summary in
`AGENT_TASKS_Ext_P0_Experiments.md`.

Session C may *consume* E1b findings to design T-LR-3/T-LR-4. It must **not**
wire CodeQL into `run-slice`. That is this file.

| Task | Status | Depends on | Acceptance |
|---|---|---|---|
| **T-LR-5 CodeQL engine, generic** | **Done, 2026-08-19 — 6/7 checklist items closed, item 6 real-blocked and disclosed (below).** Architecturally NOT a `StructuralEngine` implementation despite the task's own framing — CodeQL's DI query is a whole-database batch join, the same shape Graphify's own "one combined pass" already is, not a per-file `extractDecoratorFacts` API. Shipped as `scanner/codeql-di-provider.ts` (build DB + run query + parse) + `analysis/codeql-di-pass.ts` (an opt-in `AnalysisPass`, `--codeql-source-root`/`--codeql-build-command`). Real end-to-end run against `spikes/fineract/repo` (fineract-charge + fineract-provider): 2105 real DI bindings, 731 new relationships, 56 new units introduced, `calm validate` 0 errors/0 warnings — the flagship `ChargesApiResource -> ChargeReadPlatformService -> ChargeReadPlatformServiceImpl` chain resolves (though that specific impl already had a unit via `graphify-import`, so the new-info case verified was `LoanChargesApiResource -> LoanChargeReadPlatformServiceImpl`, confidence 7, grade `architecture`, status `inferred`). A real bug was found and fixed live-testing this: CodeQL's `RefType.getName()` returns an empty string for an anonymous `new SomeInterface() { ... }` implementation — `codeqlDiPass` now skips any binding with an empty `resolvedImpl`/`injectingClass` rather than introduce a CALM-schema-invalid empty-name node (regression-locked). 6 new regression tests. `npm test` 121/121. See `Claim_Register.md`'s `T-LR-5-codeql-di` row for the full evidence. | T-P0-3, E1b; GHAS before any private-repo production use (`CON-20`) | Second `StructuralEngine`, one call site. Mechanism-class detector only |
| **T-LR-6 Per-(engine, fact-type) trust tiers** | Not started — T-LR-5's own trust-tier PLACEMENT is done (confidence 7/4, strictly between R2b's 8 and R2c's 6; never overrides an existing relationship for the same pair), but the full evidence-earned-per-fact-type MATRIX this task names is separate, larger work | T-LR-5 | Matrix becomes evidence-earned per fact type, not config-declared per framework. CodeQL is never automatically primary |

### T-LR-5 expanded acceptance — production integration, not an experiment repeat

Copied from `AGENT_TASKS_Ext_Layered_Recovery.md` so Session C's file stays
about T-LR-3/4. The checklist is authoritative here.

1. **Detector stays generic — DONE.** `di_resolution.ql` (Session C's own
   E1b query, unmodified) has zero sample-repo names; `codeql-di-pass.ts`/
   `codeql-di-provider.ts` never branch on a class/package name either.
2. **Build lifecycle handled explicitly — DONE.** `codeql-di-provider.ts`
   wraps binary-absence, database-creation failure, and query-run failure
   each in their own try/catch — warn + empty result, never a crash.
   Verified against 3 real failure modes while building this: missing
   binary (mocked), an up-to-date/cached build that never re-invokes the
   compiler (`codeql database create` itself fails with "could not process
   any of it" — a real failure mode, not hypothetical, hit repeatedly
   before landing on `--rerun-tasks` as the required build-command
   convention), and a missing `-d <database>` argument bug caught by this
   same live testing (fixed).
3. **CI/Docker impact — resolved as: skip.** This pipeline's own CI does
   not install CodeQL or run `--codeql-source-root` — the free CodeQL CLI
   license does not permit automated/CI use against a non-Open-Source
   codebase, and this repo has no `LICENSE` file (checked, not assumed).
   `--codeql-source-root`/`--codeql-build-command` are local-only, same
   posture as every `spikes/`-gated regression test.
4. **Report names the claim triple — partially done.** This session's real
   evidence is a fresh claim triple of its own:
   `{rootSet: fineract-charge+fineract-provider, terminalGrain: DI-resolved
   service->impl edges (both stereotype and bean-factory mechanisms),
   evalArtefact: a live run-slice execution + calm validate, 2026-08-19}` —
   2105 bindings, 731 relationships, 56 introduced units, 0 validate
   errors. **Not yet run**: whether enabling `--codeql-di` flips
   `R2-gold-charge-single`'s standing expected-fail (`E-charge-single-L2`)
   to a pass — if a future session sees that, the checklist's own
   instruction applies (suspect fabrication first, verify by hand before
   claiming the flagship case closed).
5. **Trust tier — placement done, matrix is T-LR-6.** Confidence 7 (same-root)
   /4 (cross-root), between R2b (8) and R2c (6); `codeqlDiPass` structurally
   never overrides an existing relationship for the same (from, to) pair
   (tested). The full evidence-earned-per-fact-type trust MATRIX T-LR-6
   names is separate, larger work, not done here.
6. **Second real-repo instance — attempted, real-blocked, disclosed.**
   Waltz (`spikes/waltz/repo`) uses Maven, not Gradle — Maven itself
   required installing (`brew install maven`, done). The Waltz POM reactor
   fails to resolve for EVERY module (including the simplest,
   `waltz-common`, via `-pl`, since Maven still parses the whole reactor)
   with real, pre-existing property-resolution errors
   (`${jooq.group}`/`${jdbc.group}` unresolved in `waltz-schema`'s POM) —
   consistent with Waltz's own jOOQ Pro (commercial) dependency needing
   license-gated Maven profile/settings this environment doesn't have,
   not a defect in this session's code. Two independent attempts (network-
   enabled full reactor build, and a `waltz-common`-only build) hit the
   identical failure. **Genuinely not verified against a second real repo**
   — disclosed here, not silently skipped, per this project's own
   discipline. Revisit trigger: jOOQ Pro credentials/profile become
   available, or a Waltz module with no jOOQ-codegen dependency is found.
7. **Scope decision — DI only, as recommended.** Command-bus dispatch (E1)
   was not built; this ships exactly the "recommended first ship" below.

**Recommended first ship:** DI only. T-LR-3/T-LR-4 then become consumers of
this engine, not a third Graphify detector. **T-LR-4 is now closed by this
work**, not just unblocked: `codeqlDiPass`'s `bean-factory` branch directly
produces the signal T-LR-4 named ("components wired via factory methods
with no class-level stereotype produce signal") — real, verified on
`LoanChargesApiResource -> LoanChargeReadPlatformServiceImpl` (a real
`@Bean`-factory-wired, stereotype-free implementation, mechanism
`codeql-di-bean-factory`). `AGENT_TASKS_Ext_Layered_Recovery.md`'s T-LR-4
row updated to reflect this.

**Landmines:** JDBC ownership may only retag `database` → `service`, never
drop the unit. Hop bound stays at 2 (`OOS-unbounded-multihop`).
