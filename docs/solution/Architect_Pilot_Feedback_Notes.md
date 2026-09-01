# Architect Pilot Feedback Notes

Running log of real observations, confusion points, and errors hit while an architect (not the person who built the pipeline) walks through [`Architect_Guide_Scan_To_Signoff.md`](./Architect_Guide_Scan_To_Signoff.md) for the first time, using a reference Java/JAX-RS banking platform as the test repo. Each entry is raw feedback plus what it means and what (if anything) should change — this is a feedback log, not itself the fix. Action items graduate to `BACKLOG.md` when there's a concrete owner/priority decision to track.

**Status:** in progress — session ongoing, entries added as feedback comes in.

**⚠️ Entry 9 below is a high-severity safety finding — read before trusting the chat-mode's "cannot apply" claim in any host other than VS Code Copilot Chat.**

---

## Entry 1 — `npm install` deprecation warnings + vulnerability summary

**Observed:**
```
npm warn deprecated inflight@1.0.6...
npm warn deprecated glob@7.2.3...
3 vulnerabilities (2 moderate, 1 high)
```

**What it means:** Normal end-of-install noise, not a failure — install succeeded (429 packages). Deprecation warnings are from transitive sub-dependencies, not Weaver's own deps. The 3 vulnerabilities all trace to `@cyclonedx/cdxgen`'s `tar`/`undici` sub-deps (checked via `npm audit`) — not exploitable in how Weaver uses cdxgen (local filesystem scan, not untrusted network input). `npm audit fix --force` would bump `cdxgen` to an untested breaking major version — should not be run.

**Action item:** Add a short expectation-setting note to the guide's "Before you start" so an architect doesn't stop and second-guess a successful install. **Status: not yet applied to the guide.**

---

## Entry 2 — `npm run build` output

**Observed:** full build output including the `tsc` compile, catalogue YAML/JSON copy steps, and `[generate-control-url-mapping] wrote 9 mapping(s)...`.

**What it means:** Ran correctly, no errors. Confirmed as expected output.

**Action item:** None — working as intended.

---

## Entry 3 — silent flag-typo swallowing (`-out` vs `--out`) — real bug

**Observed:**
```
node pipeline/dist/orchestration/run-slice.js repo/fineract/fineract-charge -out testresults/fineract-charge01
...
[run-slice] .../fineract-charge: 0 native route(s), 211 decorator fact(s), 3 unit(s)
[run-slice] .../-out: 0 native route(s), 0 decorator fact(s), 0 unit(s)
[run-slice] .../testresults/fineract-charge01: 0 native route(s), 0 decorator fact(s), 0 unit(s)
```
Architect reported no final completion message and assumed the process was hung.

