# Agent task list — Extraction enrichment + Platform IR

**Single source of truth** for extraction enrichment work. Integrity recommendations are **not separate** — they are **Wave XI gates**, hard dependencies, and per-task constraints. You do not need a parallel tracker.

**Purpose:** Close/mitigate gaps in `docs/solution/Extraction_Gaps_Mitigation_and_IR_Platform_Review.md` (§1 + §8) while **extending the Architecture-as-Code platform** (not accumulating one-off patches).

**Related (do not fork work):**  
- `AGENT_TASKS_Solution_Cleanup_and_Prioritized_Actions.md` — docs cleanup + modularity Wave M (reuse; don’t re-build).  
- `Contract_Evolution_Policy.md`, `Module_Authoring_Guide.md`, `Modularity_and_Integration_Assessment.md`.

---

## 0. How to use this file (mandatory process)

### 0.1 Agent run order — **hard, not optional**

```
XI Integrity bootstrap (first, once)
  → X0 Visibility
  → X1 Quality gates
  → X2 Persistence (X2-1 before X2-2)
  → X3 Platform IR
  → ── MVP checkpoint (recommended pause) ──
  → X4 OpenAPI (X4-2 with or before X4-1)
  → X6-1 Relationship overrides   ← before X5 edges / X8-3 / X9
  → X5 k8s (X5-0 kind policy before X5-1)
  → X6-2..X6-4 HITL depth
  → X7 Messaging/kinds (X7-1 before X7-2)
  → X8 Deployable + HTTP (X8-3 uses client strategy catalogue)
  → X9 Env soft-graph (allowlist catalogue, off by default)
  → X10 remains deferred unless product owner orders it
```

**MVP slice (prefer finishing this cleanly before X5–X9):**  
`XI → X0 → X1 → X2 → X3 → X4`  
Rationale: visibility + gates + catalogue patterns + shared IR + OpenAPI give the largest integrity-safe power-up without risking orchestration special-cases.

### 0.2 Every task completion — agent must do all of these

1. **Integrity home** stated in PR/summary: `provider | analysis-pass | catalogue | contract | module | platform-artefact`.  
2. **Catalogue/pass/provider path** named (file path).  
3. **Regression:** new fixture or baseline bump under X1 rules.  
4. **STATUS / scope-limitations** updated when capability changes (T-XI-4).  
5. **No** writing override results into `TypedFacts`.  
6. **No** high-confidence nodes from import-only / guesswork.  
7. **No** secret *values* in any artefact.  
8. **No** new 100+ line feature blocks in `run-slice.ts` (wire only).

### 0.3 PR / agent summary template (copy into every delivery)

```markdown
## Integrity gate
- Integrity home: <provider|pass|catalogue|contract|module|platform-artefact>
- Paths: <files>
- Wave M reuse: <pass-registry / route-composer / engine-matrix / n/a + why>
- TypedFacts enriched? <yes/no — if no, why CALM-only is wrong or N/A>
- Contract bump? <none | minor | major per Contract_Evolution_Policy>
- Regression: <test name or baseline bump>
- STATUS/scope-limitations updated? <yes>
- Hard dependencies satisfied: <list predecessor task IDs>
```

### 0.4 Architectural integrity checklist (reject PR if violated)

| Principle | Required pattern | Patch anti-pattern (reject) |
|---|---|---|
| **Dual goals** | Enrich **TypedFacts**; CALM is one projection | Logic only in `build-calm.ts` for a one-off |
| **Catalogue / strategy** | New signal = YAML row or named strategy once | `if (repo.includes('fineract'))` |
| **Contract** | New kinds → `Contract_Evolution_Policy` + mappings | Stuff everything into `service` forever |
| **Determinism** | LLM offline only; same inputs → same facts | LLM in `run-slice` core |
| **Layering** | Provider or analysis **pass**; orchestrator wires | Feature logic dumped in `run-slice.ts` |
| **Reuse Wave M** | pass-registry, composers, engine matrix | Parallel second pipeline |
| **HITL = authorize** | Overrides + DR on **output** only | Overrides write into TypedFacts |
| **Honesty** | Low confidence / unmapped / limitations | Fake high confidence |
| **Security** | Secret *names* only; redact snippets | Secret *values* in IR/CALM |
| **Regression** | Fixture or baseline with change | “Works on my package” |

