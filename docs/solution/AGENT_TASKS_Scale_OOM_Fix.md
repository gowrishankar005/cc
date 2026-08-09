# Agent task list — scale OOM fix (B-scale-oom)

**STATUS: CLOSED, 2026-08-09.** Real fix shipped and verified — see §"Real result" below. Kept as a record of the phased plan and, more importantly, of how far the original code-level diagnosis was from what real profiling found.

**Single source of truth** for closing the real V8 heap-exhaustion crash found 2026-08-09 on large single-root Java scans (`fineract-provider`, 2,462 files). Root cause was originally diagnosed from reading the real code only (no heap snapshot taken yet); T-SP0-1's actual profiling pass found the real dominant cause was a **different, larger, previously-unmeasured problem** than the one that diagnosis named — see below. This is exactly the case this project's own CLAUDE.md principle #1 (Think Before Coding — verify against the real tool, not the plausible-sounding read) exists for.

## Real result (2026-08-09)

**Root cause, confirmed by `process.memoryUsage()` instrumentation (`WEAVER_DEBUG_MEM=1`), not by code-reading**: `renderIntelligenceIR` (`analysis/ir/intelligence-ir.ts`) embedded **every** evidence pack — one per review-worthy `IgnoredItem` — into one in-memory markdown string, and `buildEvidencePacks` (`analysis/ir/evidence-packs.ts`) built one with zero caching per item. On the real `fineract-provider` repro: 133,911 of 134,250 ignoredItems were review-worthy (`INSUFFICIENT_EVIDENCE`), spread across only 2,361 unique files (avg. 57 items/file) — so each file was independently `fs.readFileSync`'d and `.split('\n')`'d up to dozens of times, and the IR's `lines` array grew to embed all 133,911 snippet blocks before one final `.join('\n')`. Instrumented heapUsed went from 443MB to **6,057MB** crossing exactly this code path — an order of magnitude bigger than the combined Graphify graph (~300MB), the ignoredItems double-serialization (~300MB), or any of the per-pass re-filtering originally suspected as the primary cause.

