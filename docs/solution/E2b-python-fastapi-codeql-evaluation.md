# CodeQL buildless Python/FastAPI+Flask evaluation — the truth, found (2026-08-22)

**Task:** the `BACKLOG.md` E2b row asked whether CodeQL's confirmed-buildless
Python extraction closes a real, measured gap the way `E1b` did for Java
DI resolution and `E2a` did for NestJS string-token DI — same question,
third language.

**Result: no gap found — the opposite of `E1b`/`E2a`.** CodeGraph is
already primary for Python HTTP-route extraction; CodeQL adds no unique
capability here, only weaker corroboration. This is a real, negative
result, not an unrun experiment — `BACKLOG.md`'s prior "no candidate repo
identified" note is now stale.

## Repos and probes, verified before scoring

Two real, public Python repos, run through Graphify, CodeGraph, and
CodeQL's official Python HTTP models (`Http::Server::RouteSetup`,
Flask/FastAPI framework recognition) at the same probes each other tool
was scored against:

- **`openbb-core`** (OpenBB — real, active open-source investment-research
  platform, FastAPI). Probes: `obb-fastapi-app` (L1 symbol), `obb-route-user-me`
  (L2 http-route), `obb-auth-depends` (L2 control).
- **A reference banking sample's `userservice`** (a polyglot microservices banking sample's Python component, Flask +
  SQLAlchemy) — the same fixture already used elsewhere in this session's
  cross-package benchmarking, re-run here specifically for the Python
  HTTP-route probe.

## Real scored result (`scoreboard-tier-a.md`, `scoreboard.md`)

| Fixture | Probe | Graphify | CodeGraph | CodeQL |
|---|---|---|---|---|
| openbb-core | `obb-fastapi-app` (L1 symbol) | partial (full=0, file=3) | **hit** (full=10, file=73) | **miss** (full=0, file=0) |
| openbb-core | `obb-route-user-me` (L2 http-route) | partial | **hit** | hit (partial credit — `/me` prefix not joined by CodeQL's `getUrlPattern()`) |
| openbb-core | `obb-auth-depends` (L2 control) | hit | **hit** | partial |
| reference-sample-userservice (Flask) | aggregate, 6 probes | 2/6 | **5/6** | 3/6 |

Aggregate score line (`summary.md` §8): `openbb-core | FastAPI | 2/4 | 4/4 | 2/4`
— Graphify 2, **CodeGraph 4/4 (clean sweep)**, CodeQL 2/4.

Raw CodeQL query output confirms the miss is real, not a scoring artifact —
`codeql/openbb-core/flask_fastapi_routes.csv` returns only 6 rows (and one
of the 6 is a test file, `tests/provider/standard_models/test_options_chains.py`,
not production code), missing the `read_user_settings`/`/me` composed-path
binding CodeGraph resolves natively; `codeql/reference-sample-userservice/flask_fastapi_routes.csv`
returns 4 Flask routes but all typed generically as `httpMethod="route"`
rather than the real `GET`/`POST` verb CodeGraph's native typing carries.

## Why CodeQL underperforms here (root cause, not just the score)

- **No FastAPI-specific model** — CodeQL's official Python HTTP models
  target Flask's `@app.route`; FastAPI's `@router.get`/`@router.post`
  decorators are recognized only incidentally where they structurally
  resemble Flask's shape, which is why `openbb-core`'s dedicated FastAPI
  router functions score a flat miss at L1.
- **Prefix/router composition not joined** — `getUrlPattern()` returns the
  leaf path only; a FastAPI `APIRouter(prefix="/user")` mounted route
  loses its real composed URL (`/me` alone, not `/user/me`) the same class
  of composition gap `T-LR-3`'s JAX-RS `@Path` work already had to solve
  for Java — CodeQL's official model does not solve it for Python either.
- **Verb-blind on Flask** — `@app.route(...)` without an explicit `methods=`
  kwarg defaults to GET but CodeQL's extractor reports the literal
  `"route"` string rather than resolving the real verb, a precision loss
  CodeGraph's native typing does not have.

## What this does and doesn't establish

**Establishes:**
- CodeQL's buildless Python extraction is real and fast in practice
  (`codeql resolve extractor --language=python` confirmed buildless;
  wall time 44–113s for `openbb-core`, no build command) — the mechanical
  claim from `BACKLOG.md` row 30 is confirmed.
- Unlike Java (`E1b`, `@Bean`-factory bus dispatch) and TypeScript (`E2a`,
  string-token DI), **no real capability gap was found for Python HTTP
  surface** — CodeGraph's native `route` typing already covers what CodeQL's
  official Python model covers, and covers it more precisely (verb typing,
  prefix composition).
- Two real, independent repos (`openbb-core` FastAPI, a reference banking sample's Flask service), not one —
  this already clears `Catalogue_Intake.md`'s second-instance bar `E2a`
  itself flagged as not yet met.

**Does not establish:**
- That CodeQL has zero value anywhere in the Python surface — persistence
  (SQLAlchemy `Table('users')`) and JWT/control probes were also scored in
  the same run (`findings-tier-a.md`) and are equally weak for CodeQL
  there (`Table()` query didn't fire; JWT partial) — this doc only answers
  the HTTP-routing question E2b was scoped for.
- Whether a hand-authored (not official-model) exploratory query, the same
  move that turned `E1b`/`E2a` from a miss into a real gap-closing result,
  would do better here. Not attempted — the official model result alone is
  enough to answer "should this become a `T-LR-5`-shaped pipeline pass,"
  which is what E2b was scoped to decide.

## Recommendation

**Do not scope a Python CodeQL HTTP-routing pass.** Unlike `E1b`→`T-LR-5`
and `E2a`, this evaluation found no measured gap for CodeQL to close —
CodeGraph's native Python `route` typing is already the stronger primary
signal, and adding a CodeQL pass here would add real per-run cost (44–113s
buildless-but-not-free) for weaker precision, not new coverage. Close
`BACKLOG.md`'s E2b row as answered (negative result), not as still-open.
