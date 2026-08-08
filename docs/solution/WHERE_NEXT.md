# Where next — clear path (2026-08-08)

## Named list (easy reference)

| Name | What it is |
|---|---|
| **Weaver Discovery Ladder (WDL)** | Prioritized discovery queue: Java → TS/Node → Python; cloud/K8s first within each. Owner-good 2026-08-08. |
| **Short cite** | `WDL` or “the Discovery Ladder” |
| **Canonical section** | **§2.1** of this file (ranked table 1–18) |
| **Later** | Prethink Find* parity is **out of WDL scope** until we reopen “Prethink capability pick-up” |

**You are not behind.** Three tracks got mixed. This file is the **single navigation** for what to do now.

| Track | Purpose | May edit pipeline? |
|---|---|---|
| **H** Hard-tests | Find / confirm gaps on real repos | **No** (eval only) |
| **S** Solutioning | Prioritized discovery list + design | Docs only until implement |
| **I** Implement | Close P1 gaps (e.g. serverless) | Yes, from backlog |

**Rule:** Hard-tests **fill evidence** for the list. They do **not** invent product scope mid-session. Implementation only from **BACKLOG** after you prioritize.

---

## Your three asks → where they live

| Your item | Deliverable | Status |
|---|---|---|
| Prethink vs Weaver comparison | §1 this file | **done here** |
| Potential discovery list + fintech priority | §2 this file | **done here** (candid: priority list, not “solid proven”) |
| Back to hard-test #2 + ~9 more packages | §3 this file + registry | **next action** |

---

## 1. Prethink vs Weaver (one page)

### 1.1 Product split (Prethink)

| Layer | OpenRewrite public `rewrite-prethink` | Moderne full Prethink |
|---|---|---|
| Framework Find* (Spring, Kafka, Feign…) | **Not in repo** | Commercial recipes (docs list) |
| Intermediate model | Data tables (schemas OSS) | Same tables + filled |
| CALM export | **Yes** (`GenerateCalmArchitecture`) | Yes |
| Agent packaging | Yes (CLAUDE.md, CSV context) | Yes + quality/tests/LLM optional |

### 1.2 Side-by-side

| Dimension | **Weaver** | **Prethink (full product)** | **Prethink OSS kit only** |
|---|---|---|---|
| **Primary job** | Deterministic architecture → CALM for monorepos | Agent context + architecture tables → CALM | Assemble CALM if tables full |
| **Code model** | CodeGraph + Graphify (source-friendly) | OpenRewrite **LST** (build-coupled) | Consumes tables only |
| **HTTP** | Flask/Nest/JAX-RS strong; Spring thinner; **Lambda/API GW open** | Broad Spring/JAX-RS/Nest/… (docs) | Schema only |
| **Outbound HTTP** | **Gap** | First-class (Feign/WebClient/…) | Schema ready |
| **Persist** | JPA, Spring Data, jOOQ, Dynamo import, Prisma ownership | JPA/SD/JDBC/MyBatis + Node ORMs (docs) | Schema only |
| **Messaging** | Kafka + SQS partial | Kafka/Rabbit/JMS/SQS (docs) | Schema only |
| **Relationships** | R0 structural, R1, R2 multi-hop, grades | Package + method-call → connects/interacts | Builder only |
| **Multi-root honesty** | Explicit product (exams) | Multi-repo LST platform | N/A alone |
| **Completeness / silence** | S0–S4, HITL | Not their claim | No |
| **Claim discipline** | Claim Register + L0–L5 | Not their claim | No |
| **CALM** | Primary deliverable | Explicit deliverable | Explicit deliverable |
| **Mainframe / dual estate** | OOS named | Not a focus | No |

### 1.3 How to talk about it

| Don’t say | Do say |
|---|---|
| “Only we do CALM from code” | “CALM export is shared (Prethink does it too); we compete on **honesty, multi-root, zero-build hybrid, eval**” |
| “Prethink’s GitHub has full discovery” | “Public repo is **tables + CALM + agents**; Find* is Moderne” |
| “We must clone every Prethink recipe” | “Use their **table catalogue** as a checklist; prioritize by **fintech + our exams**” |

