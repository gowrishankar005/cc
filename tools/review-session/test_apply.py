"""Stated exit bar: a real override (type_change or relationship_add)
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
            "rationale": "Real end-to-end apply.py test.",
            "reviewer": "architect:test",
            "reviewed_at": "2026-08-09T00:00:00Z",
            "status": "active",
            "residual_id": "R-001",
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

    def _write_draft_with_colliding_filenames(self):
        """Real bug found on review: a decision and its override sharing a
        filename (a natural convention — naming both after their shared
        residual id, e.g. R-001.json in each directory) used to silently
        drop one of them during the merge step, AFTER validate_drafts had
        already said the pair was fine. This writes exactly that shape."""
        decision = {
            "decision_id": "D-test-001",
            "module": "architecture",
            "target_type": "node",
            "target_ref": self.target_node_id,
            "final_decision": {"action": "overridden", "new_value": "database"},
            "rationale": "Real filename-collision regression test.",
            "reviewer": "architect:test",
            "reviewed_at": "2026-08-09T00:00:00Z",
            "status": "active",
            "residual_id": "R-001",
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
        (self.session_dir / "drafts" / "decisions" / "R-001.json").write_text(json.dumps(decision))
        (self.session_dir / "drafts" / "overrides" / "R-001.json").write_text(json.dumps(override))

    def test_apply_handles_decision_and_override_sharing_a_filename(self):
        self._write_draft_with_colliding_filenames()
        run = _run([sys.executable, str(TOOLS_DIR / "apply.py"), "--session-dir", str(self.session_dir), "--out", str(self.applied_dir), "--i-confirm-apply"])
        self.assertEqual(run.returncode, 0, run.stderr)
        calm = json.loads((self.applied_dir / "architecture.calm.json").read_text())
        node = next(n for n in calm["nodes"] if n["unique-id"] == self.target_node_id)
        self.assertEqual(node["node-type"], "database", "must apply correctly even when decision/override files share a filename")
        overrides_result = json.loads((self.applied_dir / "modules" / "calm-generator" / "overrides-applied-report.json").read_text())
        self.assertEqual(len(overrides_result["applied"]), 1)
        self.assertEqual(overrides_result["applied"][0]["override_id"], "O-test-001")

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

        # Real gap found 2026-09-04: "N applied, M rejected, K skipped" alone
        # reads as a completeness signal without being one. Both the
        # pre-confirmation table (printed before run-slice ever runs) and
        # the final summary line's suffix must be real, not just present.
        self.assertIn("[apply] residual completeness:", run.stdout)
        self.assertRegex(run.stdout, r"\[apply\] wrote .* \(\d+/\d+ residuals had a decision\)")

    def test_apply_report_records_residual_completeness(self):
        self._write_draft()
        run = _run([sys.executable, str(TOOLS_DIR / "apply.py"), "--session-dir", str(self.session_dir), "--out", str(self.applied_dir), "--i-confirm-apply"])
        self.assertEqual(run.returncode, 0, run.stderr)
        report_md = (self.session_dir / "apply-report.md").read_text()
        self.assertIn("Residual completeness:", report_md)

    def test_apply_completeness_table_covers_multiple_trigger_classes_some_decided_some_not(self):
        """Real gap found on review: every other completeness-table test
        only ever exercised a fixture producing ONE trigger class -- this
        feature's own stated verification bar is >=3 trigger classes, some
        decided and some not. residuals.json is overwritten with a richer
        synthetic set (apply.py's completeness view reads it independently
        of what run-slice itself produced) while the real scan/apply
        subprocess flow underneath is unchanged."""
        self._write_draft()  # R-001, decided (S2-http-without-security-control)
        residuals_path = self.session_dir / "residuals.json"
        residuals_doc = json.loads(residuals_path.read_text())
        residuals_doc["items"] = [
            {"id": "R-001", "tier": "A", "trigger": "S2-http-without-security-control", "class": "x", "unitIds": [], "evidenceRefs": [], "rationale": "r", "status": "open", "card": "c"},
            {"id": "R-002", "tier": "A", "trigger": "unmapped-signal-cluster", "class": "x", "unitIds": [], "evidenceRefs": [], "rationale": "r", "status": "open", "card": "c"},
            {"id": "R-003", "tier": "A", "trigger": "unmapped-signal-cluster", "class": "x", "unitIds": [], "evidenceRefs": [], "rationale": "r", "status": "open", "card": "c"},
            {"id": "R-004", "tier": "B", "trigger": "unresolved-outbound-target", "class": "x", "unitIds": [], "evidenceRefs": [], "rationale": "r", "status": "open", "card": "c"},
        ]
        residuals_path.write_text(json.dumps(residuals_doc))

        run = _run([sys.executable, str(TOOLS_DIR / "apply.py"), "--session-dir", str(self.session_dir), "--out", str(self.applied_dir), "--i-confirm-apply"])
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertIn("residual completeness: 1/4 decided, by trigger:", run.stdout)
        self.assertIn("[A] S2-http-without-security-control: 1/1 decided", run.stdout)
        self.assertIn("[A] unmapped-signal-cluster: 0/2 decided", run.stdout)
        self.assertIn("[B] unresolved-outbound-target: 0/1 decided", run.stdout)
        self.assertRegex(run.stdout, r"\[apply\] wrote .* \(1/4 residuals had a decision\)")

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
        """Stated exit bar, literally. Uses the project's own real
        `npm run validate` wrapper (pipeline/package.json) — the same
        command this whole session has used everywhere else — rather than
        guessing at calm-cli's own flag/output shape independently."""
        self._write_draft()
        run = _run([sys.executable, str(TOOLS_DIR / "apply.py"), "--session-dir", str(self.session_dir), "--out", str(self.applied_dir), "--i-confirm-apply"])
        self.assertEqual(run.returncode, 0, run.stderr)

        validate_run = _run(["npm", "run", "validate", "--", str(self.applied_dir / "architecture.calm.json"), "-f", "pretty"], cwd=REPO_ROOT / "pipeline")
        combined = validate_run.stdout + validate_run.stderr
        self.assertIn("Errors: no (0)", combined, f"expected 0 validation errors, got:\n{combined}")

    def test_apply_refuses_a_malformed_decision_shape_before_calling_run_slice(self):
        """Entry 25, Architect_Pilot_Feedback_Notes.md: a real Copilot Chat
        session drafted 23 decision files using invented field names
        (residual_id/construct/option) instead of the real decision_id/
        final_decision/status schema -- validate_drafts's old file-loading
        step silently dropped every one instead of reporting it, so
        _run_validation() reported "0 errors" and apply.py went on to call
        run-slice, which crashed inside an isolated module and never wrote
        architecture.calm.json, with only a vague "no overrides were passed
        through?" message. Writes the EXACT malformed shape actually found
        on disk from that real session (not a hypothetical), and asserts
        apply.py now refuses at the validation stage -- before run-slice is
        ever invoked at all, matching test_apply_refuses_when_validation_fails's
        own pattern."""
        malformed_decision = {
            "residual_id": "R-001",
            "construct": "signal-catalogue-candidate",
            "option": "[1]",
            "rationale": "JWT-based authentication exists in source; pattern not detected by pipeline's catalogue.",
            "reviewer": "llm-advisory:claude",
            "timestamp": "2026-09-01T00:00:00Z",
        }
        (self.session_dir / "drafts" / "decisions" / "R-001.json").write_text(json.dumps(malformed_decision))
        run = _run([sys.executable, str(TOOLS_DIR / "apply.py"), "--session-dir", str(self.session_dir), "--out", str(self.applied_dir), "--i-confirm-apply"])
        self.assertNotEqual(run.returncode, 0)
        self.assertFalse(self.applied_dir.exists(), "run-slice must never even be invoked for a schema-invalid pack")
        self.assertIn("decision_id", run.stdout + run.stderr)

    def test_apply_surfaces_real_stderr_when_a_module_is_isolated(self):
        """Entry 25 (continued): even once the malformed-decision case is
        caught earlier by validation (test above), the OTHER real failure
        mode -- run-slice exits 0 but a module threw and was isolated by
        modules/registry.ts, so overrides-applied-report.json is never
        written -- deserves its own real defense-in-depth fix: surface
        result.stderr (where the isolated module's real error lands) instead
        of a generic message a human can misread as "0 overrides, fine".
        Uses --run-slice to point at a stub script (this is what that flag
        exists for) so this test doesn't depend on engineering a real
        pipeline crash."""
        self._write_draft()
        stub = self.tmp / "fake-run-slice.js"
        stub.write_text(
            "const fs = require('fs');\n"
            "const path = require('path');\n"
            "const outIdx = process.argv.indexOf('--out');\n"
            "const outDir = process.argv[outIdx + 1];\n"
            "fs.mkdirSync(path.join(outDir, 'modules', 'calm-generator'), { recursive: true });\n"
            "console.error('[module-registry] module \"calm-generator\" failed: DISTINCTIVE_TEST_MARKER_a1b2c3');\n"
            "process.exit(0);\n"
        )
        run = _run(
            [
                sys.executable,
                str(TOOLS_DIR / "apply.py"),
                "--session-dir",
                str(self.session_dir),
                "--out",
                str(self.applied_dir),
                "--i-confirm-apply",
                "--run-slice",
                str(stub),
            ]
        )
        self.assertNotEqual(run.returncode, 0)
        self.assertIn("DISTINCTIVE_TEST_MARKER_a1b2c3", run.stderr, "the real isolated-module error must be surfaced, not swallowed")
        report = (self.session_dir / "apply-report.md").read_text()
        self.assertIn("DISTINCTIVE_TEST_MARKER_a1b2c3", report, "the real crash cause must also land in the audit trail")

    def test_missing_source_calm_warns_but_does_not_silently_skip(self):
        """Real gap found on review: if the source scan's architecture.calm.json
        goes missing (moved/deleted since the pack was built), endpoint
        checks used to silently degrade to "not checked" with no warning at
        all. override-applier.ts still catches a real dangling endpoint at
        real apply time regardless (this isn't a safety hole), but the
        pre-flight pass silently skipping a meaningful check with zero
        explanation was a real observability gap."""
        self._write_draft()
        (self.out_dir / "architecture.calm.json").unlink()  # simulate it going missing
        run = _run([sys.executable, str(TOOLS_DIR / "apply.py"), "--session-dir", str(self.session_dir), "--out", str(self.applied_dir), "--i-confirm-apply"])
        self.assertIn("endpoint existence was NOT checked", run.stderr)
        # The apply itself should still succeed (override-applier.ts is the
        # real backstop) and the warning should be recorded in the audit trail.
        self.assertEqual(run.returncode, 0, run.stderr)
        report = (self.session_dir / "apply-report.md").read_text()
        self.assertIn("endpoint existence was NOT checked", report)


if __name__ == "__main__":
    unittest.main()
