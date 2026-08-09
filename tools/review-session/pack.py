#!/usr/bin/env python3
"""pack.py — T-RS1-2. Builds a Session Pack from a real run-slice out-dir.

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
from redact import redact  # noqa: E402
from triage import build_residuals  # noqa: E402
from cards import build_all_cards  # noqa: E402

SNIPPET_CONTEXT_LINES = 3  # +/- lines around a referenced line, bounded window per design §6


def main() -> int:
    parser = argparse.ArgumentParser(description="Build a Weaver residual review Session Pack from a run-slice out-dir.")
    parser.add_argument("--out-dir", required=True, help="run-slice output directory (must contain typed-facts.json + coverage-report.json)")
    parser.add_argument("--session-dir", required=True, help="where to write the Session Pack (typically review-sessions/<run-id>)")
    parser.add_argument("--roots", nargs="*", default=None, help="override package roots for source snippet reads (defaults to typed-facts.json's own packageRoots)")
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

    residuals = build_residuals(review_queue)

    unit_index = _build_unit_index(facts)
    (session_dir / "evidence" / "unit-index.json").write_text(json.dumps(unit_index, indent=2))

    packs = _build_evidence_packs(residuals, unit_index, package_roots)
    (session_dir / "evidence" / "packs.json").write_text(json.dumps(packs, indent=2))

    # T-RS1-4 — deterministic choice cards, generated from the fixed
    # per-class templates in cards.py (never LLM-invented), attached
    # directly onto each residual so the bound Copilot Chat agent (T-RS1-5)
    # can read the card straight out of residuals.json.
    card_markdown = build_all_cards(residuals, unit_index, packs)
    for r in residuals:
        r["card"] = card_markdown[r["id"]]
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
    (no full Graphify graph dump, per design §4.1)."""
    index = {}
    for unit in facts.get("units", []):
        index[unit["id"]] = {
            "kind": unit["kind"],
            "confidence": unit["confidence"],
            "filePath": unit["filePath"],
            "evidenceRefs": [e["ref"] for e in unit.get("evidence", [])],
        }
    return index


_REF_RE = re.compile(r"^(.*):(\d+)$")


def _build_evidence_packs(residuals: list[dict], unit_index: dict, package_roots: list[str]) -> dict:
    """Redacted source snippets for every residual's referenced units, bounded
    window (+/- SNIPPET_CONTEXT_LINES), only ever read from within a scanned
    package root — never an arbitrary path (S8, path-traversal-safe)."""
    resolved_roots = [Path(r).resolve() for r in package_roots]
    packs = {}
    for residual in residuals:
        for unit_id in residual.get("unitIds", []):
            unit = unit_index.get(unit_id)
            if not unit:
                continue
            for ref in unit.get("evidenceRefs", []):
                if ref in packs:
                    continue
                snippet = _read_snippet(ref, resolved_roots)
                if snippet is not None:
                    packs[ref] = redact(snippet)
    return packs


def _read_snippet(ref: str, resolved_roots: list[Path]) -> str | None:
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
        start = max(0, line_str - 1 - SNIPPET_CONTEXT_LINES)
        end = min(len(lines), line_str + SNIPPET_CONTEXT_LINES)
        return "\n".join(lines[start:end])
    return None


