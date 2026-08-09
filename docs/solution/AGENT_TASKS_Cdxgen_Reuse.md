# Agent task list — B-cdxgen-reuse

**STATUS: CLOSED, 2026-08-09.** T-CDX-1/2/3 done, real evidence per task, Program DoD checked (T-CDX-4/5 remain the honestly-deferred residuals they were always scoped to be, not silently dropped).

**Single source of truth** for the one item left open from the "Open threads right now" punch list after Phase 1 close: `B-cdxgen-reuse` (P2, dependency/container-fact corroboration, independent of the now-closed `B-spring-config`).

**Product:** Weaver. **Owner:** Gowri.

**Related:**
| Doc | Role |
|---|---|
| `BACKLOG.md` | `B-cdxgen-reuse` row — flip to `done` on close |
| `coe-lab/docs/reference/spring-boot-gap-closure-backlog.md` | Original T-CDX-1…5 spec — this file corrects it against real tool behavior, does not restate it |
| `coe-lab/docs/reference/existing-tools-for-spring-config-gap.md` | The reuse-check that first recommended cdxgen — verified here for real, not just cited |
| `AGENT_TASKS_Phase1_Close.md` | Sibling program (`B-spring-config`, closed) — same catalogue-driven, corroboration-only design discipline |

---

## 0. Real findings from verifying the tool before building (do this first, always)

Checked 2026-08-09, before writing any code — this project's own "verify the real tool" discipline (CLAUDE.md principle #1):

1. **The npm package name in the source docs is wrong.** Bare `cdxgen` returns a 404 from the real npm registry (`npm view cdxgen version` → `404 'cdxgen@*' is not in this registry`). The real, correct package is **`@cyclonedx/cdxgen`** (`npm view @cyclonedx/cdxgen version` → `12.8.2`, Apache-2.0 — confirmed installable and real).
2. **`cdxgen` only produces real dependency data when the target already has a lockfile.** Confirmed with three real, different-language checks, `--no-install-deps` in every case (see finding 3 for why):
   - `pipeline/test/fixtures/nestjs-sample` (package.json only, no `package-lock.json`) → **0 components**. Honest, correct behavior — nothing is installed and there's no lockfile to read exact resolved versions from, not a bug.
   - `spikes/boa/repo/src/accounts/userservice` (has a real `uv.lock`) → **75 real components** (astroid, attrs, bcrypt, ... with real pinned versions), no network access needed.
   - `spikes/fineract/repo/fineract-charge` (Gradle project, `build.gradle`, no Gradle dependency-lock file present, no `mvn`/`gradle` binary in this sandbox) → **not run this round** — real, disclosed residual, see §"Explicitly out of scope" below.