### 0.5 Platform-extending vs patching (examples)

| Platform-extending | Patching (do not ship) |
|---|---|
| `persistence-detection-catalogue.yml` + dispatcher | Extra `if` for one library in detector |
| `scanner/openapi-provider.ts` → evidence `openapi` | Calm builder parses OpenAPI alone |
| Pass `detect-messaging` registered once | Kafka-only script for one repo |
| Platform IR from TypedFacts | IR re-implements CALM mapping |
| Relationship overrides in applier | Hand-edited `architecture.calm.json` in CI |

---

## Wave XI — Integrity bootstrap (do first; carry recommendations)

*These tasks operationalize the integrity review so nothing is tracked outside this file.*

### T-XI-1 — Confirm Wave M extension points exist (reuse map)

| Field | Content |
|---|---|
| **Why** | Skipping Wave M causes parallel micro-pipelines (patching). |
| **Solution** | Inventory `pipeline/src/` for: `pass-registry` / `passes`, `route-composer-registry`, `engine-capability-matrix`, `modules/registry`, `CONTRACT_VERSION`. Document in STATUS or `docs/solution/STATUS.md` a **Reuse map** table: component → path → use for which X-tasks. |
| **Acceptance** | Table exists; each of X2–X9 names which extension point it will use. If a registry is missing, either implement minimal one (link to Wave M) or explicitly justify one-time exception (rare). |
| **Integrity home** | Platform docs / STATUS |

---

### T-XI-2 — Hard dependency matrix (enforced by agents)

| Field | Content |
|---|---|
| **Why** | Wrong order (e.g. X2-2 before X2-1, X5 before relationship kinds) produces patches. |
| **Solution** | Agents **must refuse** to implement a task if predecessors incomplete: |

| Task | Hard predecessors (must be done or verified done) |
|---|---|
| T-X2-2 | T-X2-1 |
| T-X3-2 | T-X0-1, T-X0-2 (IR sections empty-ok but schema ready) |
| T-X4-1 | T-X4-2 designed/implemented in same PR or prior |
| T-X5-1 | T-X5-0, T-X6-1 (if emitting new relationship types into CALM via overrides path) **or** T-X5-0 + contract mapping if emitting via builders |
| T-X7-2 | T-X7-1 |
| T-X8-3 | T-X6-1, T-X8-3a (HTTP client strategy catalogue) |
| T-X9-1 | T-X6-1, T-X9-0 (allowlist catalogue) |

| **Acceptance** | Agent start message lists predecessors and marks each done/verified. |

---

### T-XI-3 — MVP-first delivery policy

| Field | Content |
|---|---|
| **Why** | Finishing X0–X4 cleanly > rushing X5–X9 as special cases. |
| **Solution** | Default agent assignment = **MVP only** (XI + X0–X4). X5–X9 only when MVP checklist green or owner explicitly expands scope. |
| **Acceptance** | Agent prompt or assignment states MVP vs full; if full, MVP still completed first. |

---

### T-XI-4 — STATUS + scope-limitations ritual (after every wave)

| Field | Content |
|---|---|
| **Why** | Claimed surface must match code (honesty pillar). |
| **Solution** | After each wave: update STATUS (built/partial/backlog) and `x-aac-scope-limitations` source (T-X0-3 YAML if present). |
| **Acceptance** | Diff includes STATUS and/or limitations when behaviour changes. |

---

### T-XI-5 — Catalogue promotion preference (systemic gaps)

