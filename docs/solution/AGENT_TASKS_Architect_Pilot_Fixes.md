# Agent task list — architect pilot fixes (`B-cli-unknown-flag-validation`, `B-chatmode-host-enforcement-gap`, `B-node-name-from-path`, `B-decision-action-leave-open`)

**STATUS: PLANNED, not started.** Written from a real architect dry-run of `Architect_Guide_Scan_To_Signoff.md` against Fineract and Bank of Anthos (2026-08-09) — every finding below traces to a specific, reproduced observation, not a hypothetical. Full raw log: [`Architect_Pilot_Feedback_Notes.md`](./Architect_Pilot_Feedback_Notes.md) (Entries 1-17).

**Product:** Weaver. **Owner:** Gowri.

**Scope note, stated up front:** this task file covers the four concrete, scoped fixes the pilot found — CLI robustness, a safety-doc correction, a node-naming bug, and a schema clarity gap. It deliberately does **not** include the three real Java detection gaps found during the Fineract deep-dive (plain-interface bridges, `@Bean`-factory wiring, generic Spring stereotype detection — Entries 11-13) — those are genuine, evidenced, but larger, separately-scoped catalogue work, not a same-round fix. They're named in §5 below and tracked in `BACKLOG.md`, but explicitly out of this file's build scope, so this round doesn't balloon into a Java-detection redesign.

**Related:**
| Doc | Role |
|---|---|
| `Architect_Pilot_Feedback_Notes.md` | Source of every finding — Entries 3, 8, 9/16, 10 |
| `BACKLOG.md` | New rows: `B-cli-unknown-flag-validation`, `B-chatmode-host-enforcement-gap`, `B-node-name-from-path`, `B-decision-action-leave-open` |
| `pipeline/src/orchestration/run-slice.ts` | AP-1's target |
| `.github/chatmodes/residual-review.chatmode.md` | AP-2's target |
| `pipeline/src/analysis/signal-mapper.ts` | AP-3's target |
| `pipeline/src/types/overrides.ts` | AP-4's target |
| `docs/solution/Architect_Guide_Scan_To_Signoff.md` | AP-5's target |

---

## 0. How to use this file

### 0.1 Phase order

```
Phase AP-1  CLI unknown-flag validation        — independent, no dependency
Phase AP-2  Chat-mode safety-claim correction   — doc-only, independent
Phase AP-3  Node name derivation                — independent, touches signal-mapper.ts (shared with AP-1's tests, not its code)
Phase AP-4  DecisionRecord leave-open clarity    — independent, small type/doc change
Phase AP-5  Guide doc updates                    — doc-only, last (folds in language confirmed by AP-2's decision)
```

No hard dependencies between AP-1 through AP-4 — they can ship in any order or in parallel. AP-5 goes last because it needs AP-2's actual wording decided first (the guide needs to state the real, corrected safety claim, not a placeholder).

### 0.2 Integrity (reject if violated)

| Principle | Required | Reject |
|---|---|---|
| Never silently change behavior an architect already depends on | AP-1's stricter flag validation must not reject any flag/arg combination the existing regression suite already exercises | Any existing fixture's CLI invocation starts failing |
| Real repro, not synthetic | Every fix verified against the actual case that found it (Entries 3, 9, 10) — re-run the real command, not just a new unit test in isolation | A fix "proven" only by a fabricated test case that doesn't match the real finding |
| Don't overclaim the fix | AP-2 is a **documentation correction**, not a capability fix — do not claim the underlying host-enforcement gap is closed, only that the claim about it is now honest | Any wording implying Claude Code chat is now safe to auto-apply from |
| Determinism | AP-3's node-name fix must not change `unique-id` (still `filePath`/`filePath::ClassName`) — only `name` changes. Confirm existing regression fixtures' node *ids* and relationship endpoints are unaffected, `name` changes are the only diff | Any `unique-id` drift, even incidental |
| Disclosure | AP-3's naming heuristic (class name extraction, or path-basename fallback) gets a `scope-limitations.yml` entry if it has any real known false-negative shape (e.g. multiple classes per file — see Entry 12's file — falls back to which name?) | Silent, undocumented fallback behavior |