**Docs:** [`OpenRewrite_Prethink_Source_and_Similar_Solutions_Research.md`](../spikes/OpenRewrite_Prethink_Source_and_Similar_Solutions_Research.md)

---

## 2. Discovery priority list for solutioning — **Weaver Discovery Ladder (WDL)**

**Official name:** **Weaver Discovery Ladder (WDL)**  
**Cite as:** WDL rank *N* (e.g. “WDL-1 Lambda”, “WDL-7 Java outbound”).

**Candid grade:** Priority nomination for solutioning + hard-tests — **not** “solid proven coverage.” Solid = claim cell + fail sample + green exam.  
**Frozen for now** (owner good 2026-08-08). Prethink breadth pick-up = separate future exercise, not a silent WDL expand.

### 2.0 Ranking rules (owner lock 2026-08-08)

| Rule | Order |
|---|---|
| **Language** | **1. Java** → **2. TypeScript/Node** → **3. Python** → 4. other (ignore unless forced) |
| **Within a language** | **Cloud + K8s first** (Lambda/API GW, Dynamo/S3, SQS, EKS/k8s trust) → then core app frameworks (Spring/Nest/Flask, messaging, outbound) → then nice-to-haves |
| **Active scope** | P0–P2 + optional **Fluxnova** (Java BPM). Rest OOS / ignore for now |
| **Do not** | Mirror every Prethink Find*; implement low language tiers before high cloud gaps on Java |

**Score intuition:** `(language weight) × (cloud/k8s boost) × (fintech + competitive need)`.

### 2.1 Ordered build / firm-up queue (use this order)

| Rank | ID | Discovery | Lang | Cloud/K8s? | Status | Backlog / next |
|---|---|---|---|---|---|---|
| **1** | D-lambda | Lambda handler + API GW/CFN paths → service + interfaces | **Java** first (saas-boost); TS/Python later if sample | **Cloud** | **done, 2026-08-08 (Y0-Y6, `partial → proven` for Java+explicit-CFN)** — real, verified on the actual `aws-saas-boost-tier-service` repo (5/5 paths exact match to gold); residual: Node/Python + SAM shorthand, no sample yet | **B-lambda-http** · HT saas-boost — **closed for evidenced shape** |
| **2** | D-dynamo-own | Dynamo SDK import ≠ database owner (handler vs store) | **Java** first; Node Dynamo already better | **Cloud** | **done, 2026-08-08 (Y2)** — real finding: zero new code needed, existing B-ontology mechanism already generalized | **B-dynamo-handler-kind** — **closed** |
| **3** | D-k8s | K8s trust / deploy correlation (maintain + any residual) | Polyglot manifests | **K8s** | partial | maintain R-k8s; BoA multi hard-test optional |
| **4** | D-s3 | S3 as data-asset / integration store | Java/Node SDK | **Cloud** | nominate | catalogue when sample |
| **5** | D-sqs-sns | SQS/SNS producers (maintain; SNS thinner) | Node lab done; Java if sample | **Cloud** | partial | maintain B-msg-prod-sqs |
| **6** | D-spring-mvc | Spring Boot REST parity with JAX-RS | **Java** | app | partial | calm-hub / Spring hard-test |
| **7** | D-outbound-java | Feign / WebClient / RestTemplate → service→service | **Java** | app | **partial (corrected 2026-08-08, was mislabeled `gap`)** — `outbound-http-detector.ts`/`outboundHttpPass` already built + live in `DEFAULT_PASSES`; `RestTemplate`/`WebClient` already `dispatched` in the catalogue. Real, precise, small residual verified by scan: `OkHttpClient`/`HttpURLConnection` missing from the catalogue's library list (real Fineract `ExternalCreditBureauIntegrationWritePlatformServiceImpl.java` evidence) — 2 catalogue rows, not a new detector. `@FeignClient` decorator strategy honestly `not-implemented`, no real sample yet. | **B-http-client** — catalogue-row fix, cheapest real win on the ladder right now |
| **8** | D-kafka | Kafka consumer/producer | **Java** primary | app | partial | maintain |
| **9** | D-oauth-java | Spring Security / OAuth2 depth | **Java** | app | partial | after OpenAPI / controls |
| **10** | D-rabbit | RabbitMQ | **Java** | app | thin | sample first |
| **11** | D-redis | Redis/ElastiCache | Java/Node | cloud-adj | nominate | import catalogue |
| **12** | D-graphql-java | GraphQL (Spring GraphQL / DGS) | **Java** | app | unevidenced | sample first |
| **13** | D-fluxnova | Fluxnova / BPM workflow | **Java** | app (FINOS) | nominate | sample; design when ready |
| **14** | D-outbound-ts | axios / fetch / got → service→service | **TS/Node** | app | gap | after Java outbound or ghostfolio HT |
| **15** | D-nest-cloud | Nest + cloud clients (Dynamo/SQS already partial) | **TS/Node** | cloud | partial | ghostfolio hard-test |
| **16** | D-openapi-ts | OpenAPI dual-unit / C-contract (maintain) | **TS** lab | app | partial | maintain |
| **17** | D-python-http | Flask maintain; FastAPI only if forced | **Python** | app | Flask proven | boa hard-test optional |
| **18** | D-python-cloud | boto3 / cloud only if pilot | **Python** | cloud | unevidenced | ignore unless forced |
| — | D-grpc, D-mybatis, legacy, FDC3/kdb/CDM… | — | — | **ignore for now** | OOS / later |

