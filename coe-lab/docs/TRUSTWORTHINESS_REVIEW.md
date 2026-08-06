# CoE Lab — Trustworthiness review vs platform requirements

**Review date:** 2026-08-07 (updated same day after **empirical baselining**)  
**Reviewed against:** `CALM_Generator_Requirements_v0_14` coverage matrix + dual-goal platform intent (v0.6–v0.11 themes: routes, persistence, messaging, controls, k8s trust, OpenAPI, vertical slices, determinism, no LLM-in-core).  
**Lab paths:** `coe-lab/**`  
**Baselines:** `docs/BASELINES.md` (re-baselined 2026-08-07 post-MVP / CONTRACT 4.0.0 — includes Kafka consumer detect + full CALM SOT validate)

---

## 1. Verdict

| Question | Answer |
|---|---|
| Is the lab **trustworthy enough to start evaluating** the platform? | **Yes.** Core tier has measured scores (all core packages **pass** after scorer/fixture fixes). |
| Does it **align with requirements**? | **Strongly for Slice 1/2 languages and Fidelity-aligned *signal menu***; intentionally incomplete for out-of-scope matrix cells (frontend, Scala, gRPC). |
| Biggest remaining trust risk | **Representativeness** — lab is tiny; still need wild-type (BoA/Fineract). Stretch packages correctly show **0 recall** until messaging/cloud land. |
| Second risk | Nest dual **openapi.yaml** unit (mitigated in gold ignore); Java packages use thin poms, not full Spring Boot apps. |

**One line:** Lab is now a **measurement-capable** core gate (nodes/interfaces/rels on controlled packages) **plus** stretch probes for open platform gaps — not a substitute for real monorepos.

---

## 2. Requirements coverage matrix vs lab

Legend: **G** = gold + fixture exist · **P** = partial/stretch · **—** = deliberately absent · **W** = wild-type only (spikes)

| Concern (v0.14) | Java | Python | Node | Lab coverage |
|---|---|---|---|---|
| Routes / entry-points | Spring, JAX-RS | Flask | NestJS | **G** `java-spring-payments`, `java-jaxrs-charges`, `py-accounts-api`, `py-ledger-worker`, `ts-nestjs-users` |
| Persistence annotation (JPA) | ✅ | — | — | **G** Charge, Payment entities |
| Persistence repository-interface | Spring Data | — | — | **—** gap (should be lab v0.2) |
| Persistence import/driver | jOOQ/Mongo etc. | SQLAlchemy | — | **G** Python SQLAlchemy; **—** jOOQ |
| Persistence cloud (Dynamo) | — | — | DynamoDB | **P** `ts-orders-dynamo` stretch |
| Messaging traditional (Kafka) | Kafka | — | — | **P** `java-kafka-settlement` stretch |
| Messaging cloud (SQS/SNS) | — | — | SQS/SNS | **P** SQS in orders-dynamo; **—** SNS |
| Batch (Spring Batch / Spark) | Spring Batch | — | Scala Spark | **—** (Spark out of language scope) |
| Auth decorator | @PreAuthorize etc. | — | — | **—** gap (OpenAPI bearer only on Nest package) |
| Auth call-based JWT | — | jwt.decode | — | **—** gap |
| Auth OAuth2 libs | named | — | — | **—** gap |
| k8s trust (shared Secret) | BoA-class | | | **P** `deploy/k8s` stretch |
| OpenAPI / Swagger | — | — | ✅ | **P** `ts-nestjs-users/openapi.yaml` (ingest depends on X4) |
| Frontend Angular | | | ✅ | **outOfScope** in gold (correct) |
| gRPC / trading domain | ❌ | | | **—** correctly not forced into gold as FN |
| Payments **domain** product | unevidenced | | | Lab has **payments-shaped API** signal package — OK as *signal*, not domain proof |

### Dual goals / solution integrity

