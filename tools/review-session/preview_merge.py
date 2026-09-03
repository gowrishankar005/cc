#!/usr/bin/env python3
"""preview_merge.py — §3.2 T-2 (Architect_Residual_Review_Session.md), the
canonical-plus-drafts preview/merge tool. Read-only over the canonical
architecture.calm.json and drafts/ — never touches either. Writes a NEW
file, <session-dir>/preview-merged.calm.json, showing the complete picture
an architect would get if every current draft were applied, with
still-pending drafted relationships tagged x-aac-draft: true.

Real mechanism reuse, not a second CALM-merge implementation: this is the
exact same drafts-merge + `run-slice.js --from-facts --overrides --out`
invocation apply.py already uses for a REAL apply (override-applier.ts's
own real applyOverrides logic) — just pointed at a throwaway temp --out
directory instead of the real one, then diffed against the real canonical
file to find what's genuinely new.

Real correctness finding this design accounts for: override-applier.ts's
relationship_add case unconditionally tags a newly-added relationship
with x-aac-status: reviewed / x-aac-override-provenance — correct for a
real apply, a false claim for a preview. Every relationship this tool
identifies as a genuine pending draft has those two keys stripped and
x-aac-draft: true added instead.

Real finding this design accounts for: apply.py never moves/archives a
draft after applying it — drafts/decisions/ + drafts/overrides/ keeps
growing forever across a session's history, so "is there an override for
this residual in drafts/" is NOT a reliable signal for "not yet applied."
The only correct signal is a diff: a relationship present in the
merged-temp output but ABSENT from the real canonical file is genuinely
pending; present in both means it's either an original canonical fact or
an already-applied override, and must be rendered exactly as-is, no tag.

Scoped to relationship_add-sourced new relationships only, matching
§3.2's own stated scope. drafts/ may also contain node_add/node_remove/
relationship_remove/type_change/boundary_change overrides from OTHER
residual classes — the same merge will apply them too (that's
override-applier.ts's own correct, unconditional behavior), but their
effects are not specially tagged here. A real, disclosed limitation, not
silently handled.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from apply import DEFAULT_RUN_SLICE, _merge_drafts  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[2]

# Real-apply-only metadata override-applier.ts's relationship_add case
# unconditionally adds — misleading in a preview, stripped from every
# relationship this tool tags as a pending draft.
_REAL_APPLY_ONLY_METADATA_KEYS = {"x-aac-status", "x-aac-override-provenance"}


def _relationship_ids(calm: dict) -> set[str]:
    return {r["unique-id"] for r in calm.get("relationships", []) if "unique-id" in r}


def build_preview_merge(session_dir: Path, run_slice_path: Path = DEFAULT_RUN_SLICE) -> tuple[dict, list[str]]:
    """Pure-ish core (still shells out to run-slice.js, but no argparse/
    printing) — returns (preview_calm_document, pending_draft_relationship_ids).
    Separated from main() so this is directly testable and reusable."""
    manifest_path = session_dir / "manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError(f"{manifest_path} not found — is this a real Session Pack (built by pack.py)?")
    manifest = json.loads(manifest_path.read_text())

    out_dir = manifest.get("outDir")
    if not out_dir:
        raise ValueError(f"{manifest_path} has no 'outDir' field — is this a real manifest.json written by pack.py?")

    canonical_calm_path = Path(out_dir) / "architecture.calm.json"
    if not canonical_calm_path.exists():
        raise FileNotFoundError(f"{canonical_calm_path} not found — was it moved/deleted since this pack was built?")
    canonical_calm = json.loads(canonical_calm_path.read_text())
    canonical_relationship_ids = _relationship_ids(canonical_calm)

    facts_path = Path(out_dir) / "typed-facts.json"
    if not facts_path.exists():
        raise FileNotFoundError(f"{facts_path} not found — was it moved/deleted since this pack was built?")

    if not run_slice_path.exists():
        raise FileNotFoundError(f"{run_slice_path} not found — is the pipeline built (npm run build)?")

    with tempfile.TemporaryDirectory(prefix="review-session-preview-drafts-") as drafts_tmp:
        drafts_tmp_dir = Path(drafts_tmp)
        _merge_drafts(session_dir, drafts_tmp_dir)

        with tempfile.TemporaryDirectory(prefix="review-session-preview-out-") as preview_tmp:
            preview_out_dir = Path(preview_tmp)
            command = ["node", str(run_slice_path), "--from-facts", str(facts_path), "--overrides", str(drafts_tmp_dir), "--out", str(preview_out_dir)]
            result = subprocess.run(command, capture_output=True, text=True)
            if result.returncode != 0:
                raise RuntimeError(f"run-slice failed:\n{result.stderr}")

            merged_calm_path = preview_out_dir / "architecture.calm.json"
            if not merged_calm_path.exists():
                raise RuntimeError(f"run-slice succeeded but {merged_calm_path} was not written — real stderr:\n{result.stderr}")
            merged_calm = json.loads(merged_calm_path.read_text())

    pending_draft_ids: list[str] = []
    new_relationships: list[dict] = []
    for rel in merged_calm.get("relationships", []):
        rid = rel.get("unique-id")
        if rid is None or rid in canonical_relationship_ids:
            continue
        tagged = dict(rel)
        metadata = [m for m in rel.get("metadata", []) if m.get("key") not in _REAL_APPLY_ONLY_METADATA_KEYS]
        metadata.append({"key": "x-aac-draft", "value": True})
        tagged["metadata"] = metadata
        new_relationships.append(tagged)
        pending_draft_ids.append(rid)

    preview_calm = dict(canonical_calm)
    preview_calm["relationships"] = [*canonical_calm.get("relationships", []), *new_relationships]
    return preview_calm, sorted(pending_draft_ids)


def main() -> int:
    parser = argparse.ArgumentParser(description="§3.2 T-2 — read-only preview of canonical architecture.calm.json plus current drafts/, pending relationships tagged x-aac-draft: true. Never touches the canonical file or drafts/.")
    parser.add_argument("--session-dir", required=True)
    parser.add_argument("--run-slice", default=str(DEFAULT_RUN_SLICE), help="path to run-slice.js (default: pipeline/dist/orchestration/run-slice.js)")
    args = parser.parse_args()

    session_dir = Path(args.session_dir).resolve()
    try:
        preview_calm, pending_ids = build_preview_merge(session_dir, Path(args.run_slice))
    except (FileNotFoundError, ValueError, RuntimeError) as e:
        print(f"[preview-merge] {e}", file=sys.stderr)
        return 1

    out_path = session_dir / "preview-merged.calm.json"
    out_path.write_text(json.dumps(preview_calm, indent=2))

    if pending_ids:
        print(f"[preview-merge] wrote {out_path} — {len(pending_ids)} pending draft relationship(s):")
        for rid in pending_ids:
            print(f"  - {rid}")
    else:
        print(f"[preview-merge] wrote {out_path} — no pending draft relationships found (drafts/ empty, or every drafted override is already reflected in the canonical file)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