def _render_session_md(manifest: dict, residuals: list[dict], session_dir: Path) -> str:
    tier_a = [r for r in residuals if r["tier"] == "A"]
    tier_b = [r for r in residuals if r["tier"] == "B"]
    tier_c = [r for r in residuals if r["tier"] == "C"]
    overrides_dir = session_dir / "drafts" / "overrides"
    lines = [
        "# Residual review session",
        "",
        f"Generated {manifest['generatedAt']} from `{manifest['outDir']}`.",
        "",
        "## How this session works (T-RS1-6, design §2 target experience)",
        "",
        "1. You already ran a Weaver scan → `architecture.calm.json` (unchanged, upstream of this pack).",
        "2. `pack.py` built this Session Pack from that scan's out-dir — the step you just did.",
        "3. Open this pack in VS Code and start a chat using the `residual-review` chat mode "
        "(`.github/chatmodes/residual-review.chatmode.md`) — or, if that chat mode's tools are disabled by "
        "your org's Copilot policy, just read this file and `residuals.json` directly (the degraded path — see below).",
        "4. The agenda below is already split into Tier A (you decide), Tier B (agent may draft — RS-4, not yet built), "
        "and Tier C (never invented, document or leave open).",
        "5. Answer every Tier A card with its option key or `other: <rationale>`.",
        "6. (RS-4, not yet built) The agent drafts Decision Records + Overrides for Tier B items whose evidence bar is met.",
        "7. Review whatever lands under `drafts/decisions/` and `drafts/overrides/` before applying anything.",
        "8. Apply (a **human step**, `apply.py` not yet built — RS-3): "
        f"`node dist/orchestration/run-slice.js --from-facts {manifest['outDir']}/typed-facts.json --overrides {overrides_dir} --out <new-out-dir>`.",
        "9. Validate the new `architecture.calm.json` (`npm run validate`) and re-open it in your CALM viewer "
        "(see below) to confirm the reviewed architecture looks right.",
        "",
        "## Before you start",
        "",
        "- This session does **not** redefine any standing exam (e.g. `E-charge-single-L2`). "
        "A residual decision here is a pilot-scoped correction, not a claim that a layered-architecture-story "
        "recovery mechanism now works — see `Architect_Residual_Review_Session.md` §0.1.",
        "- Applying is a **human step** (`apply.py`, not yet built — RS-3). Nothing here is auto-applied.",
        "- Reply to a card with its option key (e.g. `1`) or `other: <rationale>`.",
        "",
        f"## Residuals ({len(residuals)} total: {len(tier_a)} Tier A, {len(tier_b)} Tier B, {len(tier_c)} Tier C)",
        "",
        "## Tier A — you decide",
        "",
    ]
    for r in tier_a:
        lines.append(r["card"])
    lines += ["", "## Tier B — agent may draft if evidence bar met (RS-4, not yet built — every item below is answered as Tier A for now)", ""]
    for r in tier_b:
        lines.append(r["card"])
    lines += ["", "## Tier C — do not invent, document or leave open", ""]
    for r in tier_c:
        lines.append(r["card"])

    lines += ["", "## After you're done (step 9)", ""]
    if manifest.get("hasCalm"):
        lines.append(f"- Open `{manifest['outDir']}/architecture.calm.json` in your CALM viewer (design §4.5 — the existing FINOS CALM Studio / draw.io↔CALM plugin, no new viewer built for this session).")
    else:
        lines.append(f"- No `architecture.calm.json` was found in `{manifest['outDir']}` at pack time — it will exist after step 8's apply run; open that new out-dir's copy in your CALM viewer then.")
    lines.append("- Most static-file CALM viewers do not auto-reload — **manually reload after step 8's apply**, per design §4.5.")
    lines.append("- This pack's `decisions-log.md` and `apply-report.md` (written by `apply.py`, RS-3) are the audit trail — check those in if you want to keep a record; the rest of this pack is scratch by default (gitignored).")
    return "\n".join(lines)


def _render_agents_md() -> str:
    return (
        "# Bound agent playbook for this Session Pack\n\n"
        "This is the per-pack copy of the rules already enforced repo-wide by "
        "`.github/chatmodes/residual-review.chatmode.md` (T-RS1-5) — read that file's "
        "`tools:` frontmatter for how autonomous apply is structurally prevented, not just instructed against.\n\n"
        "**Mode: Guided (v1's only mode — design §5)** — ask all Tier A items as choice cards; "
        "draft Tier B only when RS-4 ships; the architect approves every apply.\n\n"
        "1. Read SESSION.md + residuals.json first — do not scan the whole repo.\n"
        "2. For each open item: use listed evidence; if needed open only the file:line already in evidence/packs.json.\n"
        "3. Never edit typed-facts.json.\n"
        "4. Write proposals only under drafts/.\n"
        "5. Every override must reference an active Decision Record with rationale.\n"
        "6. Tier A is the architect's decision — offer choices, never decide alone.\n"
        "7. Tier B drafting (RS-4) is not yet built in this pack — treat every Tier B item as Tier A for now.\n"
        "8. Weak/ambiguous evidence -> cannot_decide / leave open, never fabricate.\n"
        "9. Never run apply.py / run-slice / override-applier from this chat — applying is a human step (RS-3).\n"
    )


if __name__ == "__main__":
    raise SystemExit(main())