| Requirement theme | Lab support | Trust note |
|---|---|---|
| Deterministic generation | Scorer is deterministic; no LLM oracle | Good |
| CALM construction quality | Scores calm.json vs gold | Good |
| Platform (multi-module) | Multi-root Python pair | Partial — no second-module score |
| HITL / overrides | Not in lab v0.1 | Optional later metric |
| No LLM in core | Enforced by design | Good |
| Isolation of gold | ISOLATION + ignores + CLAUDE.md | Soft technical barrier; process-dependent |

---

## 3. Trust pillars — pass / conditional / fail

### 3.1 Methodological trust — **PASS (conditional)**

| Pillar | Status | Evidence |
|---|---|---|
| Authored architecture first | Pass | Gold files per package |
| Fixtures embody gold | Conditional | Routes/entities match by inspection; not every gold interface proven extractable today |
| Core vs stretch tiers | Pass | Stretch lists `expectedPlatformGaps` |
| Must-not-detect trap | Pass | `lib-fintech-common` |
| Out-of-scope not scored as FN | Pass | Frontend etc. in `outOfScope` |
| Miss taxonomy → platform work | Pass | `methodology.md` |
| Wild-type companions named | Pass | Research doc §4 |

### 3.2 Technical trust (will scores mean something?) — **CONDITIONAL**

| Risk | Severity | Mitigation |
|---|---|---|
| **No published baseline scores** | High | Run `run-eval.sh` on all **core** packages once; commit sample `eval-results` only if desired, or document baselines in STATUS |
| **CodeGraph `detect()` without real deps** | High for Java | Spring/JAX-RS packages lack `pom.xml` with spring/jaxrs deps — may get **0 routes** despite gold. **Add minimal manifests or mark expected detect risk.** |
| **NestJS stub decorators** | Medium | Local `function Controller` stubs ≠ `@nestjs/common` — may not match Ghostfolio-class extraction. Prefer real Nest fixture in pipeline/test as wild-type; lab Nest is **signal-shaped**. |
| **Dynamo package non-resolvable imports** | Low for eval | Imports are detection strings; Graphify may still see them; Node may not “run” |
| **Gold name matching fragile** | Medium | Substring match can false-TP; scorer uses nodeType — OK if types correct |
| **k8s gold expects service nodes from YAML alone** | High for stretch | Current pipeline has **no k8s provider** — stretch will FN; correctly labeled stretch, but don’t use for core gate |
| **Relationship gold sparse** | Medium | Many packages have 0 gold relationships — under-tests edges |
| **Interface path style** | Medium | Flask `<id>` vs Nest `:id` vs JAX-RS `{id}` — scorer normalizes; verify after first real calm output |

### 3.3 Process / bias trust — **PASS (process-dependent)**

| Control | Status |
|---|---|
| Gold separated from fixtures | Pass |
| `.cursorignore` / `.grokignore` on gold packages | Pass |
| Eval-only agent prompt | Pass |
| CLAUDE.md isolation | Pass |
| Cannot force agent compliance | Residual risk — human must not mix eval+implement in one biased session |

### 3.4 Representativeness trust — **CONDITIONAL**

| Claim | Reality |
|---|---|
| “Fidelity stack” | **Signal menu** from hiring + v0.14 — honest in research doc |
| “Many fintech frameworks” | Good for Java/Python/TS **in pipeline scope** |
| Production monorepo mess | **Not** represented (half-migrations, multi-module Maven reactor, codegen OpenAPI) |
| Scale | Packages are tiny — no 7k-file stress |

---

## 4. Package-by-package trust assessment

| Package | Gold↔fixture consistency | Likely platform outcome today | Trust as gate |
|---|---|---|---|
| py-accounts-api | Strong (routes + SQLAlchemy class) | High chance core pass if Graphify/Flask work | **Yes — primary** |
| py-ledger-worker | Strong | Same | **Yes** |
| py-multi-root | Strong for nodes | Cross-root edges only if graph finds them | **Yes for nodes** |
| ts-nestjs-users | Interfaces plausible; OpenAPI present | Depends on Nest extraction quality of stubs | **Yes with caution** |
| ts-orders-dynamo | Stretch gaps documented | Expect FN on dynamo/network | **Stretch only** |
| java-spring-payments | Annotations + minimal pom | **Empirical pass** (3 native routes) | **Yes** |
| java-jaxrs-charges | Fineract-shaped + pom | **Empirical pass** (decorator path, 0 native) | **Yes** |
| java-kafka-settlement | Stretch | Expect FN network | **Stretch only** |
| lib-fintech-common | Strong trap | Must stay zero services | **Yes — precision gate** |
| deploy-k8s-trust | Stretch | Expect fail until X5 | **Stretch only** |

