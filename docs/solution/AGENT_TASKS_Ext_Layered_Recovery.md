# AGENT TASKS — Layered Architecture Recovery

**Lane:** P2 · **Depends on:** Fact Semantics (T-FS-2) for the engine work only
**Governance/DoD:** `AGENT_TASKS_Semantic_Model_Extension.md`

The layered/multi-hop story — the problem that motivated the extension.
**All `[B]` tasks are existing, already-evidenced backlog items and are cheaper
than engine work. Do them first.**

| Task | Status | Depends on | Acceptance |
|---|---|---|---|
| **T-LR-1 `@Configuration` mis-typed `database`** `[B]` | **Done, and hardened for genericity** — `class-ownership-resolver.ts`'s new `classHasAnnotation`, wired into `graphify-import-strategy-detector.ts`, generic across every driver-import library. First pass hardcoded the annotation name (`'Configuration'`) as a string literal — a real overfit flagged on review: fixes must be catalogue-driven, not repo/framework-specific patches, to hold up across languages/frameworks. Refactored same-day: new `wiring-annotation-catalogue.yml` + `wiring-annotation-schema.ts`, `detectUnitsByImportStrategy` now takes a `wiringOnlyAnnotations: string[]` (data), never a hardcoded name — adding a new ecosystem's equivalent convention (a different DI framework's own factory-marker annotation) is a catalogue row, matching this codebase's existing `ownerBaseClass` precedent. Real Fineract evidence (`AccountingJournalEntryConfiguration`) + synthetic fixture (`configuration-wiring-sample`) both regression-locked; `npm test` 91/0/0, coe-lab core gates unchanged. Row removed from `BACKLOG.md` per its own update rule. | — | A wiring class referencing a driver-import only as a factory-method parameter type is no longer a table owner. Cheap, general, ready-to-implement |
| **T-LR-2 Direct-delegate bridge detection** `[B]` | **Done** — `multi-hop-bridge-detector.ts` gains an `r2c` branch inside the existing `implementers.length === 0` case: reuses `importsBySource` unchanged, no new interface layer, 2-hop bound unaffected (`OOS-unbounded-multihop`). New confidence tier (6/3), below R2b's (8/5) — no `implements`-edge corroboration exists for this shape. Real evidence: Fineract synthetic-shape confirmed + **Waltz 3-module scan resolves 7 real direct-delegate chains, 0 fabricated** (the exact gap `waltz-multihop-genericity-probe.md` named — 26 of its 28 real candidates were this shape). Surfaced two separate, real, out-of-scope findings while building: (1) a second independent instance of the JDBC read-service-vs-owner ambiguity (`LegalEntityRelationshipKindService`, cross-referenced into that BACKLOG row); (2) a pre-existing `ctx.unitsByRoot`/`ctx.allUnits` confidence-floor divergence that can under-grade (never fabricate) a real relationship — filed as its own new BACKLOG row. Synthetic fixture (`r2c-direct-delegate-sample`, positive + ambiguity-refusal cases) + real-repo test both regression-locked; `npm test` 93/0/0. Row removed from `BACKLOG.md`. | — | Concrete service referenced directly with no interface layer resolves. **28 real candidates already found, 0 resolved** — that's the measurable bar |
| **T-LR-3 Plain-interface bridge detection** `[B]` | **Unblocked** — DI-resolution experiment positive, `E1b-codeql-di-resolution-experiment.md`. Design not started. | T-LR-2 | Interfaces with no framework marker sitting on a real service boundary. Needs its own evidence pass before building |
| **T-LR-4 Bean-factory / stereotype-free wiring** `[B]` | **Unblocked** — same experiment covers this shape directly (`bean-factory` mechanism, 774 real bindings). Design not started. | T-LR-2 | Components wired via factory methods with no class-level stereotype produce signal |
| **T-LR-5 CodeQL engine, generic** | **Not started — 7-item checklist below, none done.** | T-P0-3 pass, `E1b-codeql-di-resolution-experiment.md` | Second `StructuralEngine`, one call site. Mechanism-class detector only — see expanded acceptance below |
| **T-LR-6 Per-(engine, fact-type) trust tiers** | T-LR-5 | Matrix becomes evidence-earned per fact type, not config-declared per framework |

**Prior evidence — read before starting T-LR-1:** `soln/bug3-jdbc-ownership-phase-a-memo.md`
already records a real evidence pass on this exact class, including signals
that were **falsified** as discriminators. Re-deriving it wastes a day and
risks re-adopting a signal already disproven.

**Status, 2026-08-13:** T-LR-1 and T-LR-2 done. The DI-resolution experiment
that was gating T-LR-3/T-LR-4 has now run — **positive**
(`docs/solution/E1b-codeql-di-resolution-experiment.md`): CodeQL resolves
both real evidenced DI-resolution gaps (plain-interface field injection via
stereotype; `@Bean`-factory wiring with no stereotype at all) at real
whole-codebase scale (2106 real bindings, 401 distinct interfaces, real
ambiguity found and correctly refused, not just the two flagship cases).
CodeQL's own built-in Spring model does not cover either shape (checked, not
assumed) — both needed hand-rolled queries. **T-LR-3/T-LR-4 are now
unblocked to be designed against this real evidence.** T-LR-5's own
expanded acceptance bar (generic detector, build-lifecycle handling,
CI/Docker impact, trust tier, second real-repo instance) is still the actual
gate for wiring CodeQL in as a live `StructuralEngine` — this experiment
cleared "does the capability exist," not "is it in production shape."
The JDBC ownership disambiguation experiment (`Engine_Capability_Research_Java_SpringBoot_JAXRS.md`
§6.2) remains untested, independent of this lane.

