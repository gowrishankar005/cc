# Agent task list — Fidelity yardstick close-out + serverless HTTP implementation

**Product:** Weaver  
**Authority:** [`Fidelity_Yardstick_Closeout_Matrix.md`](./Fidelity_Yardstick_Closeout_Matrix.md) (solutioning) · this file (implementation)  
**Backlog:** **B-lambda-http**, **B-dynamo-handler-kind**, matrix gaps G-FY-*  
**Claims:** **U-http-serverless**, **U-http** (framework-only), **U-persist-import** (Dynamo ownership)

**Evidence samples are not the product.** Prefer generic catalogue + structured-file mechanisms. Reject sample-name detectors (`OOS-sample-repo-detectors`).

---

## 0. How to use (mandatory)

### 0.1 Phase order — hard

```text
Phase Y0  Yardstick lock (matrix review + claim/OOS alignment)     [docs]
  → Phase Y1  Design notes + lab gold (no pipeline detector code)  [docs + lab]
  → Phase Y2  B-dynamo-handler-kind (ownership / kind priority)    [code]
  → Phase Y3  B-lambda-http code entry (handler → service)         [code]
  → Phase Y4  B-lambda-http path join (CFN/SAM/OpenAPI → interfaces) [code]
  → Phase Y5  Completeness / silence + standing exams              [code + eval]
  → Phase Y6  Matrix re-score + optional G-FY-04/05 backlog only   [docs]
```

| Rule | |
|---|---|
| **Do not start Y2–Y4 code** before Y0 + Y1 exit | Prevents “ship heuristics without solution surface” |
| **Do not mark U-http-serverless proven** off handler-only without paths | Paths are part of the architect construct |
| **Do not use residual session (RS-*) as substitute** for detection | Residual is for residual; this is product detection |
| **Do not wait for CodeGraph** for CFN path join | Platform structured-file |
| **Regression suite green** after every code phase | Plus targeted exams |

### 0.2 Why this program exists

| Failure | Response |
|---|---|
| Fidelity named Lambda; solution binned it under deploy/k8s | Matrix planes + **U-http-serverless** |
| Dynamo/SQS “done” read as full AWS | Plane split in matrix §2–3 |
| Hard-test #2 first discovery of fundamental gap | Y0/Y1 force claim+lab **before** wild generalization |
| Prisma ownership fixed; Java Dynamo handler still FP | Y2 generalizes ownership/priority |

### 0.3 Integrity (reject PR if violated)

| Principle | Required | Reject |
|---|---|---|
| Generic | Catalogue / structural / file-shape tests | `TierService`, `aws-saas-boost`, path literals unique to one sample in detector logic |
| Catalogue intake | [`Catalogue_Intake.md`](./Catalogue_Intake.md) four requirements | Unevidenced rows |
| Isolation | Hand gold from source | Generator CALM as gold |
| Claims | Update Claim Register + matrix status | “Fidelity AWS done” bare |
| Honesty | scope-limitations when partial | Silent overclaim |
| Determinism | No LLM in `run-slice` | — |

### 0.4 Product decisions (defaults)

| ID | Decision | Default |
|---|---|---|
| **D-handler-first** | Ship handler→service before full CFN parser breadth | **Yes** (Y3 before full Y4; Y4 can start with minimal API GW Method/Path resources) |
| **D-cfn-v1** | v1 path join = CloudFormation/SAM-like YAML with explicit `Path`+`Method`+`Handler`/function binding; not full AWS resource graph | **Yes** |
| **D-openapi-fallback** | If OpenAPI present, reuse dual-unit merge for paths | **Yes** (secondary to CFN when both exist — document precedence) |
| **D-dynamo-priority** | HTTP/handler evidence wins kind over bare Dynamo client import | **Yes** |
| **D-kinesis** | Not in Y2–Y5 code | **Defer** G-FY-04 unless owner expands |
| **D-oauth2** | Not in Y2–Y5 code | **Defer** G-FY-05 |

---

## Phase Y0 — Yardstick lock (docs only)