**Root cause (confirmed by reading `run-slice.ts`'s `main()`):**
- The CLI matches `--out` by exact string (`args.indexOf('--out')`). A single-dash `-out` is never recognized.
- The package-root list is computed as "everything before the first recognized flag." Since **no** flag was recognized, `positionalEnd` fell back to `args.length` — every argument (`fineract-charge`, `-out`, `testresults/fineract-charge01`) got resolved as a path and scanned as its own package root. Two of those don't exist as real code, hence `0 unit(s)` for both.
- Because `--out` was never matched, `outDir` silently defaulted to `<cwd>/calm-output` — **not** the path the architect typed. Nothing in the output says this happened.
- Process wasn't hung — it almost certainly completed and wrote to `calm-output/`, just not where the architect expected, with no error to flag the mismatch.

**Impact:** An architect can run a scan, watch it "succeed," and have no correct output anywhere near the path they specified — and no error tells them why. This is a real usability/correctness gap, not user error alone.

**Action item (real, not yet fixed):** `run-slice.ts`'s arg parser should reject unrecognized flags loudly (`Unknown option '-out'. Did you mean '--out'?`) instead of silently reinterpreting them as package roots. Track as a backlog item — candidate name **`B-cli-unknown-flag-validation`** — before the guide is handed to more architects, since this is exactly the kind of first-command failure that erodes trust in the tool.

**Guide fix, immediate:** none needed to the guide's own command text (it already shows `--out` correctly) — this was a transcription/typo issue on the architect's end, surfaced a real product gap.

**Fixed 2026-08-10, see `AGENT_TASKS_Architect_Pilot_Fixes.md` Phase AP-1.** `run-slice.ts` now rejects any unrecognized flag before any scan work starts, with a "did you mean" hint for the real single-dash-typo case; re-ran the exact repro command, confirmed no output written and exit code 1. Locked in `test/regression.test.js`.

---

## Entry 4 — `S1-zero-service-touching-relationships` on single-root `fineract-charge` scan — expected, correctly disclosed

**Observed:**
```
"silenceFlags": [
  "S1-zero-service-touching-relationships: 1 service unit(s) and 2 database unit(s) present, but 0 relationships touch a service unit..."
],
"servicesWithArchitectureOutbound": 0,
"architectureOutboundCoverage": 0
```
Architect asked whether this "looks good."

**What it means:** Correct, expected behavior for this specific case — not a bug, not a regression. `fineract-charge` alone contains the HTTP resource (`ChargesApiResource`) and the JPA entity (`Charge`), but the service/repository layer that bridges them lives in a different module (`fineract-provider`). Scanning `fineract-charge` in isolation means the scanner can't see that bridge, so it correctly reports S1 instead of fabricating a relationship. This matches the project's own known, previously-documented gap (the reference banking platform's multi-hop/layered story, `Claim_Register.md` R2 — not built for a single-root scan).

**Action item:** None for the tool — this is the honesty mechanism working as designed. **Follow-up test, in progress:** rescanning with both `fineract-charge` + `fineract-provider` as roots together to check whether the multi-hop bridge resolves at that scope (per the guide's reference-banking-platform example). Outcome to be logged as its own entry.

---

## Entry 5 — `pack.py` run against real `calm-output` — clean, as expected

**Observed:**
```
[pack] review-queue.json missing — generating via hitl-review-trigger.js
[hitl-review-trigger] 3 review item(s) written to .../calm-output/review-queue.json
  - [S1-zero-service-touching-relationships] ChargesApiResource.java (service, confidence 100)
  - [S1-zero-service-touching-relationships] Charge.java (database, confidence 50)
  - [S1-zero-service-touching-relationships] ChargeRepository.java (database, confidence 80)
[pack] wrote Session Pack to .../review-sessions/fineract-run (3 residual(s))
```
Architect clarified prior feedback was general flow/output confirmation, not a complaint.

**What it means:** Correct, no issues. `review-queue.json` didn't exist yet from the prior scan (expected, since Step 1's plain `run-slice` invocation doesn't run the HITL trigger on its own) — `pack.py` generated it automatically, exactly as designed (§4.2 fallback in the design doc). All 3 residuals map 1:1 to the 3 units from the Entry 4 scan, each correctly flagged under the same S1 reason. Confidence scores (100/50/80) are real, per-unit signal carried through into the pack.

**Action item:** None.

---

## Entry 6 — guide's Step 3 unclear on where the chat-mode file is / how to activate it — doc gap

**Observed:** Architect asked "where do I find this file? is it part of the repo?" in response to the guide's Step 3 line referencing `.github/chatmodes/residual-review.chatmode.md`.

**What it means:** File is real and checked in, but the guide only named the path — it never explained (a) that it's part of the repo, not an external download, or (b) the actual VS Code UI steps to activate a custom chat mode (open workspace in VS Code, find the chat-mode picker, select it by its `description`). Confirmed via the file's own header comment: this chat mode has never been exercised in a live VS Code session in this project — so this pilot run is genuinely the first real test of whether the activation flow works as documented.

**Action item:** Expand the guide's Step 3 with the concrete activation steps (not just the file path), and explicitly flag that live-session behavior is unverified so the architect knows to report back what they actually see, not assume a mismatch is their own error. **Status: not yet applied to the guide — pending confirmation of what the architect actually observes in VS Code, so the doc update reflects reality rather than assumption.**

---

## Entry 7 — chat-mode session ran live for real, using Claude Code chat rather than VS Code + Copilot Chat

**Observed:** Architect activated the chat mode and got a real, working session — two genuine choice cards (R-001, R-002) matching the design doc's mockup almost exactly (fixed options synthesized from real evidence, "None of these"/"Other" escape hatches, evidence citations with real file:line refs). Interface used was **Claude Code's own chat**, not VS Code + GitHub Copilot Chat as the guide's Step 3 describes.

**What it means — three separate findings:**

1. **The chat-mode file works, live, for the first time in this project.** Its own header comment says this had never been exercised in a live session before (Entry 6). Confirmed now: it correctly read `SESSION.md`/`residuals.json`, generated cards matching the fixed per-class template (not invented options), and correctly refused to auto-pick an answer.
2. **A second, previously-undocumented valid activation path exists**: the chat-mode markdown file works when interpreted directly by Claude Code chat, not just VS Code Copilot Chat. Guide should mention this as an alternative, not imply Copilot Chat is the only way in.
3. **Cosmetic duplicate "Other" option** on both cards — confirmed via `cards.py`: the pack's own card generator always appends one `Other…` option by design (§2.1's mandatory escape hatch); the second, plain "Other" is Claude Code's own question UI adding its own independent fallback on top of the options it was given. Two separate "always offer an escape hatch" mechanisms stacking, not a data bug. Harmless, but slightly confusing to a first-time user.

**R-001 and R-002 both correctly answered "None of these," verified against real source, not guessed:**
- `ChargesApiResource.java` injects `ChargeReadPlatformService` and `PortfolioCommandSourceWritePlatformService` only — never references `Charge.java` or `ChargeRepository.java` directly (confirmed by reading the real file). The true bridge is a service interface whose implementation isn't in this scan's roots at all.
- `Charge.java` imports `TaxGroupData`/`TaxGroup` (real, confirmed) but has zero reference to `ChargesApiResource` — the card's own evidence text already flagged this as coincidental, not a real link.
- Both are genuine cases for the tool's "don't fabricate, name the gap" behavior working as intended — not tool failures.

**Action item:** Update guide's Step 3 to (a) mention Claude Code chat as a confirmed-working alternative activation path alongside VS Code Copilot Chat, (b) note the possible cosmetic duplicate-"Other" artifact depending on host UI, and (c) update the chat-mode file's own header comment — its "NOT been exercised in a live session" disclaimer is now stale for at least the Claude Code path. **Status: not yet applied — pending R-003 and the rest of the session, so the doc update covers the whole flow, not just the first two cards.**

---

## Entry 8 — R-003 confirms same pattern; real schema gap found on the "None of these" write-back path

**Observed:** R-003 (`ChargeRepository.java`) resolved the same way as R-001/R-002 — verified against real source (`ChargeRepository extends JpaRepository<Charge,...>`, zero reference to `ChargesApiResource`). All 3 residuals answered "None of these." Chat agent correctly identified that only Decision Records are needed (no Overrides, since nothing changes in CALM), and asked before drafting rather than proceeding silently — good behavior, matches its own bound rules.

**Real gap found while reviewing the plan before letting it draft:** `pipeline/src/types/overrides.ts`'s `DecisionRecord.final_decision.action` only accepts `'accepted' | 'overridden' | 'added' | 'removed'`. None of these cleanly means "reviewed, and the honest answer is: no real connection exists, leave it open." The closest fit is `accepted` (confirming the scan correctly found nothing), but this was never designed as an explicit "leave-open" outcome — an architect or drafting agent has to infer the mapping rather than being told it.

**Action item:** Either (a) add an explicit `'left-open'` (or similar) value to `final_decision.action` so this outcome is representable without inference, or (b) if `accepted` is meant to cover this case by design, say so explicitly in `overrides.ts`'s own comments and in the design doc's Tier A taxonomy (§3), since neither currently states it. Track as **`B-decision-action-leave-open`**. Not blocking this session — recommended `accepted` with an explicit rationale as the practical workaround for now.

**Fixed 2026-08-10, see `AGENT_TASKS_Architect_Pilot_Fixes.md` Phase AP-4 (option A — no schema change).** `overrides.ts` and `Architect_Residual_Review_Session.md` §3 now state explicitly that `"accepted"` is the designated value for this outcome, not just the closest fit. New worked example (`tools/review-session/examples/decision-D-example-002-leave-open.json`) shows the no-Override shape; validated clean via `validate_drafts.py`.

---

## Entry 9 — HIGH SEVERITY: chat-mode `tools:` allowlist is not enforced by Claude Code chat

**Observed:** After the architect approved drafting, the agent used the **`Bash`** tool (`find`, a `python3` heredoc reading `calm-output/architecture.calm.json`, `mkdir -p`) and the **`Write`** tool to create `decision-D-R-001.json`, with a real per-file permission prompt ("Allow write to decision-D-R-001.json? [1] Yes [2] Yes, allow all edits this session [3] No").

**What it means — this falsifies a specific, load-bearing safety claim.** `.github/chatmodes/residual-review.chatmode.md`'s frontmatter declares:
```
tools: ['codebase', 'search', 'usages', 'problems', 'editFiles']
```
No `Bash`/terminal tool is listed. The file's own header comment states this list is "the real enforcement mechanism, not just an instruction... A chat session bound to this mode has **no code path** to run `apply.py`, `node dist/orchestration/run-slice.js`, or `override-applier.ts` — not 'won't', genuinely 'can't' through this mode."

**That claim is confirmed false when this chat-mode file is interpreted by Claude Code's own chat** (as opposed to VS Code Copilot Chat, which the design was originally built and reasoned about for). The model had live `Bash` access — the `tools:` frontmatter was not enforced as a hard capability restriction by this host at all. In principle, nothing prevented it from running `apply.py`/`run-slice`/`override-applier` directly via `Bash` in this session, other than its own adherence to the written instructions (a soft constraint) and the host's own generic per-action permission prompt (a real gate, but not something this design specifically built or can rely on being present in every host).

**In practice it behaved safely this session** — it used `Bash` only for read-only inspection (`find`, reading the real CALM file to get accurate `unique-id`s) and `mkdir -p` on the correct `drafts/decisions/` path, and it did stop to ask permission before each write. But "behaved safely because it chose to, with a generic host permission prompt as backstop" is a materially weaker guarantee than "genuinely cannot, by construction" — and the chat-mode file actively asserts the stronger claim.

**Action item, high priority:**
1. Correct the chat-mode file's header comment — the "genuinely can't through this mode" claim needs a host-specific caveat: true (structurally enforced) in VS Code Copilot Chat where the `tools:` frontmatter is honored as a real capability gate; **not proven true, and directly observed false, in Claude Code chat**, where it currently relies on the model's own compliance plus a generic permission prompt.
2. Decide whether this project wants a host-specific safety story (document the Claude Code path as "convenience only, review every write, never grant 'allow all'") or whether to close the gap structurally (e.g., a pre-flight check in `apply.py`/`override-applier.ts` refusing to run if invoked from within an active chat-agent context — needs more thought, not a same-session fix).
3. Track as **`B-chatmode-host-enforcement-gap`** — this is exactly the "specified vs proven" failure mode this project's own `CLAUDE.md` names as the thing to catch, and it was caught by actually running the real thing in a second real host, not by re-reading the design doc.

**Immediate guidance given to the architect:** always choose "Yes" per-file, never "Yes, allow all edits this session," when using this chat mode in Claude Code — the per-action prompt is the only real safety gate available in this host right now.

**Doc corrected 2026-08-10, see `AGENT_TASKS_Architect_Pilot_Fixes.md` Phase AP-2.** `.github/chatmodes/residual-review.chatmode.md`'s header comment now states the claim per-host (confirmed true in VS Code Copilot Chat — Entry 16; confirmed false in Claude Code chat — this entry), with the same "never allow-all" guidance embedded directly in the file. Design doc changelog updated too. Structurally closing the gap in non-VS-Code hosts remains open, not attempted here.

---

## Open action items summary

| # | Item | Status |
|---|---|---|
| 1 | Add install-noise expectation note to guide's "Before you start" | **Fixed 2026-08-10 (AP-5)** |
| 3 | `run-slice.ts` should reject unknown flags loudly instead of silently treating them as package roots | **Fixed 2026-08-10 (AP-1)** |
| 4 | Confirm whether multi-root (`fineract-charge` + `fineract-provider`) scan clears S1 | Resolved — see Entry 14 (self-correction, R2 multi-hop bridge did resolve it) |
| 6 | Expand guide's Step 3 with concrete chat-mode activation steps | **Fixed 2026-08-10 (AP-5)** |
| 7 | Update guide + chat-mode header comment: live session now confirmed working (Claude Code path); note cosmetic duplicate-"Other" artifact | **Fixed 2026-08-10 (AP-2, AP-5)** |
| 8 | `DecisionRecord.final_decision.action` has no value meaning "reviewed, left open" — closest is `accepted`, real schema gap | **Fixed 2026-08-10 (AP-4)** |
| 9 | **HIGH SEVERITY** — chat-mode `tools:` allowlist is not enforced by Claude Code chat; "genuinely can't apply" claim is false outside VS Code Copilot Chat | **Doc corrected 2026-08-10 (AP-2)** — underlying host gap intentionally not structurally closed, see AP-2's own scope note |
| 10 | Node `name` field is the raw file path for every unit kind (`signal-mapper.ts:214`) — real, confirmed via live output | **Fixed 2026-08-10 (AP-3)** |

---

## Entry 10 — node `name` is the raw file path for every unit, confirmed via live output — real bug, root cause isolated

**Observed:** Architect noted the CALM viewer only shows file paths as node labels, not readable names, and asked whether a diagram edge meant real DB↔API connectivity. Read the real generated `architecture.calm.json` directly (local `calm-output/architecture.calm.json`) to get ground truth instead of guessing from the rendered diagram.

**Finding 1 — name bug, confirmed and root-caused precisely:**
```
ChargesApiResource.java | service  | name: src/main/java/.../ChargesApiResource.java
Charge.java             | database | name: src/main/java/.../Charge.java
ChargeRepository.java   | database | name: src/main/java/.../ChargeRepository.java
```
All three nodes — service and both database units — have `name` set to the full raw file path. Root cause: `pipeline/src/analysis/signal-mapper.ts:214` hardcodes `name: filePath` in `mapSignalsPass`, and for Java, JPA `@Entity` detection (unlike Python/Node driver-import detection, which does use real class names via `graphify-import-strategy-detector.ts:180`) also runs through this same function — so every Java unit built this way gets a raw path as its display name, not a real, single-file coincidence. This directly hurts the "hand this to a stakeholder" usability goal the whole guide is built around.

**Action item:** Derive a human-readable `name` (real class name from decorator evidence if available, else `path.basename(filePath, '.java')`/language-appropriate equivalent as a minimal fallback) instead of the raw path. Candidate: **`B-node-name-from-path`**. Not yet fixed — offered to fix immediately, awaiting architect's go-ahead.

**Fixed 2026-08-10, see `AGENT_TASKS_Architect_Pilot_Fixes.md` Phase AP-3.** `signal-mapper.ts` now derives `name` from a real, unambiguous class name (threaded through as `DecoratorFact.fromNodeName` from CodeGraph's own `Node.name`) when exactly one exists for the file, falling back to the basename otherwise — never guesses between multiple real candidates (verified against `MultiResourceFile.java`'s 2-class shape). Re-ran the exact reference-banking-platform repro: `ChargesApiResource.java` now names `ChargesApiResource`, `Charge.java` names `Charge`, `ChargeRepository.java` names `ChargeRepository`. `unique-id` confirmed unchanged in both re-runs. `scope-limitations.yml` updated (`unit-name-derivation`), 3 new locked regression assertions.

**Finding 2 — connectivity question resolved, confirms prior findings, not a new gap:**
```json
{ "connects": { "source": "ChargeRepository.java", "destination": "Charge.java" }, "grade": "structural" }
{ "composed-of": { "container": "system", "nodes": [all 3] } }
```
Only two relationships exist: a real `ChargeRepository → Charge` structural edge (matches `extends JpaRepository<Charge,...>`, genuinely correct) and the `system` container's `composed-of` grouping (not a dependency edge — explains the outer box in the diagram). **No relationship exists between the API node and either database node** — fully consistent with S1 firing and all three "None of these" answers from Entries 7-8. The diagram's arrow was between the two database boxes; the `system` container's bounding box made it easy to misread as touching the API node.

**Action item:** None for correctness — the data is right. Possible follow-up: the "system" container box visually overlapping/appearing to connect unrelated nodes in the diagram is a rendering/legibility concern for whichever CALM viewer is in use, not something this pipeline controls.

---

## Entry 11 — real architecture traced by hand, sharper root cause found for the S1 gap

**Observed:** Architect asked to independently verify (not just trust the JSON dump) what the real relationship is between `ChargesApiResource`, `Charge`, and `ChargeRepository` by exploring the actual reference-banking-platform source.

**What was found, tracing the real chain hop by hop:**
```
ChargesApiResource (fineract-charge)
  ├─ readPlatformService: ChargeReadPlatformService        interface, IN-SCOPE (fineract-charge)
  │    └─ impl ChargeReadPlatformServiceImpl (fineract-provider, out of scan)
  │          └─ uses raw JdbcTemplate — bypasses Charge/ChargeRepository entirely for reads
  └─ commandsSourceWritePlatformService → CreateChargeDefinitionCommandHandler (fineract-charge)
       └─ clientWritePlatformService: ChargeWritePlatformService   interface, IN-SCOPE (fineract-charge)
            └─ impl ChargeWritePlatformServiceJpaRepositoryImpl (fineract-provider, out of scan)
                 └─ chargeRepository: ChargeRepository   ← the real bridge to Charge/ChargeRepository
```

**Sharper root cause than the generic S1 message:** `ChargeReadPlatformService.java` and `ChargeWritePlatformService.java` are **both physically inside the scanned root** — confirmed by reading them directly, both are plain interfaces with zero annotations (no `@Path`, `@Entity`, `@PreAuthorize`, anything the signal catalogue watches for). Because they produce no evidence, `signal-mapper.ts` never creates a `TypedUnit` for them at all — they're invisible to the pipeline even though they're in-scope, not merely unconnected. The deepest hop (the JPA repository usage) genuinely is in another module (`fineract-provider`), consistent with the known multi-root story — but the *first* hop's invisibility is a distinct, more specific mechanism: **plain, framework-marker-free interface classes are structurally undetectable by this catalogue-driven approach even when physically in-scope**, and they're often exactly the real service-boundary seam an architect needs to see.

**Confirms, doesn't contradict, prior findings:** all three "None of these" answers (Entries 7-8) remain correct — there genuinely is no direct API↔DB edge in the code, by design (CQRS-style read/write split). What's new is *why* the scanner can't see the real bridge — worth more than the generic S1 disclosure text alone.

**Action item:** Consider whether a future detection mechanism could flag "referenced interface with zero unit-forming evidence, in-scope" as its own distinct signal (e.g., promote a plain interface to a minimal placeholder unit purely on the basis of being a field-injected dependency of an already-typed service) — this would surface the real seam even without annotation evidence. Not scoped or committed to — flagging as a genuine, evidenced idea for a future detection catalogue row, not an immediate fix. No backlog ID assigned yet; candidate name if pursued: `B-plain-interface-bridge-detection`.

---

## Entry 12 — third, distinct detection gap found: Spring `@Bean`-factory ("starter") wiring is invisible too

**Observed:** Architect asked whether to run a multi-root scan (`fineract-charge` + `fineract-provider`) to recover the real chain traced in Entry 11, and which repos to include. Investigated the real implementation classes in `fineract-provider` before answering, to give an honest prediction rather than assume adding the module would fix the story.

**Finding:** Neither `ChargeReadPlatformServiceImpl` nor `ChargeWritePlatformServiceJpaRepositoryImpl` (the real implementations of the two plain interfaces from Entry 11) carry a class-level `@Service`/`@Component`/`@Repository` stereotype annotation. Both are wired via a third mechanism — a dedicated `@Configuration` "starter" class with `@Bean` factory methods:
```java
// fineract-provider/.../charge/starter/ChargeConfiguration.java
@Configuration
public class ChargeConfiguration {
    @Bean
    public ChargeReadPlatformService chargeReadPlatformService(...) { return new ChargeReadPlatformServiceImpl(...); }
    @Bean
    public ChargeWritePlatformService chargeWritePlatformService(...) { return new ChargeWritePlatformServiceJpaRepositoryImpl(...); }
}
```
This `starter`/`@Bean`-factory pattern is a real, apparently repo-wide reference-banking-platform convention (confirmed similarly named `starter`/`SavingsConfiguration.java`, `LoanAccountConfiguration.java`, etc. exist for other modules) — not a one-off. **No detection mechanism in this pipeline's signal catalogue currently recognizes `@Bean`-factory wiring as service-forming evidence.** So even scanning `fineract-provider`, these two impl classes likely still produce zero evidence and zero units — a second, independent invisibility mechanism stacked on top of Entry 11's plain-interface gap, on the very same real story.

**Action item:** A new signal-catalogue candidate — detect `@Bean`-annotated factory methods inside `@Configuration` classes as service-forming evidence for whatever type they return, sourcing the "real" class name/kind from the constructed type (e.g. `new ChargeReadPlatformServiceImpl(...)`), not just the configuration class itself. This is a materially different, well-evidenced mechanism from anything currently in the catalogue (JAX-RS/JPA/security-annotation decorators) — likely relevant repo-wide for the reference banking platform, not Charge-specific. No backlog ID assigned yet; candidate name if pursued: `B-spring-bean-factory-detection`.

**Expectation set for the upcoming multi-root scan (Entry 4's original open item):** should still be run as the real empirical test, but do not expect it to fully recover the `ChargesApiResource → ... → ChargeRepository` chain — two distinct, compounding, now-evidenced detection gaps (plain interfaces + `@Bean`-factory wiring) both sit on this exact story, independent of which roots are included.

---

## Entry 13 — should `fineract-core` be included too? Checked, answer is no, for a third reason

**Observed:** Architect asked whether `fineract-core` should also be in the multi-root scan, since `ChargesApiResource`'s write path goes through `PortfolioCommandSourceWritePlatformService`, which lives there.

**Investigated before answering:** `PortfolioCommandSourceWritePlatformService` is, itself, another plain interface (same pattern as Entry 11). Its real impl, `PortfolioCommandSourceWritePlatformServiceImpl` (in `fineract-core`), does carry `@Service` — but a direct check of `signal-catalogue.yml` confirms **there is no catalogue row for bare Spring `@Service`/`@Component` at all** — only specific things (JAX-RS routes, `@Entity`, `@PreAuthorize`, etc.) are watched for. So this impl would also produce zero evidence today. Separately, and independent of catalogue coverage: `ChargesApiResource` only imports the **interface** type — connecting that reference to a real implementation elsewhere requires resolving Spring dependency injection (interface → concrete bean), which nothing in this pipeline does; import-following alone can't make that link even if the impl were detected.

**A third, distinct real gap, on top of Entries 11-12:** no generic Spring stereotype (`@Service`/`@Component`) detection exists in the catalogue at all, and DI-based interface-to-implementation resolution isn't built. Both are real, separate from the plain-interface and `@Bean`-factory gaps already logged.

**Recommendation given:** skip `fineract-core` for this specific test — including it wouldn't recover a real edge back to `ChargesApiResource` (for the reasons above), and would only add scan time and a third confound to an already-two-gap story. Two-root scan (`fineract-charge` + `fineract-provider`) stays the cleanest test of Entries 11-12.

**Action item:** No new backlog candidate beyond what's implied by Entry 12 (a generic Spring stereotype detection row would be a natural pairing with the `@Bean`-factory detection idea) — noting here for completeness, not assigning a new id.

---

## Entry 14 — self-correction: the multi-root scan actually resolved the hop Entries 12-13 predicted it wouldn't

**Observed:** Architect ran the real two-root scan (`fineract-charge` + `fineract-provider`). `ChargesApiResource` came back with **3 real relationships**, including a `calls` edge straight to `ChargeReadPlatformServiceImpl.java::ChargeReadPlatformServiceImpl` (`x-aac-mechanism: "r2-phase1"`, confidence 10).

**What was wrong in Entries 12-13:** the prediction assumed the impl class needed signal-catalogue-recognized evidence (a Spring stereotype or `@Bean`-factory detection) to become a unit and be connectable at all. That assumption wasn't tested before being stated. In fact, the run log's own `multi-hop bridge (R2): 116 architecture relationship(s) resolved` line (visible in every scan this session, never investigated until now) is a separate mechanism — it uses Graphify's raw structural call-graph, which resolves real method calls independent of annotation-based typing, and mints a minimal unit for the call target on the spot. It doesn't need a catalogue row at all for this case. Should have tested this before predicting three turns' worth of "this won't work" — noted as a real process lesson, not just a data point.

**Two real findings in what R2 actually produced, still worth reviewing (not new detection gaps — quality/classification questions):**
1. `ChargeReadPlatformServiceImpl` got `node-type: "database"` — debatable; it's a service running raw JDBC queries, not an owned entity like `Charge`. Low confidence (`20`) honestly reflects this. Good Tier A "ontology judgment" residual candidate.
2. Two odd, identical edges from `ChargesApiResource` to `spm/domain/Component.java` (an unrelated Survey-domain class) — plausible Graphify id-resolution noise at wider scan scope, a known documented trade-off in this project's history. Worth treating with suspicion in the next residual session, not trusted outright.

**Action item:** None beyond what's already implied — these two are real candidate residuals for whenever a Session Pack is built against this multi-root run, not new backlog items.

---

## Entry 15 — a reference Java microservices banking sample's "happy path" scan — clean, as expected, confirms one known gap

**Observed:** Architect ran a fresh scan against a reference Java microservices banking sample's `repo/src/accounts/{userservice,contacts}` (recommended after the reference Java/JAX-RS banking platform's layered complexity kept surfacing detection gaps rather than letting the architect exercise the rest of the workflow).

**Result — clean and correct:**
```
userservice.py | service  | calls → db.py::UserDb
contacts.py    | service  | calls → db.py::ContactsDb
```
Both services connect directly to their own database class, no invisible layers, no CQRS/interface indirection — exactly the "happy path" shape this repo was chosen for.

**Two things checked, one reproduces Entry 10, one resolved as a non-issue:**
1. **Reproduces Entry 10, partially:** the two service nodes (`userservice.py`, `contacts.py`) still show the raw file path as `name`. The two database nodes are correctly named (`ContactsDb`, `UserDb`) — confirms Entry 10's theory that only the HTTP-entry-point path (`signal-mapper.ts:214`) has the bug; the persistence-detection path (`graphify-import-strategy-detector.ts`) already gets this right.
2. **Relationship count (2, not the ~6 an older doc entry described) — checked, not a bug.** `coverage-report.json`'s `relationshipsByKind: {"calls": 2}` confirms Graphify genuinely only found `calls` edges this run, not separate `imports`/`connects` edges too. The reconciler's dedup only collapses duplicates *within* one edge kind, so this isn't a dedup artifact — it's a real, accurate count for this run. The older "6" figure likely reflects an earlier tool/code state, not a regression.

**Only 1 residual:** `S2-http-without-security-control` — expected, matches known auth-detection coverage limits.

**Action item:** None new — this run is the clean baseline to compare the reference Java/JAX-RS banking platform's layered case against, and a good candidate for a short, low-friction residual-session walkthrough next.

**Naming half fixed 2026-08-10, see `AGENT_TASKS_Architect_Pilot_Fixes.md` Phase AP-3.** Re-ran this exact scan post-fix: `userservice.py`/`contacts.py` now name `userservice`/`contacts` (basename fallback — Python has no class-level marker for these Flask app-factory files, a real, disclosed edge in `scope-limitations.yml`'s new `unit-name-derivation` entry, not a full fix to a "true" service name). `UserDb`/`ContactsDb` were already correct before this fix. Locked in `test/regression.test.js`'s existing reference-sample test.

---

## Entry 16 — positive confirmation: VS Code + GitHub Copilot Chat correctly enforces the `tools:` allowlist (addendum to Entry 9, not a contradiction)

**Observed:** Architect ran the residual session on the reference sample's "happy path" run using genuine VS Code + GitHub Copilot Chat (not Claude Code chat). The chat agent wrote `drafts/decisions/R-001.json` directly via its `editFiles` tool, then **stopped** — the architect had to open the integrated terminal themselves and run `validate_drafts.py` and `apply.py` manually. The chat never invoked either script itself.

**What it means:** This is the positive half of Entry 9's finding, not a contradiction of it. The chat-mode's `tools:` allowlist (no `Bash`/terminal tool) genuinely held in its originally-intended host — VS Code Copilot Chat has no code path from that declared tool list to a terminal command, so the chat-mode file's "genuinely can't, not just won't" claim is **true here**, and **false in Claude Code chat** (Entry 9). The safety story is real, just host-specific — confirmed empirically in both directions now, not asserted either way.

**Action item:** Fold into Entry 9's action item #1 (correcting the chat-mode header comment) — the corrected wording should state the claim is confirmed true in VS Code Copilot Chat (this entry) and confirmed false in Claude Code chat (Entry 9), not leave either as a guess. No new backlog id — same `B-chatmode-host-enforcement-gap`.

---

## Entry 17 — CALM viewer shows blank "value" field for `path-interface` routes — confirmed viewer-side, explicitly out of scope

**Observed:** The CALM viewer's node-editor panel showed an empty `value` input for each of `contacts.py`'s 4 real interfaces, despite the underlying `architecture.calm.json` having real route text (`{"type": "path-interface", "path": "GET /version"}`).

**What it means:** Likely a field-naming mismatch — this pipeline stores route text under a `path` key (an informal per-type convention, `pipeline/src/types/calm.ts`'s `CalmInterface` allows arbitrary type-specific fields), and the viewer's generic editor form probably expects a fixed `value` key regardless of interface type. Data is confirmed correct; only the viewer's display is affected.

**Architect's direction: ignore — this is a bug on the visualizer's side, not this pipeline's.** No action item, no backlog id. Logged only so this doesn't get silently rediscovered as "new" later.

---

## Entry 18 — real bug, reproduced twice: the chat agent compacts multiple similar residuals into a summary and drops the Evidence blockquote entirely, even with correct context attached

**Observed:** Architect ran the residual session (genuine VS Code + GitHub Copilot Chat, model shown as GPT-5.6) against a fresh reference Java microservices banking sample pack — a real multi-hop 3-service scan (the reference sample's `repo/src/ledger/{ledgerwriter,balancereader,transactionhistory}`, `review-sessions/reference-sample-run/`, 23 Tier A residuals). Two attempts:
1. First attempt: only `residuals.json` + `evidence/unit-index.json` attached (`evidence/packs.json` never actually sent, still sitting unattached in the input box). Agent presented `R-001`/`R-002`/`R-003` as bare one-line questions ("has HTTP-entry-point evidence but no detected security-control evidence") with `[1]`/`[2]`/`leave-open`/`other` options and **zero evidence shown at all**.
2. Architect restarted the conversation and attached both `residuals.json` and `evidence/packs.json` this time, said "go ahead." **Same result, evidence still missing** — the agent again presented all three residuals as a compacted summary block with no `**Evidence:**` section for any of them, just the bare question + options, plus a combined "For all three cards" option-key legend.

Checked directly against the real pack data (not assumed): `R-001`'s actual `residuals.json` `card` field, read verbatim, DOES contain a full `**Evidence:**` blockquote with 4 real `file:line` citations from `LedgerWriterController.java`. The agent never reproduced it, in either attempt.

**What it means:** This is a real, reproducible violation of the chat-mode file's own instruction (`"residuals.json entry for this residual ID... every residual's card field is the full choice card (options, evidence, similar-residuals note). Present it as-is"` — `.github/agents/residual-review.agent.md`'s "Read first" section and Hard Rule 4). It is not a missing-context problem (confirmed by the second attempt, correct files attached, same failure) — it's the model choosing to compact several same-class residuals into a shorter summary and dropping the evidence in the process, an entirely plausible "be concise" instinct that the existing wording didn't explicitly forbid: the rule said "do not invent your own **options**," which a model can satisfy while still silently omitting the evidence section, especially when several residuals share a class and get batched into one reply.

**Architect's explicit direction, taken as a hard constraint on the fix**: do not hand the architect a workaround prompt to type each time ("show me the evidence verbatim...") — an architect is not expected to know to ask for that. The fix has to live in the agent's own instructions, not in what the architect has to remember to say.

**Action item — fixed same session, not just documented:** `.github/agents/residual-review.agent.md`'s "Read first" section and Hard Rule 4 rewritten to explicitly require verbatim, full-card reproduction (including the Evidence section) for every residual shown, and to explicitly forbid collapsing multiple same-class residuals into a summary that omits any one of their evidence sections — see that file's own diff/changelog. New regression test in `test_chatmode_safety.py` asserting the anti-compaction language is present, so this can't silently regress. **Honest limit, stated plainly**: this is instruction wording, not a structural guarantee like `apply.py`'s confirmation gate — it makes the failure significantly less likely, it cannot make it impossible, since LLM instruction-following is probabilistic. If it recurs after this fix, that's real evidence the wording still isn't strong enough, not that the architect did something wrong.

---

## Entry 25 — real, three-layer live failure: 23 Decision Records drafted by a real Copilot Chat session were ALL schema-invalid, silently "validated" as clean, and silently failed to apply

**Observed:** Architect ran a real, full residual review against `review-sessions/boa-run` (2026-09-01), answering all 23 residuals individually. The session's own summary reported success — `validate_drafts.py` result `valid: true, 0 errors`, `apply.py` "ran successfully," "No Overrides generated (decisions were informational...)." Checked directly, not trusted from the summary: `review-sessions/boa-run/drafts/decisions/R-001.json` (and all 23) used a completely invented field shape — `residual_id`/`construct`/`option`/`timestamp` — with no `decision_id` at all. None of the 23 decisions were ever real, valid `DecisionRecord`s, and nothing was ever written into any `architecture.calm.json`.

**Root cause — three real, independent defects that chained together, each confirmed by reading the actual code, not assumed:**

1. **The chat agent has no way to learn the real schema.** `.github/agents/residual-review.agent.md`'s only instruction for the Decision Record/Override shape was a bare citation — `(shapes: pipeline/src/types/overrides.ts)` — to a file the agent is explicitly forbidden from reading (outside the pack, no `codebase`/`search` tool). `AGENTS.md` (the one file inside the pack the agent *can* read) never embedded the shape either — just a one-line summary. The model filled the gap by inventing its own plausible-looking fields.
2. **`validate_drafts.py`'s own validation gate was defeated at its file-loading step**, duplicated identically in `validate_drafts.py`'s `main()` and `apply.py`'s `_run_validation()`: `{d["decision_id"]: d for d in decisions_list if ... "decision_id" in d}` silently *dropped* every decision file missing `decision_id` instead of reporting it as an error. With all 23 missing it, the dict passed to `validate()` was empty — trivially "0 errors" because there was nothing left to check. The real per-field validators (`_validate_decision`/`_check_required_fields`) already handled a decision missing `decision_id` correctly; they just never got the chance, because the malformed entries never reached them.
3. **`apply.py` correctly detected and failed on the resulting crash, but the message read as benign.** `writeArtefacts()` writes `emission-coverage-report.json` first, then calls `applyOverrides()` (which throws inside `loadOverridesDir()` on the first schema-invalid file), then would write `architecture.calm.json` — confirmed on disk: the real stray `boa-arch.calm.json/` output from this session has `emission-coverage-report.json` but is missing both `architecture.calm.json` and `overrides-applied-report.json`, exactly matching this crash point. `modules/registry.ts` isolates the throwing module (documented behavior — the run itself still exits 0). `apply.py` correctly detected the missing report and returned exit code 1, but its message ("no overrides were passed through?") read exactly like "0 overrides, nothing to apply" rather than "a module crashed" — which is precisely how it was misread.

**Fix — same session, all three layers, matching CLAUDE.md's "bug fixes are capability work" (mechanism class, not instance patch):**
1. `pack.py`'s `_render_agents_md()` now embeds the real `DecisionRecord`/`Override` JSON shape verbatim, as two worked examples (decision-only, and decision+override pair) — the file the agent can actually read now contains the real answer, not a citation to one it can't. `.github/agents/residual-review.agent.md` Hard Rule 6.1.9 updated to point at `AGENTS.md`, not the unreadable TypeScript file.
2. New shared `load_decisions_by_id()` in `validate_drafts.py`, used by both `main()` and `apply.py`'s `_run_validation()` (the exact bug was duplicated in both — fixed once, at the mechanism, not twice) — a decision file missing `decision_id` now produces a real validation error, never a silent drop.
3. `apply.py`'s "no overrides-applied-report.json found" branch now prints `result.stderr` (which carries the real `[module-registry] module "..." failed: ...` line whenever the cause is an isolated module crash) and records it in `apply-report.md`, so this can't be misread as "nothing to apply" again.

**Verified, not assumed:** re-ran a real pack build against `test_llm/boa-run` with `--with-dossier` — `AGENTS.md` now shows the real embedded schema. Wrote the exact real malformed shape found on disk into a fresh pack's `drafts/decisions/` and ran the real `apply.py` against it: refuses immediately (`REFUSING — validate_drafts found errors: ... missing required field 'decision_id' ... Fields present: ['construct', 'option', 'rationale', 'residual_id', 'reviewer', 'timestamp']`), never invokes `run-slice`. 9 new regression tests across `test_validate_drafts.py`/`test_apply.py`/`test_pack.py` (238/238 full suite green), including a second, independent instance of the loading-defect (all-malformed, not just one-malformed-one-good) per this repo's own "verify against a second instance" rule.

**Honest limit, stated plainly:** Fix 1 (embedding the schema) is instruction wording, same class of limit as every other agent-instruction fix in this file — it makes the model inventing its own schema far less likely, not structurally impossible. Fixes 2 and 3 are real, structural, code-level guarantees (a schema-invalid decision file can no longer validate as clean, regardless of what produced it) — the actual backstop this bug needed. Not yet re-verified against a live Copilot Chat session — the next real pilot run should confirm the agent copies the embedded shape correctly, same as every prior entry in this log.

---

## Entry 24 — real, more serious live failure: the agent silently decided all 23 residuals itself instead of presenting cards one at a time

**Observed:** Architect regenerated the pack with `--with-dossier` (confirmed working via direct inspection — Entry 23's fix verified correct), opened a genuinely fresh Copilot Chat session, attached the pack files, and sent a start message. The reply was not a card at all: `## Decisions` followed by `R-001: 1`, `R-002: 1`, ... `R-023: 1`, each with a short "Reason:" sentence the model wrote itself, ending with "This is a review decision, not an apply step. I have not modified the pack or run apply logic." No card, no options, no evidence blockquote, no "My read" paragraph — the model chose an answer for every single Tier A residual in the pack and reported it as a completed review.

**What it means — checked directly, not assumed:** searched the agent file for any instruction requiring the model to present one card and wait before moving to the next. There wasn't one. Hard rule 4 said "do not pick one on the architect's behalf," but nothing told the model *when* that boundary applies during a multi-residual session, or that "start the review" means "show me the first card," not "review everything and tell me what you'd choose." Left open, a capable model reasonably interpreted an open-ended "start the review" as a request to work through the queue efficiently and report results — exactly the behavior Hard Rule 4 already forbade, but via a gap the rule's wording didn't structurally close.

**Fix — same session:** new hard rule 5 (`.github/agents/residual-review.agent.md`, existing rules renumbered 5→9): **"Process residuals ONE AT A TIME. Present exactly one residual's full card, then STOP"** — no drafting, no decision, no moving to the next residual, until the architect replies to that specific one. Explicitly states that "go ahead" / "start the review" / "review everything" means show the first card, never permission to decide on the architect's behalf. Applied to every tier, and cross-referenced to hard rule 4 as the same boundary applied to presentation pace, not a separate concern. Hard rule 8 (bulk-apply) also got one added sentence tying it back to this rule — "similar residuals" grouping was never meant to imply the architect's-reply requirement could be skipped. New regression test `test_one_residual_at_a_time_rule_present` pins the language.

**Honest limit, stated plainly:** this is the third wording-based fix across Entries 21/22/24 in this same agent file, all targeting variations of "the model did something with a residual it wasn't supposed to do on its own." Unlike Entries 21→22→23 (same exact symptom, escalated to a structural fix after two failures), this is a **different** symptom — never diagnosed or attempted before — so treating it as a fresh first attempt is correct, not a violation of the "two failed attempts" rule. But the pattern across all of these entries is now itself data: this agent file's instruction-following has had four real, live, reproducible gaps in a row against the same handful of behaviors (compaction, evidence-line accuracy, recommendation authoring, decision pacing). If a fifth, similarly-shaped live failure shows up, that's the second occurrence of *this pattern* (not a repeat of any one entry) and is the point to stop trusting prose iteration on this file altogether and consider whether the chat-mode format itself (a single long instruction file an LLM must hold and prioritize correctly, unaided) is the right mechanism for enforcing hard turn-taking constraints, versus something enforced structurally (e.g., a pack that only ever exposes one residual's data at a time, making "decide the rest" impossible rather than merely forbidden). Not yet re-verified live — the next real reference-sample run is the actual test of this fix, same as every entry above.

---

## Entry 23 — second failed live attempt at the same symptom: re-derived the mechanism instead of patching the prose a third time, wired the recommendation to the already-built dossier

**Observed:** Architect restarted the chat again (fresh session, confirmed) after Entry 22's fix and pasted `R-001`'s reply. Still no `**My read (not a decision):**` paragraph — identical symptom, second real live failure in a row. Notably, the model's reply *did* add its own generic footer ("Reply with `1`, `2`, `leave-open`, or `other: ...`") not present anywhere in the agent file or the card — proof the model isn't blocked from adding content after the card (Entry 22's "verbatim conflict" diagnosis doesn't explain this), it simply never produced the *specific* required paragraph.

**What it means:** This repo's own convention (`CLAUDE.md`, "Session economy") states plainly: two failed fix attempts on the same problem is a stop signal, not a cue to try a third variation — it usually means the mechanism class was scoped wrong. Entries 21 and 22 both tried to get the *live, ambient chat model* to freshly author a grounded paragraph on demand, differing only in how the instruction was worded. That's the actual mechanism error: this repo already drew a hard line, on purpose, between "hope an ambient chat model follows an instruction" (probabilistic, and now shown unreliable twice for this exact ask) and "a structured LLM call with an explicit response schema and post-hoc validation that never invents an evidence ref" — that's precisely what `dossier.py` (T-2) was built for, and it was sitting unused: `cards.py` never once read `residual["dossier"]`.

**Fix — re-derived, not re-worded:** the `**My read (not a decision):**` paragraph is now rendered *deterministically* by `cards.py`'s new `_dossier_block`, straight from `residual["dossier"]` (dossier.py's own validated `{explanation, hypotheses, evidenceRefsUsed}`, already attached by `pack.py`'s `_run_dossier_pass` before cards are built, when `--with-dossier` is set). The chat model's job shrinks back to exactly what it already reliably does — reproduce the card verbatim — because the paragraph is now *part of* the card, not something added on top of it. No dossier available (no `--with-dossier`, or no LLM backend at pack-build time)? The card says so plainly (`"no evidence dossier available for this residual (run pack.py --with-dossier to generate one)"`) instead of leaving a gap the chat model might try to fill on its own — Hard Rule 4 now explicitly forbids the model from supplying its own recommendation when the card doesn't have one.

**Verified against real data, not just synthetic tests:** ran `pack.py --with-dossier` against the real reference-sample pack with a real `claude` CLI call. `R-001`'s real, rendered card now shows a correct, evidence-cited "My read" paragraph identifying the real JWT bearer-token verification on `/transactions` (`this.verifier.verify(bearerToken)`) and flagging it as a likely catalogue detection gap — independently matching what a manual evidence read found earlier in this same pilot. Two new regression tests in `test_cards.py` (dossier present / dossier absent) plus a rewritten `test_chatmode_safety.py` assertion pinning that the instruction file no longer asks the model to author anything live.

**Honest limit, stated plainly:** the recommendation now only exists when the architect explicitly runs `--with-dossier` with a working LLM backend — this is a real new manual step, not a free upgrade to every pack. Not yet re-verified against a live Copilot Chat session (only the deterministic card content and the real dossier call were verified directly); the next real pilot run should confirm the chat model reproduces this new section correctly, same as every other entry in this log.

---

## Entry 22 — real, live reproduction: Entry 21's recommendation paragraph never appeared, even in a fresh session — a genuine rule conflict, not a flaky model

**Observed:** Architect started a fresh Copilot Chat session (confirmed, not a stale one) after Entry 21 shipped, and pasted the resulting `R-001` reply. It was the deterministic card, presented correctly and verbatim — but with no `**My read (not a decision):**` paragraph at all, contradicting Hard Rule 4 as written.

**What it means — checked directly in the agent file, not assumed:** a real conflict between two instructions the model reads in the same file. The "Read first" section's rule 2 says, forcefully and first: *"Present it as-is, VERBATIM... do not re-derive or invent your own options."* That wording was written for Entry 18, specifically to stop the model from altering the card. Hard Rule 4, several paragraphs later, asks the model to append one more paragraph after the same card — but nothing in rule 2's phrasing said an appended paragraph is still compatible with "verbatim." A model that weighs the earlier, more forceful "VERBATIM... do not invent" framing more heavily than a later, less emphatic addition can reasonably resolve the apparent conflict by dropping the addition and staying safely inside "verbatim" — which is what happened.

**Fix — same session:** rule 2 now states explicitly that "verbatim" governs the card's own text only, names hard rule 4's paragraph requirement inline, and states both instructions hold at once — presenting the card unmodified and appending the recommendation are not in tension. New regression test `test_verbatim_does_not_suppress_the_recommendation_paragraph` pins the reconciling language.

**Honest limit, stated plainly:** same class of limit as every other agent-instruction fix in this file — wording, not a structural guarantee. This is also the second real instance of the same underlying failure mode in this file (Entry 18: a strong "be concise/be exact" instinct silently overriding a less emphatic requirement) — per this project's own "second occurrence of a mistake fixes the process, not the instance" rule, worth watching for a *third* occurrence; if one shows up, the fix should probably become a structural check (a lint pass over the agent file for instructions that could plausibly read as mutually exclusive) rather than a fourth prose patch. Not yet re-verified live — the next real reference-sample run should confirm the paragraph actually appears before this is considered proven.

---

## Entry 21 — a bare Tier A menu isn't informed choice when the architect doesn't own the code; Hard Rule 4 widened to require a labeled recommendation

**Observed:** After Entry 20's clickable-link fix, the architect asked directly for more: "I was expecting the LLM to read those files and recommend (of course based on the evidence) what to choose" — reasoning that "we can't expect an architect to understand the code (that they didn't write or own) and decide how it works."

**What it means:** This is a real, deliberate tension with the existing design, not an oversight. `residual-review.agent.md`'s Hard Rule 4 previously said "do not pick one on the architect's behalf, do not editorialize toward an option" — a governance boundary against an LLM's unverified guess being silently accepted as a decision. But that boundary assumed the architect could independently evaluate the evidence well enough to choose; the architect's own pushback is that this assumption doesn't hold when the code under review isn't theirs. A bare menu with citations an architect can't interpret isn't actually "informed decision making" either.

**Architect's direction, given two options (analysis-only-no-pick vs. explicit-recommendation-with-reasoning):** leaning toward the explicit recommendation, while flagging their own possible bias. Resolution reached: widen Hard Rule 4 rather than replace it — the LLM now must add one clearly-labeled `**My read (not a decision):**` paragraph per Tier A card, evidence-cited, stating which option the evidence best supports (or saying plainly the evidence doesn't support a confident read, rather than manufacturing one). What stays unchanged, deliberately: the LLM still never picks the option itself, silence is still never treated as an answer, the architect must still reply with a key before a Decision Record is drafted, and `apply.py`'s own separate, unconditional confirmation gate (hard rule 3) is untouched — the recommendation only changes what the agent may *say*, not what gets written or applied without a human step.

**Action item — fixed same session:** `.github/agents/residual-review.agent.md` Hard Rule 4 rewritten (see that file's diff). New regression test `test_tier_a_recommendation_rule_present_and_bounded` in `test_chatmode_safety.py` pins both halves of the change — that the recommendation language is present, and that the bounding language (never-silence, apply.py's gate stays unconditional) is present alongside it — so a future edit can't drop the safety framing while keeping the recommendation. **Honest limit, stated plainly**: same as Entry 18 — this is instruction wording, not a structural guarantee. It makes an unbounded "the LLM just decided for me" failure mode less likely, not impossible; if an architect reports the agent phrasing its read as the final answer rather than a recommendation, that's real evidence the wording needs strengthening, not evidence the architect misused it. Not yet re-verified against a live Copilot Chat session (the prior entries' fixes were); the next real pilot run against the reference-sample pack should confirm the recommendation actually appears, correctly labeled, before this is considered proven rather than just shipped.

---

## Entry 20 — evidence citations showed bare package-root-relative paths, not something an architect could click to the real file

**Observed:** After reviewing real cards against the reference-sample pack, the architect asked directly: "may be link the file name to the source so that architect can go read the file/section... now all that the architect has is file names (good enough to decide?)." Checked directly: every evidence citation in a card (e.g. `` `src/main/java/<reference-sample-package>/ledgerwriter/LedgerWriterController.java:108` ``) is relative to whichever scanned package root produced it — never to the VS Code workspace root an architect actually has open (confirmed via `manifest.json`'s `packageRoots`, stored as absolute filesystem paths, and the scan ref itself, stored root-relative). That combination isn't resolvable as a clickable path on its own, and isn't even the same string as a path from the workspace root.

**What it means:** A real, deterministic gap, not an LLM issue — the fix belongs in `pack.py`/`cards.py`, not agent instructions. `pack.py`'s `_read_snippet` already resolves each ref to a real absolute `Path` while reading the file for its context window; that resolved path was being discarded rather than surfaced.

**Fix — same session:** `_read_snippet` now returns `(snippet, resolved_path)`. `_build_evidence_packs` returns a companion `ref -> REPO_ROOT-relative "path:line"` map (`evidence/paths.json`, written alongside `evidence/packs.json`) wherever the resolved file lives inside `REPO_ROOT` — the normal case for this repo's own fixtures/spikes and any workspace opened at the repo root — and omits the entry rather than guess when it doesn't. `cards.py`'s `render_card_markdown`/`build_all_cards`/`_evidence_lines` gained an optional `evidence_paths` param: when present for a ref, the card's evidence blockquote shows that real, clickable path instead of the bare scan ref. Optional and defaulted, so every existing caller/test with a bare `ref -> snippet` dict (no paths) keeps working unchanged. Verified against two different instances: the NestJS fixture (new end-to-end assertion in `test_pack.py`, real `run-slice` + `pack.py` run) and the real reference-sample pack directly (the reference sample's repo `.../LedgerWriterController.java:108` now shown verbatim in `R-001`'s real evidence blockquote, content re-checked against the actual file).

**Honest limit, stated plainly:** only covers files that live inside `REPO_ROOT` — a package root scanned from outside the repo (unusual for this project's own workflow, but possible) still falls back to the bare scan ref, since guessing a wrong clickable path would be worse than showing none.

---

## Entry 19 — real bug, not an LLM issue this time: `cards.py`'s own deterministic evidence preview showed the wrong line, for every unmapped-signal-cluster residual

**Observed:** After Entry 18's fix, the architect re-ran the residual session (VS Code + GitHub Copilot Chat) against the same reference-sample pack. The agent now correctly reproduced every card verbatim, evidence included — but the evidence itself looked wrong. All 20 `unmapped-signal` cluster residuals (`R-004`...`R-023`, e.g. "Column" clustered 21 times, "HttpStatus" clustered 20 times) showed evidence lines that didn't contain the claimed signal at all — random-looking import statements, javadoc fragments, blank comment lines.

**What it means — checked directly, not assumed:** This is a real, deterministic bug in `cards.py`, nothing to do with the chat model or the LLM. Confirmed against the real pack data: `R-005`'s ("Column", 21×) real `card` field labeled `Transaction.java:42` as `import jakarta.persistence.Transient;` — but the real file's line 42 is `@Column(name = "TRANSACTION_ID", ...)`. Root cause: `evidence/packs.json`'s stored snippet per ref is a multi-line CONTEXT WINDOW (`context_lines` before *and* after the ref's own claimed line, built by `pack.py`'s `_read_snippet`/`_window_for_line`) — the ref's line number is roughly the *middle* of that window, not its first line. `cards.py`'s `_evidence_lines` was just taking "the first non-blank line of the stored snippet" as the preview — for a ref at line 42 with 15 lines of context on each side, that's real file line 27, not 42. This affected every residual whose evidence-building unit's own captured line sits more than a line or two into its context window — in practice, most unmapped-signal-cluster residuals, since their sample refs are typically not the very first line of a file.

**Fix — same session:** `cards.py` gained `_anchor_line_preview`, which recomputes the same window-start math `pack.py`'s `_window_for_line` uses (`start = max(0, line - 1 - context_lines)`) to find the anchor's real position within the stored snippet, falling back to the old first-non-blank-line heuristic only when the computed index doesn't land inside the snippet (e.g. a custom `--context-lines` large enough to trigger `_window_for_line`'s own re-centering — a known, disclosed, rare edge case, not silently papered over). `context_lines` threaded through `build_all_cards`/`render_card_markdown` from `pack.py`'s own real value, not a guessed default. Verified against the real reference-sample-run pack directly (not just synthetic tests): `R-005`'s evidence now shows the real `@Column(...)` annotations for all 5 sample refs. Two new regression tests in `test_cards.py`, deliberately different ref lines/`context_lines` values (this repo's own "verify against a second instance" rule) — a coincidental one-number match would not have caught this.