### T-LR-5 expanded acceptance — production integration, not an experiment repeat

T-P0-3 proved the *query*. This task wires it live, which is a different class
of work with its own failure modes:

1. **Detector stays generic** — `OOS-sample-repo-detectors` applies here at
   full force, not just in the experiment. No class/package name from any
   sample repo may appear in the detector logic.
2. **Build lifecycle handled explicitly** — DB creation failure (bad build,
   no network, timeout) degrades the same way `graphifyy`'s absence already
   does elsewhere in this pipeline: caught, logged as a warning, run
   continues without this engine's evidence. Never a hard crash.
3. **CI/Docker impact resolved, not deferred** — flagged in P0 §"Operational
   impact if an engine is adopted" and never closed out. Before this task is
   done: either `.github/workflows/pipeline-test.yml` installs the engine and
   handles build-mode's longer runtime, or tests using it skip gracefully on
   its absence, same pattern as the `graphifyy`-gated tests today. State which.
4. **Report names the claim triple it moves** — this engine is aimed at
   `R2-gold-charge-single` and/or `R2-multi-root-access-terminal`
   (`Claim_Register.md`). State explicitly which claim triple's status
   changed, or that neither did. **If `R2-gold-charge-single` moves from
   expected-fail to pass, the first question is whether a real one-hop chain
   was found or one was fabricated** — same standing caution as E2's landmine
   on `E-charge-single-L2`.
5. **Trust tier, not blind trust** — lands in the engine-capability-matrix
   per `T-LR-6`, at whatever tier its measured precision/recall earns. Not
   automatically primary over the existing structural pair.
6. **Second real-repo instance, per `Catalogue_Intake.md`'s bug-fix
   generalization rule** — both experiments so far (`E1-codeql-engine-evaluation.md`'s
   command-bus join, `E1b-codeql-di-resolution-experiment.md`'s DI
   resolution) are Fineract-only. `spikes/waltz/repo` is already present
   and already confirmed structurally different (real `@Autowired`
   constructor injection, not Lombok's implicit-constructor convention —
   see the earlier Waltz genericity probe) — the natural second instance,
   not a new clone to source. Required before either capability counts as
   a mechanism-class fix rather than a Fineract-instance patch, same bar
   T-LR-1/T-LR-2 were both held to.
7. **Scope decision: which capability ships first** — T-P0-3 (command-bus,
   7 real edges, one narrow shape) and T-LR-3/T-LR-4's DI-resolution
   experiment (2106 real edges, two shapes, materially stronger evidence)
   are two different capabilities CodeQL happens to provide. Wiring both
   into one `StructuralEngine` in one pass is real, avoidable scope
   creep — state explicitly which capability (or both, and why both
   together is still the smallest safe unit) this task ships, rather than
   silently expanding to cover everything CodeQL has been shown to do.

**Two landmines:**
- **JDBC ownership:** a fix may only change `kind` from `database` to
  `service` — **never suppress unit creation**, or it regresses the gold-scored
  multi-root access-terminal claim.
- **Hop bound stays at 2** (`OOS-unbounded-multihop`). Raising it needs a
  designed *and verified* ambiguity rule, not an assumption.