**Goal:** Matrix is the living authority; claims/backlog/OOS align; no silent planes.

### T-Y0-1 — Matrix accepted as solutioning gate

| | |
|---|---|
| **Do** | Confirm [`Fidelity_Yardstick_Closeout_Matrix.md`](./Fidelity_Yardstick_Closeout_Matrix.md) is linked from BACKLOG, STATUS, Claim Register, NEXT_ITERATION, coe-lab fidelity research. Fix any row that still maps Lambda→k8s without authority. |
| **Verify** | Grep shows links; matrix §4.4 proxy table present |
| **Status** | **done, 2026-08-08** — 4/5 already linked (BACKLOG, STATUS, Claim Register, coe-lab fidelity research) from the matrix's own authoring session; only `NEXT_ITERATION.md` was missing a direct link (had `AGENT_TASKS_Fidelity_Yardstick_and_Serverless.md` only) — fixed. Grepped every other Lambda mention in `docs/solution/*.md`/README — `Fintech_Tier1_Stack_Expansion_Research.md`'s references all already correctly point to the matrix/`B-lambda-http` authority ("Yes — P1 open", "in flight"), no stale Lambda→k8s framing found anywhere. Matrix §4.4 "Proxy authority" confirmed present. |

### T-Y0-2 — Claim Register + OOS alignment

| | |
|---|---|
| **Do** | Ensure **U-http-serverless** remains `specified-unbuilt` until Y5; **U-http** notes framework-only; add/confirm forbidden Fidelity phrases. For every matrix row with Status **OOS**, ensure OOS_Registry has a row or explicit pointer. Add **OOS** notes for Spark/Angular if not already covered. |
| **Verify** | Claim Register cells match matrix §3 status for P1 rows |
| **Status** | **done, 2026-08-08 (already satisfied, confirmed not fixed)** — `U-http-serverless` is `specified-unbuilt`, `U-http` notes framework-only exclusion, forbidden Fidelity-complete phrase already present (Claim_Register.md line ~70). `FY-batch-spark`→`OOS-lang-expansion`, `FY-ui-angular`→`OOS-full-frontend-analysis` both real, existing OOS_Registry rows, not just named without a pointer. `FY-ml-python` correctly has no registry row (out of CALM/service-architecture domain entirely, not a deferred capability with a trigger — same category as test files, not something OOS_Registry tracks). |

### T-Y0-3 — BACKLOG IDs for residual matrix gaps

| | |
|---|---|
| **Do** | Confirm **B-lambda-http**, **B-dynamo-handler-kind** P1. Add thin BACKLOG rows if missing: **B-kinesis** (P3, G-FY-04), **B-oauth2-import** (P2, G-FY-05) — `todo` or `unevidenced`, not fake `done`. |
| **Verify** | BACKLOG has IDs matching matrix §5 |
| **Status** | **done, 2026-08-08 (already satisfied)** — `B-lambda-http`/`B-dynamo-handler-kind` confirmed P1 in BACKLOG's "P1-serverless" row; `B-kinesis` (P3/unevidenced) and `B-oauth2-import` (P2) both already present as real `todo` rows, not fake `done`. |

**Phase Y0 exit, 2026-08-08:** Matrix + claims + backlog IDs consistent — the prior research session already did this alignment work correctly; this pass confirmed it with fresh greps rather than trusting the prior session's own claim, and closed the one real gap found (NEXT_ITERATION link). Agent can start Y1 without re-researching Fidelity.

---

## Phase Y1 — Design notes + lab gold (no detector code)

**Goal:** Implementation cannot invent scope.

### T-Y1-1 — Design note: serverless HTTP + Dynamo ownership

