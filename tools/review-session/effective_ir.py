#!/usr/bin/env python3
"""effective_ir.py — MVP scope.

Writes effective-architecture-ir.md: a human-readable, reviewed-architecture
summary distinct from intelligence-ir.md (the deterministic, facts-only
notebook Weaver's own core already writes — this tool NEVER touches that
file, only ever writes its own new one).

MVP scope (Architect_Residual_Review_Session.md §7.1's full 8-section
template with literal calm-node/calm-relationship fenced fragments is
explicitly NOT built here — the design's own §0.4 MVP cut allows deferring
that richness to B-calm-portable-ir, as long as the deferral is stated, not
silently assumed done). What IS real here, per the stated
minimum: provenance, node/relationship counts (by kind/grade), open
residuals, and a decision-log summary — assembled from real CALM +
Session Pack data, never LLM-authored prose.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


def build_effective_ir(calm: dict, residuals: list[dict], decisions: list[dict], provenance: dict) -> str:
    nodes = calm.get("nodes", [])
    relationships = calm.get("relationships", [])

    nodes_by_kind: dict[str, list[dict]] = {}
    for n in nodes:
        nodes_by_kind.setdefault(n.get("node-type", "unknown"), []).append(n)

    rels_by_grade: dict[str, int] = {}
    for r in relationships:
        grade = "unknown"
        for m in r.get("metadata", []):
            if m.get("key") == "x-aac-relationship-grade":
                grade = m.get("value", "unknown")
        rels_by_grade[grade] = rels_by_grade.get(grade, 0) + 1

    lines = [
        "# Effective architecture (MVP)",
        "",
        "**MVP scope note**: this is the minimum bar (provenance, counts, open residuals, "
        "decision log) — the full 8-section template with literal `calm-node`/`calm-relationship` "
        "fenced fragments (`Architect_Residual_Review_Session.md` §7.1) is explicitly deferred to "
        "**B-calm-portable-ir**, not silently assumed done. This file is a projection for reading, "
        "never a second source of truth — the real reviewed model is `architecture.calm.json` itself.",
        "",
        "## Provenance",
        "",
        "| Field | Value |",
        "|---|---|",
        f"| Generated | {provenance['generatedAt']} |",
        f"| Source out-dir | `{provenance.get('outDir', 'unknown')}` |",
        f"| contractVersion | {provenance.get('contractVersion', 'unknown')} |",
        f"| Node count | {len(nodes)} |",
        f"| Relationship count | {len(relationships)} |",
        f"| Residuals resolved this run | 0 (this tooling does not yet track per-run resolution counts) |",
        "",
        "## 1. Node inventory",
        "",
    ]
    for kind in sorted(nodes_by_kind):
        lines.append(f"### {kind} ({len(nodes_by_kind[kind])})")
        lines.append("")
        for n in nodes_by_kind[kind]:
            override_note = " *(overridden)*" if any(m.get("key") == "x-aac-override-provenance" for m in n.get("metadata", [])) else ""
            lines.append(f"- `{n['unique-id']}` — {n.get('name', n['unique-id'])}{override_note}")
        lines.append("")

    lines += ["## 2. Relationships (by grade)", ""]
    if rels_by_grade:
        for grade, count in sorted(rels_by_grade.items()):
            lines.append(f"- **{grade}**: {count}")
    else:
        lines.append("_No relationships in this run._")
    lines.append("")

    # Real fix (found on review): carried-forward status tracking
    # (triage.py's apply_baseline) — this section
    # used to claim otherwise and list every residual as "open" regardless
    # of real status, which became actively wrong the moment a Session Pack
    # could legitimately carry non-open residuals.
    open_residuals = [r for r in residuals if r.get("status") not in ("carried_forward",)]
    carried_residuals = [r for r in residuals if r.get("status") == "carried_forward"]

    lines += ["## 3. Open residuals", ""]
    if open_residuals:
        for r in open_residuals:
            reconfirm_note = " **(re-confirm — evidence shape changed since a prior decision)**" if r.get("reconfirm") else ""
            lines.append(f"- **{r['id']}** (Tier {r['tier']}, {r['class']}){reconfirm_note}: {r['rationale']}")
    elif not residuals:
        lines.append("_None — no S1/S2/S5/low-architecture-coverage residuals fired for this run._")
    else:
        lines.append("_None open — every residual this run was already carried forward from a prior session (see below)._")
    lines.append("")
    if carried_residuals:
        lines.append(f"_{len(carried_residuals)} additional residual(s) carried forward from a prior session (`--baseline`) — already decided, not re-asked: {', '.join(r['id'] for r in carried_residuals)}._")
        lines.append("")

    lines += ["## 4. Decision log (this pack's drafts/decisions/)", ""]
    if decisions:
        lines.append("| Decision | Target | Action | Reviewer | Rationale |")
        lines.append("|---|---|---|---|---|")
        for d in decisions:
            action = d.get("final_decision", {}).get("action", "?")
            rationale = d.get("rationale", "").replace("|", "\\|")
            lines.append(f"| {d.get('decision_id')} | `{d.get('target_ref')}` | {action} | {d.get('reviewer')} | {rationale} |")
    else:
        lines.append("_No decisions drafted yet in this pack._")
    lines.append("")

    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Build effective-architecture-ir.md (MVP scope) from a real CALM document + Session Pack residuals/decisions.")
    parser.add_argument("--calm", required=True, help="path to architecture.calm.json (real, post-apply if applicable)")
    parser.add_argument("--session-dir", help="Session Pack dir (reads residuals.json + drafts/decisions/) — optional, sections 3/4 are empty without it")
    parser.add_argument("--out", required=True, help="output path for effective-architecture-ir.md")
    args = parser.parse_args()

    calm = json.loads(Path(args.calm).read_text())

    residuals: list[dict] = []
    decisions: list[dict] = []
    if args.session_dir:
        session_dir = Path(args.session_dir)
        residuals_path = session_dir / "residuals.json"
        if residuals_path.exists():
            residuals = json.loads(residuals_path.read_text()).get("items", [])
        decisions_dir = session_dir / "drafts" / "decisions"
        if decisions_dir.exists():
            decisions = [json.loads(f.read_text()) for f in sorted(decisions_dir.glob("*.json"))]

    manifest = {}
    if args.session_dir and (Path(args.session_dir) / "manifest.json").exists():
        manifest = json.loads((Path(args.session_dir) / "manifest.json").read_text())

    provenance = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "outDir": manifest.get("outDir", str(Path(args.calm).parent)),
        "contractVersion": manifest.get("contractVersion", "unknown"),
    }

    md = build_effective_ir(calm, residuals, decisions, provenance)
    Path(args.out).write_text(md)
    print(f"[effective_ir] wrote {args.out} ({len(calm.get('nodes', []))} node(s), {len(residuals)} residual(s), {len(decisions)} decision(s))")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