| Field | Content |
|---|---|
| **Why** | Eternal HITL overrides for recurring signals = permanent patch. |
| **Solution** | When unmapped report shows same signal ≥ N times (e.g. 5), agent/docs recommend **catalogue row** via `suggest-rules` / human promotion, not another override. Document in Module guide or this file’s “operating rules”. |
| **Acceptance** | One written rule + optional note in unmapped report footer. |

---

## Wave X0 — Visibility (make dark matter visible)

### T-X0-1 — Per-run coverage report

| Field | Content |
|---|---|
| **Gap(s)** | G-L4-02, G-L1-01 (partial), G-L1-09 (partial) |
| **Why** | Without counts, high confidence looks complete; zero-route failures look like “no architecture.” |
| **Solution** | Emit `coverage-report.json` (+ provenance summary): per packageRoot — files by ext, CodeGraph routes, Graphify nodes/edges, units by kind, ignored by reason, unmapped count, `graphifyStatus: ok\|failed\|skipped`. |
| **Mitigation** | On scanner failure still write coverage with failed status. |
| **Acceptance** | Every run writes report; Graphify failure reflected; schema documented. |
| **Integrity home** | Platform artefact writer (not calm-only). |
| **After** | T-XI-4 |

---

### T-X0-2 — Unmapped-signal capture (clustered, capped)

| Field | Content |
|---|---|
| **Gap(s)** | G-L2-07 |
| **Why** | Unmatched signals vanish; catalogue cannot learn. Full AST dumps unusable. |
| **Solution** | `unmapped-signals-report.json`: cluster by signal, cap (e.g. top 100 clusters, 5 samples). Prefer as `suggest-rules` input. Footer/note: promote recurring signals to catalogue (T-XI-5). |
| **Mitigation** | Never fail run on volume. |
| **Acceptance** | Unknown decorator in fixture appears; known signals do not. |
| **Integrity home** | Rules/Analysis feedback loop. |
| **Out of scope** | Auto-merge into signal-catalogue.yml |

---

### T-X0-3 — Capability-driven `x-aac-scope-limitations`

| Field | Content |
|---|---|
| **Gap(s)** | L5 honesty |
| **Why** | Stale Slice-1-only bullets mislead consumers. |
| **Solution** | Versioned YAML (or STATUS-derived) list → metadata-builder; keep “confidence ≠ completeness” forever. |
| **Acceptance** | Generated metadata matches real capability. |
| **Integrity home** | Single source for limitations. |

---

## Wave X1 — Quality gates (protect enrichment)

### T-X1-1 — Extraction recall regression suite

| Field | Content |
|---|---|
| **Gap(s)** | G-P-04 |
| **Why** | Without gates, enrichment silently regresses (calmNodeType, GET vs Getter). |
| **Solution** | `npm test` / extend regression: NestJS fixture + BoA and/or Fineract-charge — routes, db nodes, relationships, calm validate 0, no invalid interacts. Document baseline bump process. |
| **Acceptance** | Breaking a catalogue rule fails tests. |
| **Integrity home** | CI / quality pillar. |
| **Rule** | **Every later detector task must add or extend a test here.** |

---

### T-X1-2 — Strict detect-gate option

| Field | Content |
|---|---|
| **Gap(s)** | G-L1-01 |
| **Why** | Silent zero routes destroy pilot trust. |
| **Solution** | `--strict-detect`: non-zero exit when framework deps present but 0 routes; default warn. |
| **Acceptance** | Documented scenario; default still completes. |
| **Integrity home** | Orchestration flag + existing smoke test. |

---

## Wave X2 — Persistence enrichment

### T-X2-1 — Persistence strategy catalogue + dispatcher  **[before T-X2-2]**

