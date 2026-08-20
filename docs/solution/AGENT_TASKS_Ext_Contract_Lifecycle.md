# AGENT TASKS — Contract & Lifecycle

**Lane:** P3 · **Depends on:** Fact Semantics (T-FS-2, T-FS-6)
**Governance/DoD:** `AGENT_TASKS_Semantic_Model_Extension.md`

Turns a rebuild-every-run pipeline into continuous construction.
**This lane owns the only breaking contract change in the extension.**

| Task | Depends on | Acceptance |
|---|---|---|
| **T-CL-1 Fact identity scheme** | T-FS-6 | **Done (2026-08-20)** — `TypedUnit.id` audited: every existing producer already content-derived (filePath / synthetic-unit discriminators), never file:line, never a run-scoped counter; `unresolved:<graphifyNodeId>` verified empirically stable via a real two-run `graphify extract` diff. Real bug found and fixed: `relationship-builder.ts`'s CALM `unique-id` WAS a positional `rel-${i}` counter — the exact anti-pattern this row forbids. New additive-optional `TypedRelationship.id` (tier (b), no `CONTRACT_VERSION` bump) computed by `analysis/fact-identity.ts`'s `computeRelationshipId`/`assignFactIds` (`factIdentityPass`) as `kind\|from\|to\|(mechanism-or-source)`; `relationship-builder.ts` reuses it directly. See `Claim_Register.md`'s `T-CL-1-fact-identity` row for the full evidence. Content-derived from *semantic* coordinates (fact type + endpoint identities + discriminator). **Never file:line** — it moves. Never a run-scoped counter — it isn't stable. A rename that changes semantic coordinates is legitimately a new fact plus a disappeared one, not a bug |
| **T-CL-2 Incremental merge** | T-CL-1 | Re-extraction merges against prior state. Unaffected facts carry forward unchanged, including review status. New evidence strengthens or conflicts — never silently overwrites |
| **T-CL-3 Review history** | T-CL-1 | Who/when/on-what-evidence a status changed is retrievable, not just current state |
| **T-CL-4 Contract bump** | T-CL-1..3 | `contractVersion` major bump per `Contract_Evolution_Policy.md`. **Every module's `supportedMajorVersion` reviewed and stated in the commit — an unbumped module is silently skipped, warned not failed** |
| **T-CL-5 Emission-coverage rule** | — | "What the representation could not carry, and why" becomes a required emission output. Makes portability a number, not an assertion |
| **T-CL-6 Determinism test** | T-CL-2 | Same input twice ⇒ semantically identical output. Compare on facts and status, **excluding generation timestamps** — otherwise the test fails on noise. Sort evidence by stable key before comparing rather than freezing processing order |

**No `reviewed` fact is ever silently overwritten.** A human's confirmation
takes a human to un-confirm; contradicting evidence flags for re-review.
