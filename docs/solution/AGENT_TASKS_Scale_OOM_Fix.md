# Agent task list — scale OOM fix (B-scale-oom)

**Single source of truth** for closing the real V8 heap-exhaustion crash found 2026-08-09 on large single-root Java scans (`fineract-provider`, 2,462 files). Root cause is already diagnosed from reading the real code (not profiled — no heap snapshot taken yet); this program builds the real fix, not another mitigation.

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

**Goal:** a real, repeatable measurement harness, so SP-1/SP-2/SP-3 each have a before/after number instead of "should be better."

### T-SP0-1 — Real heap profile of the existing crash
Run the `fineract-provider` repro (or the largest available real fixture if `spikes/` isn't present this session — check first, it's scratch state per `CLAUDE.md`'s own convention) with `--inspect`/`--heap-prof` (Node's built-in V8 profiler, no new dependency) at `--max-old-space-size=8192` (the known-working ceiling) to get a real allocation breakdown, not the code-level guess already on record in BACKLOG. Confirm or correct the four suspected causes (combined graph held alive, per-pass re-filtering, double-serialized `ignoredItems`, no streaming) against real numbers.
**Verify:** a real `.heapprofile` or equivalent captured, top allocators named with real byte/percentage figures, checked against the 4 suspects.
**Status:** not started.

### T-SP0-2 — Narrow the real minimum heap threshold
Bisect between 4096 (confirmed failing) and 8192 (confirmed working) to find the real minimum — BACKLOG explicitly flags this as "untested, not narrowed further."
**Verify:** a specific MB value where it transitions from crash to success, on the same repro, run at least twice at the boundary value to rule out run-to-run variance.
**Status:** not started.

### T-SP0-3 — Regression harness that doesn't depend on scratch clones
`test/regression.test.js`'s existing large-fixture tests all `skip` when `spikes/` is absent. Decide: either (a) a synthetic large fixture generated at test time (many small files, same shape as the real repro) that reproduces measurable memory pressure without needing a 2,462-file real clone, or (b) accept this program's memory measurements stay manual/scratch-only and are not locked into CI — state the choice and why, don't silently assume (a) without checking it actually reproduces the pressure pattern.
**Verify:** if (a), the synthetic fixture's peak memory is shown to scale the same way as the real repro on at least one measured point; if (b), explicitly documented as a disclosed gap in this file's own regression story.
**Status:** not started.

---

## Phase SP-1 — Cheap/safe fix: stop double-serializing `ignoredItems`

### T-SP1-1 — Remove the duplicate serialization
`write-artefacts.ts`: `facts.ignoredItems` is `JSON.stringify`'d once alone into `ignored-items-report.json`, and again nested inside the full `facts` object for `typed-facts.json`. Fix: `typed-facts.json` should reference/omit the already-written `ignored-items-report.json` rather than re-embedding it — this is a real shape change to a versioned module contract (per `CLAUDE.md`'s `contractVersion` convention in `modules/registry.ts`), so bump `CONTRACT_VERSION` and check `modules/registry.ts`'s version-gating still correctly skips a hypothetical older-major module against the new shape.
**Verify:** on the `fineract-core` fixture (823 files, safe to run every time), `typed-facts.json` no longer contains a duplicated `ignoredItems` array; `CONTRACT_VERSION` bumped; a real consuming module (`calm-generator` or `threat-signals`) still runs correctly against the new shape; full regression suite green.
**Status:** not started.

### T-SP1-2 — Measure the real memory win
Re-run T-SP0-1's profiling harness against the same repro with this fix applied.
**Verify:** a real before/after peak-memory number, not an assumption — 133,910 `ignoredItems` entries serialized twice is a real, bounded amount of duplicate work; state honestly if this alone is enough to drop the working ceiling below 8192, or if it's a smaller contribution than SP-2/SP-3.
**Status:** not started.

---

## Phase SP-2 — Real lever: shared index over the Graphify graph

### T-SP2-1 — Build one shared adjacency index
`graphify-provider.ts` currently does one `JSON.parse` of the whole combined-root graph and keeps it alive via `ctx.graphifyRun` for the entire run; every downstream pass (persistence/messaging/outbound-http/multi-hop-bridge/k8s-trust/env-soft-graph/reconciler) independently re-`.filter()`s the full `.edges`/`.nodes` arrays. Build one `Map<id, node>` + adjacency structure once, built alongside/inside `ctx.graphifyRun`, and have every pass consume it instead of re-filtering raw arrays.
**Verify:** every existing pass's output is byte-identical on all 4 regression fixtures after the refactor (same node/relationship counts as the pre-refactor baseline, matching the discipline already used for the T-M7 pass-registry refactor); real allocation reduction shown via T-SP0-1's harness on the large repro.
**Status:** not started.

### T-SP2-2 — Confirm the combined-pass cross-package design is untouched
This refactor must change *how* passes read the graph, never *what* graph gets built — the combined single-pass design (one Graphify extraction across the common ancestor of all roots) is what fixed cross-package edges and must not be silently re-partitioned.
**Verify:** the real evidenced case from that fix (`ChargesApiResource` -references-> `PlatformSecurityContext`, a different-module cross-package edge, at line 69) still appears correctly after this refactor, on a real Fineract multi-root run if `spikes/` is present this session.
**Status:** not started.

---

## Phase SP-3 — Structural fix: stream large artefact writes

### T-SP3-1 — Stream `architecture.calm.json` / `typed-facts.json` writes
Replace the "build one in-memory object → one `JSON.stringify` string → one `writeFileSync`" pattern in `write-artefacts.ts` with an incremental writer (Node's `fs.createWriteStream` + manual chunked JSON emission, or a minimal streaming-JSON approach) for the largest artefacts specifically — not a wholesale rewrite of every small artefact write, which don't contribute to the crash.
**Verify:** real peak-memory reduction shown via T-SP0-1's harness; output byte-identical to the pre-change version (streaming must produce the exact same JSON text, not just "valid JSON") on all 4 regression fixtures.
**Status:** not started.

### T-SP3-2 — Re-run the full large-repro crash test end to end
With SP-1 + SP-2 + SP-3 all applied, re-attempt the original crashing repro at progressively lower `--max-old-space-size` values (starting from T-SP0-2's narrowed threshold) to find the new real minimum.
**Verify:** a real, measured new minimum heap value, ideally at or near Node's own default (no `--max-old-space-size` flag needed at all would be the strongest possible result, but state honestly if a flag is still required and at what value).
**Status:** not started.

---

## Program DoD (Definition of Done)

- [ ] T-SP0-1, T-SP0-2, T-SP0-3 complete — real profile, real threshold, a stated regression-harness decision.
- [ ] T-SP1-1, T-SP1-2 complete — duplicate serialization removed, `CONTRACT_VERSION` bumped, measured win recorded.
- [ ] T-SP2-1, T-SP2-2 complete — shared index built, combined cross-package design confirmed intact.
- [ ] T-SP3-1, T-SP3-2 complete — streaming applied where it matters, new real minimum heap measured.
- [ ] All 4 existing regression fixtures byte-identical (aside from timestamp) throughout every phase.
- [ ] BACKLOG `B-scale-oom` row updated to reflect the real fix, not just the stopgap — the `--max-old-space-size=8192` mitigation note either removed (if no longer needed) or kept with the new, lower real minimum.
- [ ] Honest residual named if any phase is only partially completed (matches this whole file's own convention — deferrals are fine, silent scope cuts are not).