| Field | Content |
|---|---|
| **Gap(s)** | G-L2-01 |
| **Why** | Single code shape = per-repo patching risk. |
| **Solution** | `rules/persistence-detection-catalogue.yml` + dispatcher (analysis pass). Strategies: `driver-import` (current path), integrate `jpa-entity` without double-emit, Spring Data interface-extends (partial ok if documented). |
| **Mitigation** | HITL node_add; STATUS for unverified strategies. |
| **Acceptance** | BoA-style units still work; new library = catalogue row; no duplicate DB nodes. |
| **Integrity home** | Strategy catalogue + pass (Wave M style). |
| **Reject** | Per-ORM `if` chains in `run-slice`. |

---

### T-X2-2 — Cloud lib rows (Dynamo, SQS/SNS, …)  **[requires T-X2-1]**

| Field | Content |
|---|---|
| **Gap(s)** | G-L2-02 |
| **Why** | v0.14 Fidelity Node cloud stack. |
| **Solution** | Catalogue rows only via dispatcher. Dynamo→database; SQS/SNS→ defer to X7 network kind or **low-confidence** interim with explicit label — never silent high-confidence `service`. |
| **Mitigation** | `evidenceLevel: unverified` until fixture. |
| **Acceptance** | Fixture or STATUS unverified entry. |
| **Integrity home** | Catalogue rows on T-X2-1 dispatcher. |
| **Hard predecessor** | T-X2-1 |

---

## Wave X3 — Platform IR + evidence packs

### T-X3-1 — Evidence packs + redaction

| Field | Content |
|---|---|
| **Gap(s)** | G-L4-01, G-L4-07 |
| **Why** | HITL needs context; full files leak secrets. |
| **Solution** | Snippets for AMBIGUOUS/INSUFFICIENT (±K lines); redact secrets; `--no-snippets` option. |
| **Acceptance** | Redaction test; snippets-disabled mode. |
| **Integrity home** | Platform evidence sidecar / ignored-item enrichment. |

---

### T-X3-2 — Platform IR (`intelligence-ir.md`)  **[not calm-generator]**

| Field | Content |
|---|---|
| **Gap(s)** | G-L4-03, G-P-01 |
| **Why** | Intelligence must be shared across modules; IR is not a CALM draft. |
| **Solution** | Deterministic renderer from TypedFacts + coverage + unmapped (+ packs). Sections: header, coverage, units, relationships, ignored, unmapped. Optional module projection appendix by reading outputs. **Path: platform module or analysis/ir — not inside calm-generator builders.** |
| **Rules** | One-way; never feed IR → TypedFacts; no secret values. |
| **Acceptance** | IR usable without calm-generator; modules still only *require* TypedFacts. |
| **Integrity home** | Platform artefact / optional `platform-ir` module. |
| **Hard predecessor** | T-X0-1, T-X0-2 (empty sections ok) |

---

### T-X3-3 — Docs: IR = platform intelligence

| Field | Content |
|---|---|
| **Why** | Agents re-build CALM-only IR if docs say so. |
| **Solution** | Patch Solution Design §13 / STATUS; link Extraction_Gaps §3 + this file. |
| **Acceptance** | Docs state Platform IR + CALM as projection. |

---

## Wave X4 — OpenAPI (MVP includes this)

### T-X4-2 — Interface merge precedence  **[with or before T-X4-1]**

| Field | Content |
|---|---|
| **Gap(s)** | G-L3-08 |
| **Why** | Native + decorator + OpenAPI triple-count (NestJS already bit). |
| **Solution** | Authority policy: **native-route > openapi > decorator** (or tier table); one interface per `METHOD path`. |
| **Acceptance** | Overlap fixture → single set; regression. |
| **Integrity home** | Evidence authority tiers in construct layer (generalize NestJS fix) — **not** OpenAPI-only `if`. |

---

### T-X4-1 — Static OpenAPI provider