| | |
|---|---|
| **Do** | Write `docs/solution/Serverless_HTTP_and_Dynamo_Ownership_Design.md` covering: (1) handler signals (Java `RequestHandler` / `RequestStreamHandler`, common API GW event types; Node `exports.handler` / `APIGatewayProxyHandler` **if** in scope for same mechanism class — say so); (2) CFN/SAM path extraction shape (which resource types, how bind to handler class/file); (3) OpenAPI precedence vs CFN; (4) kind priority rules vs Dynamo import; (5) confidence bands; (6) scope-limitations bullets to add; (7) non-goals (full CFN topology, Step Functions, ALB-only, etc.). |
| **Verify** | Design answers every G-FY-01/02 question without sample-specific logic |
| **Status** | **done, 2026-08-08** — `docs/solution/Serverless_HTTP_and_Dynamo_Ownership_Design.md`, grounded in real SaaS Boost CFN templates read directly (`saas-boost-private-api.yaml`/`saas-boost-svc-tenant.yaml`/`saas-boost-svc-tier.yaml`), not assumed from AWS docs. Real finding that shaped the v1 scope: path/method/handler binding is a three-way join across resources **often split across separate files** (API Gateway `Resource`/`Method` in one template, `Lambda::Function`'s `Handler:` string in another) — v1 scoped to same-directory multi-file join, no cross-stack, SAM shorthand named and deferred. Node/Python handler detection explicitly deferred (no real sample yet, same discipline as `D-terminal-refine`). Kind-priority rule (§4) generalizes the existing `ownerBaseClass` mechanism to a second library rather than inventing a parallel one. |

### T-Y1-2 — Lab package + hand gold

| | |
|---|---|
| **Do** | Add lab package e.g. `coe-lab/fixtures/java-lambda-apigw/` (or under existing lab tree): (a) Java handler implementing RequestHandler-like surface **or** minimal compile-free sources the pipeline can scan; (b) `template.yaml` / CFN fragment with `GET /tiers`, `POST /tiers`; (c) separate Dynamo store class importing DynamoDbClient; (d) handler that **also** imports Dynamo client (disconfirming for Y2). Hand-author gold CALM: service + interfaces + database + architecture connects. Isolation: gold from design, not generator. |
| **Verify** | Gold validates L0 if checked in; documented expected L1/L2 for post-Y5 |
| **Status** | **done, 2026-08-08** — `coe-lab/fixtures/monorepo/packages/java-lambda-apigw/` (matches existing lab-fixture convention, not a new tree): `TierService.java` (clean handler, no Dynamo import — WDL-1 positive case), `LegacyTierHandler.java` (handler that owns `DynamoDbClient` directly — WDL-2 disconfirming case), `TierStore.java` (real store). CFN split across **two files** (`api-gateway.yaml`/`lambda-functions.yaml`) specifically to exercise the multi-file join scope decided in T-Y1-1, not just claim it. Gold at `coe-lab/gold/calm/java-lambda-apigw/architecture.calm.json`, `calm validate` 0 errors/0 warnings. **Real pre-fix baseline run and documented, not assumed**: `TierService` produces 0 units (invisible); `LegacyTierHandler` mis-typed `database` — faithfully reproduces both real hard-test findings (HT-ASB-002, HT-ASB-007) in a controlled fixture. |

### T-Y1-3 — Standing exam stubs

| | |
|---|---|
| **Do** | Add **E-fidelity-lambda-lab** and **E-saas-boost-tier** rows to standing exams or hard-test registry with protocol: root path, gold path, expected until shipped (L1 fail OK as expected-fail or skip). Link matrix §6. |
| **Verify** | Exam IDs cited from Claim Register U-http-serverless notes |
| **Status** | **done, 2026-08-08** — new `coe-lab/docs/standing-exams-serverless.md` (kept separate from `standing-disconfirming-exams.md`, which is scoped to the layered-story program specifically — different programs, not conflated). Three exam IDs: `E-fidelity-lambda-lab` (the new lab fixture), `E-saas-boost-tier`, `E-saas-boost-tenant` (both real wild repos, seeded from the two hard-tests already run). All three show the real, confirmed expected-fail state. |

**Phase Y1 exit, 2026-08-08:** Design + lab gold + exam IDs exist; **zero detector changes made** — confirmed via `git status`/diff on `pipeline/src`, not just asserted.

---

## Phase Y2 — B-dynamo-handler-kind

**Goal:** Classes that are HTTP/Lambda handlers are not `database` solely because they import DynamoDbClient.

### T-Y2-1 — Ownership / priority mechanism

| | |
|---|---|
| **Do** | Extend persistence ownership (pattern from B-ontology / `ownerBaseClass` / kind voting) so **http-entry / handler evidence** or “not store owner” rules prevent Dynamo SDK import alone from forcing `database` on handler classes. Prefer: store classes keep database; handlers stay service (after Y3) or untyped/service-bootstrap — **never** database-only-from-client-import when stronger service signal exists. May land partially with Y3 if service signal required; if so, document dependency and implement kind re-vote after HTTP pass. |
| **Verify** | Lab: store class → database; handler with Dynamo import → **not** database (or not only database). Suite green. Catalogue intake satisfied. |
| **Status** | **done, 2026-08-08 — real finding: zero new code needed.** `existingServiceFilePaths` (`pass-registry.ts`) already excludes any file already typed `service` from `persistence-detector.ts`'s import-strategy pass — built for B-ontology, generically correct, never actually exercised against a handler-owns-driver case until now. Verified empirically (not assumed): `LegacyTierHandler` (owns `DynamoDbClient` directly) correctly resolves `service`, not `database`, the moment T-Y3-1's signal exists — no Y2-specific code change required. Regression test added. |

### T-Y2-2 — Regression + saas-boost spot check

| | |
|---|---|
| **Do** | Regression test on lab. Optional gated re-scan of `spikes/aws-saas-boost/.../tier-service`: TierService must not be the sole wrong database owner story once Y3 lands; after Y2 alone, document residual if handler still lacks service signal. |
| **Verify** | Test asserts kind outcomes by role, not class name literals in production code |
| **Status** | **done, 2026-08-08 (real coverage confirmed, status row was stale — found and fixed during a post-Y4 review pass, not caught at the time)** — lab regression test asserts by role (`node-type === 'service'`, not a name-based check) — verified `pipeline/src/analysis/signal-mapper.ts`/`pass-registry.ts` grep-clean of any `TierService`/`LegacyTierHandler`/`aws-saas-boost` literal. The optional gated wild re-scan happened for real, just under T-Y4-2's own wild-exam task rather than being logged back here — `TierService` confirmed correctly `service` (not the sole wrong-database-owner story) once Y3+Y4 both landed. |

**Phase Y2 exit:** G-FY-02 mechanism in place, confirmed complete once Y3's service signal landed (verified, not just predicted).

---

## Phase Y3 — B-lambda-http (code entry → service)

**Goal:** Lambda handlers become `service` units (U-http-serverless L1 unit side).

### T-Y3-1 — Catalogue + extraction for handler entry

| | |
|---|---|
| **Do** | Add signal-catalogue (and/or extends/implements / type-reference) rows for Lambda handler entry: e.g. implements `RequestHandler`, `RequestStreamHandler`; imports/uses `APIGatewayProxyRequestEvent` / `APIGatewayProxyResponseEvent` as **corroboration** not sole path. Wire into unit kind as `service` with category http-entry-point (or new serverless-entry category that interface-builder treats correctly). |
| **Verify** | Lab handler → `service` TypedUnit; no NestJS/BoA/Fineract regression |
| **Status** | **done, 2026-08-08** — real, empirically-verified finding before writing any code: `implements` produces its own `referenceKind: 'implements'`, NOT `'extends'` (confirmed via a direct `extractFromSource()` probe, not assumed by analogy to the spring-data-repository case). `extractExtendsFacts` broadened to include it (same pipeline, no parallel mechanism). New catalogue row `lambda-request-handler-implements`. **Real bug found and fixed before shipping**: reusing `category: http-entry-point` built a bogus path-interface from the raw type-reference signal text (`RequestHandler<...>`) — fixed by adding a distinct `serverless-entry-point` category (CONTRACT_VERSION 8.0.0, additive), decisive for the kind tie-break in `signal-mapper.ts` but excluded from `node-type-mapping.yml`'s `interfaceCategories`. Both `calm-generator`/`threat-signals` module contract versions bumped, each re-verified (not just bumped) against the new category. Full suite re-run after the broadened `implements` filter to check for unintended impact on unrelated fixtures — 56/56 green. |

### T-Y3-2 — Claim + scope-limitations

| | |
|---|---|
| **Do** | U-http-serverless → `partial` (units only, paths still open if Y4 not done). scope-limitations: “handler detected; paths require CFN/OpenAPI join”. |
| **Verify** | Claim Register honest |
| **Status** | **done, 2026-08-08** — `serverless-http-java-only` scope-limitations bullet added (Java-only; Node/Python deferred, no real sample; `threat-signals`' S2 check does not yet extend to `serverless-entry-point`, named as a real residual, not silently extended or dropped). Claim Register `U-http-serverless` updated below. |

**Phase Y3 exit:** Lab handler is a service; wild saas-boost has ≥1 service unit for handler (paths may still be empty).

---

## Phase Y4 — B-lambda-http (path join)

**Goal:** Architect sees `GET /tiers` etc. as interfaces on the service.

### T-Y4-1 — Structured-file provider (CFN/SAM subset)

| | |
|---|---|
| **Do** | Implement minimal structured-file ingestion for API Gateway + Lambda bindings (CloudFormation/SAM-style YAML/JSON): extract path, method, link to handler property / function resource → map to scanned handler unit (by class name, artifact path, or Handler string `package.Class::method`). Emit interface facts or decorator-equivalent route signals for interface-builder. Reuse OpenAPI pass merge rules where both exist; document precedence in design note. |
| **Verify** | Lab gold paths appear on service; calm validate 0 errors on lab output |
| **Status** | **done, 2026-08-08** — `cfn-manifest-provider.ts` (scanner) does the full path/method/handler join within a same-directory multi-file resource pool (real, empirically-confirmed finding: the `yaml` package resolves `!Ref`/`!GetAtt`/`!Sub` for free, no custom tag handling needed — confirmed by parsing a real fixture template before writing the regex). `cfn-route-pass.ts` (analysis) binds each resolved binding to a real scanned unit by handler class name, same never-guess-on-0-or-2+ discipline as `openApiPass`'s merge check. New `structured-file` Evidence source (CONTRACT_VERSION 9.0.0), `SOURCE_PRECEDENCE` tier 2 (between `openapi` and `decorator`, per D-openapi-fallback). Verified end-to-end on the lab fixture (real two-file CFN split, all 3 bindings resolved, exact path match, `calm validate` 0/0, gold L0/L1/L2 all PASS) and locked into a regression test. |

### T-Y4-2 — Wild exam: saas-boost tier-service

| | |
|---|---|
| **Do** | Re-run hard-test protocol against gold; update finding HT-ASB-001 status. Fix only generic bugs. |
| **Verify** | L1 path recall improves vs gold `/tiers*`; document residual honestly |
| **Status** | **done, 2026-08-08** — real re-run against `spikes/aws-saas-boost/repo/services/tier-service` with the repo's own real CFN templates (`--cfn-manifests .../resources`). `TierService` → real `service` unit with **5/5 real paths exactly matching gold** (`GET/POST /tiers`, `GET/PUT/DELETE /tiers/{id}`); real `TierService → DynamoTierDataStore` architecture-grade edge present, exact match to gold. HT-ASB-001/002/005 closed; HT-ASB-003/004 (test noise, method-as-unit noise) and HT-ASB-006 (completeness UX, Y5's job) explicitly named as still-open residuals, not silently swept into "closed." Full retest addendum in `coe-lab/docs/findings/aws-saas-boost-tier-service-gold-vs-platform.md` §8. Only 5 of 26 real CFN bindings found across the whole `resources/` directory bound — the rest are other services' routes, correctly left unresolved (their Java source isn't in this scan's roots), not guessed. |

**Phase Y4 exit, 2026-08-08:** Lab + real wild repo both green on unit-kind + path recall + L2 story. `pipeline/src` changes: `cfn-manifest-provider.ts` (new), `cfn-route-pass.ts` (new), `pass-registry.ts`/`passes.ts` (wiring), `run-slice.ts` (`--cfn-manifests` CLI flag), `interface-builder.ts` (SOURCE_PRECEDENCE), `typed-facts.ts` (CONTRACT_VERSION 9.0.0). Full suite green including 2 new locked regression tests.

**Phase Y4 exit:** U-http-serverless can claim paths on lab; wild partial/proven only if saas-boost meets bar.

---

## Phase Y5 — Completeness + exams + suite

### T-Y5-1 — Silence / HITL when serverless expected empty

| | |
|---|---|
| **Do** | Address HT-ASB-006 class: e.g. S-flag or review trigger when infra scan finds API GW methods but 0 service units, or Dynamo-only with handler files present. Prefer generic completeness signals over sample rules. |
| **Verify** | Documented flag fires on pre-Y3 artefact or synthetic |
| **Status** | **done, 2026-08-08** — new `S5` silence flag (`coverage-report.ts`), two real conditions: (a) 0 service units with ≥1 database/topic unit present (the general "Dynamo-only" case, independent of CFN — the ORIGINAL pre-Y3 gap this whole finding started from); (b) `--cfn-manifests` found real route bindings but bound none to a scanned unit (the still-real post-Y4 residual, e.g. handler code in an unscanned root). Both verified firing on a new, dedicated, deliberately generic (not sample-named) lab fixture (`java-lambda-orphan-store`), and verified NOT firing on the healthy `java-lambda-apigw` fixture (negative-path check). Documented in `coe-lab/docs/validation-approach-vnext.md`'s S-table. Locked regression test. |

### T-Y5-2 — Standing exams last-run + full suite

| | |
|---|---|
| **Do** | Run E-fidelity-lambda-lab, E-saas-boost-tier, full `npm test` / regression; update standing exam last-run; matrix §3 status columns; BACKLOG B-lambda-http / B-dynamo-handler-kind → done or partial with residuals listed. |
| **Verify** | BoA R1, Fineract exams, NestJS, ontology tests still green |
| **Status** | **done, 2026-08-08** — both exams re-run fresh (not reused from Y4's run) and re-confirmed: `E-fidelity-lambda-lab` `validate-calm-pair.mjs` L0/L1/L2 all PASS, exit 0; `E-saas-boost-tier` manual diff against gold, exact path-set match. Full suite 59/59 green (58 + the new S5 test), including BoA R1/Fineract/NestJS/ontology regressions all unaffected. `B-lambda-http` → `done for Java+explicit-CFN shape` with residuals explicitly listed in BACKLOG.md, not swept in. `Fidelity_Yardstick_Closeout_Matrix.md` §3 (`FY-http-lambda`/`FY-infra-cfn`) and §5 (`G-FY-01`/`G-FY-02`/`G-FY-03`) updated — partial re-score, not the full T-Y6-1 sweep. |

**Phase Y5 exit, 2026-08-08:** Program DoD for serverless P1 met. `pipeline/src` changes this phase: `coverage-report.ts` (S5 flag), `pass-registry.ts`/`cfn-route-pass.ts` (expose real counts). New dedicated lab fixture `java-lambda-orphan-store` (deliberately generic, not sample-named). Full suite 59/59 green including 1 new locked regression test.

---

## Phase Y6 — Matrix re-score + deferred gaps

### T-Y6-1 — Re-score Fidelity matrix

| | |
|---|---|
| **Do** | Update every P-http / P-persist Dynamo / CFN path row status. Changelog on matrix. STATUS § Fidelity serverless → done/partial. |
| **Verify** | No row left “named only” for Lambda |
| **Status** | **done, 2026-08-08** — full sweep: `FY-db-dynamo` (§3.2, stale "handler mis-kind" replaced with real Y2 closure), §4.1 priority table (P0/P1 row reframed from live-problem to closed-with-residual), §4.4 proxy-authority table (both Lambda-related rows' "(when built)"/"Future lab" language replaced with dated, real closure), §6 standing exams table (both exam rows: "fail or skip until built" → real PASS results). §1.2's historical RCA table deliberately left untouched — it correctly describes the original miss, not current state, same history-preservation discipline as every other doc this session. `STATUS.md` → `done`, program CLOSED. |

### T-Y6-2 — Optional G-FY-04 / G-FY-05 design-only

| | |
|---|---|
| **Do** | Only if owner requests: thin design stubs for Kinesis and OAuth2 import — **no code** unless promoted to P1. |
| **Verify** | BACKLOG rows accurate |
| **Status** | **explicitly skipped, 2026-08-08** — its own gate is "only if owner requests," and no such request was made this round. `B-kinesis`/`B-oauth2-import` remain accurate `todo` rows, not silently promoted or dropped. |

---

## Definition of program done

- [x] Y0–Y1 complete (matrix + design + lab gold)
- [x] Y2–Y4: lab service + paths + correct Dynamo kinds — verified on lab AND the real wild repo (5/5 real paths, real architecture edge)
- [x] Y5: exams updated; suite green (59/59); no forbidden Fidelity claim language (Claim Register scoped to "Java+explicit-CFN shape" throughout, never bare "Lambda works")
- [x] Claim **U-http-serverless** at least **partial** with evidence pointers — currently `partial → proven for Java+explicit-CFN shape`, exceeds the bar
- [x] Hard-test finding HT-ASB-001/002 updated (closed or residual-named) — `aws-saas-boost-tier-service-gold-vs-platform.md` §8 retest addendum
- [x] Matrix §5 G-FY-01/02 closed or residual-explicit — `Fidelity_Yardstick_Closeout_Matrix.md` §3/§5 partially re-scored at Y5 (the two directly-relevant rows + G-FY-01/02/03); **full sweep across every P-http/P-persist row is still T-Y6-1's job**, correctly not done early

**Program DoD met, 2026-08-08. Only Y6 (thin, docs-only matrix re-score + optional Kinesis/OAuth2 stubs) remains.**

**Not required for done:** full CFN topology, Kinesis, Angular, Spark, CodeGraph upstream fix.

---

## Suggested agent session splits

| Session | Tasks |
|---|---|
| S1 | T-Y0-1…T-Y0-3, T-Y1-1…T-Y1-3 |
| S2 | T-Y2-1…T-Y2-2 |
| S3 | T-Y3-1…T-Y3-2 |
| S4 | T-Y4-1…T-Y4-2 |
| S5 | T-Y5-1…T-Y5-2, T-Y6-1 |

---

## Changelog

| Date | Note |
|---|---|
| 2026-08-08 | **PROGRAM CLOSED (Y6).** Full matrix sweep — every P-http/P-persist Dynamo/CFN row reflects real, dated status; no row left "named only" for Lambda. T-Y6-2 explicitly skipped (owner-request gate not met, not silently dropped). `docs/solution/STATUS.md`'s Fidelity yardstick row → `done`. All Y0-Y6 phases complete: matrix lock → design → lab gold → Dynamo ownership (zero new code) → handler-as-service → CFN path join → completeness flag → full re-score. Real, verified on the actual wild repo this program was built around throughout, not just synthetic. Honest residuals carried forward, not swept in: Node/Python Lambda handlers, SAM `Events:` shorthand, cross-stack CFN refs, only one real evidenced CFN-authoring style (a second real repo would strengthen the generalization claim). |
| 2026-08-08 | **Y5 complete + Program DoD met.** New `S5` completeness flag (`coverage-report.ts`) closes the HT-ASB-006 class generically — two real conditions (0 service units with a real store present; CFN routes found but unbound), verified on a new, deliberately generic lab fixture and confirmed silent on the healthy real repo. Both standing exams re-run fresh, still PASS. `Fidelity_Yardstick_Closeout_Matrix.md` partially re-scored (2 rows + 3 gap-register entries). `B-lambda-http` → `done for Java+explicit-CFN shape` with residuals explicitly listed. Full suite 59/59 green. Only Y6 (thin, docs-only) remains. |
| 2026-08-08 | Initial program: yardstick-first phases Y0–Y6; serverless + Dynamo ownership implementation gated on matrix/design/lab |
