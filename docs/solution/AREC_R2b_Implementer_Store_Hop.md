# AREC R2b — Implementer→Store Hop (design addendum to AREC_R2_MultiHop_Strategy.md)

**Status:** T-R1-1 (Weaver Robustness Phase R1) — design addendum, complete. Implementation is T-R1-2, not started by this document.
**Depends on:** [`AREC_R2_MultiHop_Strategy.md`](./AREC_R2_MultiHop_Strategy.md) (Phase 1, shipped T-C1), `Claim_Register.md` (R2 row), `BACKLOG.md` (`B-R2b`).
**Backlog ID:** `B-R2b`.

## 0. Why this document exists

`B-R2b`'s own one-line description (`BACKLOG.md`) is: *"sole implementer → imported DB/topic unit (impl need not be the entity)."* Phase 1's real limitation, confirmed in code (`multi-hop-bridge-detector.ts:106`): once a bridge interface resolves to exactly one implementer, that implementer must **itself already be** a `database`/`topic` `TypedUnit` — checked with a hard `kind !== 'database' && kind !== 'topic'` gate. If the implementer is a plain class that only *imports* the real entity/repository (rather than being one), Phase 1 gives up and emits an honest `CROSS_DOMAIN_UNRESOLVED` ignored-item. This is the design's own §2.2 second bullet ("If the implementing class ITSELF is not a unit... the search continues one more hop") — specified in prose, never implemented in code. This addendum makes that one extra hop precise enough to build, and — per this project's "Think Before Coding" principle — states plainly what it will and will not close on the real evidence repo before anyone writes it.

## 1. Real evidence re-verified this session (2026-08-07, not recalled from the earlier spike)

Re-checked directly against `spikes/fineract/repo` (real Fineract clone already present, not re-cloned):

- **`fineract-provider` genuinely exists locally** (`spikes/fineract/repo/fineract-provider`, 2733 real `.java` files) — the module the original R2 design doc named as "out of single-root scope" for `fineract-charge` alone. A real multi-root remeasure (`fineract-charge` + `fineract-provider`) is actually runnable in this environment, not just theoretically possible.
- **`ChargeReadPlatformServiceImpl.java`** (the bridge's real read-path implementer, confirmed via `grep -rl "class ChargeReadPlatformServiceImpl"`) imports `java.sql.ResultSet`/`SQLException`, `JdbcSupport`, `ChargeData`/`ChargeAppliesTo`/`ChargeTimeType`/`ChargeNotFoundException`, and `org.springframework.jdbc.core.{JdbcTemplate,RowMapper,NamedParameterJdbcTemplate}`. **It does NOT import `Charge` (the `@Entity`) or `ChargeRepository` anywhere** — confirmed by grepping its own import block for `charge` and finding no entity/repository line. This is the exact raw-JDBC/RowMapper shape the original spike named ("only a SQL table name as a string literal"), re-confirmed by direct import-list inspection, not assumed.
- **`ChargeWritePlatformServiceJpaRepositoryImpl.java`** (a *different* bridge, `ChargeWritePlatformService`, confirmed via `implements ChargeWritePlatformService` at line 60) **does** import `Charge` and `ChargeRepository` directly — this is exactly the "implementer imports the store, isn't the store itself" shape `B-R2b` targets. But per the original design doc §1 (already-established, re-confirmed not re-litigated here): `ChargesApiResource`'s write path never statically references this class at all — it goes through `PortfolioCommandSourceWritePlatformService`, resolved at runtime by a string command-name key. There is no `imports`/`references` edge for R2b to even start walking. This remains named non-goal (§2.4, unchanged).

**Conclusion, stated before any code is written**: R2b's mechanism is real and worth building — it generalizes to any codebase where a plain implementer class imports its store directly and is *statically reachable* (many real layered-Java shapes are exactly this; Fineract's own write side would be, if not for the command bus). **But on `fineract-charge`+`fineract-provider` specifically, R2b will most likely NOT close the flagship residual**: the read path's implementer never imports the entity at all (nothing to chase to), and the write path's implementer is never statically referenced at all (nothing to chase from). `T-R1-2`'s multi-root remeasure step should be run and its actual result reported honestly — the prediction here is that it stays a residual, not that it must be forced closed. If a future Spring JDBC driver-import catalogue row is added (`org.springframework.jdbc.core`) and Java's symbol-vs-package Graphify gap (`T-R1-3`/`B-java-driver-ref`) is fixed, `ChargeReadPlatformServiceImpl` could become its own `database` unit directly via the *existing* driver-import strategy — a different, independent path to closure than R2b's hop, out of this addendum's scope, named here only so it isn't lost.

## 2. Mechanism (generic — structural test, not a name/suffix list)

Same source/bridge discovery as Phase 1 (§2.1–§2.2 of the parent doc, unchanged). New step, only reached when Phase 1's existing check (`implMatch.unit.kind === 'database' | 'topic'`) fails:

