# Standing exams — serverless / a large financial-services organization yardstick program

**Status:** T-Y1-3 deliverable, [`AGENT_TASKS_Fidelity_Yardstick_and_Serverless.md`](../../docs/solution/AGENT_TASKS_Fidelity_Yardstick_and_Serverless.md).
**Scope:** exams for `U-http-serverless` / `B-lambda-http` / `B-dynamo-handler-kind`. Separate from [`standing-disconfirming-exams.md`](./standing-disconfirming-exams.md), which is scoped to the layered-architecture-story program specifically — different programs, different exam vocabularies, not conflated.
**Rule:** same as the layered-story program's own — an architecture/claim update for `U-http-serverless` without updating the relevant exam's last-run row here is a process reject.

---

## E-fidelity-lambda-lab

| | |
|---|---|
| **Protocol** | `run-slice` on `coe-lab/fixtures/monorepo/packages/java-lambda-apigw` → compare against `coe-lab/gold/calm/java-lambda-apigw/` via `validate-calm-pair.mjs --package java-lambda-apigw` |
| **Expected outcome until B-lambda-http/B-dynamo-handler-kind ship** | L0 PASS; L1 **FAIL** (`TierService` invisible — 0 units; `LegacyTierHandler` mis-typed `database`) |
| **Expected outcome after Y2+Y3+Y4 ship** | L1 PASS (both handlers `service`, paths present via CFN join); L2 PASS (`TierService → TierStore` connects) |

**Last-run:**