| Field | Content |
|---|---|
| **Gap(s)** | G-L1-04, G-L3-04, G-L2-05 partial |
| **Why** | Structured API + securitySchemes; Fidelity-evidenced. |
| **Solution** | Discover openapi/swagger files → evidence source `openapi` → units/interfaces/controls via Analysis. |
| **Mitigation** | Absent file → coverage `openapi: absent`. |
| **Acceptance** | Mini OpenAPI fixture; run without file ok. |
| **Integrity home** | **Scanner provider → TypedFacts**, not calm-only parse. |
| **Hard predecessor** | T-X4-2 in same PR or prior |

---

## Wave X6-1 early — Relationship overrides (before trust/HTTP/env edges via HITL)

### T-X6-1 — Implement relationship_add / relationship_remove

| Field | Content |
|---|---|
| **Gap(s)** | G-L4-05 |
| **Why** | Mitigations that cite relationship overrides are **false** until this ships; HITL cannot complete edges. |
| **Solution** | Applier implements add/remove with DR enforcement; connects shape validated. |
| **Acceptance** | Test: DR+override adds edge; no DR → rejected; calm validate ok. |
| **Integrity home** | calm-generator override-applier (module-local authorization) — **does not** mutate TypedFacts. |
| **Schedule** | Complete **before** relying on HITL for X5/X8/X9 edges. |

---

## Wave X5 — Kubernetes trust

### T-X5-0 — Relationship kind / mapping policy for trust  **[before T-X5-1]**

| Field | Content |
|---|---|
| **Why** | Emitting k8s trust only as ad-hoc CALM JSON is a patch. |
| **Solution** | Decide: new TypedRelationship kind `shares-secret` (contract bump) **or** `connects` + description/protocol null + evidence source `k8s`. Add relationship-type-mapping row. Document in STATUS. |
| **Acceptance** | Policy written; types/mappings ready before provider emits. |
| **Integrity home** | Contract + mapping catalogue. |

---

### T-X5-1 — k8s manifest provider (flat/pre-rendered)

| Field | Content |
|---|---|
| **Gap(s)** | G-L1-03 |
| **Why** | Shared secret trust invisible to code scanners (BoA). |
| **Solution** | `--k8s-manifests` dir; Secret/ConfigMap **names** only; Deployments → relationships per T-X5-0; image/namespace → decorators/metadata. |
| **Security** | Never write secret data values. |
| **Acceptance** | Two deployments + shared secret name → relationship or unresolved report. |
| **Integrity home** | Scanner provider + analysis detector → TypedFacts. |
| **Hard predecessor** | T-X5-0; prefer T-X6-1 if HITL completion expected |

---

### T-X5-2 — Ingress → actor (optional)

| Field | Content |
|---|---|
| **Gap(s)** | G-L3-10 |
| **Solution** | Optional actor emission; prefer connects if interacts unused. |
| **Acceptance** | Fixture or explicit STATUS backlog. |
| **Integrity home** | Same k8s provider. |

---

## Wave X6 — HITL depth (remainder)

### T-X6-2 — Orphan/stale override detection

| Field | Content |
|---|---|
| **Gap(s)** | G-L4-08 |
| **Solution** | Report orphans in overrides-applied-report; optional `--strict-overrides`. |
| **Acceptance** | Test lists orphan ids. |
| **Integrity home** | override-applier |

---

### T-X6-3 — Reconstruct-only `--from-facts`

| Field | Content |
|---|---|
| **Gap(s)** | G-L4-06 |
| **Solution** | Rebuild modules + IR + overrides without rescan; refuse incompatible contractVersion. |
| **Acceptance** | Frozen facts → same calm (modulo timestamps). |
| **Integrity home** | Orchestration entrypoint |

---

### T-X6-4 — Bounded LLM advisory CLI (optional)

