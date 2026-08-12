# AGENT TASKS — Lens Modules

**Lane:** Independent — **runs in parallel with every other lane, including P0**
**Governance/DoD:** `AGENT_TASKS_Semantic_Model_Extension.md`

Modules consume `typed-facts.json` only. `threat-signals` proved the boundary
holds: it was written without touching Scanner, Rules, Analysis or the CALM
generator. **That independence is why this lane doesn't wait for the gate** —
it neither blocks nor is blocked by fact-semantics work.

| Task | Depends on | Acceptance |
|---|---|---|
| **T-LM-1 Vulnerability lens** | A real SCA/dependency-scan feed on a real repo | Design driven by the real feed, not a hypothetical schema. Module + namespaced output |
| **T-LM-2 Resilience lens** | Narrow capability definition first | Retry-annotation and timeout-config detection — not "resilience" scoped whole |
| **T-LM-3 Data-flow / lineage lens** | — | Field-level lineage across transformations; start from existing flows + data classification |
| **T-LM-4 Green-engineering lens** | Non-code cost evidence source | **Do not approximate cost from code metrics** (call counts, LOC) — that isn't what the requirement means. Needs cloud-billing/IaC input |

**Per module:** declare `supportedMajorVersion`, register in
`AVAILABLE_MODULES`, write output under `outDir/modules/<name>/`, and add a
Claim Register entry at the status the evidence supports. A module that throws
must not stop the others — the registry already isolates this; don't defeat it.

**Contract coupling:** if the Contract & Lifecycle lane bumps `TypedFacts`,
every module here needs its declared major version *reviewed*, not merely
bumped — an unbumped module is skipped with a warning, not an error.