| Date | Agent/session | Result | Artefact / evidence |
|---|---|---|---|
| 2026-08-08 | a large financial-services organization yardstick session (T-Y1-2/T-Y1-3) | **Expected-fail state confirmed real, pre-fix baseline** — real `run-slice` on the fixture: `TierService` produces **0 TypedUnits at all** (invisible, matches real `aws-saas-boost-tenant-service` HT-ASB-007); `LegacyTierHandler` typed `database` solely from its `DynamoDbClient` field (matches real `aws-saas-boost-tier-service` HT-ASB-002); `TierStore` correctly `database`. Gold `calm validate` 0 errors, 0 warnings. | `coe-lab/gold/calm/java-lambda-apigw/architecture.calm.json`; fixture `coe-lab/fixtures/monorepo/packages/java-lambda-apigw/` |
| 2026-08-08 | a large financial-services organization yardstick session (T-Y5-2, full close) | **PASS, fully re-confirmed on a fresh re-scan.** `L0 schema (gold): PASS`, `L0 schema (gen): PASS`, `L1 unit recall: PASS`, `L2 story: PASS`, exit code 0. Both handlers real `service` units with real CFN-resolved paths; real architecture-grade connects. | Fresh `coe-lab/generated/java-lambda-apigw/architecture.calm.json` |
| 2026-08-08 | a large financial-services organization yardstick session (Y2+Y3 shipped) | **PASS on unit kind + L2, L1 paths still FAIL as honestly expected (Y4 not built).** Real re-run: `TierService` and `LegacyTierHandler` both correctly `service` (no longer invisible, no longer mis-kinded); `TierStore` correctly `database`; `TierService → TierStore` real architecture-grade `connects` (L2 story **PASS**). `validate-calm-pair.mjs --require-l2`: `L1 unit recall: FAIL` (3 "missing interface path" — expected, paths are Y4's job), `L2 story: PASS`. Locked regression test added (`pipeline/test/regression.test.js`). Full suite 56/56 green, including a check that broadening the `implements`-fact extraction filter caused no regression elsewhere. | `pipeline/test/regression.test.js` new test; `coe-lab/generated/java-lambda-apigw/architecture.calm.json` |

## E-saas-boost-tier

| | |
|---|---|
| **Protocol** | `run-slice` on `spikes/aws-saas-boost/repo/services/tier-service` → compare against `coe-lab/gold/calm/aws-saas-boost-tier-service/` |
| **Expected outcome until shipped** | L1 FAIL (0 service units; `TierService` mis-typed `database`) — real, already-run baseline |
| **Expected outcome after ship** | L1 PASS for unit kind; L1 path recall depends on Y4 (CFN join) reaching this real repo's actual template shape |

**Last-run:**

| Date | Agent/session | Result | Artefact / evidence |
|---|---|---|---|
| 2026-08-08 | hard-test #2 (pre-Y0) | **FAIL, as expected pre-fix** — 0 service units, `TierService` typed `database`, 0 architecture-grade relationships | `coe-lab/docs/findings/aws-saas-boost-tier-service-gold-vs-platform.md` |
| 2026-08-08 | a large financial-services organization yardstick session (T-Y5-2, full close) | **PASS, fully re-confirmed on a fresh re-scan** — manual diff (gold has `x-lab-grain: class-file`, so the automated scorer reports N/A, same as before): generated paths `['DELETE /tiers/{id}', 'GET /tiers', 'GET /tiers/{id}', 'POST /tiers', 'PUT /tiers/{id}']` exactly equal gold's. HT-ASB-006's completeness gap also verified closed by the new S5 flag (T-Y5-1) — fires correctly on a 0-service/CFN-unbound synthetic, silent on this healthy real repo. | Fresh scan output, manual diff against `coe-lab/gold/calm/aws-saas-boost-tier-service/` |
| 2026-08-08 | a large financial-services organization yardstick session (Y4 shipped) | **PASS — full real-repo win.** Real re-run with `--cfn-manifests spikes/aws-saas-boost/repo/resources` (the repo's own real CFN templates): `TierService` → real `service` unit, **5/5 real paths exact match to gold** (`GET/POST /tiers`, `GET/PUT/DELETE /tiers/{id}`); real `TierService → DynamoTierDataStore` architecture-grade edge, exact match to gold. HT-ASB-001/002/005 closed. Honest residual: only 5 of 26 real CFN bindings found across the whole shared `resources/` dir bound to this scan's roots — the other 21 are real routes for other SaaS Boost services not in this scan, correctly left unresolved. HT-ASB-003/004 (test/method noise) and HT-ASB-006 (completeness UX) explicitly still open. | `coe-lab/docs/findings/aws-saas-boost-tier-service-gold-vs-platform.md` §8 retest addendum |

## E-saas-boost-tenant (secondary — WDL-1 generalization check)

| | |
|---|---|
| **Protocol** | `run-slice` on `spikes/aws-saas-boost/repo/services/tenant-service` → compare against `coe-lab/gold/calm/aws-saas-boost-tenant-service/` |
| **Expected outcome until shipped** | L1 FAIL (`TenantService` invisible, 0 units — the "clean" disconfirming variant, no Dynamo mis-kind since the handler doesn't import Dynamo itself) |

**Last-run:**

| Date | Agent/session | Result | Artefact / evidence |
|---|---|---|---|
| 2026-08-08 | hard-test #3 (pre-Y0) | **FAIL, as expected pre-fix, confirms WDL-1 is systematic not tier-service-specific** | `coe-lab/docs/findings/aws-saas-boost-tenant-service-gold-vs-platform.md` |

---

## How to update this file

1. Run the exam's real protocol (or cite the closest real evidence already gathered).
2. Append a new last-run row — never overwrite history.
3. Update `Claim_Register.md`'s `U-http-serverless` cell + `BACKLOG.md`'s `B-lambda-http`/`B-dynamo-handler-kind` rows in the same change.

---

## Changelog

| Date | Note |
|---|---|
| 2026-08-08 | Initial file (T-Y1-3). Three exam IDs: `E-fidelity-lambda-lab` (controlled lab fixture, both WDL-1 and WDL-2 shapes), `E-saas-boost-tier` and `E-saas-boost-tenant` (real wild repos, seeded from the two real hard-tests already run). All three currently show the expected pre-fix FAIL state, confirmed real not assumed. |
| 2026-08-08 | Y2-Y4 shipped: `E-fidelity-lambda-lab` and `E-saas-boost-tier` both re-run and PASS (unit kind + real paths + real architecture edge). `E-saas-boost-tenant` not yet re-run this round (no Dynamo-import handler in that shape to exercise D-dynamo-priority differently; low marginal value — deferred to Y5's full exam close, not silently skipped). |