---

## 5. Gaps in the lab vs “excellent validation” (requirements-complete)

| Missing for excellence | Why it matters | Priority |
|---|---|---|
| **Empirical core baselines** (run + record scores) | Without this, trust is theoretical | **Done** — see BASELINES.md |
| **pom.xml / package manifests** for Java detect() | Avoid false “platform broken” on lab | **Done** (minimal poms) |
| **@PreAuthorize / jwt.decode packages** | Controls are in-scope requirements | **P1** |
| **Spring Data repository package** | v0.12/v0.14 persistence shape | **P1** |
| **FastAPI package** | Coverage matrix Python routes diversity | **P1** |
| **SNS** (alongside SQS) | Fidelity cloud messaging | **P2** |
| **Relationship-rich gold** (service→service HTTP client) | Edge recall under-tested | **P1** |
| **CI workflow** for core tier | Continuous trust | **P1** |
| **Aggregator report** (all packages one table) | Pilot scorecard | **P1** |
| **Link scores to STATUS / gap taxonomy IDs** | Close loop to extraction tasks | **P1** |
| **Commit-pinned baseline** in gold `changelog` after first green | Drift control | **P0** after first runs |

---

## 6. What would make a score “trustworthy” in practice

Use this **acceptance bar** before treating lab results as platform quality:

1. **Core tier** packages each have a recorded `score.json` from a real `run-slice` (not hand-waved).  
2. **lib-fintech-common** has **0 must-not-detect violations**.  
3. At least **one multi-root** Python score exists.  
4. Stretch packages may fail; failures map to **expectedPlatformGaps** or a new gap class — not silent.  
5. Same commit of gold + fixtures used for score.  
6. Parallel **wild-type** note: BoA and/or Fineract still pass regression suite.  
7. No platform PR that both opens gold and changes catalogues without an eval-only miss write-up.

---

## 7. Recommendations (ordered)

| # | Action | Effect on trust |
|---|---|---|
| 1 | Run eval on all **core** packages; archive scores under `eval-results/` (local) or paste summary into STATUS | Turns lab from design into measurement |
| 2 | Add minimal **Java `pom.xml`** (or document extractFromSource-only indexing path) for spring + jaxrs packages | Removes detect() false alarms |
| 3 | Add **control** fixture (`@PreAuthorize` and/or `jwt.decode`) | Aligns with controls requirements |
| 4 | Demote any core package that systematically fails for fixture reasons to stretch until fixed | Protects gate integrity |
| 5 | Keep stretch failures as **backlog drivers**, not ship blockers | Honest tiers |
| 6 | Never replace wild-type with lab-only green | Generalization trust |

---

## 8. Bottom line

| | |
|---|---|
| **Requirements alignment** | **Good** for languages/frameworks in Slice 1/2 and Fidelity *signal* coverage; honest about stretch and out-of-scope. |
| **Trustworthiness now** | **Design-trustworthy, measurement-not-yet-proven.** Isolation and methodology are solid; **empirical baselines are the missing seal.** |
| **Safe use** | Use core packages + trap for regression-style eval after baselines; use stretch to track X2/X5/X7. |
| **Unsafe use** | “Lab all green ⇒ ready for Fidelity monorepo” without wild-type and without fixing detect()/stub risks. |

**Honest summary:** The CoE lab is a **credible evaluation design** aligned with your requirements and dual goals. It becomes **trustworthy evidence** only after you **run the scorer against real pipeline output** on core packages and fix any fixture/detect gaps those runs expose — until then, treat it as an excellent **spec for validation**, not yet a completed **validation result**.
