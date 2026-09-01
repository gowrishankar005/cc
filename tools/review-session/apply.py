#!/usr/bin/env python3
"""apply.py — The one command that turns a validated Session Pack's
drafts into a real, applied CALM document. This is the ONLY place in this
whole tool suite that ever invokes run-slice.js / override-applier.ts — a
deliberate, narrow chokepoint (S3/S4).

Flow: validate_drafts (in-process, re-run here even if already run
manually — never trust a stale prior validation) -> refuse if it fails ->
require explicit confirmation (S4: never silent) -> merge drafts/decisions/
+ drafts/overrides/ into one directory (a real integration detail found
while building this: override-applier.ts's loadOverridesDir() scans ONE
flat directory, dispatched by which key each file has — the Session Pack's
own split-directory layout doesn't match that, so this merge is required,
not optional) -> node dist/orchestration/run-slice.js --from-facts
--overrides --out -> summarize into apply-report.md.

S4 in practice: the bound chat-mode (.github/agents/residual-review.agent.md)
is instructed never to invoke this script, and its declared tools: list
excludes terminal tools as additional friction — but neither is this
script's own real guarantee (a chat host, or a user's IDE auto-approve
settings, could still get a run proposed and approved upstream). THIS
script is the actual backstop: a human running it directly from a real
terminal (a TTY) still gets its own explicit interactive confirmation
prompt; a non-interactive invocation (no TTY, e.g. from some other script,
including a chat client that did get through) is refused unless
--i-confirm-apply is passed explicitly — this tool never auto-confirms
either way, regardless of what ran it.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from validate_drafts import validate as validate_drafts, load_decisions_by_id  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_RUN_SLICE = REPO_ROOT / "pipeline" / "dist" / "orchestration" / "run-slice.js"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_json_dir(dir_path: Path) -> list[dict]:
    if not dir_path.exists():
        return []
    return [json.loads(f.read_text()) for f in sorted(dir_path.glob("*.json"))]


def _run_validation(session_dir: Path, manifest: dict) -> tuple[bool, list[str], list[str]]:
    decisions_list = _load_json_dir(session_dir / "drafts" / "decisions")
    overrides_list = _load_json_dir(session_dir / "drafts" / "overrides")
    decisions_by_id, load_errors = load_decisions_by_id(decisions_list)

    calm_node_ids = None
    calm_relationship_ids = None
    out_dir = manifest.get("outDir")
    if out_dir:
        calm_path = Path(out_dir) / "architecture.calm.json"
        if calm_path.exists():
            calm = json.loads(calm_path.read_text())
            calm_node_ids = {n["unique-id"] for n in calm.get("nodes", [])}
            calm_relationship_ids = {r["unique-id"] for r in calm.get("relationships", [])}

    report = validate_drafts(decisions_by_id, overrides_list, calm_node_ids, calm_relationship_ids)
    report.errors = load_errors + report.errors
    # Real gap found on review: if the source scan's architecture.calm.json
    # went missing (moved/deleted since this pack was built), endpoint
    # checks silently degrade to "not checked" with no warning at all — the
    # real safety property still holds (override-applier.ts independently
    # re-checks node/relationship existence at real apply time regardless),
    # but a pre-flight pass that silently skipped a meaningful check with no
    # explanation is a real observability gap, not just a style nit.
    if calm_node_ids is None:
        report.warnings.insert(0, f"source scan's architecture.calm.json not found under manifest outDir ({out_dir}) — endpoint existence was NOT checked here (override-applier.ts will still catch a real dangling endpoint at apply time, just later and with a less specific message)")
    return report.valid, report.errors, report.warnings


def _confirm(i_confirm_apply: bool) -> bool:
    if i_confirm_apply:
        return True
    if not sys.stdin.isatty():
        print("[apply] REFUSING: non-interactive invocation (no TTY) without --i-confirm-apply — this tool never auto-confirms an apply.", file=sys.stderr)
        return False
    reply = input("This will apply drafts and write a new CALM document. Type 'apply' to confirm: ")
    return reply.strip() == "apply"


def _merge_drafts(session_dir: Path, tmp_dir: Path) -> None:
    """Real bug found on review: copying by bare filename silently drops a
    file whenever drafts/decisions/ and drafts/overrides/ contain a file
    with the same name (a natural convention — pairing a decision and its
    override by their shared residual id, e.g. R-001.json in both dirs).
    validate_drafts.py reads the two directories separately, so it would
    have already said the pair is valid — the data loss happens ONLY here,
    after validation, so re-validation can't catch it. Fixed by namespacing
    each copy with its source subdirectory; override-applier.ts dispatches
    by JSON content (decision_id vs override_id key), never by filename, so
    this is a safe, zero-behavior-change fix."""
    for sub in ("decisions", "overrides"):
        src = session_dir / "drafts" / sub
        if not src.exists():
            continue
        for f in src.glob("*.json"):
            shutil.copy2(f, tmp_dir / f"{sub}-{f.name}")


def _write_apply_report(session_dir: Path, entry: dict) -> None:
    report_path = session_dir / "apply-report.md"
    lines = []
    if report_path.exists():
        lines.append(report_path.read_text())
    else:
        lines.append("# Apply report\n")
    lines.append(f"\n## Attempt at {entry['timestamp']}\n")
    lines.append(f"- Outcome: **{entry['outcome']}**\n")
    if entry.get("command"):
        lines.append(f"- Command: `{entry['command']}`\n")
    for key in ("validation_errors", "validation_warnings", "applied", "rejected", "skipped", "orphans"):
        if entry.get(key):
            lines.append(f"- {key}: {entry[key]}\n")
    if entry.get("out_dir"):
        lines.append(f"- New out-dir: `{entry['out_dir']}`\n")
    if entry.get("stderr"):
        lines.append(f"- stderr (real crash cause, if a module was isolated):\n```\n{entry['stderr']}\n```\n")
    report_path.write_text("".join(lines))


def _append_decisions_log(session_dir: Path, entry: dict) -> None:
    log_path = session_dir / "decisions-log.md"
    text = log_path.read_text() if log_path.exists() else "# Decisions log\n"
    text = text.replace("_No decisions recorded yet — this file is appended to as Decision Records are drafted/applied._\n", "")
    text += f"\n## Apply at {entry['timestamp']} — {entry['outcome']}\n"
    if entry.get("applied"):
        text += f"- Applied: {entry['applied']}\n"
    if entry.get("rejected"):
        text += f"- Rejected: {entry['rejected']}\n"
    log_path.write_text(text)


def main() -> int:
    parser = argparse.ArgumentParser(description="Apply a Session Pack's validated drafts to a new, real CALM document.")
    parser.add_argument("--session-dir", required=True)
    parser.add_argument("--out", required=True, help="new out-dir for the reviewed run")
    parser.add_argument("--strict-overrides", action="store_true")
    parser.add_argument("--i-confirm-apply", action="store_true", help="skip the interactive confirmation prompt — required for any non-interactive invocation")
    parser.add_argument("--run-slice", default=str(DEFAULT_RUN_SLICE), help="path to run-slice.js (default: pipeline/dist/orchestration/run-slice.js)")
    args = parser.parse_args()

    session_dir = Path(args.session_dir).resolve()
    manifest_path = session_dir / "manifest.json"
    if not manifest_path.exists():
        print(f"[apply] {manifest_path} not found — is this a real Session Pack (built by pack.py)?", file=sys.stderr)
        return 1
    manifest = json.loads(manifest_path.read_text())

    valid, errors, warnings = _run_validation(session_dir, manifest)
    # Real gap found on review: warnings (e.g. "endpoint existence not
    # checked" when the source CALM is missing) were only ever surfaced on
    # the failure path — on a successful validation they were silently
    # discarded, including this file's own new warning above. Print
    # whenever non-empty, regardless of outcome.
    for w in warnings:
        print(f"[apply] warning: {w}", file=sys.stderr)
    if not valid:
        print("[apply] REFUSING — validate_drafts found errors:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        _write_apply_report(session_dir, {"timestamp": _now(), "outcome": "refused: validation failed", "validation_errors": errors, "validation_warnings": warnings})
        return 1

    if not _confirm(args.i_confirm_apply):
        print("[apply] REFUSING — apply not confirmed.", file=sys.stderr)
        _write_apply_report(session_dir, {"timestamp": _now(), "outcome": "refused: not confirmed"})
        return 1

    run_slice_path = Path(args.run_slice)
    if not run_slice_path.exists():
        print(f"[apply] {run_slice_path} not found — is the pipeline built (npm run build)?", file=sys.stderr)
        return 1
    if not manifest.get("outDir"):
        print(f"[apply] {manifest_path} has no 'outDir' field — is this a real manifest.json written by pack.py?", file=sys.stderr)
        return 1
    facts_path = Path(manifest["outDir"]) / "typed-facts.json"
    if not facts_path.exists():
        print(f"[apply] {facts_path} not found in the source out-dir — was it moved/deleted since this pack was built?", file=sys.stderr)
        return 1

    out_dir = Path(args.out).resolve()
    with tempfile.TemporaryDirectory(prefix="review-session-apply-") as tmp:
        tmp_dir = Path(tmp)
        _merge_drafts(session_dir, tmp_dir)

        command = ["node", str(run_slice_path), "--from-facts", str(facts_path), "--overrides", str(tmp_dir), "--out", str(out_dir)]
        if args.strict_overrides:
            command.append("--strict-overrides")

        # Log the command BEFORE running it — even a crash mid-run leaves a
        # real record of what was attempted, per this task's own spec.
        _write_apply_report(session_dir, {"timestamp": _now(), "outcome": "starting", "command": " ".join(command)})

        result = subprocess.run(command, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"[apply] run-slice failed:\n{result.stderr}", file=sys.stderr)
            _write_apply_report(session_dir, {"timestamp": _now(), "outcome": "FAILED", "command": " ".join(command)})
            return 1

    overrides_report_path = out_dir / "modules" / "calm-generator" / "overrides-applied-report.json"
    if not overrides_report_path.exists():
        # Real bug found live (Architect_Pilot_Feedback_Notes.md Entry 25):
        # run-slice can exit 0 (success) even when the calm-generator module
        # itself threw and was isolated by modules/registry.ts — the real
        # crash reason lands on stderr (e.g. "[module-registry] module
        # \"calm-generator\" failed: ...") but this branch used to print only
        # a generic, easy-to-misread-as-benign message ("no overrides were
        # passed through?"), which is exactly how a real isolated-module
        # crash got mistaken for "0 overrides, nothing to apply" in a real
        # session. Surface the real stderr so this is unmissable.
        print(f"[apply] run-slice succeeded but {overrides_report_path} was not written.", file=sys.stderr)
        if result.stderr.strip():
            print(f"[apply] real cause is likely on stderr below (a module may have thrown and been isolated):\n{result.stderr}", file=sys.stderr)
        else:
            print("[apply] no stderr output either — no overrides were passed through?", file=sys.stderr)
        _write_apply_report(
            session_dir,
            {
                "timestamp": _now(),
                "outcome": "succeeded, but no overrides-applied-report.json found",
                "out_dir": str(out_dir),
                "stderr": result.stderr.strip() or None,
            },
        )
        return 1

    overrides_result = json.loads(overrides_report_path.read_text())
    entry = {
        "timestamp": _now(),
        "outcome": "applied",
        "command": " ".join(command),
        "out_dir": str(out_dir),
        "applied": [o["override_id"] for o in overrides_result.get("applied", [])],
        "rejected": [o["override_id"] for o in overrides_result.get("rejected", [])],
        "skipped": [o["override_id"] for o in overrides_result.get("skipped", [])],
        "orphans": [o["override_id"] for o in overrides_result.get("orphans", [])],
        "validation_warnings": warnings,
    }
    _write_apply_report(session_dir, entry)
    _append_decisions_log(session_dir, entry)

    print(f"[apply] wrote {out_dir} — {len(entry['applied'])} applied, {len(entry['rejected'])} rejected, {len(entry['skipped'])} skipped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
