# reference-banking-sample-accounts-domain — solid, well-connected gold for testing Weaver

**What this is:** a hand-authored FINOS CALM 1.2 gold file for a real, wild-type reference Java microservices banking sample's accounts bounded context (a real public multi-service reference repo, local clone `spikes/refbank/repo`) — `frontend` + `userservice` + `contacts` + `accounts-db`. Authored specifically to be **solid and well-connected**, after `coe-lab/docs/findings/gold-calm-relationship-connectivity-audit.md` found several existing hand-authored lab-fixture gold packages had disconnected nodes (missing same-package `connects` edges even where an API obviously talks to its own entity).

**Every fact is grep-verified against real source and real k8s manifests, cited at file:line** — routes, JWT issue/verify call sites, database engine construction, service-to-service env-var wiring, shared-secret mounts. Nothing inferred from README/docs/diagrams (this repo's own gold-authoring rule, `gold/calm/README.md`).

## Connectivity, checked the same way the audit checked the others

7 nodes, 7 relationships (4 `connects`, 1 `interacts`, 1 `composed-of`, 1 `deployed-in`). Every real architectural unit (`end-user`, `frontend`, `userservice`, `contacts`, `accounts-db`) has a genuine `connects`/`interacts` edge — the only two nodes reachable *solely* via a grouping relationship are the two `system` boundary nodes (`platform-system`, `k8s-cluster`), which is correct and expected, not a repeat of the earlier bug.

```bash
cd pipeline
npx --no-install calm validate -u ../coe-lab/gold/calm/reference-banking-sample-accounts-domain/url-mapping.json \
  -a ../coe-lab/gold/calm/reference-banking-sample-accounts-domain/architecture.calm.json -f pretty
# Summary — Errors: no (0), Warnings: no (0)
```

## Two real findings surfaced while authoring this (not previously documented this precisely)

1. **CALM's `protocol` enum has no honest value for a Python/SQLAlchemy→PostgreSQL connection.** `userservice→accounts-db` and `contacts→accounts-db` are both real SQLAlchemy-over-psycopg2 connections (`userservice/db.py:31`, `contacts/db.py:31`) — but `JDBC` is literally *Java* Database Connectivity, and using it here would misrepresent the stack. Left `protocol` unset, same discipline as the Kafka finding in `rich-calm-example/README.md` §2.2 — this is a second, independent real-repo confirmation of the same enum gap.
2. **Frontend has two `jwt.decode` call sites with genuinely different security meaning**, at different lines: `decode_token()` (`frontend.py:617`, `verify_signature: False` — reads claims only, no enforcement) vs. `verify_token()` (`frontend.py:629`, `verify_signature: True` with the real public key — genuine enforcement). Only the second is cited as `security-auth-001` evidence. This is a real, concrete illustration of exactly what that control's own description warns about ("NOT proof that signature verification... was enforced") — most repos don't hand you both the false-positive-shaped call and the real one side by side like this.

## A real first test run against Weaver — the actual point of this file

```bash
cd pipeline
node dist/orchestration/run-slice.js \
  ../spikes/refbank/repo/src/frontend \
  ../spikes/refbank/repo/src/accounts/userservice \
  ../spikes/refbank/repo/src/accounts/contacts \
  --out /tmp/refbank-weaver-out
```

Real output, this session: **6 nodes, 3 relationships** (vs. gold's 7/7). Diffed against gold, not just counted:

| Gold says | Weaver's real output | Verdict |
|---|---|---|
| `frontend`/`userservice`/`contacts` service nodes | `frontend.py`/`userservice.py`/`contacts.py` | **Match** (naming convention differs, same real units) |
| `frontend` has `security-auth-001` (verifying `jwt.decode`) | `frontend.py -> ['security-auth-001']` | **Match** — real detection working |
| `contacts` has `security-auth-001` | `contacts.py -> ['security-auth-001']` | **Match** |
| `userservice` has `security-auth-jwt-issue-001` (JWT issuance) | Not present | **Confirmed real gap** — no catalogue row for token *issuance* exists yet, only decode/verify. Gold's own control description named this before running Weaver; the real run confirms it, doesn't just assert it. |
| One shared `accounts-db` node | `db.py::UserDb` + `db.py::ContactsDb` (two separate nodes) | **Confirmed real grain difference**, exactly as gold's `accounts-db` node description predicted. A real, meaningful architectural claim ("one shared database"), not just a naming mismatch. |
| `frontend --connects--> userservice`, `frontend --connects--> contacts` | Missing — instead, **2 `CROSS_DOMAIN_UNRESOLVED` ignored-items**: `frontend.py:17` and `frontend.py:28`, both `"imports HTTP client 'requests' — real outbound-HTTP capability, but no statically-resolvable target"` | **Confirmed real, precisely located gap.** Weaver correctly detects the outbound-HTTP *capability* but can't resolve the *target* — because the real target is env-var-mediated (`USERSERVICE_API_ADDR`/`CONTACTS_API_ADDR`, resolved at k8s deploy time, not in source). This is exactly the "config/env-var-mediated relationships... not detected" limitation `CLAUDE.md`'s own `x-aac-scope-limitations` names — now reproduced with exact file:line evidence instead of asserted in prose. |
| `end-user --interacts--> frontend` | Not present | **Expected** — no actor-detection mechanism exists (named gap, see `spring-boot-approach-audit-of-weaver.md`) |
| `deployed-in` (k8s) | Not present | Expected — this run didn't pass k8s manifests; not this comparison's focus |

**This table is itself the deliverable this file exists to produce**: a real, current, precisely-located diff between what Weaver claims and what a correct architecture actually is — useful for prioritizing exactly the gaps that matter (env-var-mediated service resolution, JWT-issuance control coverage, database-grain policy), not hypothetical ones.

## Files in this folder

- `architecture.calm.json` — the gold file
- `controls/jwt-issue.requirement.json` — new local control-requirement (JWT issuance has no equivalent in Weaver's own catalogue yet — this is real, hand-authored per this repo's own `pipeline/src/rules/control-requirements/*.requirement.json` convention, not borrowed)
- `url-mapping.json` — merges the pipeline's own `control-url-mapping.json` (for the reused `security-auth-001`/`jwt-decode-call` control) with this gold's own local `jwt-issue` mapping — same pattern as `rich-calm-example/url-mapping.json`, **same disclosed limitation**: absolute, machine-specific paths, not portable across checkouts without regenerating
