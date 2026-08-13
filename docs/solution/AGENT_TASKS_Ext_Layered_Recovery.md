# AGENT TASKS — Layered Architecture Recovery

**Lane:** P2 · **Depends on:** Fact Semantics (T-FS-2) for the engine work only
**Governance/DoD:** `AGENT_TASKS_Semantic_Model_Extension.md`

The layered/multi-hop story — the problem that motivated the extension.
**All `[B]` tasks are existing, already-evidenced backlog items and are cheaper
than engine work. Do them first.**

| Task | Depends on | Acceptance |
|---|---|---|
| **T-LR-1 `@Configuration` mis-typed `database`** `[B]` | — | A wiring class referencing a driver-import only as a factory-method parameter type is no longer a table owner. Cheap, general, ready-to-implement |
| **T-LR-2 Direct-delegate bridge detection** `[B]` | — | Concrete service referenced directly with no interface layer resolves. **28 real candidates already found, 0 resolved** — that's the measurable bar |
| **T-LR-3 Plain-interface bridge detection** `[B]` | T-LR-2 | Interfaces with no framework marker sitting on a real service boundary. Needs its own evidence pass before building |
| **T-LR-4 Bean-factory / stereotype-free wiring** `[B]` | T-LR-2 | Components wired via factory methods with no class-level stereotype produce signal |
| **T-LR-5 CodeQL engine, generic** | T-P0-3 pass | Second `StructuralEngine`, one call site. Mechanism-class detector only — see expanded acceptance below |
| **T-LR-6 Per-(engine, fact-type) trust tiers** | T-LR-5 | Matrix becomes evidence-earned per fact type, not config-declared per framework |

**Prior evidence — read before starting T-LR-1:** `soln/bug3-jdbc-ownership-phase-a-memo.md`
already records a real evidence pass on this exact class, including signals
that were **falsified** as discriminators. Re-deriving it wastes a day and
risks re-adopting a signal already disproven.

**Status, 2026-08-13:** T-LR-1 starting now. T-LR-2 next (already scoped in
detail this session — no new evidence pass needed). T-LR-5's dependency
(T-P0-3 pass) is now satisfied, but deliberately not started yet:
`docs/solution/Engine_Capability_Research_Java_SpringBoot_JAXRS.md` §6
recommends two more targeted CodeQL experiments (DI/bean-graph resolution —
directly relevant to T-LR-3/T-LR-4 below — and JDBC ownership
disambiguation) before committing to T-LR-5's integration shape, since T-LR-5
is real production integration work, not an experiment repeat, and the
research doc's own evidence so far leans toward a corroboration/trust-tier
role for CodeQL rather than "second `StructuralEngine`." T-LR-3/T-LR-4 are
similarly held pending that DI-resolution experiment — see `BACKLOG.md`'s
rows for both, updated the same day with this cross-reference.

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

**Two landmines:**
- **JDBC ownership:** a fix may only change `kind` from `database` to
  `service` — **never suppress unit creation**, or it regresses the gold-scored
  multi-root access-terminal claim.
- **Hop bound stays at 2** (`OOS-unbounded-multihop`). Raising it needs a
  designed *and verified* ambiguity rule, not an assumption.
