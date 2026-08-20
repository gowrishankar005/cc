# AGENT TASKS — Multi-Repo & Deployment

**Lane:** P5 · **Depends on:** Contract & Lifecycle (T-CL-2)
**Governance/DoD:** `AGENT_TASKS_Semantic_Model_Extension.md`

Last lane deliberately — cross-repo joins are only meaningful once single-repo
incremental construction is proven.

| Task | Depends on | Acceptance |
|---|---|---|
| **T-MR-1 Per-repo manifest** | — | **Done, 2026-08-20.** Small checked-in file declaring the repo's own node ids and published contracts. Human-authored; the pipeline never writes to target repos. See `Claim_Register.md`'s `T-MR-1-repo-manifest` row |
| **T-MR-2 Ranked cross-repo joins** | T-MR-1, T-CL-2 | **Done, 2026-08-20.** Strict reliability order: shared API-spec identity → published artifact coordinates → service-catalogue/DNS → human review. **Never infer a cross-repo edge from naming alone** — review status at best. See `Claim_Register.md`'s `T-MR-2-cross-repo-join` row |
| **T-MR-3 k8s-derived `deployed-in`** `[B]` | — | **Done, 2026-08-20.** Runtime placement relationships. Trust (shared-secret) relationships already exist; this is the placement half. Flat pre-rendered manifests only (`OOS-helm-kustomize`). See `Claim_Register.md`'s `T-MR-3-k8s-deployed-in` row |
| **T-MR-4 Persistence catalogue completion** `[B]` | — | Remaining plain-import driver libraries gain ownership shapes |
| **T-MR-5 Decision Record boundary overrides** `[B]` | — | **Done, 2026-08-20.** Boundary-change overrides; node and relationship overrides already exist. See `Claim_Register.md`'s `T-MR-5-boundary-override` row |

**Secret values are never read, stored, or emitted** — names only
(`OOS-secret-values`, revisit trigger "Never").
