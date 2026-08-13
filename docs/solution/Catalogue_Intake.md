# Catalogue intake rule

**Applies to:** any new row in `signal-catalogue.yml`, `control-requirement-catalogue.yml`, `persistence-detection-catalogue.yml`, `messaging-detection-catalogue.yml`, `http-client-detection-catalogue.yml`, `env-relationship-allowlist.yml`, `engine-capability-matrix.yml` — anywhere a new detection vocabulary gets added rather than a new mechanism built.

**Also applies to any bug fix that changes detection, matching, or
relationship-building logic** — not only PRs framed as "new capability."
Calling something a bug fix does not exempt it from this rule. A fix that
makes a failing case pass by narrowing a match, adding a conditional, or
tuning a pattern *is* a change to detection coverage, whatever the commit
message calls it, and is exactly as capable of silently overfitting to the
one repo that surfaced the bug as an unevidenced new row would be.

**Why this exists:** every catalogue in this pipeline exists precisely so new capability is a data row, not new code (`CLAUDE.md`'s own stated discipline). That only stays true if a new row is held to the same bar every prior one already met by convention — without a written rule, "add a row" quietly drifts into "add an unevidenced guess," which is exactly the failure mode this whole project's evidence discipline exists to prevent. This formalizes a practice that was already happening (every real catalogue addition — `jax-rs-composed-route`, `jpa-entity`, the Kafka field-type row, `org.postgresql`/`org.jooq`/`org.springframework.jdbc.core` — already carried real evidence, a test, and a doc update) into something a reviewer can check a PR against, not something that has to be re-derived from memory each time.

## The four requirements

A new catalogue row is not mergeable without all four:

1. **Real evidence sample, cited by file/line.** Not "this is a common pattern" — a specific real repo, file, and line (or a checked-in lab fixture built to isolate a real shape, e.g. `coe-lab/fixtures/`). If the evidence is a synthetic fixture rather than a found-in-the-wild sample, say so explicitly — don't let a fixture read as if it were real-repo evidence.
2. **Claim-cell update.** `Claim_Register.md`'s relevant row (U-*/R*/C-*) reflects the new coverage honestly — usually still `partial` (one more vocabulary is rarely "done"), never silently upgraded to `proven` off one sample.
3. **Regression test.** A test that would fail if the row were removed or the matching logic broke — not just "the pipeline still runs," a real assertion on the specific unit/relationship/evidence the new row is supposed to produce. Gate it on the evidence repo's presence (`fs.existsSync`, skip-not-fail) if it needs a scratch clone; no skip guard needed for checked-in lab fixtures. **For a bug fix specifically: the regression test must cover at least
   one instance of the mechanism class *other than* the case that revealed
   the bug** — a different language, framework, or repo exercising the same
   underlying pattern. A test that only re-asserts the original failing case
   proves the symptom is gone, not that the fix is a mechanism-class fix
   rather than a mechanism-instance patch. If no second instance is available
   yet, say so explicitly and note it as a known limit — don't silently skip
   this requirement because only one sample exists today.
4. **`scope-limitations.yml` note**, if the row is narrower than its name suggests — e.g. covers one language/framework variant, is unverified beyond a single sample, or has a known false-positive/false-negative shape. If the row is a clean, fully generic addition with no caveat, no new bullet is needed — don't pad the file for its own sake.

## What does *not* satisfy the rule

- A row added because "it seems likely enterprise repos use this" — no cited evidence, no exception.
- A single-repo-shaped literal that would need a new row per repo to generalize (a class/method name unique to one sample) — that's the exact per-repo patching this project's own principles forbid (see `CLAUDE.md`'s Simplicity First / the R2 design note's explicit rejection of a bridge-role name-suffix list for the identical reason).
- **A bug fix verified only against the sample that reported it.** This is
  the single most common way this rule gets bypassed in practice: the fix
  looks narrow because the diff is small, but a small diff tuned to one
  observed shape is still an instance patch, not a capability fix, unless a
  second, different instance is what actually proves it generalizes.
- A test that only checks the pipeline doesn't crash — the regression must assert the specific real outcome the row exists to produce.
- Silently widening an existing row's matching (e.g. loosening a regex) without re-running the full suite to confirm nothing upstream starts false-positive-matching on the wider pattern.

## Worked example (retroactive, not hypothetical)

`persistence-detection-catalogue.yml`'s `org.jooq` row: (1) evidence — a real `GenericSelector.java` from a reference Java governance platform, exact import lines grep-verified; (2) claim — `Claim_Register.md`'s relationship row updated to note the real 229-unit result, not silently marked "proven" off one class; (3) test — `regression.test.js`'s gated test against that platform asserts the exact unit count and evidence signal text; (4) scope note — the row's own catalogue comment states it's Java-only and depends on the shared `java-import-resolver.ts` fix, not a claim about jOOQ support in any other language.

## Where this is enforced

Not by tooling today — by PR review, per this file, same as the rest of this
project's integrity rules (AGENT TASKS Weaver Robustness §0.3). A future CI
check that greps a diff for new catalogue rows and fails if the matching
test/claim-cell/scope-limitations diff isn't present is a reasonable
escalation if drift is ever observed in practice — not built ahead of that
need.

**That trigger condition has arguably now been met** — see `BACKLOG.md`'s
`Mechanical bug-fix generalization check` row. Recorded as a real candidate
for escalation, not built speculatively ahead of confirmed drift.