| Field | Content |
|---|---|
| **Gap(s)** | G-L4-04 |
| **Solution** | Offline CLI; proposals only; never in run-slice; never TypedFacts; cap N; exclude CROSS_DOMAIN. |
| **Acceptance** | No key → dry run; schema maps to DR original_suggestion. |
| **Integrity home** | Sibling of suggest-rules (offline authoring). |
| **Reject** | Auto-apply overrides (X10). |

---

## Wave X7 — Messaging & richer kinds

### T-X7-1 — Contract: topic / batch-job kinds  **[before T-X7-2]**

| Field | Content |
|---|---|
| **Gap(s)** | G-L3-01, G-P-02 |
| **Solution** | Follow `Contract_Evolution_Policy.md`; mapping rows; bump if required. |
| **Acceptance** | Compiles; modules still load. |
| **Integrity home** | TypedFacts contract |

---

### T-X7-2 — Kafka / JMS / SQS detection

| Field | Content |
|---|---|
| **Gap(s)** | G-L2-03 |
| **Solution** | Analysis pass + catalogue; decorator + producer patterns; **import-only ≤ medium/low confidence**. |
| **Acceptance** | Fixture/sample with honest confidence. |
| **Integrity home** | Pass + catalogue; **not** run-slice Kafka block. |
| **Hard predecessor** | T-X7-1 |

---

### T-X7-3 — System node + composed-of (optional, rule-based)

| Field | Content |
|---|---|
| **Gap(s)** | G-L3-06 |
| **Solution** | One system node per root or per run; composed-of children; **flag to disable**; document rule (not cosmetic default without meaning). |
| **Acceptance** | calm validate; multi-unit package has composed-of. |
| **Integrity home** | node/relationship builders + mapping |
| **Reject** | Synthetic nodes without documented rule |

---

### T-X7-4 — Protocol when known

| Field | Content |
|---|---|
| **Gap(s)** | G-L3-03 |
| **Solution** | HTTP/JDBC when evidenced; else null — never invent. |
| **Acceptance** | Fixture with non-null + unknown null. |
| **Integrity home** | relationship-type-mapping / builder |

---

## Wave X8 — Deployable identity + outbound HTTP

### T-X8-1 — Deployable-unit / manifest signals

| Field | Content |
|---|---|
| **Gap(s)** | G-L1-10, G-L2-15 |
| **Solution** | package.json / Maven / Dockerfile as bootstrap/deployable evidence; optional “require deployable OR http-entry for service”. |
| **Acceptance** | Policy + fixture. |
| **Integrity home** | Signal catalogue / analysis pass |

---

### T-X8-2 — docker-compose topology (optional, low confidence, off by default)

| Field | Content |
|---|---|
| **Gap(s)** | G-L1-11 |
| **Solution** | Provider parse compose → low-confidence nodes/edges; source `docker-compose`. |
| **Acceptance** | Off by default; fixture or STATUS backlog. |
| **Integrity home** | Scanner provider |

---

### T-X8-3a — HTTP-client strategy catalogue  **[before T-X8-3]**

| Field | Content |
|---|---|
| **Why** | Per-library hardcoding (axios vs Feign vs fetch) is classic patching. |
| **Solution** | `http-client-detection-catalogue.yml` (or extend signal catalogue with strategy ids): client family → match patterns → emit unresolved-target or connects. Same pattern as persistence strategies. |
| **Acceptance** | Adding a client library = catalogue row. |
| **Integrity home** | Strategy catalogue |

---

### T-X8-3 — Outbound HTTP → relationships  **[requires T-X8-3a, T-X6-1]**

| Field | Content |
|---|---|
| **Gap(s)** | G-L2-13 |
| **Solution** | Pass uses catalogue; resolvable target → low/medium connects; else ignored `unresolved-http-target` with evidence for HITL. |
| **Acceptance** | Fixture both paths. |
| **Integrity home** | Analysis pass + catalogue |
| **Hard predecessors** | T-X8-3a, T-X6-1 |

---

## Wave X9 — Config/env soft-graph