### 0.3 Every phase completion

1. Real before/after evidence: re-run the exact case that found the bug (cited per phase below).
2. `git status --short pipeline/` (or `.github/`, `docs/`) confirms only intended files touched.
3. Full regression suite green, byte-identical on unrelated pre-existing fixtures.
4. `BACKLOG.md` row flipped to `done` with real evidence cited.
5. `Architect_Pilot_Feedback_Notes.md`'s relevant entry gets a one-line "Fixed 2026-08-09, see AP-N" addendum — keeps the feedback log from going stale once items are closed.

---

## Phase AP-1 — CLI rejects unrecognized flags loudly (Entry 3)

### T-AP1-1 — Unknown-flag detection in `run-slice.ts`'s `main()`
After computing `packageRoots` (the current `args.slice(0, positionalEnd)` logic), scan the **remaining** args (everything from `positionalEnd` onward, i.e. what was intended as flags) for any token starting with `-` that isn't one of the recognized flag names (`--out`, `--overrides`, `--modules`, `--strict-detect`, `--no-snippets`, `--k8s-manifests`, `--cfn-manifests`, `--strict-overrides`, `--no-system-node`, `--enable-env-soft-graph`, `--from-facts`). Any match → `console.error` a clear message and `process.exit(1)` **before** any scan work starts. Include a "did you mean" hint when the unknown flag is a single-dash near-miss of a real one (e.g. `-out` → `--out`) — a simple Levenshtein-distance-1 check against the known flag list is enough, no new dependency.
**Verify:** re-run the exact real command from Entry 3 (`run-slice.js repo/fineract/fineract-charge -out testresults/fineract-charge01`) — must fail loudly with a message naming `-out` and suggesting `--out`, must NOT scan `-out` or the output path as package roots, must NOT silently default `outDir`.

### T-AP1-2 — Regression fixture for the exact bug shape
New `test/regression.test.js` case: invoke the CLI with a single-dash typo of a real flag, assert non-zero exit code and a stderr message naming the bad flag — locks Entry 3's exact failure mode as a permanent regression check, not just a manual fix.
**Verify:** test fails against the pre-fix binary (confirm it would have caught the original bug), passes after T-AP1-1.

---

## Phase AP-2 — Chat-mode safety-claim correction (Entries 9, 16)

