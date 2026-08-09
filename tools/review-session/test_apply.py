"""T-RS3-1's own exit bar: a real override (type_change or relationship_add)
applies; calm validate reports 0 errors on the reviewed out-dir. Real,
genuine subprocess chain: run-slice -> pack.py -> hand-authored draft ->
apply.py -> calm validate. No mocks.
"""

import json
import shutil
import subprocess
import sys
import unittest
from pathlib import Path

TOOLS_DIR = Path(__file__).resolve().parent
REPO_ROOT = TOOLS_DIR.parents[1]
RUN_SLICE = REPO_ROOT / "pipeline" / "dist" / "orchestration" / "run-slice.js"
NESTJS_FIXTURE = REPO_ROOT / "pipeline" / "test" / "fixtures" / "nestjs-sample"


def _run(cmd, **kwargs):
    return subprocess.run(cmd, capture_output=True, text=True, **kwargs)


@unittest.skipUnless(RUN_SLICE.exists(), "pipeline/dist not built — run `cd pipeline && npm run build` first")
class TestApplyEndToEnd(unittest.TestCase):
    def setUp(self):
        import tempfile

        self.tmp = Path(tempfile.mkdtemp(prefix="apply-test-"))
        self.out_dir = self.tmp / "out"
        self.session_dir = self.tmp / "session"
        self.applied_dir = self.tmp / "applied"

        run = _run(["node", str(RUN_SLICE), str(NESTJS_FIXTURE), "--out", str(self.out_dir)])
        self.assertEqual(run.returncode, 0, run.stderr)
        pack_run = _run([sys.executable, str(TOOLS_DIR / "pack.py"), "--out-dir", str(self.out_dir), "--session-dir", str(self.session_dir)])
        self.assertEqual(pack_run.returncode, 0, pack_run.stderr)

        calm = json.loads((self.out_dir / "architecture.calm.json").read_text())
        self.target_node_id = calm["nodes"][0]["unique-id"]

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)
        for cache in (".codegraph", ".graphify-cache", "graphify-out"):
            shutil.rmtree(NESTJS_FIXTURE / cache, ignore_errors=True)

    def _write_draft(self):
        decision = {
            "decision_id": "D-test-001",
            "module": "architecture",
            "target_type": "node",
            "target_ref": self.target_node_id,
            "final_decision": {"action": "overridden", "new_value": "database"},
            "rationale": "Real end-to-end apply.py test (T-RS3-1).",
            "reviewer": "architect:test",
            "reviewed_at": "2026-08-09T00:00:00Z",
            "status": "active",
        }
        override = {
            "override_id": "O-test-001",
            "module": "architecture",
            "target_ref": self.target_node_id,
            "override_type": "type_change",
            "new_value": "database",
            "decision_record_ref": "D-test-001",
            "status": "active",
            "created_by": "architect:test",
            "created_at": "2026-08-09T00:00:00Z",
        }
        (self.session_dir / "drafts" / "decisions" / "D-test-001.json").write_text(json.dumps(decision))
        (self.session_dir / "drafts" / "overrides" / "O-test-001.json").write_text(json.dumps(override))

    def test_apply_confirmed_applies_a_real_type_change(self):
        self._write_draft()
        run = _run([sys.executable, str(TOOLS_DIR / "apply.py"), "--session-dir", str(self.session_dir), "--out", str(self.applied_dir), "--i-confirm-apply"])
        self.assertEqual(run.returncode, 0, run.stderr)

        calm = json.loads((self.applied_dir / "architecture.calm.json").read_text())
        node = next(n for n in calm["nodes"] if n["unique-id"] == self.target_node_id)
        self.assertEqual(node["node-type"], "database", "the type_change override must have genuinely applied")

        # apply-report.md and decisions-log.md must both reflect the real outcome.
        report = (self.session_dir / "apply-report.md").read_text()
        self.assertIn("O-test-001", report)
        log = (self.session_dir / "decisions-log.md").read_text()
        self.assertIn("Applied", log)

    def test_apply_refuses_without_confirmation(self):
        self._write_draft()
        run = _run([sys.executable, str(TOOLS_DIR / "apply.py"), "--session-dir", str(self.session_dir), "--out", str(self.applied_dir)], input="")
        self.assertNotEqual(run.returncode, 0)
        self.assertFalse(self.applied_dir.exists(), "must never write an out-dir when apply was refused")

    def test_apply_refuses_when_validation_fails(self):
        # A dangling decision_record_ref -> validate_drafts must catch this
        # BEFORE any confirmation prompt or run-slice invocation happens.
        override = {
            "override_id": "O-bad",
            "module": "architecture",
            "target_ref": self.target_node_id,
            "override_type": "type_change",
            "new_value": "database",
            "decision_record_ref": "D-does-not-exist",
            "status": "active",
            "created_by": "architect:test",
            "created_at": "2026-08-09T00:00:00Z",
        }
        (self.session_dir / "drafts" / "overrides" / "O-bad.json").write_text(json.dumps(override))
        run = _run([sys.executable, str(TOOLS_DIR / "apply.py"), "--session-dir", str(self.session_dir), "--out", str(self.applied_dir), "--i-confirm-apply"])
        self.assertNotEqual(run.returncode, 0)
        self.assertFalse(self.applied_dir.exists())
        self.assertIn("REFUSING", run.stderr)

    def test_calm_validate_zero_errors_on_reviewed_out(self):
        """T-RS3-1's own exit bar, literally. Uses the project's own real
        `npm run validate` wrapper (pipeline/package.json) — the same
        command this whole session has used everywhere else — rather than
        guessing at calm-cli's own flag/output shape independently."""
        self._write_draft()
        run = _run([sys.executable, str(TOOLS_DIR / "apply.py"), "--session-dir", str(self.session_dir), "--out", str(self.applied_dir), "--i-confirm-apply"])
        self.assertEqual(run.returncode, 0, run.stderr)

        validate_run = _run(["npm", "run", "validate", "--", str(self.applied_dir / "architecture.calm.json"), "-f", "pretty"], cwd=REPO_ROOT / "pipeline")
        combined = validate_run.stdout + validate_run.stderr
        self.assertIn("Errors: no (0)", combined, f"expected 0 validation errors, got:\n{combined}")


if __name__ == "__main__":
    unittest.main()