### T-X9-0 — Env-key allowlist catalogue  **[before T-X9-1]**

| Field | Content |
|---|---|
| **Why** | Regex soup per monorepo = patching. |
| **Solution** | `env-relationship-allowlist.yml`: key name patterns / k8s secretKeyRef name patterns only; no value capture rules. |
| **Acceptance** | File exists; documented. |
| **Integrity home** | Config catalogue |

---

### T-X9-1 — Shared env/secret *name* edges  **[requires T-X9-0, T-X6-1]**

| Field | Content |
|---|---|
| **Gap(s)** | G-L1-06 |
| **Solution** | Off by default; enable flag; emit low-confidence edges from allowlist matches only; **red-team test: values never in output**. |
| **Acceptance** | Fixture shared name; security test. |
| **Integrity home** | Analysis pass + allowlist catalogue |
| **Hard predecessors** | T-X9-0, T-X6-1; preferably T-X5-1 for k8s names |

---

## Wave X10 — Explicitly deferred (do not implement unless ordered)

| ID | Item | Why deferred | Residual mitigation |
|---|---|---|---|
| T-X10-1 | Helm/Kustomize/Terraform full resolve | Cost | Pre-rendered k8s only |
| T-X10-2 | Frontend / Scala / gRPC programmes | New slices | Coverage matrix ❌ |
| T-X10-3 | Feature-flag architecture | Low ROI | Ignore as logic |
| T-X10-4 | Two-tier domain boundaries | Org process | Single catalogue pilot |
| T-X10-5 | CodeQL/scip-java Phase 2 | Needs metrics | Phase 1 path |
| T-X10-6 | LLM auto-authorize overrides | Breaks HITL integrity | X6-4 proposals only |
| T-X10-7 | Every class as node | Noise | Confidence floor |
| T-X10-8 | Writing overrides into TypedFacts | Breaks determinism/Goal A | Never |

---

## Suggested agent prompts (include integrity process)

### Agent XI — Bootstrap
```
Read docs/solution/AGENT_TASKS_Extraction_Enrichment.md §0 and Wave XI.
Complete T-XI-1 (reuse map), confirm T-XI-2 dependency matrix, adopt T-XI-3 MVP policy.
Do not implement extraction features yet. Output STATUS reuse map.
```

### Agent MVP — X0–X4 (default assignment)
```
You are on the MVP slice only (see AGENT_TASKS_Extraction_Enrichment.md §0.1).
Prereq: Wave XI done or do XI first.
Implement X0 → X1 → X2 (2-1 before 2-2) → X3 → X4 (4-2 with 4-1).
Every PR uses §0.3 integrity template. Reuse Wave M registries. No k8s/messaging/env yet.
No LLM in run-slice. No secret values. Update STATUS after the wave.
```

### Agent E4 — Trust path
```
Hard order: T-X6-1, then T-X5-0, then T-X5-1. Optional X5-2, X6-2, X6-3.
Integrity template required. Names only for secrets.
```

### Agent E5 — Messaging/kinds
```
T-X7-1 then T-X7-2; then X7-3 (rule-based optional), X7-4.
Import-only messaging must not be high confidence. Contract_Evolution_Policy required.
```

### Agent E6 — Deployable + HTTP
```
T-X8-3a catalogue BEFORE T-X8-3. Predecessors: T-X6-1.
No per-library if-chains. Low confidence for unresolved targets.
```

### Agent E7 — Env soft-graph
```
T-X9-0 allowlist catalogue, then T-X9-1 off-by-default.
Red-team: values never appear. Predecessors T-X6-1.
```

---

## Tracking checklist (single tracker)

### Integrity / process
- [x] T-XI-1 Wave M reuse map  
- [x] T-XI-2 deps respected on every task  
- [x] T-XI-3 MVP-first unless expanded  
- [x] T-XI-4 STATUS/limitations after each wave  
- [x] T-XI-5 catalogue promotion rule documented  

