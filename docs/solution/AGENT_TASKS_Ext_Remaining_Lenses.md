# AGENT TASKS — Remaining lenses (BR-50 gaps)

**Lane:** Independent · Session A closed what it can (`T-LM-0`/`T-LM-2`/`T-LM-5`
done; `T-LM-1`/`3`/`4` are **Phase 2**)
**Governance/DoD:** `AGENT_TASKS_Semantic_Model_Extension.md`
**Why this file exists:** `01-business-challenge.md` BR-50 names eight
minimum lenses. Session A owned four (vulnerability, resilience, data-flow,
green). Security is already `threat-signals`. These three had **no T-* row**.

`T-LM-1`/`3`/`4`/`6`/`7` are **Phase 2** (`BACKLOG.md`): more research,
inputs, and validation before any build. **T-LM-8** (written decision) can
start now. Gold from fixture source only (`CON-40`). Unmeasured lenses may
inform, must not gate (`BR-110`).

| Task | Status | Depends on | Acceptance |
|---|---|---|---|
| **T-LM-6 Workflow / feature-traceability lens** | **Phase 2** — needs a real consumer and gold, same bar as T-LM-1/3/4 | Real consumer + gold | A module answering "which components and controls does this feature/flow touch?" against `typed-facts` only. Narrow first. Gold + scorer before any CI gate |
| **T-LM-7 Observability lens** | **Phase 2** — needs a real consumer and gold, same bar as T-LM-1/3/4 | Real consumer + gold | A module answering "what should be monitored, where do signals live, what's missing?" Narrow first. Gold + scorer before any CI gate |
| **T-LM-8 Pattern-conformance stance** | Not started — **decision, not a build by default** | — | Record whether BR-50 "architectural-pattern conformance" is (a) **external** — consumers run `calm validate -p` on Weaver output, Weaver does not implement a pattern engine — or (b) an in-pipeline module. **Recommended: (a).** Write the choice into `Claim_Register.md` and this row so the gap stops looking like a miss. Only create `T-LM-8b` if (b) is chosen |

**Refuse:** stuffing lens output into free-form node metadata because it
schema-validates. That bypasses the contract (`NFR-30`).

**Contract:** declare `supportedMajorVersion`, register in `AVAILABLE_MODULES`,
write under `outDir/modules/<name>/`. A throwing module must not stop others.
