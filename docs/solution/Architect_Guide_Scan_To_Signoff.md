# Scan to Sign-Off — the Architect's Guide to Weaver

**What this is:** a practical, step-by-step walkthrough for an architect taking a repo from "I have source code" to "I have a reviewed, validated `architecture.calm.json` I'm willing to put my name on." No design rationale, no changelog — just the commands, in order, with what to expect at each step.

**What this isn't:** the design document. For *why* each step exists, the taxonomy of what an architect must decide vs. what the tool may draft, and every edge case considered, see [`Architect_Residual_Review_Session.md`](./Architect_Residual_Review_Session.md) (the design authority) and [`tools/review-session/README.md`](../../tools/review-session/README.md) (the tool's own reference). This guide exists because those two are correct but not something you hand an architect on day one.

**The workflow this covers is internally called the "residual review session."** If you want a name to call it in conversation: think of it as **the Review Bench** — the workbench where whatever the scan couldn't decide on its own gets finished, reviewed, and signed off. That name is a convenience for this guide, not a renamed product — the code, files, and other docs still say "residual review session" / "Session Pack," and that's fine.

**Hit something not covered here?** [`Architect_Pilot_Feedback_Notes.md`](./Architect_Pilot_Feedback_Notes.md) is a real log of everything a first-time architect actually ran into walking through this guide — worth a check before assuming something unexpected is your mistake.

**Working in Claude Code? You may not need most of the steps below.** `/review-session` (`.claude/skills/review-session/SKILL.md`) runs this entire guide — Steps 1 through 6 — as one conversational flow: it detects the right scan flags for your repo and confirms once, packs (asking about the dossier's real cost before running it, not silently defaulting to it), presents every open decision to you as real evidence-backed cards, validates, asks one explicit "apply now or stop here" before ever touching real CALM, applies, and validates the result — then tells you honestly what's still open. It's a second delivery vehicle for the *identical* rules this whole guide documents (see `Architect_Residual_Review_Session.md` §4.4a), not a shortcut around them. Keep reading if you want to understand what it's doing under the hood, you're on VS Code + Copilot Chat instead, or you want manual, step-by-step control.

---

## The shape of the whole thing

```
your repo
   │
   ▼
1. Scan  (run-slice)              →  typed-facts.json, coverage-report.json, architecture.calm.json (draft)
   │
   ▼
2. Build a Session Pack  (pack.py) →  review-sessions/<run-id>/  (SESSION.md, choice cards, drafts/)
   │
   ▼
3. Work the pack  (VS Code Copilot Chat, Claude Code's /review-session, or SESSION.md by hand)
   │                                 → you answer what only a human can decide
   │                                 → the assistant drafts the rest, evidence-only, never invents
   ▼
4. Validate the drafts  (validate_drafts.py)
   │
   ▼
5. Apply  (apply.py — the only step that touches real CALM; needs your explicit confirmation)
   │
   ▼
6. Read the result  (effective_ir.py + calm validate)
   │
   ▼
a reviewed architecture.calm.json + a human-readable summary you can hand to a stakeholder
```

Every write into the final CALM file goes through step 5, and step 5 only ever applies what steps 3–4 produced as a Decision Record + Override pair. Nothing edits the architecture file directly.

---

## Before you start

- `pipeline/` is built: `cd pipeline && npm install && npm run build`
- Python 3, standard library only — no extra install needed for `tools/review-session/`
- You know the package root(s) you want scanned (one repo, one or more sub-package directories)

**`npm install` prints deprecation warnings and a vulnerability count — expected, not a failure.** The warnings come from transitive sub-dependencies, not this project's own. The vulnerability count (checked: traces to `@cyclonedx/cdxgen`'s `tar`/`undici` sub-deps, not exploitable in how this pipeline uses it — a local filesystem scan, not untrusted network input) is real but not actionable here. **Do not run `npm audit fix --force`** — it bumps `cdxgen` to an untested breaking major version.

---

## Step 1 — Scan the repo

```bash
node pipeline/dist/orchestration/run-slice.js <package-root> [<package-root> ...] --out <out-dir>
```

This produces the raw materials in `<out-dir>`: `typed-facts.json`, `coverage-report.json`, `architecture.calm.json` (the deterministic first pass), `intelligence-ir.md`, and a review queue of anything the scanner itself flagged as uncertain.

**What to look at before moving on:** `<out-dir>/coverage-report.json`'s `silenceFlags`. If it includes `S1`, the scan genuinely didn't recover part of the architecture's shape for this repo — that's real information you'll want in hand before promising a stakeholder "this is the architecture," not something the next steps quietly paper over.

