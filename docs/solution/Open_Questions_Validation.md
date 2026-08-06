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
| Q11 | Supported scan topology for claims? | parked | State module vs multi-root in claim text |
| Q12 | STATUS “built” overclaim? | decided | Claim Register wins |

## New questions (append only)

| ID | Question | State | Notes |
|---|---|---|---|
| Q13 | Is Prisma-importing Nest `*Service` correctly `database` kind? | parked | Modelling; AREC/unit ontology later |
| Q14 | Should R0 entity–entity edges appear in CALM or only IR/structural appendix? | parked | Wave 2–3 product choice |