### 2.2 Same items as band view (quick)

| Band | Items |
|---|---|
| **P0 — CLOSED, 2026-08-08** | ~~1–2 Lambda + Dynamo ownership~~ (**Java cloud**) — done, see §2.1 |
| **P0b — cloud/k8s keep hot, next real work** | 3–5 k8s, S3, SQS/SNS — mostly maintain/nominate, not fresh gaps (see §2.4 below) |
| **P1 — Java app core, real gaps here** | 6–9 Spring REST, **Java outbound (real, unblocked gap)**, Kafka, OAuth |
| **P2 — Java breadth + BPM** | 10–13 Rabbit, Redis, GraphQL, **Fluxnova** |
| **P1/P2 — TS then Python** | 14–18 outbound-ts, Nest/cloud, OpenAPI; Python last |

### 2.4 Real state of P0b (3–5) — not fresh gaps, don't re-open as if new

Checked against the current Claim Register, not re-guessed: rank 3 (`D-k8s`) is `partial`/actively maintained (T-E6 re-watched under harder conditions, clean); rank 4 (`D-s3`) is a real, still-**unbuilt** nomination — no catalogue row exists, and no real sample has been gathered yet (own note: "catalogue when sample" — needs a hard-test first, not blind implementation); rank 5 (`D-sqs-sns`) is genuinely `partial` (SQS import-only proven, SNS still thin) and already tracked under `B-msg-prod-sqs`. None of these three are "next build" candidates the way ranks 1–2 were — they're either already maintained or blocked on a missing evidence sample.

### 2.5 What actually changed after Fidelity yardstick Y0-Y6 closed

§5's own rule said: *"Implement Feign because Prethink has it, before Lambda hard-test is closed or generalized"* — **forbidden**. Lambda (WDL-1/2) is now closed. That constraint is lifted. **Rank 7 (`D-outbound-java`, Feign/WebClient/RestTemplate → service→service) is the highest-ranked item on the whole ladder that is both (a) a real, explicitly-named `gap` (not `partial`/`maintain`) and (b) no longer blocked by an open higher-priority item.** Rank 6 (`D-spring-mvc`, Spring Boot REST parity) is `partial`, not a hard gap, and has a named but not-yet-run hard-test sample (`calm-hub-core`, §3.2 row #5) — evidence-gathering-first, per this doc's own §2.3 rule (`claim cell → backlog ID → hard-test or lab fail sample → implement → exam green`), not straight to code.

### 2.3 What solutioning does with this list

```text
claim cell  →  backlog ID  →  hard-test or lab fail sample  →  implement  →  exam green
```

**Do not** implement TS outbound or Fluxnova before **Java cloud P0 (1–2)** unless a hard-test forces a reorder.

---