**Optional, only if `S1` shows up on a real Java/Spring repo: CodeQL DI-resolution.** CodeGraph (the default scanner) can miss a real dependency wired through a Spring `@Bean`-factory method or disambiguated by a stereotype annotation — CodeQL can see both, at real cost (a full compile + database build, minutes not seconds). Simplest way in:

```bash
node pipeline/dist/orchestration/run-slice.js <package-root> --out <out-dir> --auto-codeql
```

This detects your `build.gradle`/`pom.xml` and derives the right build command itself (including the two known Gradle gotchas — a stale daemon, a missing `--no-daemon` — that would otherwise silently produce zero bindings). **Before you use this, read the license note**: the free CodeQL CLI license only permits automated use against an Open Source Codebase, or under a paid GitHub Advanced Security license — this pipeline can't verify which applies to you, so `--auto-codeql` is a conscious opt-in, never on by default. If you're running this repeatedly, set `WEAVER_CODEQL_LICENSE_CONFIRMED=1` once in your shell profile instead of typing the flag every time — same effect, same license attestation. Full detail (hand-writing `--codeql-source-root`/`--codeql-build-command` yourself, the Gradle-daemon failure mode, what "silently zero bindings" looks like) is in `README.md`'s own CodeQL section — this is the fast path, that's the reference.

## Step 2 — Build your Session Pack

```bash
python3 tools/review-session/pack.py --out-dir <out-dir> --session-dir review-sessions/<run-id>
```

This reads the scan output and writes a self-contained workspace: `review-sessions/<run-id>/SESSION.md` (open this first), `residuals.json` (everything still open, sorted into three tiers — see below), `manifest.json` (includes a real `residualsByTrigger` count — check this before deciding whether a dossier pass is worth the cost, see below), `evidence/` (redacted source snippets backing each item), and an empty `drafts/` waiting to be filled.

If a pack for this run already exists with unapplied drafts, this refuses to overwrite it — apply or discard the old one first. It's always safe to re-run this exact command with `--with-dossier` added afterward, once you've seen the real residual count — nothing is lost by packing dossier-less first.

**Optional: attach a real, evidence-grounded LLM explanation to every open residual (any tier) before you start.** Check `manifest.json`'s `residualsByTrigger` for the real count first — this has a real, measured cost ($0.08–$0.32 and 40–132 seconds per residual) and a real, live-found risk: a full ~50-residual pack has hit sustained rate-limiting, and once, consumed enough real usage quota to lock out the calling session for hours. Bound it instead of running it on everything:

```bash
python3 tools/review-session/pack.py --out-dir <out-dir> --session-dir review-sessions/<run-id> --with-dossier --dossier-limit 15
```

`--dossier-limit 15` is a real, evidenced safe margin — comfortably under the ~20–30 calls that succeeded before hitting a wall both times this was tried. Drop the flag only for a genuinely small pack, or if you've explicitly decided the lockout risk is acceptable for this run.

**The three tiers, briefly:**
- **Tier A — you decide.** Presented as a short multiple-choice card with real evidence attached, never a blank text box.
- **Tier B — the assistant may draft, you approve.** Only when the evidence bar is fully met; otherwise it correctly says "cannot decide" rather than guessing.
- **Tier C — nobody invents.** Things like an unresolvable external call or a dynamic dispatch pattern get documented as out-of-scope, not fabricated into a relationship that doesn't exist.

**Set your expectations before you open the pack:** most real residuals today will be Tier A. Only one real detector currently produces Tier B (a specific multi-hop-bridge shape — one clear candidate among several syntactic implementers, below the auto-include confidence bar); everything else routes to Tier A or C. Seeing an all-Tier-A pack on your first run is normal, not a sign the tool skipped something.

## Step 3 — Work the pack

The custom agent lives at `.github/agents/residual-review.agent.md` — it's a real file checked into this repo, not something to fetch separately. (If you're on an older Copilot Chat that still expects `.github/chatmodes/*.chatmode.md`, this file won't be picked up from its current location — see your Copilot Chat version, or ask about migrating back, if the agent picker comes up empty.) It reads `SESSION.md` and `residuals.json`, presents each open item as a choice card synthesized from real evidence, and only ever writes proposals under `drafts/`.

**Already using Claude Code instead?** `/review-session` reuses this exact same file's hard rules by reference (`Architect_Residual_Review_Session.md` §4.4a) — it isn't a separate protocol, just a different vehicle that also owns Steps 1, 2, 4–6 for you. Everything below in this step (how to actually decide a card, what "Leave open" means, the fetch-span behavior) applies identically whichever vehicle presents the cards. One real, additional guarantee the Skill vehicle adds: a `PreToolUse` hook (`.claude/hooks/check-apply-confirmed.py`) hard-blocks Step 5's apply command in real code unless a genuine confirmation round-trip with you already happened — not just an instruction the assistant is trusted to follow. (Disclosed honestly: whether that hold survives `--dangerously-skip-permissions` is undocumented by Claude Code itself — don't treat it as unconditional if you run in that mode.)