1. Look up the implementer node's own outgoing `imports`/`references` edges (Graphify's relation vocabulary — confirmed generic across languages, `scanner/graphify-provider.ts`'s documented edge-kind set: `imports, references, inherits, calls, case_of, implements, ...`, not Java-specific).
2. Filter those edges' targets to ones that are **already** a `database`/`topic` `TypedUnit` (`nodeToUnit` lookup — no new detection mechanism, reuses whatever Phase 1/persistence-detector/spring-data-repository/etc. already produced).
3. **Exactly one** match → emit the architecture relationship from the *original* source service unit to that store unit (not to the implementer — the implementer is plumbing, same as the bridge interface itself; §2.6's "no unit for pure plumbing" spirit extends to this hop too).
4. **Zero or 2+** matches → do not guess. Emit `CROSS_DOMAIN_UNRESOLVED` with a `unresolved-multi-hop` detail naming the implementer and match count, same convention as Phase 1.
5. **Hop bound stays exactly 2 bridge hops total** (service → bridge interface → implementer → store), matching the parent doc's §2.4.2 — this is one *filter* added at the existing second hop, not a new third hop. No recursion beyond this depth (an implementer's implementer is never chased).

### 2.1 Confidence tier (new, below both existing R2 tiers)

| Tier | Existing/new | Value | Reasoning |
|---|---|---|---|
| R1 same-package (existing) | existing | evidence-weight model | direct import, no inference |
| R2 same-root, impl **is** the unit (Phase 1) | existing | 15 | one inference layer (bridge resolution) |
| R2 cross-root, impl **is** the unit (Phase 1) | existing | 10 | bridge resolution + root-boundary claim |
| **R2b same-root, impl imports the unit** | **new** | **8** | two inference layers (bridge resolution + implementer-import chase) — must sit below both Phase-1 tiers per the parent doc's "never look more certain than a shallower inference" rule |
| **R2b cross-root, impl imports the unit** | **new** | **5** | deepest, most-inferred case this pipeline produces; floor value, reviewable like every other confidence weight in this project (draft, not physics) |

These four numbers are a proposal, not a locked constant — flag for review the same way the original confidence-scoring weights (`Gap_Closure_Build_Ready_Specs_v0.1.md §7`) were always framed as a starting point.

### 2.2 Relationship shape

Same `kind: 'calls'`, same `grade: 'architecture'` as Phase 1 (§2.3 of the parent doc — R2b is a new *production mechanism* for the same grade, not a new grade). Add `x-aac-relationship-grade`/description text distinguishing "via bridge+implementer-import" from Phase 1's "via bridge, implementer is the store" so a reader of `coverage-report.json`'s `relationshipsByKind`/`relationshipsBySource` breakdown (already generic, no code change needed there) can tell the two R2 mechanisms apart from the `x-aac-confidence` value alone if needed — no new top-level field required.

## 3. Cross-language applicability (stated honestly, not assumed)

- **Java, TypeScript**: `implements` is a real Graphify-captured relation for both (`class X implements InterfaceY`) — the bridge-discovery half of R2/R2b applies unchanged.
- **Python**: Python has no structural `implements` keyword (duck typing / optional ABC `abstractmethod`, rarely declared the same way). **R2/R2b's bridge-resolution mechanism is honestly inapplicable to Python-shaped interfaces today** — not a bug, a real gap in the mechanism's reach, worth naming in `scope-limitations.yml` if not already covered by the existing "multi-hop/layered architecture story not yet recovered" language in S1's flag text. Confirm during T-R1-2 whether this needs an explicit new line or whether S1's existing wording already covers it honestly.

## 4. Fixture plan (T-R1-2)