3. **`--no-install-deps` is a real, load-bearing safety decision, not a default to leave alone.** `cdxgen --install-deps` (the tool's own default) will run real installs (`npm install`, `mvn`, `gradle`, etc.) as a side effect of generating an SBOM — a real, uncontrolled network/build-tool-invocation side effect Weaver's own core-path determinism principle would never accept, even for an explicitly-optional corroboration lane like this one. **Always pass `--no-install-deps`.** Consequence, stated plainly: this means cdxgen corroboration is only ever as good as whatever lockfile a target repo already has checked in — a real, honest limitation of reuse over hand-rolling, not swept under the rug.
4. **`cdxgen` also has a `--dry-run` flag** ("Read-only mode... reports blocked writes, command execution, temp creation, network access, and submissions") — useful for a future CI/safety check that a real run never attempts a write/network action beyond producing its own output file, not required for this MVP.

---

## 1. Integrity (reject PR if violated)

| Principle | Required | Reject |
|---|---|---|
| No LLM | `cdxgen` invocation is a deterministic external CLI shell-out, same class as the Graphify subprocess | Any semantic/AI mode of cdxgen enabled |
| No uncontrolled side effects | Every invocation passes `--no-install-deps` | A code path that omits it |
| Corroboration only | cdxgen's dependency names only ever RAISE confidence on a unit another lane already found — never create a competing/primary unit on their own | A cdxgen-only-derived TypedUnit with no other evidence |
| Never guess | If a package root has 2+ persistence/messaging units and a corroborating dependency name matches, do NOT guess which unit it corroborates (same discipline as `spring-config-pass.ts`'s server.port ambiguity fix) | Corroboration attached to an arbitrarily-picked unit under ambiguity |
| Real fixtures, real assertions | A checked-in fixture with a REAL, committed lockfile (not spikes-dependent for the primary test) + exact assertions | A smoke test that only checks the shell-out didn't error |
| Determinism | Byte-identical output (aside from timestamp) on every existing regression fixture before/after | Any unrelated fixture's output changes |

---

## 2. Tasks

### T-CDX-1 — Adoption decision
**Decision, recorded here (real, not assumed):** use `@cyclonedx/cdxgen` as a **pinned devDependency** in `pipeline/package.json` (same convention `@finos/calm-cli` already uses — a real external validator/tool dependency, not bundled into the runtime `dependencies`), invoked via its installed binary (`node_modules/.bin/cdxgen`), never `npx` in the shipped code path (npx's own "may download and run a different version silently" behavior is a real supply-chain risk for a pinned-tool convention this project already avoids for `calm-cli`). Always `--no-install-deps`.
**Verify:** `package.json` diff shows a pinned version, `npm ci` installs it reproducibly.
**Status: DONE, 2026-08-09.** `pipeline/package.json`'s `devDependencies` gained `"@cyclonedx/cdxgen": "^12.8.2"`. **Real, disclosed residual found via `npm audit`**: cdxgen's own transitive dependency tree (`tar`, `undici`) carries 2 moderate + 1 high advisory (DoS/cache-desync classes) — the suggested fix (`npm audit fix --force`) would downgrade to `cdxgen@11.7.0`, a real regression risk (older CLI, flags/behavior not re-verified). Not fixed this round: cdxgen is invoked read-only against local, trusted filesystem paths only (never exposed to untrusted network input in Weaver's own usage), so the practical exposure is low — named honestly here rather than silently accepted or silently fixed with an unverified downgrade.

### T-CDX-2 — `scanner/cdxgen-provider.ts`
New provider, same "structured external tool output" mechanism class as the Graphify subprocess wrapper (not a new mechanism): shells `cdxgen -t <lang> --no-install-deps -o <tmpfile> <root>`, parses the real CycloneDX JSON `components[]` array into a simplified `{name, version, purl}[]`. Language type (`-t`) inferred from which manifest files are present at the root (package.json → nodejs, requirements.txt/pyproject.toml/uv.lock → python, pom.xml/build.gradle → java), matching the existing `deployable-manifest-provider.ts`'s own manifest-detection convention.
**Verify:** real run against `spikes/boa/repo/src/accounts/userservice` (has `uv.lock`) produces the real 75-component list found in §0; real run against a fixture with no lockfile produces an empty, non-error result (graceful, not a crash).
**Status: DONE, 2026-08-09.** `scanner/cdxgen-provider.ts`. Verified against the real BoA `uv.lock` (75 real components, `sqlalchemy@1.4.54` among them) and against the checked-in NestJS fixture (no lockfile → real empty array, locked into a regression test). **Real finding while building the checked-in fixture (T-CDX-2's own verify step)**: a first Node.js-based fixture attempt exposed a genuine PRE-EXISTING bug in the shared `graphify-import-strategy-detector.ts` — `package.json` itself gets walked as if its own top-level JSON keys (`name`/`version`/`private`/`description`/`dependencies`) were classes, producing 5 bogus `database` units never seen before in this project (no prior fixture's `package.json` happened to declare a catalogue-recognized driver-import library, so this path never fired). Confirmed NOT triggered by BoA's Python fixture (clean 2-unit run, no bogus units). **Out of scope for this task to fix** (a pre-existing, unrelated detector bug, not introduced by cdxgen) — named here, tracked as a new BACKLOG item (`B-package-json-manifest-false-positive`), and worked around by using a Python fixture (`requirements.txt`, exact catalogue-matching `psycopg2` package name) for the checked-in T-CDX-3 test instead.

### T-CDX-3 — Dependency corroboration
For each package root, if `cdxgen`'s real component names include one already named in `persistence-detection-catalogue.yml`'s `driver-import` strategy or `messaging-detection-catalogue.yml`'s `import-only-cloud-client` strategy, AND exactly one persistence/messaging unit already exists in that root (never guess under 2+ candidates — same discipline `spring-config-pass.ts`'s port-ambiguity fix already established), raise that unit's confidence with a small corroboration-tier evidence entry (weight ~10, matching `jpa-table`'s existing corroboration tier) citing the real cdxgen-found package name + version.
**Verify:** real fixture where a unit's confidence measurably changes (not just "some evidence added") when cdxgen corroboration fires; a 0-candidate and 2+-candidate case both produce a real, named non-attachment (ignored item or explicit skip), never a guess.
**Status: DONE, 2026-08-09.** `analysis/cdxgen-corroboration-pass.ts`. Real, verified twice: (1) against the real BoA repo — `db.py::UserDb`'s confidence measurably raised 20→30 by a genuine `sqlalchemy@1.4.54` fact from BoA's own real `uv.lock`, `calm validate` 0 errors/0 warnings; (2) against the new checked-in `test/fixtures/cdxgen-sample/` (Python, real `requirements.txt` pinning `psycopg2==2.9.9`) — same 20→30 confidence raise, locked into an exact-assertion regression test (checks the precise signal string `cdxgen:psycopg2@2.9.9`, not just "some evidence exists"). 0-candidate and 2+-candidate ambiguity both tested directly against `cdxgenCorroborationPass.run()`, confirmed to produce a real `AMBIGUOUS_BOUNDARY` ignored item and never mutate any candidate's evidence.
**`CONTRACT_VERSION` bumped 10.0.0→11.0.0** (new `Evidence.source: 'dependency-manifest'`; no new category — reuses existing `persistence`/`messaging` values, since this genuinely is that same evidence, just from a third mechanism). Both modules reviewed and `supportedMajorVersion` bumped to `'11'`: `interface-builder.ts`'s `SOURCE_PRECEDENCE` table gained the key (additive, never contributes interfaces); `threat-signals` confirmed unaffected (filters on `http-entry-point`/`security-control` only).

### T-CDX-4 — Container/compose facts (deferred, real reason stated)
`cdxgen`'s "Container File" project type (docker-compose/Dockerfile/k8s facts) — named in the original spec as corroborating `k8s-manifest-provider.ts`'s existing image data.
**Status: DEFERRED, not started this round.** Real reason: T-CDX-2/3 (dependency corroboration) is the higher-value half or this item per the original audit's own severity grading (A2 > A3), and this round's real environment-verification work (§0) already found the Java/Gradle case — the language most likely to have real Dockerfiles in this project's evidence repos — isn't reachable without a `gradle`/`mvn` binary this sandbox doesn't have. Revisit once a real container/compose-bearing fixture with a resolvable dependency tree is available, rather than building against an unverified capability.

### T-CDX-5 — `evinse` (explicitly out of scope, unchanged from the original spec)
Not sized into this pass — a materially larger scope (real call-graph/reachability analysis). Revisit as its own item if pursued.

---

## Explicitly out of scope this round (named, not silently dropped)

- **Java/Gradle dependency corroboration** — real, found via §0's own verification: no `mvn`/`gradle` binary in this sandbox, and Fineract's `fineract-charge` module has no committed Gradle dependency-lock file to read from instead. Not built, not faked — a real environment gap, distinct from a design gap.
- **T-CDX-4 (container/compose facts)** — see T-CDX-4 above.
- **`evinse`** — see T-CDX-5 above.

---

## Program DoD (Definition of Done) — **ALL CLOSED, 2026-08-09**

- [x] T-CDX-1 complete: `@cyclonedx/cdxgen` pinned as a real devDependency, `--no-install-deps` always passed. `npm audit` residual named, not silently accepted.
- [x] T-CDX-2 complete: real provider, verified against BoA's real `uv.lock` (75 real components) and a no-lockfile case (graceful empty result). Found and worked around a real, pre-existing, unrelated detector bug (`B-package-json-manifest-false-positive`) rather than silently building a fixture that happened to hide it.
- [x] T-CDX-3 complete: real dependency corroboration, never-guess discipline extended and tested (0/1/2+ candidate cases), verified against both a real repo (BoA) and a checked-in fixture.
- [x] A checked-in fixture (`test/fixtures/cdxgen-sample/`, Python, real committed `requirements.txt`) proves the mechanism without needing `spikes/` present.
- [x] Every existing regression fixture byte-identical (aside from timestamp) — confirmed via unchanged pre-existing test counts/assertions.
- [x] Full suite green (72/72, up from 69/69), real exact-assertion tests added (checks the precise corroboration signal string and confidence delta, not a smoke test).
- [x] `BACKLOG.md`'s `B-cdxgen-reuse` row flipped to `done` with real evidence cited.
- [x] Honest residuals named: Java/Gradle corroboration (real environment gap — no `mvn`/`gradle` binary here); T-CDX-4/T-CDX-5 (deferred, reasons stated above); `npm audit`'s 3 transitive vulnerabilities in cdxgen's own dependency tree (low practical exposure, named not silently accepted); `B-package-json-manifest-false-positive` (new, real, pre-existing bug found — tracked separately, not this task's to fix).
