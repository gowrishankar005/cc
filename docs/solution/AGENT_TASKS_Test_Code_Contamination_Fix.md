# Agent task list — test-code contamination fix (`B-test-code-exclusion`, `B-jaxrs-composer-class-scoping`)

**STATUS: CLOSED, 2026-08-09.** Both phases done, real evidence per task below, 79/79 full suite green (74 pre-existing + 5 new). One real, found-during-verification regression fixed along the way (see T-TC1-2's status) — a stale hardcoded baseline, not a code bug.

**Single source of truth** for closing the real, QA-gate-blocking defect found 2026-08-09 during a real Fineract dry-run of the pilot review procedure: `FineractOperationIdReaderTest.java` (a JUnit test file) was typed as a `service` node at confidence 100 with a fabricated `"GET /test"` route, appeared as a real residual in the review session, and — same root cause class — 17 other `/test/`-path files across the same scan were typed as real `database` units.

**Product:** Weaver. **Owner:** Gowri.

**Why this is P0, not routine backlog:** this is a first-impression defect. A BU reviewer's first act with a new tool is opening the generated diagram and sanity-checking it against what they know — finding their own test class rendered as a production microservice at 100% confidence is the fastest way to lose trust in every other number this tool reports. Named as the release-blocking finding in the Fineract QA gate report (2026-08-09), conditional-pass verdict.

**Related:**
| Doc | Role |
|---|---|
| `BACKLOG.md` | New rows: `B-test-code-exclusion`, `B-jaxrs-composer-class-scoping` |
| `pipeline/src/analysis/jaxrs-route-composer.ts` | TC-2's target — the real, confirmed misattribution bug |
| `pipeline/src/analysis/cross_package/graphify-import-strategy-detector.ts` | TC-1's second target — the Graphify-driven side of the same class of contamination |
| `pipeline/src/orchestration/run-slice.ts` | TC-1's primary insertion point (per-root scan loop) |
| `pipeline/src/types/typed-facts.ts` | `IgnoredItem.reason` already has `'TEST_CODE'` defined, unused — TC-1 wires it up for real |
| `pipeline/src/rules/scope-limitations.yml` | TC-1/TC-2 both need a real disclosure entry here — neither limitation was ever named here, a real gap in its own right |

---

## 0. How to use this file (mandatory)

### 0.1 Root cause recap (full detail: prior turn's RCA, verified against real source before this file was written)

Two independent, compounding causes, found via a real Fineract multi-root scan (`fineract-charge`+`fineract-provider`):

1. **No test-path exclusion exists anywhere in the pipeline.** `IgnoredItem.reason` includes `'TEST_CODE'` in its own type union — confirmed via grep, never assigned by any real code path. The taxonomy was designed for this exact case and never built. `/test/` files get scanned identically to `/main/` files by both CodeGraph and Graphify.
2. **`jaxrs-route-composer.ts` has an undisclosed, untested assumption that real test files violate.** It takes the *first* class-level `@Path` fact found anywhere in a file and applies that *same one path* to every method in the whole file (`let classPath` set once, `break` after the first match — lines 42–48). A file with 2+ classes each carrying their own `@Path` (rare in production JAX-RS, common in test-fixture files, e.g. `FineractOperationIdReaderTest.java`'s 5 nested `static` resource classes) gets every method's route misattributed to the first class's path. `DecoratorFact.line` is already available on every fact, so a per-method, nearest-preceding-class-by-line resolution is implementable now.

**Amplifying factor (not a separate cause, explains the confidence=100 severity):** the composer's own bug produced 5 duplicate `"GET /test"` entries instead of 5 distinct real paths; `scoreConfidence`'s `Math.min(100, total)` capped 5×weight-40 at exactly 100 — the more wrong the composer was, the more certain the output looked.

**Confirmed already contaminated on the Graphify side too, same review session, not a new claim to re-verify:** 17 of 23 real `/test/`-path units in the same Fineract scan were `database`-kind at confidence 20 (`persistence-detector.ts`'s exact driver-import weight) — `VisibilityProbe.java`, `TestConfiguration.java`, `EmailReadPlatformServiceImplTest.java`, and others. Same cause #1 (no test-path exclusion), different extraction engine.

### 0.2 Phase order

```
Phase TC-1  Test-path exclusion (both extraction engines) — the broader, higher-volume fix (23/482 units in one real scan)
  → Phase TC-2  JAX-RS composer per-class scoping — the sharper correctness bug, matters even where TC-1 doesn't apply (a real multi-resource-class production file would hit this too)
```

Independent fixes, no hard dependency — sequenced TC-1 first only because it's the higher-volume real defect. TC-2 must still ship in this program even though TC-1 alone would have prevented the specific `FineractOperationIdReaderTest.java` case, because TC-2 is a real correctness bug that could misfire on genuine production code (any real file with 2+ resource classes), not just test files.

### 0.3 Integrity (reject PR if violated)

| Principle | Required | Reject |
|---|---|---|
| Never silently drop | Every file/fact excluded by TC-1 becomes a real, visible `IgnoredItem` (reason `TEST_CODE`), never just vanishes with no trace | A file silently skipped with no record anywhere |
| Never guess | TC-2's per-class resolution must fall back to "no composed route" (matching the existing `if (!fullPath) continue`) when a method has no unambiguously-resolvable preceding class-level `@Path` — never fabricate a class association | A heuristic that guesses when genuinely ambiguous |
| Generic, not repo-specific | `isTestPath()` is a real, generic path/filename heuristic (directory segments + filename suffix patterns across Java/Python/TS conventions) — not a Fineract-specific exclusion list | Hardcoding `FineractOperationIdReaderTest.java` or any specific filename |
| Determinism | Byte-identical output (aside from timestamp) on every existing regression fixture — none of the 4 pre-existing fixtures have files under a `/test/`-shaped path or a multi-class-per-file JAX-RS shape, so both fixes should be no-ops for them; confirm, don't assume | Any pre-existing fixture's output changes |
| Real fixtures, real assertions | New fixtures reproducing both bugs' exact shapes (multi-class-per-file JAX-RS; a driver-import inside a `/test/`-path file), exact assertions | A fixture that happens to avoid re-triggering the original bug shape |
| Disclosure | Both limitations (test-path heuristic's real false-negative/positive edges; composer's fallback-to-no-route on ambiguity) named in `scope-limitations.yml` | Silent, undocumented behavior |

### 0.4 Every phase completion

1. Real before/after evidence: re-run the exact Fineract multi-root scan that found this, confirm `FineractOperationIdReaderTest.java` and the 17 Graphify-side test units no longer appear as real units (TC-1) and/or resolve to correct per-class paths where still legitimately composed (TC-2).
2. `git status --short pipeline/` confirms only intended files touched.
3. Full regression suite green, byte-identical on pre-existing fixtures.
4. `BACKLOG.md`/`scope-limitations.yml` updated.
5. PR template filled (§0.5).

### 0.5 PR template

```markdown
## Test-code contamination fix delivery
- Phase: <TC-1|TC-2>
- Real before/after: <Fineract re-scan unit counts, specific file(s) checked>
- Regression: <suite name, pass count>
- scope-limitations.yml / BACKLOG updated: <yes/no>
- Explicit residual: <…>
```

---

## Phase TC-1 — Test-path exclusion (both extraction engines) — **CLOSED, 2026-08-09**

### T-TC1-1 — Shared `isTestPath()` predicate
New, small, generic predicate (likely `pipeline/src/rules/test-path.ts` or similar) — checks a relative file path against real, common test conventions across this project's polyglot scope: directory segments (`/test/`, `/tests/`, `/__tests__/`), filename suffixes (`Test.java`, `Tests.java`, `test_*.py`, `*_test.py`, `.test.ts`, `.spec.ts`). Generic, not Fineract-specific — matches the pattern already established (e.g. `YAML_RE`/`PROPS_RE` in `spring-config-provider.ts`).
**Verify:** unit test with real positive/negative path examples across all three languages, including the actual `FineractOperationIdReaderTest.java` real path as one real positive case.
**Status: DONE, 2026-08-09.** `pipeline/src/rules/test-path.ts`. Real test with 10 positive cases (including the actual bug-finding path) and 4 negative cases, including two deliberate near-miss checks (`src/services/latest.ts`, `contest.py`) proving it doesn't over-match on a "test" substring.

### T-TC1-2 — Apply to CodeGraph-derived facts (the confirmed bug's primary cause)
In `run-slice.ts`'s per-root scan loop: filter `indexedFiles` (and `nativeRoutes`, by their own `filePath`) through `isTestPath()` before decorator/call/type-reference/extends extraction runs. For each excluded file, record one `IgnoredItem` (reason `TEST_CODE`, ref `<filePath>:0`, detail naming which test-path pattern matched) — real visibility, not a silent skip. Likely needs a small `RawRootFacts.excludedTestFiles: string[]` carried through to wherever `ctx.allIgnoredItems` is populated (`mapSignalsPass` is the natural place, since it already runs per-root over `rawByRoot`).
**Verify:** real re-scan of the exact Fineract multi-root case — `FineractOperationIdReaderTest.java` no longer produces a `service` unit; a real `IgnoredItem` with reason `TEST_CODE` exists for it instead.
**Status: DONE, 2026-08-09.** `RawRootFacts.excludedTestFiles`, wired through `run-slice.ts`'s scan loop and `mapSignalsPass`. **Real re-scan of the exact original bug case**: `FineractOperationIdReaderTest.java` no longer produces a unit; a real `TEST_CODE` ignored item exists for it (289 total across `fineract-charge`+`fineract-provider`, 271 CodeGraph-side files excluded for `fineract-provider` alone). `calm validate` still 0 errors/0 warnings. **One real regression found and fixed during full-suite verification, not silently patched**: a pre-existing hardcoded test baseline (`fineract-core`'s direct-reconciler relationship count) was `96`, a real number from an earlier fix — dropped to a real, honestly-lower `94` once 28 real `/test/`-path files in `fineract-core` stopped contaminating it. Verified this was the ONLY effect, not a side effect of something else: a direct re-run confirmed R2b's real production count (3, genuine service→repository chains) stayed exactly unchanged, only the R0/structural count moved. Test updated to the new real baseline with the full explanation, not silenced.

### T-TC1-3 — Apply to Graphify-derived facts (the confirmed second contamination path)
`graphify-import-strategy-detector.ts`'s `detectUnitsByImportStrategy` (shared by persistence/messaging/outbound-http detection) needs the same `isTestPath()` filter applied to the matched file before building a unit from it.
**Verify:** real re-scan confirms the 17 real Graphify-side test-path `database` units from the original Fineract finding no longer appear; a real fixture (a `/test/`-path file importing a real catalogued driver library, e.g. `psycopg2`) proves the filter fires deterministically, not just on this one real repo's luck.
**Status: DONE, 2026-08-09.** `detectUnitsByImportStrategy`'s return type changed to `ImportStrategyResult` (`{unitsByRoot, excludedTestFiles}`), propagated through `persistence-detector.ts`/`messaging-detector.ts` and their pass wrappers (`detectPersistencePass`/`detectMessagingPass` in `passes.ts`/`messaging-pass.ts`). Real re-scan confirms zero real `/test/`-path Graphify-derived units remain (18 excluded from `fineract-provider`'s persistence detection alone). New checked-in fixture (`test/fixtures/jaxrs-multiclass-sample/test/test_db.py`, a real `psycopg2` import under a `test/` path) proves the filter fires deterministically, not just on Fineract's own luck.

### T-TC1-4 — `scope-limitations.yml` disclosure
Name the real heuristic's own honest edges: a test file that doesn't match any of the path/filename conventions checked (a real, if rare, false negative) still gets scanned; a production file that happens to match a convention-like name (a real, if rare, false positive) gets excluded. Both named, not silently assumed perfect.
**Verify:** real entry added, cross-referenced from this task file.
**Status: DONE, 2026-08-09.** `scope-limitations.yml` v0.9.0→v0.10.0, new `test-code-exclusion-heuristic` entry naming both real edges plainly, plus a companion `jaxrs-composer-single-resource-class-assumption` entry for TC-2's own heuristic (see below).

---

## Phase TC-2 — JAX-RS composer per-class scoping — **CLOSED, 2026-08-09**

### T-TC2-1 — Per-method class resolution by nearest-preceding line
Replace the single global `classPath` variable in `composeJaxRsRoutes` with a per-method resolution: for each method-level HTTP-verb fact, find the class-level `@Path` fact with the largest `line` value that is still ≤ the method's own line (nearest preceding class block — correct for standard top-to-bottom Java layout, including nested classes). No class-level `@Path` precedes the method at all → fall back to method-path-only or no compose (never guess), matching the existing `if (!fullPath) continue` discipline.
**Verify:** re-verify the ORIGINAL 19/19 real Fineract route-assembly proof this composer was built and proven against (`docs/spikes/fineract-route-assembly-spike/`) — the single-class-per-file case must remain byte-identical, this is a real regression risk given how central this mechanism is.
**Status: DONE, 2026-08-09.** `jaxrs-route-composer.ts`'s `composeJaxRsRoutes` now resolves per-method via `resolveClassPath()` (nearest-preceding class-level `@Path` by line). **The highest-risk regression check ran and passed unchanged**: `test/regression.test.js`'s existing exact-assertion `ChargesApiResource` test (the real subset of the original 19/19 proof) still passes byte-for-byte — same 6 exact routes, same `Charge.java`/`ChargeRepository.java` typing, `calm validate` 0 errors/0 warnings.

### T-TC2-2 — Real fixture: legitimate multi-class-per-file production shape
New fixture (or extend an existing JAX-RS one) with 2 real, distinct resource classes in one file, each with its own `@Path` and `@GET` methods — proves the fix correctly resolves EACH method to its OWN class's path, not just that it avoids the bug.
**Verify:** exact-assertion test — both classes' routes composed correctly and distinctly, neither borrows the other's path.
**Status: DONE, 2026-08-09.** `test/fixtures/jaxrs-multiclass-sample/src/main/java/example/MultiResourceFile.java` — 2 real classes (`OrdersResource`/`ProductsResource`), each own `@Path`. Real, verified: the file's one TypedUnit (file-level granularity, by design) carries BOTH `GET /orders` and `GET /products` as two genuinely distinct interfaces — not two copies of the first class's path (the original bug's exact symptom).

### T-TC2-3 — Direct unit test of the exact bug shape
A direct test against `composeJaxRsRoutes()` using the real `FineractOperationIdReaderTest.java` shape (5 classes, 5 distinct paths, one file) — proves TC-2 holds independently of TC-1 (defense in depth: even if the test-path filter ever has a gap, the composer itself must never misattribute).
**Verify:** all 5 methods resolve to their own real, distinct path (`/test`, `/implicit`, `/invalid`, `/conflict`, `/implicit-conflict`), not 5 copies of the first one.
**Status: DONE, 2026-08-09.** Direct unit test against `composeJaxRsRoutes()` with the exact real 5-class shape (same paths, same relative line spacing as the real file) — all 5 resolve correctly and distinctly. A second direct unit test locks the original single-class production shape byte-identical to before, independent of the full-pipeline `ChargesApiResource` regression test above (defense in depth at the unit level too).

---

## Program DoD (Definition of Done) — **ALL CLOSED, 2026-08-09**

- [x] TC-1 (T-TC1-1…4) complete: `isTestPath()` real and tested, applied to both CodeGraph and Graphify extraction paths, real `TEST_CODE` ignored items visible (289 real items on the original Fineract case), `scope-limitations.yml` updated.
- [x] TC-2 (T-TC2-1…3) complete: composer resolves per-class by line-proximity, the original 19/19 real-route proof (via its exact-assertion regression test) re-verified unbroken, both a legitimate multi-class fixture and the exact bug-shape fixture pass.
- [x] Real re-scan of the exact Fineract multi-root case that found this: `FineractOperationIdReaderTest.java` no longer a false `service`; the Graphify-side test units no longer appear; `calm validate` still 0 errors/0 warnings.
- [x] Every pre-existing regression fixture byte-identical (aside from timestamp) — confirmed via a real, isolated re-run per fixture; the one exception (`fineract-core`'s R0 relationship count, 96→94) is a real, understood, correctly-updated baseline, not an unexplained drift — see T-TC1-2.
- [x] Full suite green (79/79, up from 74/74), real exact-assertion tests added for both fixes.
- [x] `BACKLOG.md` rows (`B-test-code-exclusion`, `B-jaxrs-composer-class-scoping`) flipped to `done` with real before/after evidence cited.
- [x] Honest residual named: `isTestPath()`'s real false-positive/negative edges are exactly as anticipated in T-TC1-4's original scope, not broader — no surprise found during implementation.
