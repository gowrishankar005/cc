#!/usr/bin/env python3
"""queue_rank.py — T-RT-2: consequence-ranked queue (BACKLOG.md's own
acceptance wording: "highest-consequence first ... backlog size and age
queryable").

Reads one Session Pack's residuals.json (already carrying each residual's
real, computed `consequence` field — written by pack.py via
consequence.py, T-RT-2) and prints the OPEN backlog (never carried_forward/
applied — already-decided items are not a backlog) sorted highest-
consequence-first, tie-broken by residual id for a stable order.

Age is real, not invented: `residuals.json`'s own residual ids are
positional/regenerated per run (triage.py's own documented limitation —
they are not stable across scans), so "how long has this exact residual
been open" can only be answered by matching (trigger, unitIds) signatures
across a series of PRIOR Session Packs, the same signature
`triage.py`'s `apply_baseline()` already uses for --baseline carry-
forward. Pass `--history` with one or more earlier session dirs (oldest
first) to get a real age; without it, age is honestly reported as unknown
rather than guessed at.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

OPEN_STATUSES = {"open"}  # carried_forward/applied residuals are already decided, not backlog


def _load_residuals(session_dir: Path) -> dict:
    residuals_path = session_dir / "residuals.json"
    if not residuals_path.exists():
        raise SystemExit(f"[queue_rank] {residuals_path} not found — is this a real Session Pack (built by pack.py)?")
    return json.loads(residuals_path.read_text())


def _signature(residual: dict) -> tuple:
    return (residual.get("trigger"), tuple(sorted(residual.get("unitIds", []))))


def rank_backlog(residuals: list[dict]) -> list[dict]:
    """Open residuals only, sorted by consequence score descending (a
    residual with no `consequence` field — an older pack built before
    T-RT-2 — sorts as score 0, never crashes or silently drops it), tie-
    broken by id for a stable, reproducible order."""
    backlog = [r for r in residuals if r.get("status") in OPEN_STATUSES]
    return sorted(backlog, key=lambda r: (-r.get("consequence", {}).get("score", 0), r["id"]))


def compute_ages(backlog: list[dict], history_packs: list[dict]) -> dict[str, dict]:
    """{residual_id: {"first_seen": iso-timestamp, "age_days": float}} for
    every backlog residual whose (trigger, unitIds) signature is found in
    an OLDER pack in `history_packs` (each a parsed residuals.json dict,
    already sorted oldest-first by the caller). A residual with no match
    in any given history pack is simply absent from the returned dict —
    "no history found" is reported by the caller as unknown, never
    defaulted to zero."""
    ages: dict[str, dict] = {}
    for residual in backlog:
        if not residual.get("unitIds"):
            continue  # a run-level residual has no stable unit-based signature to match on — never guessed
        sig = _signature(residual)
        first_seen = None
        for pack in history_packs:
            match = next((r for r in pack.get("items", []) if _signature(r) == sig), None)
            if match is not None:
                first_seen = pack.get("generatedAt")
                break
        if first_seen is not None:
            ages[residual["id"]] = {"first_seen": first_seen}
    return ages


def _age_days(first_seen: str, now: str) -> float | None:
    try:
        start = datetime.fromisoformat(first_seen.replace("Z", "+00:00"))
        end = datetime.fromisoformat(now.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None
    return round((end - start).total_seconds() / 86400, 1)


def render_report(residuals_doc: dict, backlog: list[dict], ages: dict[str, dict]) -> str:
    generated_at = residuals_doc.get("generatedAt", "")
    lines = [
        f"# Consequence-ranked backlog ({len(backlog)} open residual(s))",
        "",
        "Highest-consequence first — pii-proxy / external-system-identity / trust-boundary-edge "
        "(see consequence.py's own docstring for exactly what each proxies for and its honest limits).",
        "",
    ]
    for r in backlog:
        signals = r.get("consequence", {}).get("signals", [])
        score = r.get("consequence", {}).get("score", 0)
        age_entry = ages.get(r["id"])
        if age_entry:
            age_days = _age_days(age_entry["first_seen"], generated_at)
            age_str = f"{age_days}d (first seen {age_entry['first_seen']})" if age_days is not None else f"first seen {age_entry['first_seen']}"
        else:
            age_str = "unknown (no --history given, or no matching signature in it)"
        lines.append(f"- **{r['id']}** (score {score}: {', '.join(signals) or 'none'}) — {r['tier']}/{r['class']} — age: {age_str}")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Rank a Session Pack's open residual backlog highest-consequence-first; report backlog size and (with --history) age.")
    parser.add_argument("--session-dir", required=True)
    parser.add_argument("--history", nargs="*", default=[], help="one or more PRIOR Session Pack dirs, oldest first, used to compute real residual age by (trigger, unitIds) signature match")
    parser.add_argument("--json", action="store_true", help="print machine-readable JSON instead of the markdown report")
    args = parser.parse_args()

    session_dir = Path(args.session_dir).resolve()
    residuals_doc = _load_residuals(session_dir)
    residuals = residuals_doc.get("items", [])
    backlog = rank_backlog(residuals)

    history_packs = []
    for h in args.history:
        hp = Path(h).resolve() / "residuals.json"
        if not hp.exists():
            print(f"[queue_rank] warning: --history dir {h} has no residuals.json — skipping", file=sys.stderr)
            continue
        history_packs.append(json.loads(hp.read_text()))

    ages = compute_ages(backlog, history_packs) if history_packs else {}

    if args.json:
        out = {
            "backlogSize": len(backlog),
            "items": [
                {"id": r["id"], "tier": r["tier"], "class": r["class"], "consequence": r.get("consequence", {"signals": [], "score": 0}), "age": ages.get(r["id"])}
                for r in backlog
            ],
        }
        print(json.dumps(out, indent=2))
    else:
        print(render_report(residuals_doc, backlog, ages))
        if not args.history:
            print("\n(pass --history <prior-session-dir> ... for real age tracking — none given, every age above is unknown)")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