### MVP
- [x] T-X0-1 coverage  
- [x] T-X0-2 unmapped  
- [x] T-X0-3 limitations source  
- [x] T-X1-1 regression suite  
- [x] T-X1-2 strict detect  
- [x] T-X2-1 persistence strategies  
- [x] T-X2-2 cloud rows  
- [x] T-X3-1 evidence packs  
- [x] T-X3-2 platform IR  
- [x] T-X3-3 IR docs  
- [x] T-X4-2 interface merge  
- [x] T-X4-1 OpenAPI provider  
- [x] **MVP checkpoint green** — see `docs/solution/STATUS.md` §B.3, 14/14 regression tests passing, verified against real fixtures (BoA, Fineract-charge, Fineract-core, NestJS, OpenAPI sample).  

### Post-MVP
- [x] T-X6-1 relationship overrides  
- [x] T-X5-0 trust kind policy  
- [x] T-X5-1 k8s provider  
- [ ] T-X5-2 Ingress optional — skipped, timeboxed (explicitly optional per this file's own wording; see STATUS.md §B.3)  
- [x] T-X6-2 orphans  
- [x] T-X6-3 reconstruct-only  
- [ ] T-X6-4 advisory CLI — skipped, timeboxed (explicitly optional per this file's own wording; see STATUS.md §B.3)  
- [x] T-X7-1..4  
- [x] T-X8-1 — T-X8-2 skipped, timeboxed (explicitly optional; see STATUS.md §B.3)  
- [x] T-X8-3a HTTP catalogue  
- [x] T-X8-3 outbound HTTP  
- [x] T-X9-0 env allowlist  
- [x] T-X9-1 env edges  
- [x] X10 stays deferred (untouched, as required)  

---

## Gap → task map

| Gap ID | Primary task |
|---|---|
| G-L1-01 | T-X1-2, T-X0-1 |
| G-L1-03 | T-X5-0, T-X5-1 |
| G-L1-04 | T-X4-1, T-X4-2 |
| G-L1-06 | T-X9-0, T-X9-1 |
| G-L1-09 | T-X0-1 |
| G-L1-10 | T-X8-1 |
| G-L1-11 | T-X8-2 |
| G-L2-01 | T-X2-1 |
| G-L2-02 | T-X2-2, T-X7-2 |
| G-L2-03 | T-X7-1, T-X7-2 |
| G-L2-07 | T-X0-2, T-XI-5 |
| G-L2-13 | T-X8-3a, T-X8-3 |
| G-L2-14/15 | T-X8-1 |
| G-L3-01/06 | T-X7-1, T-X7-3 |
| G-L3-02 | T-X5-*, T-X6-1, T-X8-3 |
| G-L3-03 | T-X7-4 |
| G-L3-04/08 | T-X4-* |
| G-L4-01/03/07 | T-X3-* |
| G-L4-02 | T-X0-1 |
| G-L4-04/05/06/08 | T-X6-* |
| G-P-01 | T-X3-2 |
| G-P-04 | T-X1-1 |
| Integrity risks | Wave XI + hard predecessors |

---

## Integrity review (folded in — no separate tracker)

| Question | Answer |
|---|---|
| Platform-building or patching? | **Platform if Wave XI + hard deps + integrity homes are followed**; patching if agents skip them. |
| Dual goals | TypedFacts + Platform IR first; CALM projects |
| Determinism / HITL | Overrides post-build only; X6-4 offline; X10-6/8 banned |
| What to finish first | **MVP: XI → X0–X4** |
| What was added to carry recommendations | Wave XI, hard predecessor table, PR template, HTTP/env **catalogues before detectors**, X5-0 kind policy, MVP checkpoint, reject rules on each risk |

**Bottom line:** Use **this file only**. Integrity is not a side memo — it is **Wave XI + §0 process + hard dependencies + per-task integrity homes**.
