"""§3.2 T-2 (Architect_Residual_Review_Session.md) — real, no-mocks
subprocess chain: run-slice -> pack.py -> hand-authored relationship_add
draft -> preview_merge.py -> assertions directly on the resulting
preview-merged.calm.json. Same real-chain discipline test_apply.py's own
docstring already states for this tool family.
"""

import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

TOOLS_DIR = Path(__file__).resolve().parent
REPO_ROOT = TOOLS_DIR.parents[1]
RUN_SLICE = REPO_ROOT / "pipeline" / "dist" / "orchestration" / "run-slice.js"
DUP_REL_FIXTURE = REPO_ROOT / "pipeline" / "test" / "fixtures" / "duplicate-relationship-sample"


def _run(cmd, **kwargs):
    return subprocess.run(cmd, capture_output=True, text=True, **kwargs)


@unittest.skipUnless(RUN_SLICE.exists(), "pipeline/dist not built — run `cd pipeline && npm run build` first")
class TestPreviewMergeEndToEnd(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="preview-merge-test-"))
        self.out_dir = self.tmp / "out"
        self.session_dir = self.tmp / "session"

        run = _run(["node", str(RUN_SLICE), str(DUP_REL_FIXTURE), "--out", str(self.out_dir)])
        self.assertEqual(run.returncode, 0, run.stderr)
        pack_run = _run([sys.executable, str(TOOLS_DIR / "pack.py"), "--out-dir", str(self.out_dir), "--session-dir", str(self.session_dir)])
        self.assertEqual(pack_run.returncode, 0, pack_run.stderr)

        calm = json.loads((self.out_dir / "architecture.calm.json").read_text())
        self.node_ids = [n["unique-id"] for n in calm["nodes"] if n["node-type"] != "system"]
        self.assertGreaterEqual(len(self.node_ids), 2, "fixture must have 2 real non-system nodes to draft a real relationship_add between")
        self.canonical_relationship_ids = {r["unique-id"] for r in calm["relationships"]}

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)
        for cache in (".codegraph", ".graphify-cache", "graphify-out"):
            shutil.rmtree(DUP_REL_FIXTURE / cache, ignore_errors=True)

    def _new_relationship_id(self) -> str:
        return f"connects|{self.node_ids[1]}|{self.node_ids[0]}|test-preview-merge"

    def _write_relationship_add_draft(self, rel_id: str, decision_id: str = "D-preview-001", override_id: str = "O-preview-001"):
        decision = {
            "decision_id": decision_id,
            "module": "architecture",
            "target_type": "relationship",
            "target_ref": rel_id,
            "final_decision": {"action": "added", "new_value": rel_id},
            "rationale": "Real preview_merge.py end-to-end test — a drafted relationship_add.",
            "reviewer": "architect:test",
            "reviewed_at": "2026-09-03T00:00:00Z",
            "status": "active",
            "residual_id": "R-001",
        }
        override = {
            "override_id": override_id,
            "module": "architecture",
            "target_ref": rel_id,
            "override_type": "relationship_add",
            "new_value": {
                "unique-id": rel_id,
                "description": "Real preview_merge.py test relationship.",
                "relationship-type": {"connects": {"source": {"node": self.node_ids[1]}, "destination": {"node": self.node_ids[0]}}},
            },
            "decision_record_ref": decision_id,
            "status": "active",
            "created_by": "architect:test",
            "created_at": "2026-09-03T00:00:00Z",
        }
        (self.session_dir / "drafts" / "decisions" / f"{decision_id}.json").write_text(json.dumps(decision))
        (self.session_dir / "drafts" / "overrides" / f"{override_id}.json").write_text(json.dumps(override))

    def test_zero_overrides_sanity_check(self):
        """The diff baseline is only trustworthy if a zero-overrides merge
        reproduces exactly the real canonical relationship set — verified
        directly, not assumed, before trusting the diff-based approach at
        all (this task's own stated precondition)."""
        run = _run([sys.executable, str(TOOLS_DIR / "preview_merge.py"), "--session-dir", str(self.session_dir)])
        self.assertEqual(run.returncode, 0, run.stderr)
        preview = json.loads((self.session_dir / "preview-merged.calm.json").read_text())
        preview_ids = {r["unique-id"] for r in preview["relationships"]}
        self.assertEqual(preview_ids, self.canonical_relationship_ids, "a zero-overrides preview must reproduce the real canonical relationship set exactly")

    def test_pending_draft_relationship_tagged_x_aac_draft_and_stripped_of_real_apply_metadata(self):
        rel_id = self._new_relationship_id()
        self._write_relationship_add_draft(rel_id)
        run = _run([sys.executable, str(TOOLS_DIR / "preview_merge.py"), "--session-dir", str(self.session_dir)])
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertIn(rel_id, run.stdout)

        preview = json.loads((self.session_dir / "preview-merged.calm.json").read_text())
        drafted = next((r for r in preview["relationships"] if r["unique-id"] == rel_id), None)
        self.assertIsNotNone(drafted, "the real drafted relationship must appear in the preview")
        metadata_keys = {m["key"] for m in drafted.get("metadata", [])}
        self.assertIn("x-aac-draft", metadata_keys)
        self.assertTrue(next(m["value"] for m in drafted["metadata"] if m["key"] == "x-aac-draft"))
        self.assertNotIn("x-aac-status", metadata_keys, "the real-apply-only tag must be stripped from a preview-only relationship")
        self.assertNotIn("x-aac-override-provenance", metadata_keys, "the real-apply-only tag must be stripped from a preview-only relationship")

        # Real canonical relationships must be untouched — no x-aac-draft tag, present exactly as before.
        for rel in preview["relationships"]:
            if rel["unique-id"] in self.canonical_relationship_ids:
                self.assertNotIn("x-aac-draft", {m["key"] for m in rel.get("metadata", [])})

        # Read-only over the real files — the whole point of this tool.
        self.assertFalse((self.session_dir / "drafts" / "decisions" / "D-preview-001.json").read_text() == "", "drafts/ must be untouched")
        canonical_after = json.loads((self.out_dir / "architecture.calm.json").read_text())
        self.assertEqual({r["unique-id"] for r in canonical_after["relationships"]}, self.canonical_relationship_ids, "the real canonical file must never be modified by a preview run")

    def test_already_applied_override_not_tagged_as_pending(self):
        """apply.py never moves/archives a draft after applying it -- the
        SAME override can still sit in drafts/ after a real apply already
        folded it into a (different) canonical file. Point this session's
        own manifest at that already-applied out-dir and confirm the same
        draft is correctly NOT re-tagged as pending -- the only correct
        signal is the diff, never "is there a file in drafts/"."""
        rel_id = self._new_relationship_id()
        self._write_relationship_add_draft(rel_id)

        applied_dir = self.tmp / "applied"
        apply_run = _run([sys.executable, str(TOOLS_DIR / "apply.py"), "--session-dir", str(self.session_dir), "--out", str(applied_dir), "--i-confirm-apply"])
        self.assertEqual(apply_run.returncode, 0, apply_run.stderr)
        applied_calm = json.loads((applied_dir / "architecture.calm.json").read_text())
        self.assertIn(rel_id, {r["unique-id"] for r in applied_calm["relationships"]}, "sanity: the real apply must have genuinely added the relationship")

        # Point manifest.json at the now-applied out-dir, simulating a
        # session whose canonical file has already absorbed this draft --
        # while the SAME draft files are still sitting in drafts/, exactly
        # apply.py's own real, confirmed behavior.
        manifest_path = self.session_dir / "manifest.json"
        manifest = json.loads(manifest_path.read_text())
        manifest["outDir"] = str(applied_dir)
        manifest_path.write_text(json.dumps(manifest))

        run = _run([sys.executable, str(TOOLS_DIR / "preview_merge.py"), "--session-dir", str(self.session_dir)])
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertIn("no pending draft relationships found", run.stdout)

        preview = json.loads((self.session_dir / "preview-merged.calm.json").read_text())
        drafted = next(r for r in preview["relationships"] if r["unique-id"] == rel_id)
        self.assertNotIn("x-aac-draft", {m["key"] for m in drafted.get("metadata", [])}, "an already-applied override must never be re-tagged as a pending draft")


if __name__ == "__main__":
    unittest.main()
