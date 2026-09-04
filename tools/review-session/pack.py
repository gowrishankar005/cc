#!/usr/bin/env python3
"""pack.py — Builds a Session Pack from a real run-slice out-dir.

Usage:
    python3 pack.py --out-dir <run-slice-out> --session-dir <review-sessions/<run-id>>

Reads (per Architect_Residual_Review_Session.md §4.2): typed-facts.json,
coverage-report.json (both required), review-queue.json (generated via
hitl-review-trigger.js if missing), unmapped-signals-report.json and
ignored-items-report.json (optional), architecture.calm.json (optional,
noted in manifest only).

Writes the layout from §4.1: SESSION.md, AGENTS.md, manifest.json,
residuals.json, evidence/{unit-index.json,packs.json}, empty
drafts/{decisions,overrides}, decisions-log.md.

S1 (never imported by run-slice.ts / not part of the deterministic core),
S2 (never writes typed-facts.json — read-only over every Weaver artefact),
S8 (every snippet in evidence/packs.json passes through redact.py first).
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
REPO_ROOT = Path(__file__).resolve().parents[2]

from redact import redact  # noqa: E402
from triage import build_residuals, apply_baseline  # noqa: E402
from cards import build_all_cards  # noqa: E402
from consequence import annotate_residuals  # noqa: E402
import dossier  # noqa: E402
from llm_common import _llm_backend_available  # noqa: E402
from validate_drafts import summarize_by_trigger, load_decisions_by_id  # noqa: E402

# Wider than the original +/- 3: most "need 20 more lines" cases stay in
# the pack. Hard cap on the window so one residual cannot dump a file.
DEFAULT_CONTEXT_LINES = 15
MAX_SNIPPET_WINDOW = 40
FETCH_SPAN_DEFAULT_MAX_LINES = 40
FETCH_SPAN_HARD_CAP_LINES = 80
FETCH_SPAN_SESSION_MAX_CALLS = 10
FETCH_SPAN_SESSION_MAX_LINES = 400

_REF_RE = re.compile(r"^(.*):(\d+)$")


def main() -> int:
    if len(sys.argv) > 1 and sys.argv[1] == "fetch-span":
        return fetch_span_main(sys.argv[2:])
    return pack_main()


def pack_main() -> int:
    parser = argparse.ArgumentParser(description="Build a Weaver residual review Session Pack from a run-slice out-dir.")
    parser.add_argument("--out-dir", required=True, help="run-slice output directory (must contain typed-facts.json + coverage-report.json)")
    parser.add_argument("--session-dir", required=True, help="where to write the Session Pack (typically review-sessions/<run-id>)")
    parser.add_argument("--roots", nargs="*", default=None, help="override package roots for source snippet reads (defaults to typed-facts.json's own packageRoots)")
    parser.add_argument("--baseline", help="a prior Session Pack dir — residuals already decided there are carried forward, not re-asked; residuals whose evidence shape changed since are flagged re-confirm")
    parser.add_argument("--max-residuals", type=int, default=None, help="keep the N highest-consequence askable residuals (carried_forward always kept). Token cap, not a correctness cap.")
    parser.add_argument("--context-lines", type=int, default=DEFAULT_CONTEXT_LINES, help=f"lines either side of an Evidence.ref (default {DEFAULT_CONTEXT_LINES}; window capped at {MAX_SNIPPET_WINDOW})")
    parser.add_argument("--with-dossier", action="store_true", help="opt-in Evidence Dossier pass (T-2): calls the `claude` CLI to attach an additive `dossier` field to every open residual (any tier). Off by default -- needs the `claude` CLI on PATH; no backend -> reports what would have been attempted, writes a normal dossier-less pack.")
    args = parser.parse_args()

    out_dir = Path(args.out_dir).resolve()
    session_dir = Path(args.session_dir).resolve()

    facts_path = out_dir / "typed-facts.json"
    coverage_path = out_dir / "coverage-report.json"
    if not facts_path.exists() or not coverage_path.exists():
        print(f"[pack] missing typed-facts.json or coverage-report.json in {out_dir} — run run-slice.js first", file=sys.stderr)
        return 1

    refuse_reason = _refuse_if_unapplied_drafts(session_dir)
    if refuse_reason:
        print(f"[pack] REFUSING: {refuse_reason}", file=sys.stderr)
        return 1

    facts = json.loads(facts_path.read_text())
    coverage = json.loads(coverage_path.read_text())

    review_queue_path = out_dir / "review-queue.json"
    if not review_queue_path.exists():
        print("[pack] review-queue.json missing — generating via hitl-review-trigger.js")
        _generate_review_queue(out_dir)
    if not review_queue_path.exists():
        print("[pack] hitl-review-trigger.js did not produce review-queue.json — treating as empty (no S1/S2/S5/low-arch-cov residuals this run)", file=sys.stderr)
        review_queue = {"items": []}
    else:
        review_queue = json.loads(review_queue_path.read_text())

    unmapped_path = out_dir / "unmapped-signals-report.json"
    unmapped = json.loads(unmapped_path.read_text()) if unmapped_path.exists() else None

    ignored_path = out_dir / "ignored-items-report.json"
    ignored = json.loads(ignored_path.read_text()) if ignored_path.exists() else []

    calm_path = out_dir / "architecture.calm.json"
    has_calm = calm_path.exists()

    package_roots = args.roots if args.roots else facts.get("packageRoots", [])

    session_dir.mkdir(parents=True, exist_ok=True)
    (session_dir / "drafts" / "decisions").mkdir(parents=True, exist_ok=True)
    (session_dir / "drafts" / "overrides").mkdir(parents=True, exist_ok=True)
    (session_dir / "evidence").mkdir(parents=True, exist_ok=True)

    residuals = build_residuals(review_queue, unmapped=unmapped, ignored=ignored if isinstance(ignored, list) else None)

    if args.baseline:
        baseline_dir = Path(args.baseline).resolve()
        baseline_residuals_path = baseline_dir / "residuals.json"
        baseline_decisions_dir = baseline_dir / "drafts" / "decisions"
        if not baseline_residuals_path.exists():
            print(f"[pack] --baseline {baseline_dir} has no residuals.json — ignoring, treating this as a first pass", file=sys.stderr)
        else:
            baseline_residuals = json.loads(baseline_residuals_path.read_text()).get("items", [])
            baseline_decisions = [json.loads(f.read_text()) for f in sorted(baseline_decisions_dir.glob("*.json"))] if baseline_decisions_dir.exists() else []
            before = len(residuals)
            residuals = apply_baseline(residuals, baseline_residuals, baseline_decisions)
            carried = sum(1 for r in residuals if r.get("status") == "carried_forward")
            reconfirm = sum(1 for r in residuals if r.get("reconfirm"))
            print(f"[pack] --baseline applied: {carried}/{before} residual(s) carried forward (not re-asked), {reconfirm} flagged re-confirm (evidence shape changed since baseline)")

    unit_index = _build_unit_index(facts)
    (session_dir / "evidence" / "unit-index.json").write_text(json.dumps(unit_index, indent=2))

    # T-RT-2: a real, computed consequence score per residual (PII-proxy /
    # external-system-identity / trust-boundary-edge signals — see
    # consequence.py's own module docstring for exactly what each proxies
    # for and why), so queue_rank.py can rank the backlog highest-
    # consequence-first without re-deriving these facts itself.
    residuals = annotate_residuals(residuals, unit_index, facts.get("relationships", []))
    residuals = _rank_and_cap(residuals, args.max_residuals)

    context_lines = max(0, args.context_lines)
    packs, evidence_paths = _build_evidence_packs(residuals, unit_index, package_roots, context_lines)
    (session_dir / "evidence" / "packs.json").write_text(json.dumps(packs, indent=2))
    (session_dir / "evidence" / "paths.json").write_text(json.dumps(evidence_paths, indent=2))

    # T-2 (AGENT_TASKS_Residual_Dossier_Module.md): opt-in only -- with no
    # --with-dossier flag, pack.py behaves exactly as it did before this
    # pass existed (doesn't even check for a `claude` CLI backend).
    if args.with_dossier:
        residuals = _run_dossier_pass(residuals, unit_index, packs)

    # Deterministic choice cards, generated from the fixed
    # per-class templates in cards.py (never LLM-invented), attached
    # directly onto each residual so the bound Copilot Chat agent
    # can read the card straight out of residuals.json. carried_forward
    # residuals never get a full choice card — they're not being
    # asked again — just a short note.
    askable = [r for r in residuals if r.get("status") != "carried_forward"]
    card_markdown = build_all_cards(askable, unit_index, packs, context_lines, evidence_paths)
    for r in residuals:
        r["card"] = card_markdown.get(r["id"], f"### {r['id']} (carried forward)\n\n{r['rationale']}\n")
    (session_dir / "residuals.json").write_text(json.dumps({"generatedAt": _now(), "items": residuals}, indent=2))

    manifest = {
        "generatedAt": _now(),
        "outDir": str(out_dir),
        "packageRoots": package_roots,
        "contractVersion": facts.get("contractVersion"),
        "runVersion": facts.get("runVersion"),
        "hasCalm": has_calm,
        "hasUnmapped": unmapped is not None,
        "residualCount": len(residuals),
        # Static per-trigger INVENTORY only (tier + count) -- not decided/
        # undecided, which pack.py cannot know at generation time (drafts/
        # doesn't exist yet). Decided/undecided is an apply-time fact; see
        # apply.py's own _print_completeness_table / summarize_by_trigger.
        # Real gap found 2026-09-04: a review pass fully worked one of 5
        # trigger classes in a real pack and reported it complete -- this
        # flat residualCount gave no signal that other classes existed.
        "residualsByTrigger": _residuals_by_trigger_inventory(residuals),
        "crossPackageBackbone": "codegraph",
        "extraReadCount": 0,
        "extraReadLines": 0,
        "extraReadMaxCalls": FETCH_SPAN_SESSION_MAX_CALLS,
        "extraReadMaxLines": FETCH_SPAN_SESSION_MAX_LINES,
    }
    (session_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))

    (session_dir / "SESSION.md").write_text(_render_session_md(manifest, residuals, session_dir))
    (session_dir / "AGENTS.md").write_text(_render_agents_md())
    (session_dir / "decisions-log.md").write_text("# Decisions log\n\n_No decisions recorded yet — this file is appended to as Decision Records are drafted/applied._\n")

    print(f"[pack] wrote Session Pack to {session_dir} ({len(residuals)} residual(s))")
    return 0


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _refuse_if_unapplied_drafts(session_dir: Path) -> str | None:
    """§4 concurrency rule: refuse to overwrite an existing pack that has
    unapplied drafts, fail loud rather than silently clobber in-progress work."""
    decisions_dir = session_dir / "drafts" / "decisions"
    overrides_dir = session_dir / "drafts" / "overrides"
    has_unapplied = any(d.exists() and any(d.iterdir()) for d in (decisions_dir, overrides_dir))
    if has_unapplied:
        return f"a pack for this run already exists at {session_dir} and has unapplied drafts — apply or discard it first"
    return None


def _generate_review_queue(out_dir: Path) -> None:
    hitl_trigger = Path(__file__).resolve().parents[2] / "pipeline" / "dist" / "analysis" / "ir" / "hitl-review-trigger.js"
    if not hitl_trigger.exists():
        print(f"[pack] {hitl_trigger} not found (pipeline not built?) — skipping review-queue generation", file=sys.stderr)
        return
    subprocess.run(["node", str(hitl_trigger), str(out_dir)], check=False)


def _build_unit_index(facts: dict) -> dict:
    """Thin unitId -> {kind, confidence, refs} — never the full TypedUnit
    (no full CodeGraph dump, per design §4.1)."""
    index = {}
    for unit in facts.get("units", []):
        index[unit["id"]] = {
            "kind": unit["kind"],
            "confidence": unit["confidence"],
            "filePath": unit["filePath"],
            "evidenceRefs": [e["ref"] for e in unit.get("evidence", [])],
        }
    return index


def _rank_and_cap(residuals: list[dict], max_residuals: int | None) -> list[dict]:
    """--max-residuals keeps the N highest-consequence *askable* residuals
    (T-RT-2 scores already annotated). Uncapped path keeps build order
    (review-queue first, then unmapped, then ignored). carried_forward
    always kept. Original residual ids are preserved."""
    if max_residuals is None:
        return residuals
    carried = [r for r in residuals if r.get("status") == "carried_forward"]
    askable = [r for r in residuals if r.get("status") != "carried_forward"]
    askable.sort(key=lambda r: int((r.get("consequence") or {}).get("score") or 0), reverse=True)
    return carried + askable[: max(0, max_residuals)]


def _build_evidence_packs(residuals: list[dict], unit_index: dict, package_roots: list[str], context_lines: int = DEFAULT_CONTEXT_LINES) -> tuple[dict, dict]:
    """Redacted source snippets for every residual's referenced units and
    residual.evidenceRefs, bounded window, only ever read from within a
    scanned package root — never an arbitrary path (S8, path-traversal-safe).

    Also returns a companion ref -> clickable-path map (Architect_Pilot_
    Feedback_Notes.md Entry 20): the stored `ref` itself is only relative to
    whichever scanned package root produced it, not to the VS Code workspace
    root an architect actually has open, so it isn't directly openable. Where
    the resolved absolute file lives inside REPO_ROOT (the normal case for
    this repo's own fixtures/spikes and any workspace opened at REPO_ROOT),
    we can compute a real REPO_ROOT-relative "path:line" that VS Code's own
    file-link auto-detection resolves. Falls back to omitting the entry
    (never a wrong/guessed path) when the file lives outside REPO_ROOT."""
    resolved_roots = [Path(r).resolve() for r in package_roots]
    packs: dict[str, str] = {}
    paths: dict[str, str] = {}
    refs: list[str] = []
    for residual in residuals:
        refs.extend(residual.get("evidenceRefs") or [])
        for unit_id in residual.get("unitIds", []):
            unit = unit_index.get(unit_id)
            if not unit:
                continue
            refs.extend(unit.get("evidenceRefs") or [])
    for ref in refs:
        if ref in packs:
            continue
        # Real gap found 2026-08-23, first real end-to-end pack --with-dossier
        # run against a structured-config fixture: a structured-file-derived
        # unit's evidenceRefs use a dotted-key-path shape (e.g.
        # "application-prod.yml:spring.datasource.url", from
        # spring-config-pass.ts's own `ref: ${filePath}:${key}` convention),
        # not file:line -- _REF_RE never matches it, so it used to be
        # silently omitted from packs entirely and the LLM layer saw nothing,
        # with no signal WHY. Real per-key line tracking doesn't exist
        # anywhere in spring-config-provider.ts today (checked, not assumed
        # -- would need new YAML-AST line tracking, an unevidenced, bigger
        # mechanism) -- ship the honest, smaller fix instead: an explicit
        # placeholder stating the real reason, so build_evidence_prompt
        # includes it and the model can correctly reason "no snippet, not
        # nothing" rather than refusing with zero context for why.
        if not _REF_RE.match(ref):
            packs[ref] = f"[no source snippet available for this evidence ref — structured-config key path {ref!r}, not a file:line reference]"
            continue
        result = _read_snippet(ref, resolved_roots, context_lines)
        if result is None:
            continue
        snippet, resolved_path = result
        packs[ref] = redact(snippet)
        try:
            rel = resolved_path.relative_to(REPO_ROOT)
        except ValueError:
            continue
        m = _REF_RE.match(ref)
        if m:
            paths[ref] = f"{rel.as_posix()}:{m.group(2)}"
    return packs, paths


def _run_dossier_pass(residuals: list[dict], unit_index: dict, packs: dict) -> list[dict]:
    """T-2's opt-in Evidence Dossier pass, over every OPEN residual
    regardless of tier. No `claude` CLI on PATH (even with --with-dossier
    set) -> log what would have been attempted, return residuals
    unchanged so the rest of pack.py writes a normal dossier-less pack."""
    targets = [r for r in residuals if r.get("status") == "open"]
    if not targets:
        print("[pack] --with-dossier set but no open residual(s) to build a dossier for -- nothing to do")
        return residuals
    if not _llm_backend_available():
        print(f"[pack] --with-dossier set but no LLM backend available (`claude` CLI not found on PATH) -- would attempt a dossier for {len(targets)} residual(s), writing a dossier-less pack: {[r['id'] for r in targets]}")
        return residuals
    print("[pack] --with-dossier: backend claude CLI")

    updated_targets, episodes = dossier.process_dossier_batch(targets, unit_index, packs)
    updated_by_id = {r["id"]: r for r in updated_targets}
    for episode in episodes:
        if episode["outcome"] == "dossiered":
            print(f"[pack] dossier {episode['residualId']}: dossiered")
        else:
            print(f"[pack] dossier {episode['residualId']}: {episode['outcome']} -- {episode.get('reason', '')}")
    return [updated_by_id.get(r["id"], r) for r in residuals]


def _window_for_line(line_1indexed: int, n_lines: int, context_lines: int) -> tuple[int, int]:
    start = max(0, line_1indexed - 1 - context_lines)
    end = min(n_lines, line_1indexed + context_lines)
    if end - start > MAX_SNIPPET_WINDOW:
        # Keep the referenced line inside a MAX_SNIPPET_WINDOW slice.
        center = line_1indexed - 1
        half = MAX_SNIPPET_WINDOW // 2
        start = max(0, center - half)
        end = min(n_lines, start + MAX_SNIPPET_WINDOW)
        if end - start < MAX_SNIPPET_WINDOW:
            start = max(0, end - MAX_SNIPPET_WINDOW)
    return start, end


def _read_snippet(ref: str, resolved_roots: list[Path], context_lines: int = DEFAULT_CONTEXT_LINES) -> tuple[str, Path] | None:
    """Returns (snippet, resolved_absolute_path) so callers can also build
    a real, clickable evidence link — the stored `ref` itself is only
    relative to whichever scanned package root it came from (e.g.
    src/main/java/.../Foo.java), not to the VS Code workspace root an
    architect actually has open, so it's not directly openable on its
    own (found live: an architect asked for clickable evidence links,
    Architect_Pilot_Feedback_Notes.md Entry 20)."""
    m = _REF_RE.match(ref)
    if not m:
        return None
    rel_path, line_str = m.group(1), int(m.group(2))

    for root in resolved_roots:
        candidate = (root / rel_path).resolve()
        # Path-traversal guard: the resolved candidate must stay inside its root.
        try:
            candidate.relative_to(root)
        except ValueError:
            continue
        if not candidate.exists():
            continue
        try:
            lines = candidate.read_text(errors="replace").splitlines()
        except OSError:
            continue
        start, end = _window_for_line(line_str, len(lines), context_lines)
        return "\n".join(lines[start:end]), candidate
    return None


def _residuals_by_trigger_inventory(residuals: list[dict]) -> dict[str, dict]:
    """manifest.json's static, pack-time-only per-trigger inventory (tier +
    count) -- see summarize_by_trigger (validate_drafts.py) for the
    apply-time decided/undecided counterpart this deliberately does NOT
    duplicate (pack.py runs before drafts/ exists)."""
    by_trigger: dict[str, dict] = {}
    for r in residuals:
        trigger = r.get("trigger", "<no trigger>")
        entry = by_trigger.setdefault(trigger, {"tier": r.get("tier"), "count": 0})
        entry["count"] += 1
    return by_trigger


def _render_session_md(manifest: dict, residuals: list[dict], session_dir: Path) -> str:
    tier_a = [r for r in residuals if r["tier"] == "A"]
    tier_b = [r for r in residuals if r["tier"] == "B"]
    tier_c = [r for r in residuals if r["tier"] == "C"]
    lines = [
        "# Residual review session",
        "",
        f"Generated {manifest['generatedAt']} from `{manifest['outDir']}`.",
        "",
        "## How this session works",
        "",
        "1. You already ran a Weaver scan → `architecture.calm.json` (unchanged, upstream of this pack). "
        "Cross-package backbone on this run is **CodeGraph** (not Graphify).",
        "2. `pack.py` built this Session Pack from that scan's out-dir — the step you just did.",
        "3. Open this pack in VS Code and start a chat using the `residual-review` chat mode "
        "(`.github/agents/residual-review.agent.md`) — or, if that chat mode's tools are disabled by "
        "your org's Copilot policy, just read this file and `residuals.json` directly (the degraded path — see below).",
        "4. The agenda below is already split into Tier A (you decide), Tier B (the chat agent may draft "
        "in-conversation, per its own bound rules), and Tier C (never invented, document or leave open).",
        "5. Answer every Tier A card with its option key or `other: <rationale>`.",
        "6. For any Tier B residual, the chat agent may draft directly (writing under `drafts/decisions/` / "
        "`drafts/overrides/` via its own tools) — review each draft as Accept/Reject/Edit, never treat a draft "
        "existing as approval. (`draft_tier_b.py` is a separate, optional headless alternative for scripted/batch "
        "runs outside a chat session — not the primary path.)",
        "7. Review whatever lands under `drafts/decisions/` and `drafts/overrides/` before applying anything — "
        "run `validate_drafts.py` yourself first if you want to check before `apply.py` does it again automatically.",
        "8. Apply (a **human step** — `apply.py` refuses without an explicit confirmation, S4): "
        f"`python3 tools/review-session/apply.py --session-dir {session_dir} --out <new-out-dir>`.",
        "9. Validate the new `architecture.calm.json` (`npm run validate`) and re-open it in your CALM viewer "
        "(see below) to confirm the reviewed architecture looks right.",
        "",
        "## Before you start",
        "",
        "- This session does **not** redefine any standing exam (e.g. `E-charge-single-L2`). "
        "A residual decision here is a pilot-scoped correction, not a claim that a layered-architecture-story "
        "recovery mechanism now works — see `Architect_Residual_Review_Session.md` §0.1.",
        "- Applying is a **human step** — `apply.py` re-validates everything and requires explicit confirmation "
        "(a real terminal prompt, or `--i-confirm-apply`). Nothing here is auto-applied, ever.",
        "- Reply to a card with its option key (e.g. `1`) or `other: <rationale>`.",
        "- If a card says evidence is short, Copilot prints a `pack.py fetch-span` command. "
        "**You** run it — the chat mode is instructed never to run it itself. Then continue the chat. "
        f"Session cap: {FETCH_SPAN_SESSION_MAX_CALLS} extra-reads / {FETCH_SPAN_SESSION_MAX_LINES} extra lines.",
        "- Ranked backlog: `python3 tools/review-session/queue_rank.py --session-dir <this pack>` (T-RT-2). "
        "Similar residuals can be bulk-applied with `bulk_apply.py` (T-RT-1) — still one Decision Record each.",
        "",
    ]

    carried = [r for r in residuals if r.get("status") == "carried_forward"]
    askable_a = [r for r in tier_a if r.get("status") != "carried_forward"]
    askable_b = [r for r in tier_b if r.get("status") != "carried_forward"]
    askable_c = [r for r in tier_c if r.get("status") != "carried_forward"]

    lines += [f"## Residuals ({len(residuals)} total: {len(askable_a)} Tier A, {len(askable_b)} Tier B, {len(askable_c)} Tier C, {len(carried)} carried forward)", ""]

    # Per-trigger-class breakdown, real gap found 2026-09-04: a review pass
    # fully worked one trigger class and reported the whole pack reviewed --
    # the tier-only line above mixes several trigger classes per tier with
    # no way to tell. Reads any drafts/decisions/ already on disk (non-empty
    # only on a re-run against an existing session-dir) via the same
    # summarize_by_trigger apply.py's own completeness table uses, so the
    # two views can't drift apart (Architect_Residual_Review_Session.md
    # §3.1's producer registry is the human-facing counterpart).
    decisions_dir = session_dir / "drafts" / "decisions"
    existing_decisions = [json.loads(f.read_text()) for f in sorted(decisions_dir.glob("*.json"))] if decisions_dir.exists() else []
    decisions_by_id, _ = load_decisions_by_id(existing_decisions)
    by_trigger = summarize_by_trigger(residuals, decisions_by_id)
    if by_trigger:
        lines += ["### By trigger class", ""]
        for trigger, entry in sorted(by_trigger.items()):
            lines.append(f"- [{entry['tier']}] `{trigger}`: {entry['decided']}/{entry['total']} decided")
        lines.append("")

    if carried:
        lines += ["## Carried forward from a prior session (not re-asked)", ""]
        for r in carried:
            lines.append(f"- **{r['id']}**: {r['rationale']}")
        lines.append("")

    lines += ["## Tier A — you decide", ""]
    for r in askable_a:
        lines.append(r["card"])
    lines += ["", "## Tier B — the chat agent may draft in-conversation if the evidence bar is met (review each draft as Accept/Reject/Edit)", ""]
    for r in askable_b:
        lines.append(r["card"])
    lines += ["", "## Tier C — do not invent, document or leave open", ""]
    for r in askable_c:
        lines.append(r["card"])

    lines += ["", "## After you're done (step 9)", ""]
    if manifest.get("hasCalm"):
        lines.append(f"- Open `{manifest['outDir']}/architecture.calm.json` in your CALM viewer (design §4.5 — the existing FINOS CALM Studio / draw.io↔CALM plugin, no new viewer built for this session).")
    else:
        lines.append(f"- No `architecture.calm.json` was found in `{manifest['outDir']}` at pack time — it will exist after step 8's apply run; open that new out-dir's copy in your CALM viewer then.")
    lines.append("- Most static-file CALM viewers do not auto-reload — **manually reload after step 8's apply**, per design §4.5.")
    lines.append("- This pack's `decisions-log.md` and `apply-report.md` (written by `apply.py`) are the audit trail — check those in if you want to keep a record; the rest of this pack is scratch by default (gitignored).")
    lines.append("- Starting a NEW scan later? Pass `--baseline " + str(session_dir) + "` to `pack.py` so residuals already decided here aren't re-asked.")
    return "\n".join(lines)


def _render_agents_md() -> str:
    return (
        "# Bound agent playbook for this Session Pack\n\n"
        "This is the per-pack copy of the rules already stated repo-wide by "
        "`.github/agents/residual-review.agent.md` — read that file's header comment for the real "
        "safety guarantee: apply.py's own explicit confirmation gate, not this file's tools: list.\n\n"
        "**Mode: Guided (v1's only mode — design §5)** — ask all Tier A items as choice cards; "
        "Tier B may be drafted in-chat (editFiles, per the chat-mode's own §5.1 hard rules) and is always shown as "
        "Accept / Reject / Edit rationale, never auto-accepted; the architect approves every apply.\n\n"
        "1. Read SESSION.md + residuals.json first — do not scan the whole repo. "
        "Do not use workspace search. If a pack file is not in context, ask the architect to open it.\n"
        "2. For each open item: use listed evidence; if needed, cite only file:line already in evidence/packs.json.\n"
        "3. Never edit typed-facts.json.\n"
        "4. Write proposals only under drafts/.\n"
        "5. Every override must reference an active Decision Record with rationale — see the REAL shape below, "
        "never a guessed one.\n"
        "6. Tier A is the architect's decision — offer choices, never decide alone.\n"
        "7. Tier B may be drafted directly in this chat — see the chat-mode file's own §5.1 hard rules "
        "(llm-advisory: reviewer, cited evidence). Present as Accept / Reject / Edit rationale.\n"
        "8. 0 or 2+ candidates after pack + extra-read → cannot_decide, never fabricate. "
        "No folklore (\"typical Spring\").\n"
        "9. Never run apply.py / run-slice / override-applier / pack.py fetch-span from this chat — "
        "applying and extra-reads are human steps. If evidence is short, PRINT one fetch-span command and stop.\n\n"
        "## The real Decision Record / Override shape — copy these, never invent your own fields\n\n"
        "Found live (a real Copilot Chat session drafted 23 Decision Records using invented fields "
        "`residual_id`/`construct`/`option` instead of the real schema below — every one silently failed "
        "to apply): you cannot read `pipeline/src/types/overrides.ts` from this chat (outside the pack, "
        "workspace search is off) — these two worked examples ARE the schema, copy their field names exactly. "
        "Note: `residual_id` IS now a real, required field (added 2026-09-04) — the incident above was about "
        "inventing it as a substitute for `decision_id`/`final_decision`/`status`, not about the field itself; "
        "set it to the exact `residuals.json` id you're answering, alongside `decision_id` (the draft's own new id), never instead of it.\n\n"
        "**Decision Record with NO override** (the most common real outcome — a `leave-open`/`accepted` "
        "answer, or any decision that doesn't change CALM):\n"
        "```json\n"
        + json.dumps(
            {
                "decision_id": "D-<residual-id>-001",
                "module": "architecture",
                "target_type": "node",
                "target_ref": "<calm-element unique-id, or an ignored-item file:line ref>",
                "final_decision": {"action": "accepted", "new_value": None},
                "rationale": "<one line citing the residual id and the evidence ref it's based on>",
                "reviewer": "llm-advisory:<model>",
                "reviewed_at": "<ISO timestamp>",
                "status": "active",
                "supersedes": None,
                "residual_id": "<the residuals.json id this decision answers, e.g. R-014>",
            },
            indent=2,
        )
        + "\n```\n\n"
        "**Decision Record + its Override** (only when a real CALM change is warranted — `final_decision.action` "
        "is `overridden`/`added`/`removed`, and a matching Override file exists under `drafts/overrides/`, "
        "`override_type` one of type_change/relationship_add/relationship_remove/node_add/node_remove/"
        "node_rename/boundary_change):\n"
        "```json\n"
        + json.dumps(
            {
                "decision_id": "D-<residual-id>-001",
                "module": "architecture",
                "target_type": "node",
                "target_ref": "<calm-element unique-id>",
                "final_decision": {"action": "overridden", "new_value": "database"},
                "rationale": "<one line citing the residual id and the evidence ref it's based on>",
                "reviewer": "llm-advisory:<model>",
                "reviewed_at": "<ISO timestamp>",
                "status": "active",
                "supersedes": None,
                "residual_id": "<the residuals.json id this decision answers, e.g. R-014>",
            },
            indent=2,
        )
        + "\n```\n"
        "```json\n"
        + json.dumps(
            {
                "override_id": "O-<residual-id>-001",
                "module": "architecture",
                "target_ref": "<same calm-element unique-id as the decision's target_ref>",
                "override_type": "type_change",
                "new_value": "database",
                "decision_record_ref": "D-<residual-id>-001",
                "status": "active",
                "created_by": "llm-advisory:<model>",
                "created_at": "<ISO timestamp>",
            },
            indent=2,
        )
        + "\n```\n\n"
        "**Every field above is required** — a decision file missing `decision_id` (or any other required "
        "field) is not silently accepted; it fails validation and apply.py refuses to apply it. Do not omit "
        "one to save space.\n"
    )


def fetch_span_main(argv: list[str]) -> int:
    """Architect-run extra-read. The chat mode is instructed to print the command, not run it.

    Two mutually-exclusive ways to specify the same bounded/redacted/capped read:
      --path <file> --start-line <n> --end-line <n>   (exact range)
      --anchor <file:line> [--context-lines <n>]      (windowed around a line, via _window_for_line)
    """
    parser = argparse.ArgumentParser(
        prog="pack.py fetch-span",
        description="Append a bounded, redacted source span to an existing Session Pack (HITL extra-read). Copilot must not run this.",
    )
    parser.add_argument("--session-dir", required=True)
    parser.add_argument("--residual-id", required=True, help="must match an id in this pack's residuals.json")
    parser.add_argument("--path", help="source path under a packageRoot (or an existing evidence path prefix) — exact-range mode only")
    parser.add_argument("--start-line", type=int, default=None, help="exact-range mode only")
    parser.add_argument("--end-line", type=int, default=None, help="exact-range mode only")
    parser.add_argument("--anchor", help="<file:line> — alternate to --path/--start-line/--end-line, windowed by --context-lines via _window_for_line")
    parser.add_argument("--context-lines", type=int, default=DEFAULT_CONTEXT_LINES, help=f"--anchor mode only (default {DEFAULT_CONTEXT_LINES}, window capped at {MAX_SNIPPET_WINDOW})")
    parser.add_argument("--max-lines", type=int, default=FETCH_SPAN_DEFAULT_MAX_LINES)
    args = parser.parse_args(argv)

    anchor_mode = args.anchor is not None
    exact_given = args.path is not None or args.start_line is not None or args.end_line is not None
    if anchor_mode and exact_given:
        parser.error("--anchor cannot be combined with --path/--start-line/--end-line")
    if not anchor_mode and (args.path is None or args.start_line is None or args.end_line is None):
        parser.error("exact-range mode requires --path, --start-line, and --end-line (or use --anchor instead)")

    session_dir = Path(args.session_dir).resolve()
    residual_id = args.residual_id
    if not residual_id:
        print("[fetch-span] residual-id is required", file=sys.stderr)
        return 1

    manifest_path = session_dir / "manifest.json"
    residuals_path = session_dir / "residuals.json"
    packs_path = session_dir / "evidence" / "packs.json"
    extra_path = session_dir / "evidence" / "extra-reads.json"
    if not manifest_path.exists() or not residuals_path.exists():
        print(f"[fetch-span] not a Session Pack: {session_dir}", file=sys.stderr)
        return 1

    manifest = json.loads(manifest_path.read_text())
    residuals_doc = json.loads(residuals_path.read_text())
    residuals = residuals_doc.get("items") or []
    target = next((r for r in residuals if r.get("id") == residual_id), None)
    if target is None:
        print(f"[fetch-span] residual {residual_id} not in this pack", file=sys.stderr)
        return 1

    extra_doc = json.loads(extra_path.read_text()) if extra_path.exists() else {"calls": [], "totalLines": 0}
    if len(extra_doc["calls"]) >= FETCH_SPAN_SESSION_MAX_CALLS:
        print(f"[fetch-span] session cap {FETCH_SPAN_SESSION_MAX_CALLS} extra-reads reached — remaining items stay cannot_decide", file=sys.stderr)
        return 1

    roots = [Path(r).resolve() for r in (manifest.get("packageRoots") or [])]
    if not roots:
        print("[fetch-span] pack has no packageRoots", file=sys.stderr)
        return 1

    if anchor_mode:
        m = _REF_RE.match(args.anchor)
        if not m:
            print(f"[fetch-span] --anchor must be <file:line>: {args.anchor}", file=sys.stderr)
            return 1
        anchor_path_str, anchor_line_str = m.group(1), m.group(2)
        anchor_line = int(anchor_line_str)
        if anchor_line < 1:
            print("[fetch-span] --anchor line must be >= 1", file=sys.stderr)
            return 1
        candidate = _resolve_under_roots(anchor_path_str, roots)
        if candidate is None:
            print(f"[fetch-span] path is outside packageRoots / evidence prefix: {anchor_path_str}", file=sys.stderr)
            return 1
        try:
            file_lines = candidate.read_text(errors="replace").splitlines()
        except OSError as err:
            print(f"[fetch-span] cannot read {candidate}: {err}", file=sys.stderr)
            return 1
        if anchor_line > len(file_lines):
            print(f"[fetch-span] anchor line {anchor_line} past end of file ({len(file_lines)} lines)", file=sys.stderr)
            return 1
        context_lines = max(0, args.context_lines)
        window_start, window_end = _window_for_line(anchor_line, len(file_lines), context_lines)
        start, end = window_start + 1, window_end
    else:
        start = args.start_line
        end = args.end_line
        if start < 1 or end < start:
            print("[fetch-span] start-line must be >= 1 and end-line >= start-line", file=sys.stderr)
            return 1
        candidate = _resolve_under_roots(args.path, roots)
        if candidate is None:
            print(f"[fetch-span] path is outside packageRoots / evidence prefix: {args.path}", file=sys.stderr)
            return 1
        try:
            file_lines = candidate.read_text(errors="replace").splitlines()
        except OSError as err:
            print(f"[fetch-span] cannot read {candidate}: {err}", file=sys.stderr)
            return 1
        if start > len(file_lines):
            print(f"[fetch-span] start-line {start} past end of file ({len(file_lines)} lines)", file=sys.stderr)
            return 1

    max_lines = min(max(1, args.max_lines), FETCH_SPAN_HARD_CAP_LINES)
    span_len = end - start + 1
    if span_len > max_lines:
        print(f"[fetch-span] requested {span_len} lines > --max-lines {max_lines} (hard cap {FETCH_SPAN_HARD_CAP_LINES})", file=sys.stderr)
        return 1
    if extra_doc["totalLines"] + span_len > FETCH_SPAN_SESSION_MAX_LINES:
        print(f"[fetch-span] session line cap {FETCH_SPAN_SESSION_MAX_LINES} would be exceeded", file=sys.stderr)
        return 1

    slice_end = min(end, len(file_lines))
    snippet = redact("\n".join(file_lines[start - 1 : slice_end]))
    actual_lines = slice_end - start + 1

    rel = _rel_to_roots(candidate, roots)
    ref = f"{rel}:{start}"
    packs = json.loads(packs_path.read_text()) if packs_path.exists() else {}
    packs[ref] = snippet
    packs_path.parent.mkdir(parents=True, exist_ok=True)
    packs_path.write_text(json.dumps(packs, indent=2))

    refs = list(target.get("evidenceRefs") or [])
    if ref not in refs:
        refs.append(ref)
    target["evidenceRefs"] = refs
    residuals_path.write_text(json.dumps(residuals_doc, indent=2))

    extra_doc["calls"].append({"residualId": residual_id, "ref": ref, "lines": actual_lines})
    extra_doc["totalLines"] += actual_lines
    extra_path.write_text(json.dumps(extra_doc, indent=2))

    manifest["extraReadCount"] = len(extra_doc["calls"])
    manifest["extraReadLines"] = extra_doc["totalLines"]
    manifest_path.write_text(json.dumps(manifest, indent=2))

    print(f"[fetch-span] appended {ref} ({actual_lines} line(s)) to {packs_path} for {residual_id}")
    return 0


def _resolve_under_roots(path_str: str, roots: list[Path]) -> Path | None:
    raw = Path(path_str)
    candidates: list[Path] = []
    if raw.is_absolute():
        candidates.append(raw.resolve())
    else:
        candidates.append(Path.cwd().joinpath(raw).resolve())
        for root in roots:
            candidates.append((root / raw).resolve())
    for cand in candidates:
        if not cand.exists() or not cand.is_file():
            continue
        for root in roots:
            try:
                cand.relative_to(root)
                return cand
            except ValueError:
                continue
    return None


def _rel_to_roots(path: Path, roots: list[Path]) -> str:
    for root in roots:
        try:
            return str(path.relative_to(root))
        except ValueError:
            continue
    return str(path)


if __name__ == "__main__":
    raise SystemExit(main())