### T-AP2-1 — Correct the header comment's host-scoped claim
`.github/chatmodes/residual-review.chatmode.md`'s header comment currently states the `tools:` allowlist means the model has "no code path... not 'won't', genuinely 'can't' through this mode" with no host qualifier. Rewrite to state plainly, with both real observations cited:
- **Confirmed true in VS Code + GitHub Copilot Chat** (Entry 16 — the chat wrote only `drafts/`, the architect had to run `validate_drafts.py`/`apply.py` manually via terminal themselves).
- **Confirmed false in Claude Code chat** (Entry 9 — the model had live `Bash` access despite the same frontmatter; safety there rests on the model's own compliance plus a generic per-action permission prompt, not a structural restriction).
- Explicit guidance for the Claude Code path: never grant a blanket "allow all edits this session" — approve each write individually.
**Verify:** re-read the corrected file; a reviewer unfamiliar with this pilot should be able to tell, from the file alone, which host gives a structural guarantee and which gives a convention-based one.

### T-AP2-2 — Same correction reflected in the design doc
`Architect_Residual_Review_Session.md` §4.4 currently reasons about VS Code Copilot Chat only. Add a short, dated note (matching the doc's existing changelog convention) recording that this was empirically tested against a second host (Claude Code chat) and the enforcement gap was found — point at `Architect_Pilot_Feedback_Notes.md` Entries 9/16 rather than re-deriving the finding inline.
**Verify:** changelog entry added, doesn't restate the whole finding — just links out, matching this doc's own established pattern for prior findings.

**No code fix in this phase.** This is a documentation-honesty correction only — closing the structural gap itself (a pre-flight check in `apply.py`/`override-applier.ts`, or an equivalent host-side hardening) is explicitly **not** in scope here; it's a bigger design question (Entry 9's action item #2) that needs its own decision, not a same-round fix bundled in with everything else.

---

## Phase AP-3 — Node `name` derived from real identifier, not raw path (Entries 10, 15)

### T-AP3-1 — Fix `mapSignalsPass`'s hardcoded `name: filePath`
`pipeline/src/analysis/signal-mapper.ts:214`. Derive a human-readable name instead: prefer a real class/decorator name if one is available from the unit's own evidence (check whether `DecoratorFact`/evidence already carries a `fromNodeKind: 'class'` name for the file — if so, use it); otherwise fall back to `path.basename(filePath).replace(/\.(java|py|ts|tsx|js)$/, '')` (language-agnostic enough for this project's current scope, matches the existing extension-based `language` derivation already in `codegraph-provider.ts`). Multi-class-per-file case (Entry 12's `ChargeConfiguration.java` shape, or any file with 2+ real classes): fall back to the basename, not a guess at which class — never fabricate a preference between multiple real candidates.
**Verify:** re-run the exact Entry 10 case (`fineract-charge` single-root) — `ChargesApiResource.java`'s node `name` becomes `ChargesApiResource`, not the full path. Re-run Entry 15's BoA case — `userservice.py`/`contacts.py` become `userservice`/`contacts` (or a real extracted identifier if evidence supports better).

### T-AP3-2 — Confirm `unique-id` untouched
Direct diff of `unique-id` fields before/after on both re-runs above — must be byte-identical (only `name` should change). This is the integrity rule from §0.2, checked explicitly, not assumed.
**Verify:** diff shows zero `unique-id` changes across all nodes in both real re-runs.

### T-AP3-3 — Regression fixtures
Add/extend fixtures covering: a single, cleanly-named class (expect real class name), a file with no clean class marker (expect basename fallback), and the multi-class-per-file case (expect basename fallback, not an arbitrary pick).
**Verify:** exact-assertion tests for all three shapes; full suite stays green, no unrelated fixture's `name` field changes unexpectedly (only ones that were previously wrong under the raw-path bug should change).

---

## Phase AP-4 — `DecisionRecord.final_decision.action` leave-open clarity (Entry 8)

### T-AP4-1 — Decide and document the mapping
Two options, pick one (recommend option A — smaller, no schema churn):
- **(A)** Keep the existing 4-value enum (`accepted | overridden | added | removed`). Add an explicit code comment on `overrides.ts`'s `DecisionRecord.final_decision.action` field, and a corresponding line in `Architect_Residual_Review_Session.md` §3's Tier A taxonomy, stating plainly: `"accepted"` is the correct value for a reviewed "leave open" outcome (confirming the scan found nothing real to connect) — not just the closest fit, the *designated* one.
- **(B)** Add a fifth enum value (e.g. `'left-open'`) if the team decides the semantic distinction is worth a schema change. Requires touching `validate_drafts.py`'s `VALID_DECISION_ACTIONS` and `override-applier.ts`'s equivalent check too — a wider blast radius than (A).
**Verify:** whichever is chosen, re-generate the three Decision Records from the real Fineract R-001/R-002/R-003 session (Entries 7-8) and confirm they validate cleanly against the (possibly updated) schema, with the mapping now stated rather than inferred.

### T-AP4-2 — Update `tools/review-session/examples/README.md`
The worked example currently only shows `"overridden"` for a `type_change`. Add a second worked example showing a "leave open" Decision Record with no matching Override, using the now-documented `action` value — gives future architects (and drafting agents) a real template for this exact, now-confirmed-common case (3 of 3 residuals in the real BoA/Fineract sessions were this shape).
**Verify:** example validates via `validate_drafts.py`, matches the chosen option from T-AP4-1.

---

## Phase AP-5 — Guide doc updates (Entries 1, 6, 7, 16)

### T-AP5-1 — "Before you start" install-noise note
One short paragraph in `Architect_Guide_Scan_To_Signoff.md`: `npm install` producing deprecation warnings and a vulnerability count is expected, not a failure; don't run `npm audit fix --force`.
**Verify:** reads clearly against Entry 1's actual transcript — an architect seeing that exact output shouldn't stop and ask.

### T-AP5-2 — Step 3 rewritten with concrete activation steps and both confirmed hosts
Replace the current one-line chat-mode reference with: (a) explicit confirmation it's a checked-in repo file, not external; (b) the real VS Code Copilot Chat activation steps (open workspace, find the chat-mode picker, select by description); (c) Claude Code chat named as a second, **confirmed-working but weaker-safety** alternative, with the explicit "always approve individually, never allow-all" guidance from AP-2; (d) a note that the duplicated "Other" option on choice cards (Entry 7) is host-dependent cosmetic behavior, not a data issue.
**Verify:** re-read against Entries 6, 7, 9, 16 — every point raised in those entries should be addressed in the rewritten section, not just some of them.

### T-AP5-3 — Cross-link the feedback notes
Add a line near the top of the guide pointing at `Architect_Pilot_Feedback_Notes.md` for architects who hit something not covered — keeps the guide from needing to restate every pilot finding inline while still surfacing that a real feedback trail exists.
**Verify:** link resolves, one line, doesn't duplicate content.

---

## §5 — Explicitly out of scope for this file (named, not silently dropped)

Three real, evidenced Java detection gaps found during the Fineract deep-dive (Entries 11-13) are **not** part of this build round:

| Candidate | Finding |
|---|---|
| `B-plain-interface-bridge-detection` | In-scope plain interfaces with zero annotations are invisible to the pipeline even when they're the real architectural seam (Entry 11) |
| `B-spring-bean-factory-detection` | `@Configuration`/`@Bean`-factory wiring (Fineract's repo-wide "starter" pattern) produces zero detectable evidence (Entry 12) |
| (unnamed, folded into the row above or its own) | No generic Spring `@Service`/`@Component` stereotype detection exists at all, and DI-based interface→impl resolution isn't built (Entry 13) |

These are real, well-evidenced, and worth doing — but they're catalogue/detection-mechanism work (new signal-catalogue rows, possibly a new extraction mechanism), a materially different size and risk profile than the four fixes above. Recommend a separate task file once scoped, not bundled here. `BACKLOG.md` rows to be added for tracking, status `todo`, not opened as active work by this file.

---

## Program DoD (Definition of Done)

- [ ] AP-1: unknown flags rejected loudly, real Entry 3 repro re-run and confirmed fixed, regression test locked.
- [ ] AP-2: chat-mode header + design doc corrected to state the real, host-scoped safety claim — no code change, no overclaim either direction.
- [ ] AP-3: node `name` is a real identifier (or documented basename fallback) for both the Fineract and BoA real re-runs, `unique-id` confirmed untouched, regression fixtures for all three naming shapes.
- [ ] AP-4: `DecisionRecord.final_decision.action`'s leave-open mapping is documented (or extended), example updated, real Fineract Decision Records re-validated.
- [ ] AP-5: guide's install-noise, chat-mode activation, and multi-host safety guidance all updated; feedback-notes cross-link added.
- [ ] Full regression suite green throughout, byte-identical on unrelated fixtures.
- [ ] `BACKLOG.md`: 4 active rows flipped `done` with real evidence; 2-3 Java-detection rows added as `todo` (§5), not started.
- [ ] `Architect_Pilot_Feedback_Notes.md`: Entries 3, 8, 9/16, 10 each get a one-line "Fixed, see AP-N" addendum.
