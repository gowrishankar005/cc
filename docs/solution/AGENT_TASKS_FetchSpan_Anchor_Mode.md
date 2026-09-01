# AGENT TASK — `fetch-span --anchor`/`--context-lines` mode (T-3)

**Lane:** Independent · **After** nothing (T-1/T-2 both closed, this task doesn't touch the LLM backend at all)
**Governance/DoD:** `docs/solution/Architect_Residual_Review_Session.md` §3, `docs/solution/AGENT_TASKS_Residual_Assist_Redesign.md`'s own T-3 row (this file executes that row)
**Why this file exists:** `pack.py fetch-span` today requires an architect (or the in-chat Copilot mode printing a command for them to run) to supply exact `--start-line`/`--end-line` values. That's precise but demands the caller already knows the exact window they want — "give me N lines of context around this evidence ref" is the more common real need and currently has to be hand-computed. This adds a second way to *specify* the same bounded/redacted/capped read, not a new read mechanism.

## What you're building

A new mode on the existing `pack.py fetch-span` subcommand (`fetch_span_main`, `tools/review-session/pack.py:428`):

```
pack.py fetch-span --session-dir <pack> --residual-id <id> --anchor <file:line> --context-lines <n> [--max-lines <n>]
```

alongside the existing exact-range mode:

```
pack.py fetch-span --session-dir <pack> --residual-id <id> --path <file> --start-line <n> --end-line <n> [--max-lines <n>]
```

## Non-negotiable constraints

- **This is an alternate way to specify a span — not a new mechanism with its own limits.** Reuse every existing cap unchanged: `FETCH_SPAN_SESSION_MAX_CALLS` (10), `FETCH_SPAN_SESSION_MAX_LINES` (400), `FETCH_SPAN_HARD_CAP_LINES` (80), the same redaction (`redact()`, imported from `redact.py`), the same path-restriction-to-`packageRoots` (`_resolve_under_roots`), the same `evidence/packs.json`/`residuals.json`/`evidence/extra-reads.json`/`manifest.json` write sequence.
- **Reuse `_window_for_line` (`pack.py:284`), do not write a second windowing implementation.** It already does exactly this computation — given a 1-indexed line and `n_lines`, returns a `(start, end)` 0-indexed slice pair, capped at `MAX_SNIPPET_WINDOW` (40) and centered on the anchor line if the naive window would exceed it. This is the same helper `_build_evidence_packs`'s initial snippet extraction already calls (`pack.py:298`'s `_read_snippet`) — it is a proven, tested function, not something to reimplement for the CLI path.
- **`--anchor` and `--start-line`/`--end-line` are mutually exclusive**, and `--anchor` requires `--path` too (it names a file; `<file:line>` in the flag's own value, or a separate `--path` — your call on the exact CLI shape, but `argparse` must reject an invalid combination with a clear message, not silently pick one). Anchor mode's `--context-lines` should default to `pack.py`'s own existing `DEFAULT_CONTEXT_LINES` (15, `pack.py:42`) for consistency with how the rest of this tool already windows evidence.
- **All the existing exact-mode failure cases must have an anchor-mode equivalent**: path outside `packageRoots`, anchor line past EOF, session cap reached, line cap exceeded (`--max-lines`, hard-capped at `FETCH_SPAN_HARD_CAP_LINES`). Don't special-case anchor mode into skipping a check the exact mode already enforces.

## Where to make the change

`fetch_span_main` (`pack.py:428-524`) currently does, in order: parse args → validate `--residual-id` → load manifest/residuals → session-cap check → validate `start`/`end`/`max_lines` → resolve path under roots → read file → redact+write snippet → update `residuals.json`/`extra-reads.json`/`manifest.json`. The anchor-mode branch needs to compute an equivalent `(start, end)` — in 1-indexed terms, since the rest of the function (the `ref = f"{rel}:{start}"` line, `extra_doc["calls"]` entry) all use 1-indexed `start` — from `_window_for_line`'s 0-indexed result, before falling into the same redact/write/update logic the exact-range path already uses. Don't duplicate that downstream logic — branch only on how `start`/`end`/`span_len` get computed, then join back into one shared path.

## Verification

- `cd tools/review-session && python3 -m unittest discover -s . -p "test_*.py"` — full suite must stay green (217 tests before this task; expect it to grow, never shrink).
- New tests in `test_pack.py` (real subprocess CLI invocations, same convention the existing `fetch-span` tests already use — check `test_pack.py` for the current fetch-span test class and match its style): anchor mode produces the same result as the equivalent hand-computed exact range on a real fixture file; anchor past EOF fails with a clear message; anchor outside `packageRoots` fails; `--anchor` combined with `--start-line` is rejected by argparse; the two modes correctly share the session-wide call/line caps (an anchor-mode call and an exact-mode call in the same session both count against the same `FETCH_SPAN_SESSION_MAX_CALLS`/`FETCH_SPAN_SESSION_MAX_LINES`).
- Update `.github/chatmodes/residual-review.chatmode.md`'s "Extra-read" section (shows the architect the exact command to run) and `tools/review-session/README.md`'s `fetch-span` documentation to show both modes.
- No live-model call is needed anywhere in this task — it's pure file I/O, no `claude` CLI involvement. Don't add one.