Current `test/fixtures/r2-bridge-sample` uses the **entity itself as the sole implementer** (`WidgetReadServiceImpl` presumably annotated `@Entity` or otherwise already a unit) — this is Phase 1's shape, not R2b's. A **new**, separate fixture (`test/fixtures/r2b-implementer-hop-sample/`, do not overwrite the existing one — Phase 1's regression lock must stay green) needs:

- `WidgetApiResource` (or similarly invented, non-Fineract name — matches this project's existing fixture-naming convention) — `service` unit, HTTP route, imports a bridge interface `WidgetReadService`.
- `WidgetReadService` — bare interface, zero evidence, zero `TypedUnit` (the bridge, same as Phase 1's fixture).
- `WidgetReadServiceImpl` — **plain class**, `implements WidgetReadService`, has **no** persistence/messaging evidence of its own (no `@Entity`, no driver import) — it only imports `WidgetEntity`.
- `WidgetEntity` — real `@Entity`/driver-import unit (whichever mechanism is simplest to fixture — an `@Entity` decorator matches the existing catalogue with no new rows needed).

Expected result: one `TypedRelationship`, `WidgetApiResource → WidgetEntity`, `kind: calls`, `confidence: 8` (§2.1), grade `architecture`. `WidgetReadServiceImpl` (the implementer) must **not** become a CALM node any more than `WidgetReadService` does (§2.6 extends).

A second fixture case (or a second unit inside the same fixture) should prove the **ambiguity path still refuses to guess**: an implementer importing 2+ store units → `CROSS_DOMAIN_UNRESOLVED`, zero relationships — mirrors Phase 1's own "never guess" regression test.

## 5. Execution plan for the implementing agent (phases, each with its own verify step)

Following this project's Goal-Driven Execution principle — state the verify step before writing code, not after.

### Step 1 — Lock this design (T-R1-1)
**Done by this document.** No code changes. Verify: this file exists, cites real re-checked evidence (§1), and states the Fineract-closure prediction plainly (done above) — reviewed by the user before Step 2 starts.

### Step 2 — Implement the hop (T-R1-2, code)
Extend `pipeline/src/analysis/cross_package/multi-hop-bridge-detector.ts` only:
- Build a `importsBySource` index (mirror the existing `implementersByTarget` index, same file, keyed by edge source instead of target) for `imports`/`references` edges.
- Where Phase 1 currently hits the `no-terminal-unit` ignored-item branch (current line ~106-123), add the §2 lookup before giving up: filter the implementer's `importsBySource` targets to ones present in `nodeToUnit` with `kind === 'database' | 'topic'`; exactly-one → emit; zero/2+ → keep the existing ignored-item path (extend its `detail` text to say which case fired, for debuggability).
- Add the two new confidence constants (§2.1) alongside the existing two.
- **No changes needed** to `pass-registry.ts`, `multi-hop-bridge-pass.ts`, `coverage-report.ts`, or any CALM builder — this is purely internal to the one detector file, matching "Surgical Changes."
**Verify:** `npm run build` clean; existing Phase 1 regression tests (real Fineract 0-relationship/2-ignored-item residual test, synthetic Phase-1 fixture test) still pass unchanged — this is the regression shield, not optional.

### Step 3 — New fixture + tests (T-R1-2, continued)
Build `test/fixtures/r2b-implementer-hop-sample/` per §4. Add regression tests: (a) positive path — exact relationship + confidence + grade asserted, implementer produces no node; (b) ambiguity path — 2+ store imports → zero relationships, real ignored-item.
**Verify:** both new tests pass; full suite (currently 46 tests) is still green, count grows by however many new tests are added — report the new total, don't just say "still passing."

### Step 4 — Real-repo remeasure (T-R1-2, continued — do not skip)
Run the existing single-root `fineract-charge` regression unchanged first (confirm it's still the same honest residual — 0 R2 relationships, same ignored-item count, `architectureOutboundCoverage: 0` — Phase 1's own residual test should NOT flip just from this change, since neither implementer chases to a real store per §1). Then run a **combined** `fineract-charge` + `fineract-provider` scan (per the existing multi-root support and `coe-lab/docs/multi-root-l2-protocol.md`'s labeling convention) and report the *actual* result — relationship count, confidence values, whether `architectureOutboundCoverage` moves off 0%, and if it doesn't close, name the real reason from the actual run output (should match §1's prediction, but confirm against real output, don't assume the prediction holds without checking).
**Verify:** a real command transcript (or a new, explicitly-labeled `multi-root` regression test if the run is fast/stable enough to lock in — `fineract-provider` at 2733 files plus `fineract-charge` may be slow; time it and decide whether it belongs in the always-run suite or a documented manual/gated check, same tradeoff `test/regression.test.js` already makes for `FINERACT_ROOT`-gated tests).

### Step 5 — Docs sync (T-R1-2 close-out)
- `Claim_Register.md` R2 row: note R2b mechanism shipped, cite the synthetic-fixture proof, and state the real Fineract multi-root result from Step 4 (closed / partially closed / still residual — whichever it actually is).
- `BACKLOG.md`: flip `B-R2b` to `done` (mechanism) — if Step 4 shows Fineract's flagship case still doesn't close, add a **new**, more narrowly-scoped backlog row for whatever the actual remaining blocker is (e.g. a Spring-JDBC driver-import catalogue row + `B-java-driver-ref`, or command-bus resolution if that's ever revisited) rather than leaving `B-R2b` open forever for a goal it was never going to fully reach alone.
- `STATUS.md`: new row under the Robustness/Phase R1 section.
- `scope-limitations.yml`: add the Python-inapplicability note from §3 if not already implied by existing text.

### Step 6 (parallel, not blocking) — T-R1-3, Java import normalization
Independent track per the existing `AGENT_TASKS_Weaver_Robustness.md` row — can run before, after, or alongside Steps 2-5. Not expanded further here; that task's own spec (T-R1-3) already covers it. Worth noting for whoever picks it up: fixing it **and** adding a `org.springframework.jdbc.core` driver-import catalogue row together is the actual (separate, larger) path to closing Fineract's read-path residual — flagged in §1, not assumed to be in scope for T-R1-3 as currently written.

## 6. Non-goals (restated, unchanged from parent doc)

- Command-bus/dynamic-dispatch resolution — still permanently out of scope.
- No Fineract/BoA/any-sample class or interface name literal anywhere in the detector.
- No name-suffix allowlist.
- No third bridge hop beyond the bound in §2.
- Not claiming Python coverage for the bridge mechanism (§3) — named, not silently assumed.