## 3. Hard-test track — resume and finish the queue

### 3.1 Done

| package-id | Result | Feeds |
|---|---|---|
| maven-doxia-system-map | Empty expected (library) | Negative control |
| **aws-saas-boost-tier-service** | Dynamo yes; Lambda no; handler→DB | **WDL-1, WDL-2** |
| **aws-saas-boost-tenant-service** | **#3 compared** — WDL-1 systematic; handler invisible; DAL OK | **WDL-1**; WDL-2 N/A this shape |

**Phase I built and closed, 2026-08-08.** `AGENT_TASKS_Fidelity_Yardstick_and_Serverless.md` Y0-Y6 complete — WDL-1/WDL-2 both real, verified on `aws-saas-boost-tier-service` itself (5/5 real paths exact match to gold), not just synthetic. See `Fidelity_Yardstick_Closeout_Matrix.md` for the full re-scored status. **Next build candidate (per §2.5): rank 7, `D-outbound-java`** — the highest-ranked genuine `gap` no longer blocked by an open higher-priority item.

### 3.2 Suggested order for remaining hard-tests (~8)

Aligned with **Java → TS → Python** and **cloud/k8s first**. One package per cycle (playbook A→B→C).

| # | package-id | Why next | Discovery ranks |
|---|---|---|---|
| **3** | `aws-saas-boost-tenant-service` | **Java cloud** — generalize Lambda/Dynamo miss? | 1–2 |
| **4** | `aws-saas-boost-services-multi` | **Java cloud** multi-root / multi-Lambda | 1–2 |
| **5** | `calm-hub-core` | **Java** Spring/Quarkus-class REST | 6 |
| **6** | `waltz-web` | **Java** controls / call-site | 9-ish |
| **7** | `waltz-data` | **Java** jOOQ confirm | maintain |
| **8** | `ghostfolio-api` | **TS/Node** Nest + clients | 14–15 |
| **9** | `boa-userservice` | **Python** R1 (after Java/TS cloud pressure) | 17 |
| **10** | `boa-contacts` | **Python** second service | 17 |
| **11** | `boa-multi` | multi-root + **k8s** trust optional | 3, multi-root |

Optional later: more Fineract modules only if claim cells change.

### 3.3 Hard-test session rules (so you don’t get lost)

1. Pick **one** row from §3.2 with status `queued`.  
2. Playbook A→B→C only ([`hard-test-eval-playbook.md`](../../coe-lab/docs/hard-test-eval-playbook.md)).  
3. Write finding + HT-* backlog row; tag which **D-*** cells it hits.  
4. **Stop.** Do not implement detectors in the same session.  
5. After 2–3 packages, **re-rank §2** if evidence contradicts priority.

---

## 4. What to do next (post Y0-Y6 close, 2026-08-08)

Options A/B/C below (Fidelity serverless build vs. more hard-tests first) are **resolved** — Option B ran to completion. This section now answers the *next* fork.

### Option A — Eval-first (gather evidence for rank 7 before building)

```text
Today:  hard-test #5  calm-hub-core          (Java Spring/Quarkus REST, rank 6)
Next:   look for a real outbound-HTTP sample (Feign/WebClient/RestTemplate) — rank 7 has no hard-test sample cited yet, only a backlog ID (B-http-client)
Then:   #4 saas-boost-services-multi (multi-root Lambda generalization — strengthens WDL-1's n=1-repo evidence, doesn't unblock anything new)
```

### Option B — Build-first (if pilot needs outbound-HTTP service→service edges)

```text
Design note for D-outbound-java (same Y0/Y1-style gate: no detector code
before a design note + lab gold exist), reusing this project's proven
call-site/field-type extraction mechanisms (no new engine expected —
Feign's @FeignClient is decorator-shaped, RestTemplate/WebClient calls
are call-site-shaped, same family as C-call).
Verify against a real sample before committing to a mechanism shape —
rank 7 currently has ZERO real evidence gathered, unlike Lambda which
had 2 real hard-tests before Y0 started.
```

### Option C — Strengthen what's already built (lower risk, less new capability)