**VS Code + GitHub Copilot Chat (the primary, intended path).**
1. Open this repo as a workspace in VS Code (the desktop app, not the terminal).
2. Open the Copilot Chat panel and find its agent picker — a dropdown near the chat input (or type `/agents` in the chat box to open it directly).
3. Select **"CALM File reviewer"** (this file's own `name:` frontmatter).
4. Point it at your pack, e.g.: `Read review-sessions/<run-id>/SESSION.md and start the residual review.`
5. No `ANTHROPIC_API_KEY` or any other secret to set up — Copilot Chat uses whatever model your own Copilot subscription already provides.

**How to actually decide a Tier A card — a real question, not a formality.** A pack with 20+ Tier A cards is normal on a real multi-service repo, and "you decide" isn't much help on its own. What actually works:
- **Read the evidence blockquote, and only the evidence blockquote.** That's the whole point of a choice card — the answer is either supported by what's shown, or it isn't. Don't reach for "what a Spring Boot app like this usually does," even if you're confident — if the evidence doesn't show it, it doesn't count, no matter how experienced you are with the framework.
- **Evidence too short to be sure? Ask for more before deciding**, don't fill the gap from memory. The chat prints a `pack.py fetch-span` command for exactly this (see below) — run it, then keep reading.
- **`--with-dossier`'s explanation (if you built the pack with it) is a second opinion, not a second vote.** It's a legitimate aid for reading the evidence faster, not a replacement for you actually deciding — and it's never treated as independent corroboration of anything.
- **"Leave open" is a complete, correct answer, not a cop-out.** This system is built so you never have to force a confident answer you don't actually have — it was the single most common real answer across two prior pilot sessions. If the evidence genuinely doesn't tell you, say so and move on.
- **For a big batch, don't decide every card independently from scratch.** Once you've answered one for real and its card's "Similar residuals this session" note lists others, replicate that exact decision across them — still one real Decision Record per residual, never a blanket record:
  ```bash
  python3 tools/review-session/bulk_apply.py --session-dir review-sessions/<run-id> --anchor <the-residual-id-you-just-answered> --i-confirm-bulk-apply
  ```
  Want to work highest-impact-first instead of top-to-bottom through 20+ cards? Rank the backlog by real consequence signals first:
  ```bash
  python3 tools/review-session/queue_rank.py --session-dir review-sessions/<run-id>
  ```

**The real safety guarantee, wherever you run the chat mode (VS Code, Claude Code, or any other host) — read this, not folklore about what a given host "can't" do:** Copilot Chat can propose invoking any tool available to it in any host, including a terminal command — that's normal agentic behavior, not a bug, and it is *not* something this chat-mode file's declared `tools:` list can categorically prevent (a host is free to ignore that list, and even where it's honored, the per-action confirmation prompt that would gate a run is itself a configurable IDE setting someone could turn off). **The one thing that actually holds, in every host, no exceptions**: `apply.py` — the only code path that ever writes to `architecture.calm.json` — is this repo's own code, not an IDE preference, and it refuses to run without its own separate, explicit confirmation (Step 5), regardless of what the chat client did upstream. A drafted file under `drafts/` is inert until you run Step 5 yourself. Treat that as the guarantee — not "this host can't run scripts."

**Practical guidance while you're in the chat, any host:** always approve file writes individually, and never grant a blanket "allow all edits this session" permission — that's needless exposure, not a required convenience, given Step 5 is the real gate either way.

**Optional, before you even open the chat: `pack.py --with-dossier` (see Step 2 above for the real cost and the `--dossier-limit` safety bound).** Re-run Step 2 with this flag and every open residual (any tier, up to the limit you set) gets a real, evidence-grounded explanation attached before you start — Copilot Chat (or you, reading `SESSION.md` by hand) sees the reasoning up front instead of a bare choice card. Needs the `claude` CLI already authenticated on your `PATH` (same convenience as Copilot Chat itself — no separate key to manage).

**Previously a known gap, fixed:** a residual from a Spring config file (`application.yml`-derived database/queue units) used to come back from `--with-dossier` saying no evidence was provided, with no explanation why — a real coverage hole in how evidence snippets were built for that unit shape. Fixed: that shape now gets an honest placeholder explaining exactly why no snippet is available, instead of the model seeing nothing.

**If a card's evidence snippet is too short to decide from:** the chat prints one `pack.py fetch-span` command instead of guessing — it never runs this itself. Copy it into your terminal, run it, and the extra source lines land in the pack for you to keep reviewing. Two forms: an exact `--start-line`/`--end-line` range, or `--anchor <file:line> --context-lines <n>` for "N lines either side of this line" without hand-computing the range yourself. Capped per session (10 extra reads / 400 lines) so this can't quietly balloon into reading the whole repo.

**A small cosmetic quirk you may see, host-dependent, not a bug:** every choice card already includes its own "Other…" option (by design). Some hosts' own chat UI adds a second, independent "Other" on top of it — two overlapping ways to say the same thing, harmless.

**Without a chat interface at all:** open `SESSION.md` directly and hand-author the Decision Record + Override JSON pairs yourself. See `tools/review-session/examples/` for two worked examples — a correction (`decision-D-example-001.json` + its Override) and a "leave it open" confirmation (`decision-D-example-002-leave-open.json`, no Override needed) — this path works today, it's just more typing.

Either way, by the end of this step `review-sessions/<run-id>/drafts/decisions/` (and, if anything actually needs to change in CALM, `drafts/overrides/`) are populated.

## Step 4 — Validate the drafts

```bash
python3 tools/review-session/validate_drafts.py --session-dir review-sessions/<run-id> --calm <out-dir>/architecture.calm.json
```

Checks every draft against the schema and the same integrity rules the real apply mechanism enforces (no dangling references, no override against a superseded decision, no relationship pointing at a node that doesn't exist). Fix anything it flags before applying — nothing here writes to the real architecture file yet.

## Step 5 — Apply

```bash
python3 tools/review-session/apply.py --session-dir review-sessions/<run-id> --out <out-dir>-reviewed
```

The only command in this whole workflow that touches `run-slice`/the real override mechanism. Before it asks for your explicit confirmation, it prints a real, per-trigger-class completeness table — how many of the pack's residuals actually have a decision, broken down by trigger class, not just "N applied." Read this before confirming: it's the thing that stops "N applied, 0 rejected" from silently reading as "the pack is fully reviewed" when several trigger classes were never touched (a real mistake this exact workflow's own build process made once — see `BACKLOG.md`'s "Session Pack completeness visibility" row). Once confirmed, it writes the reviewed output to `<out-dir>-reviewed` along with `apply-report.md` (which repeats the same completeness numbers) and `decisions-log.md` — your audit trail of who decided what.

## Step 6 — Read the result

```bash
python3 tools/review-session/effective_ir.py \
  --calm <out-dir>-reviewed/architecture.calm.json \
  --session-dir review-sessions/<run-id> \
  --out review-sessions/<run-id>/effective-architecture-ir.md

# the validate script lives in pipeline/package.json, and its own -u path is
# relative to pipeline/ — cd into it, and adjust the target path to match
(cd pipeline && npm run validate -- ../<out-dir>-reviewed/architecture.calm.json -f pretty)
```

`effective-architecture-ir.md` is the human-readable summary — nodes, relationships, decisions, and what's still explicitly left open — the thing you'd actually hand a stakeholder. `calm validate` is the final, independent schema check on the file itself.

**Doing another scan later?** Point `pack.py` at the prior session with `--baseline`, and anything you already decided is carried forward, never re-asked — only genuine drift gets re-surfaced as a new item.

---

## What you'll end up with

| File | What it is |
|---|---|
| `<out-dir>-reviewed/architecture.calm.json` | The reviewed, `calm validate`-clean architecture model — the deliverable |
| `review-sessions/<run-id>/effective-architecture-ir.md` | Human-readable summary for stakeholders |
| `review-sessions/<run-id>/decisions-log.md` | Audit trail — every decision, who made it, why |
| `review-sessions/<run-id>/apply-report.md` | What actually got written and when |

---

## The rules worth knowing before you start

- Nothing here ever edits `typed-facts.json` — the deterministic scan output is never touched, only projected forward through overrides.
- The only legal write path into the architecture file is Decision Record + Override, applied by `apply.py`. There is no other door.
- Insufficient evidence always means "leave it open," never a plausible-sounding guess — this is on purpose.
- Answering a residual for this run does not mean the scanner will find the same thing automatically next time. It's a correction for *this* run's output, not a permanent fix to the detection mechanism. If `coverage-report.json` flagged a real gap (S1/S2), that's still a real, disclosed gap in what the scanner recovers — say so when you report results, don't let a clean-looking reviewed CALM file imply otherwise.
- Session Packs (`review-sessions/`) are scratch workspaces, not permanent artefacts — gitignored by default. `decisions-log.md` and `apply-report.md` are the pieces worth keeping around for audit purposes if you want to archive one.

For the full rule set (redaction, bulk-apply integrity, what the tool is explicitly forbidden from doing) see `tools/review-session/README.md`'s "Non-negotiable rules" section.
