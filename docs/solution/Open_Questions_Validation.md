# Open questions — validation & architecture claims (living)

**Cadence:** Review when Claim Register, wild gold, or AREC DoD changes; at least when opening Wave 3.  
**Owner:** Lab / platform maintainer (eval + design).  
**Companion:** `Claim_Register.md`

| ID | Question | State | Resolution |
|---|---|---|---|
| Q1 | DoD: schema vs unit vs story? | decided | L0–L5 in `coe-lab/docs/validation-approach-vnext.md` |
| Q2 | Relationship = code edge or architecture link? | decided | R0 vs R1+ in Claim Register + AREC |
| Q3 | Which silence must be loud? | decided (policy) | Empty service neighborhood vs db units → no L2 pass; Wave 3-S implements |
| Q4 | Dual-unit intentional product? | decided | Structural interim, not full architecture |
| Q5 | How disconfirm relationship claims? | decided | Shallow (BoA) + layered (Fineract) samples |
| Q6 | Lab representative of enterprise? | decided | No alone; wild gold required |
| Q7 | Who owns wild gold? | parked | Eval maintainer; document in wild-type policy |
| Q8 | Validation stack pieces? | decided | L0–L5 |
| Q9 | Override → catalogue feedback? | parked | Existing unmapped promotion rules |
| Q10 | Forever OOS vs deferred? | partial | Claim cells + scope-limitations.yml |
| Q11 | Supported scan topology for claims? | **decided (T-A6, 2026-08-07)** | Module-root is the primary/default claim mode; multi-root is real and supported but secondary — only the specific multi-root run that produced a cross-package finding may claim it. Full reasoning + real Fineract evidence in `Claim_Register.md` Q11. |
| Q12 | STATUS “built” overclaim? | decided | Claim Register wins |

## New questions (append only)

| ID | Question | State | Notes |
|---|---|---|---|
| Q13 | Is Prisma-importing Nest `*Service` correctly `database` kind? | **decided (T-E2, 2026-08-08) — known limitation, not fixed this round** | Real re-investigation of `access.service.ts`: it's a genuine `@Injectable()` service that imports `@prisma/client` only for its TYPE namespace (`Prisma.AccessWhereInput`) and delegates actual persistence to a separate, real `PrismaService extends PrismaClient` class via constructor injection. The import-only driver-import strategy cannot currently distinguish "owns the client" (a real `inherits`/`extends` Graphify edge to the driver type — confirmed present for `PrismaService`, confirmed ABSENT for `AccessService`) from "imports the client's types for its own method signatures." A principled fix (require an inherits/extends edge, not just an import edge) exists but was NOT implemented this round: it carries real regression risk to the already-proven BoA/Fineract driver-import detection (neither was re-verified against an inherits-based rule in the time available), and this project's own discipline (`CLAUDE.md`: verify before asserting) forbids shipping a structural rewrite without that verification. **Decision: keep current behavior** (any class in a file importing a known persistence driver becomes `database`-kind for the class the file `contains`) — a known, now explicitly disclosed false-positive risk (see `scope-limitations.yml`'s `persistence-import-vs-ownership-ambiguous` bullet), not silently believed correct. Revisit with real time budget to re-verify all three evidence repos (BoA, Fineract, Ghostfolio) against an inherits-based rule. |
| Q14 | Should R0 entity–entity edges appear in CALM or only IR/structural appendix? | parked | Wave 2–3 product choice |