`aws-saas-boost-services-multi` (§3.2 #4) — the CFN join mechanism is currently proven against exactly one real repo's authoring style. A second real repo (or a multi-service scan of SaaS Boost itself) would close the "only one evidenced CFN-authoring style" residual named in `BACKLOG.md`'s `B-lambda-http` row, without opening new scope.

**Second correction, this time by actually running the pipeline, not just grepping source** — WDL's own table (§2.1 rank 7) labels `D-outbound-java` a `gap`, which overstates it. Real, checked state: `outbound-http-detector.ts`/`outboundHttpPass` **already exists and is already live** in `DEFAULT_PASSES` — this is not an unbuilt mechanism. `http-client-detection-catalogue.yml` already has a `dispatched` (not `not-implemented`) strategy, `import-only-client`, covering `RestTemplate`/`requests`/`axios`/`httpx`/`node-fetch`/`WebClient` — built from real evidence (BoA's `frontend.py`, Fineract's `SendMessageToSmsGatewayTasklet.java`) already gathered in an earlier session, not new. A second strategy (`resolvable-target-decorator`, for `@FeignClient`-style literal-target detection) is honestly `not-implemented` — no real `@FeignClient` usage was found in evidence repos when that catalogue was written.

**What's actually still open, verified by real scan just now** (not assumed): Fineract's real `ExternalCreditBureauIntegrationWritePlatformServiceImpl.java` uses `OkHttpClient`/`HttpURLConnection` — neither is in the catalogue's library list. Scanning the real containing module shows both fall through as generic unmapped signals (`"No signal-catalogue.yml rule matched raw signal 'OkHttpClient'"`), not even reaching the existing detector's own "unresolved-http-target" bucket. **This is a precise, small, real gap — two missing catalogue library rows on an already-built, already-dispatched mechanism — not a new detector to build.** Exactly the "new capability = new catalogue row" shape this project's whole discipline is designed for (`Catalogue_Intake.md`'s four requirements: evidence cited here, by file/line, real).

**Recommendation, corrected**: WDL rank 7 should be re-ranked from `gap` to `partial` (mechanism built, 2 real libraries missing from the catalogue) — a genuinely small, cheap, well-evidenced fix, not a design-note-first program like Lambda was. If you want new capability with real leverage, this is the cheapest real win on the ladder right now.

---

## 5. What **not** to do next

- More open-ended “research the industry” without a package-id.  
- Implement Feign because Prethink has it, before Lambda hard-test is closed or generalized.  
- Hard-test and patch detectors in the same chat.  
- Claim “solid list complete.”

---

## 6. Link map (when lost, open these)

| Need | File |
|---|---|
| **This navigation** | `WHERE_NEXT.md` (this file) |
| Hard-test queue | `coe-lab/docs/hard-test-repo-registry.md` |
| Hard-test how | `coe-lab/docs/hard-test-eval-playbook.md` |
| Findings backlog | `coe-lab/docs/coe-lab-hard-test-backlog.md` |
| Prethink source | `docs/spikes/OpenRewrite_Prethink_Source_and_Similar_Solutions_Research.md` |
| Serverless implement | `AGENT_TASKS_Fidelity_Yardstick_and_Serverless.md` |
| Product backlog | `BACKLOG.md` |

---

## 7. Immediate next message you can send (post Y0-Y6 close, 2026-08-08)

Copy one:

1. **“Fix B-http-client”** — cheapest real win: 2 catalogue rows on an already-built, already-dispatched mechanism, real evidence already cited (`Claim_Register.md`'s `U-outbound-http`).
2. **“Hard-test #5: calm-hub-core”** — resume eval for rank 6 (`D-spring-mvc`, Spring Boot REST parity), the next `partial` item with a named-but-unrun sample.
3. **“Hard-test #4: aws-saas-boost-services-multi”** — strengthen WDL-1/2's evidence base beyond one repo's CFN-authoring style (real residual named in `B-lambda-http`'s BACKLOG row).
4. **“Expand WHERE_NEXT §1 into a slide-ready comparison”** — docs only, unchanged from before.

Default recommendation: **(1)** — real, cheap, already-evidenced, no design note or hard-test needed first (unlike everything else on the ladder right now).
