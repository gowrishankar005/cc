# AGENT TASKS — Remaining lenses (BR-50 gaps)

**Lane:** Independent · **After** Session A (`T-LM-1`…`4`)
**Governance/DoD:** `AGENT_TASKS_Semantic_Model_Extension.md`
**Why this file exists:** `01-business-challenge.md` BR-50 names eight
minimum lenses. Session A owns four (vulnerability, resilience, data-flow,
green). Security is already `threat-signals`. These three had **no T-* row**.

**Do not start while Session A is running.** Same module-registry /
`typed-facts` surface. A new lens still follows `T-LM-0`: gold from fixture
source only (`CON-40`), never from the module's own output. Unmeasured
lenses may inform, must not gate (`BR-110`).

| Task | Status | Depends on | Acceptance |
|---|---|---|---|
| **T-LM-6 Workflow / feature-traceability lens** | Not started | Session A done (or a real consumer asking sooner) | A module answering "which components and controls does this feature/flow touch?" against `typed-facts` only. Narrow the capability first (e.g. OpenAPI operationId / named route clusters) — do not scope "workflow" whole. Gold + scorer before any CI gate |
| **T-LM-7 Observability lens** | Not started | Session A done | A module answering "what should be monitored, where do signals live, what's missing?" Narrow first (e.g. health/metrics endpoint presence, missing SLO annotations). Gold + scorer before any CI gate |
| **T-LM-8 Pattern-conformance stance** | **Done (2026-08-20) — decided: (a) external** | — | Decision: BR-50 "architectural-pattern conformance" is **external** — consumers run `calm validate -p` on Weaver's generated `architecture.calm.json`; Weaver does not implement a pattern engine. Recorded in `Claim_Register.md`'s "Pattern-conformance stance (T-LM-8)" section and `OOS_Registry.md`'s `OOS-pattern-conformance-engine` row (with revisit trigger). `T-LM-8b` is not created — (b) was not chosen |

**Refuse:** stuffing lens output into free-form node metadata because it
schema-validates. That bypasses the contract (`NFR-30`).

**Contract:** declare `supportedMajorVersion`, register in `AVAILABLE_MODULES`,
write under `outDir/modules/<name>/`. A throwing module must not stop others.