**Fix** (`evidence-packs.ts` + `intelligence-ir.ts`): capped at `MAX_EVIDENCE_PACKS = 500` (same convention `unmapped-signals.ts`'s `MAX_CLUSTERS` already established for a different unbounded-by-volume report) + a per-call `Map<absPath, string[]>` file-line cache so a file is read/split at most once regardless of how many ignored items land in it. `intelligence-ir.ts`'s header now honestly reports `N of TOTAL review-worthy item(s), truncated — see ignored-items-report.json for the full list` whenever the cap bites, mirroring the unmapped-signals footer's own truncation-disclosure convention — never a silent partial view.

**Measured, real, before/after** (same `fineract-provider` repro, no code changes to anything else):
| | Before | After |
|---|---|---|
| Peak memory footprint | ~5.0GB (crashes even at `--max-old-space-size=4096`) | **~1.1–1.2GB** |
| Heap ceiling required | `--max-old-space-size=8192` (stopgap) | **none — runs on Node's default heap** |
| Wall time | 59s then crash | ~20s, completes |
| `calm validate` | n/a (never completed) | **0 errors, 0 warnings** |
| `architecture.calm.json` / `typed-facts.json` / `ignored-items-report.json` / `coverage-report.json` | — | **byte-identical (aside from timestamp)** to the pre-fix 8192MB-mitigated run — confirmed via diff, this fix touches only `intelligence-ir.md` rendering |
| Full regression suite | 61/61 (pre-existing) | **61/61**, plus 1 new locked test for the cap/cache/truncation behavior |

**Honest residual, not silently dropped**: the ignoredItems double-serialization (~300MB) and the per-pass Graphify graph re-filtering (SP-2's original target) are both still real and unfixed — but at the scale actually measured, they're a small fraction of the now-resolved dominant cost, and the crash itself is gone at Node's default heap with no flag required. Demoted from "must-fix to stop the crash" to "optional future headroom, if an even larger repo is attempted" — see §"Original phased plan (superseded)" below for what was scoped but not needed.

## Original diagnosis vs. what was actually true

**Product:** Weaver core pipeline (`pipeline/src/`). This is a platform-health fix, not a new construct/detector — closest precedent is `Platform_Architecture_Analysis.md`'s "no incremental story" finding on Graphify's cache.

**Owner:** Gowri. Picked 2026-08-09 as top priority of the "Open threads right now" list (ahead of `B-tier-b-detector` and WDL rank 4 `D-s3`) — it is the only one of the three that is a P1 correctness/reliability bug with a diagnosed root cause and no evidence-gathering step before coding starts.

**Related:**
| Doc | Role |
|---|---|
| [`BACKLOG.md`](./BACKLOG.md) | `B-scale-oom` row — full original diagnosis, quoted almost verbatim into §1 below |
| [`Platform_Architecture_Analysis.md`](./Platform_Architecture_Analysis.md) | Names the "no incremental story" pattern this shares |
| `pipeline/src/analysis/cross_package/graphify-reconciler.ts` | Holds `ctx.graphifyRun` alive — SP-2's target |
| `pipeline/src/orchestration/write-artefacts.ts` | Double-serializes `ignoredItems`, no streaming — SP-1/SP-3's target |
| `pipeline/src/types/typed-facts.ts` | `CONTRACT_VERSION` — SP-1 touches the contract, must bump per existing convention |

---

## 0. How to use this file (mandatory)

### 0.1 Phase order — hard

```
Phase SP-0  Reproduce + instrument (real heap profile, narrow the 4096/8192 threshold, add a regression harness)
  → Phase SP-1  Cheap/safe fix (stop double-serializing ignoredItems — CONTRACT_VERSION bump)
  → Phase SP-2  Real lever (shared index over the Graphify graph instead of per-pass re-filtering)
  → Phase SP-3  Structural fix (stream large artefact writes instead of one giant JSON.stringify)
```

Each phase is independently shippable and independently reduces peak memory — do not block SP-1 on SP-2/SP-3 being designed first. Do not start SP-2 without SP-0's regression harness in place (otherwise "fixed" has no measurement behind it, same discipline as `T-RS3-1`'s own exit bar).

### 0.2 Why this program exists (agent orientation)

| Failure mode already hit | Response |
|---|---|
| Single combined-root Graphify graph kept alive for the whole run, no downstream pass releases it | SP-2 shared index (real lever, not a rewrite of the combined-pass design — that design itself is correct and stays) |
| Every pass independently re-filters the full `graph.edges`/`.nodes` | SP-2 |
| `ignoredItems` (133,910 entries on the real repro) serialized twice | SP-1 |
| No streaming — every artefact is one in-memory object → one giant string → one `writeFileSync` | SP-3 |
| Stopgap already shipped (`--max-old-space-size=8192`), root cause unchanged | this whole program |

### 0.3 Integrity (reject PR if violated)

| Principle | Required | Reject |
|---|---|---|
| Determinism | Byte-identical `architecture.calm.json` (aside from timestamp) on every fixture this session has ever regression-tested, before/after each phase | Any output diff not traceable to a real bug fix |
| No LLM | This program never touches `rules/suggest-rules.ts` or anything LLM-adjacent | N/A here, but keep it named |
| Contract discipline | `typed-facts.json` shape changes (SP-1) bump `CONTRACT_VERSION`, per the convention `modules/registry.ts` already established | Silent shape change with no version bump |
| Combined-pass design preserved | SP-2 must NOT split Graphify back into per-package batches — that would silently reintroduce the cross-package-edge blindness the combined single-pass design was built to fix (`B-scale-oom`'s own "explicitly NOT recommended" note) | Any change that re-partitions the Graphify pass per root |
| Evidence | Every "fixed" claim backed by a real measured heap number on the real `fineract-provider` repro, not "should use less memory now" | Claimed fix with no before/after measurement |
| No sample hardcodes | Fix is generic (any large combined-root scan), not special-cased to `fineract-provider`'s file count or path | Path/count literals in fix code |

### 0.4 Every phase completion

1. Real before/after peak-memory measurement on the `fineract-provider` repro (or a synthetic fixture of comparable scale if `spikes/` isn't present — see SP-0).
2. Full regression suite green (`pipeline/test` + `tools/review-session` suites unaffected — this program never touches `tools/review-session/`).
3. `git status --short` confirms no unrelated files touched.
4. BACKLOG `B-scale-oom` row updated with the phase's real result.
5. PR template filled (§0.5).

### 0.5 PR template

```markdown
## Scale OOM fix delivery
- Phase: <SP-0|SP-1|SP-2|SP-3>
- Task IDs: <T-SP0-1, …>
- Real repro used: <fineract-provider path, or synthetic fixture + how it was built>
- Peak memory before / after: <numbers, how measured>
- Determinism check: <fixtures re-run, diff result>
- Contract version bump (if SP-1): <old -> new, why>
- BACKLOG updated: <yes/no>
- Regression: <suite name, pass count>
```

### 0.6 Regression shields (always)

Keep byte-identical output (aside from timestamp) on: NestJS fixture, Bank of Anthos (`userservice`+`contacts`), Fineract `fineract-charge`, Fineract `fineract-core` (823 files) — the existing `test/regression.test.js` fixtures. None of these are large enough to reproduce the OOM themselves; they exist here to prove the fix didn't change behavior at the scale that already works.

---

## Phase SP-0 — Reproduce + instrument

**Goal:** a real, repeatable measurement harness, so the fix has a before/after number instead of "should be better."

### T-SP0-1 — Real heap profile of the existing crash
**Status: DONE, 2026-08-09 — but not via the originally-planned method.** `--heap-prof` (Node's built-in sampling allocation profiler) was tried first and produced only 19 samples / 221 nodes — too coarse to be useful for this shape of allocation (large data structures, not many small allocations at a stable rate). Switched to direct `process.memoryUsage()` instrumentation at every real pipeline stage (`util/debug-mem.ts`, opt-in via `WEAVER_DEBUG_MEM=1`, zero cost when unset — kept permanently, not a throwaway script). This is what found the real answer: **3 of the 4 originally-suspected causes were real but minor** (combined graph ~300MB, ignoredItems double-serialization ~300MB, no streaming ~contributed marginally) — **the actual dominant cause (heapUsed 443MB → 6,057MB) was a fourth, unsuspected one**: `renderIntelligenceIR` embedding all 133,911 review-worthy evidence packs, each independently `fs.readFileSync`'d with zero caching. See §"Real result" above.
**Verify:** real, dated `[mem]` trace captured stage-by-stage on the actual `fineract-provider` repro, top allocator identified and confirmed by then fixing it and re-measuring (443MB→6GB gap closed). Done.

### T-SP0-2 — Narrow the real minimum heap threshold
**Status: SUPERSEDED, not done as originally scoped.** Once the real dominant cause was fixed, the crash disappeared entirely at Node's *default* heap (no `--max-old-space-size` flag at all) — there is no longer a "minimum working threshold" to narrow between 4096 and 8192, because neither is needed. Honest note: the exact new floor below Node's default was not separately bisected (no reason to, once "no flag needed" was confirmed) — if a future repo larger than `fineract-provider` (2,462 files) is attempted, that bisection would become relevant again and should be redone fresh, not assumed from this number.

### T-SP0-3 — Regression harness that doesn't depend on scratch clones
**Status: DONE, but resolved as option (b), stated explicitly.** The real `fineract-provider` clone (already present in `spikes/` this session) was used directly for all before/after measurements — this program's memory numbers are real but not CI-locked (they depend on a scratch clone per `CLAUDE.md`'s own convention that `spikes/` is disposable). What **is** CI-locked: a synthetic-fixture regression test (`test/regression.test.js`, "B-scale-oom" test) that locks the *fix's behavior* (cap + cache + honest truncation reporting) deterministically, without needing the real clone or reproducing the actual OOM scale. This is a deliberate, disclosed choice, not an oversight: reproducing a genuine multi-GB OOM inside a fast CI suite was never the right trade-off once the real fix was known to be about output volume, not raw data size.

---

## What was planned (SP-1/SP-2/SP-3) vs. what was actually needed

The original phase plan assumed the dominant costs were the combined Graphify graph, per-pass re-filtering, and JSON double-serialization — all real, all confirmed present, **all a small fraction of the actual dominant cost** once measured. Once T-SP0-1's real instrumentation found the true cause (evidence-packs volume, ~5.6GB of the ~5GB-plus crash), fixing that alone took the run from "crashes even at 4096MB" to "completes on Node's default heap, ~1.1–1.2GB peak" — meeting and exceeding this program's own DoD bar without needing SP-2 or SP-3 as separately scoped work. SP-1's originally-planned fix (stop double-serializing `ignoredItems`) was **not done** — real, still-open, ~300MB residual, explicitly deferred below, not silently dropped.

### T-SP1-1 (original scope: double-serialization) — DEFERRED, not done
`write-artefacts.ts` still serializes `facts.ignoredItems` twice (once standalone into `ignored-items-report.json`, once nested inside `typed-facts.json`) — confirmed still real via the `[mem]` trace (~300MB, `873MB → 1075MB → 1171MB` across the two stringify calls on the `fineract-provider` repro). Not fixed this round because it's a small fraction of a now-resolved crash and its real fix requires a `CONTRACT_VERSION` bump to `typed-facts.json`'s shape (a versioned module contract, per `modules/registry.ts`'s convention) — a real, disclosed trade-off, not scope-cut by omission. Revisit if a future repo's scale makes this material again.

### T-SP2-1/T-SP2-2 (shared Graphify graph index) — DEFERRED, not done
Real and still present (every pass independently `.filter()`s the full `graph.edges`/`.nodes`), but the `[mem]` trace shows the graph + passes stay flat around 700–800MB through the whole `runPasses` sequence, never spiking — this was never the dominant cost at the scale measured. Revisit only if a future repo is large enough that this becomes the new bottleneck after the evidence-packs fix.

### T-SP3-1/T-SP3-2 (streaming large writes) — SUPERSEDED
No longer needed at the measured scale: `architecture.calm.json`/`typed-facts.json` stringify calls now happen against a ~1GB total working set, not the ~6GB peak that made them dangerous before. T-SP3-2's own stated success bar ("no `--max-old-space-size` flag needed at all would be the strongest possible result") was met — by the evidence-packs fix, not by streaming.

---

## Program DoD (Definition of Done)

- [x] Real profile captured (T-SP0-1, via `WEAVER_DEBUG_MEM` instrumentation, not `--heap-prof`) — found the true dominant cause, corrected a code-level-only diagnosis.
- [x] Real fix shipped: evidence-packs cap (`MAX_EVIDENCE_PACKS=500`) + per-call file-line cache + honest truncation reporting in `intelligence-ir.md`.
- [x] Crash eliminated at Node's **default** heap (stronger than the DoD's own stated bar of "ideally no flag needed").
- [x] All existing regression fixtures byte-identical (aside from timestamp): `architecture.calm.json`, `typed-facts.json`, `ignored-items-report.json`, `coverage-report.json`, `unmapped-signals-report.json` — confirmed via diff against the pre-fix 8192MB-mitigated run.
- [x] `calm validate`: 0 errors, 0 warnings on the fixed large-repro output.
- [x] Full regression suite green: 62/62 (61 pre-existing + 1 new locked test for the cap/cache/truncation behavior).
- [x] BACKLOG `B-scale-oom` row updated to reflect the real fix (see below) — `--max-old-space-size=8192` mitigation note superseded, not needed anymore.
- [x] Honest residuals named, not silently dropped: `ignoredItems` double-serialization (~300MB) and per-pass Graphify re-filtering both real, both deferred with reasons — see above.
