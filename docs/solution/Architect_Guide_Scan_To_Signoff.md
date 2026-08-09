# Scan to Sign-Off — the Architect's Guide to Weaver

**What this is:** a practical, step-by-step walkthrough for an architect taking a repo from "I have source code" to "I have a reviewed, validated `architecture.calm.json` I'm willing to put my name on." No design rationale, no changelog — just the commands, in order, with what to expect at each step.

**What this isn't:** the design document. For *why* each step exists, the taxonomy of what an architect must decide vs. what the tool may draft, and every edge case considered, see [`Architect_Residual_Review_Session.md`](./Architect_Residual_Review_Session.md) (the design authority) and [`tools/review-session/README.md`](../../tools/review-session/README.md) (the tool's own reference). This guide exists because those two are correct but not something you hand an architect on day one.

**The workflow this covers is internally called the "residual review session."** If you want a name to call it in conversation: think of it as **the Review Bench** — the workbench where whatever the scan couldn't decide on its own gets finished, reviewed, and signed off. That name is a convenience for this guide, not a renamed product — the code, files, and other docs still say "residual review session" / "Session Pack," and that's fine.

**Hit something not covered here?** [`Architect_Pilot_Feedback_Notes.md`](./Architect_Pilot_Feedback_Notes.md) is a real log of everything a first-time architect actually ran into walking through this guide — worth a check before assuming something unexpected is your mistake.

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
3. Work the pack  (VS Code Copilot Chat, or SESSION.md by hand)
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

## Step 2 — Build your Session Pack

```bash
python3 tools/review-session/pack.py --out-dir <out-dir> --session-dir review-sessions/<run-id>
```

This reads the scan output and writes a self-contained workspace: `review-sessions/<run-id>/SESSION.md` (open this first), `residuals.json` (everything still open, sorted into three tiers — see below), `evidence/` (redacted source snippets backing each item), and an empty `drafts/` waiting to be filled.

If a pack for this run already exists with unapplied drafts, this refuses to overwrite it — apply or discard the old one first.

**The three tiers, briefly:**
- **Tier A — you decide.** Presented as a short multiple-choice card with real evidence attached, never a blank text box.
- **Tier B — the assistant may draft, you approve.** Only when the evidence bar is fully met; otherwise it correctly says "cannot decide" rather than guessing.
- **Tier C — nobody invents.** Things like an unresolvable external call or a dynamic dispatch pattern get documented as out-of-scope, not fabricated into a relationship that doesn't exist.

## Step 3 — Work the pack

The chat mode lives at `.github/chatmodes/residual-review.chatmode.md` — it's a real file checked into this repo, not something to fetch separately. It reads `SESSION.md` and `residuals.json`, presents each open item as a choice card synthesized from real evidence, and only ever writes proposals under `drafts/`.

**Recommended, strongest safety guarantee: VS Code + GitHub Copilot Chat.**
1. Open this repo as a workspace in VS Code (the desktop app, not the terminal).
2. Open the Copilot Chat panel and find its chat-mode picker (usually a dropdown near the chat input).
3. Select the mode matching this file's `description` frontmatter ("Weaver residual review session...").
4. Point it at your pack, e.g.: `Read review-sessions/<run-id>/SESSION.md and start the residual review.`

**Confirmed real** (not just designed): in an actual VS Code Copilot Chat session, the chat wrote a Decision Record and then genuinely stopped — it has no terminal tool available at all, so you run `validate_drafts.py`/`apply.py` yourself in Step 4/5. This is a structural guarantee in this host, not a convention.

**Also works, weaker safety guarantee: Claude Code chat.** The same chat-mode file works when opened directly in Claude Code — same choice cards, same evidence-first behavior. **But confirmed differently here**: Claude Code chat *does* have terminal (`Bash`) access despite the identical file, so nothing structurally stops it from running `apply.py` itself. In practice it stayed within its stated rules (wrote only to `drafts/`, asked before writing) — but the only thing actually enforcing that is the model's own compliance plus this host's per-action permission prompt. **If you use this path: always approve each file write individually, and never choose a blanket "allow all edits this session" option** — that's the one thing standing between you and an unreviewed apply.

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

The only command in this whole workflow that touches `run-slice`/the real override mechanism. It re-validates, asks for your explicit confirmation, then writes the reviewed output to `<out-dir>-reviewed` along with `apply-report.md` and `decisions-log.md` — your audit trail of who decided what.

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
