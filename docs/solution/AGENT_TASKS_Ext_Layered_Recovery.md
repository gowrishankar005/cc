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
| **T-LR-5 CodeQL engine, generic** | T-P0-3 pass | Second `StructuralEngine`, one call site. Mechanism-class detector only |
| **T-LR-6 Per-(engine, fact-type) trust tiers** | T-LR-5 | Matrix becomes evidence-earned per fact type, not config-declared per framework |

**Two landmines:**
- **JDBC ownership:** a fix may only change `kind` from `database` to
  `service` — **never suppress unit creation**, or it regresses the gold-scored
  multi-root access-terminal claim.
- **Hop bound stays at 2** (`OOS-unbounded-multihop`). Raising it needs a
  designed *and verified* ambiguity rule, not an assumption.
