"""Stated exit bar: "Pack on NestJS fixture or a Python-app out-dir
succeeds offline." Automated, not just the manual run this was originally
proven with — same "lock every proven behavior into a regression test"
discipline as pipeline/test/regression.test.js.

Requires the pipeline to be built (`cd pipeline && npm run build`) — skips
cleanly if dist/ isn't present, same convention pipeline/test/regression.test.js
uses for scratch-clone-dependent fixtures.
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

TOOLS_DIR = Path(__file__).resolve().parent
REPO_ROOT = TOOLS_DIR.parents[1]
RUN_SLICE = REPO_ROOT / "pipeline" / "dist" / "orchestration" / "run-slice.js"
NESTJS_FIXTURE = REPO_ROOT / "pipeline" / "test" / "fixtures" / "nestjs-sample"


@unittest.skipUnless(RUN_SLICE.exists(), "pipeline/dist not built — run `cd pipeline && npm run build` first")
class TestPackEndToEnd(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="review-session-test-"))
        self.out_dir = self.tmp / "out"
        self.session_dir = self.tmp / "session"

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)
        for cache in (".codegraph", ".graphify-cache", "graphify-out"):
            shutil.rmtree(NESTJS_FIXTURE / cache, ignore_errors=True)

    def test_pack_on_nestjs_fixture_succeeds_offline(self):
        run = subprocess.run(
            ["node", str(RUN_SLICE), str(NESTJS_FIXTURE), "--out", str(self.out_dir)],
            capture_output=True,
            text=True,
        )
        self.assertEqual(run.returncode, 0, f"run-slice failed: {run.stderr}")

        pack_run = subprocess.run(
            [sys.executable, str(TOOLS_DIR / "pack.py"), "--out-dir", str(self.out_dir), "--session-dir", str(self.session_dir)],
            capture_output=True,
            text=True,
        )
        self.assertEqual(pack_run.returncode, 0, f"pack.py failed: {pack_run.stderr}")

        for expected in ("SESSION.md", "AGENTS.md", "manifest.json", "residuals.json", "decisions-log.md"):
            self.assertTrue((self.session_dir / expected).exists(), f"missing {expected}")
        self.assertTrue((self.session_dir / "drafts" / "decisions").is_dir())
        self.assertTrue((self.session_dir / "drafts" / "overrides").is_dir())
        self.assertTrue((self.session_dir / "evidence" / "unit-index.json").exists())
        self.assertTrue((self.session_dir / "evidence" / "packs.json").exists())
        self.assertTrue((self.session_dir / "evidence" / "paths.json").exists())

        # NestJS fixture's real S2 residual (Controller with no security-control evidence) must be present.
        # Leftover fuel (unmapped/ignored) may append further residuals after it.
        residuals = json.loads((self.session_dir / "residuals.json").read_text())
        self.assertGreaterEqual(len(residuals["items"]), 1)
        s2 = next((r for r in residuals["items"] if r["trigger"] == "S2-http-without-security-control"), None)
        self.assertIsNotNone(s2, "expected the NestJS S2 residual")
        self.assertEqual(s2["tier"], "A")
        session_md = (self.session_dir / "SESSION.md").read_text()
        self.assertIn("CodeGraph", session_md)
        self.assertIn("fetch-span", session_md)

        # Architect_Pilot_Feedback_Notes.md Entry 20: the NestJS fixture lives
        # under REPO_ROOT (pipeline/test/fixtures/...), so at least one
        # evidence ref must resolve to a real, REPO_ROOT-relative clickable
        # path -- not just the bare package-root-relative scan ref -- and
        # that path must actually appear in the residual's own rendered card.
        paths = json.loads((self.session_dir / "evidence" / "paths.json").read_text())
        self.assertGreater(len(paths), 0, "expected at least one clickable evidence path for the NestJS fixture (lives under REPO_ROOT)")
        clickable = next(iter(paths.values()))
        self.assertIn("pipeline/test/fixtures/nestjs-sample", clickable)
        all_cards_text = "\n".join(r["card"] for r in residuals["items"])
        self.assertTrue(
            any(p in all_cards_text for p in paths.values()),
            "at least one rendered card must show a clickable REPO_ROOT-relative evidence path, not just the bare scan ref",
        )

    def test_refuses_overwrite_when_unapplied_drafts_exist(self):
        subprocess.run(["node", str(RUN_SLICE), str(NESTJS_FIXTURE), "--out", str(self.out_dir)], capture_output=True, text=True, check=True)
        subprocess.run(
            [sys.executable, str(TOOLS_DIR / "pack.py"), "--out-dir", str(self.out_dir), "--session-dir", str(self.session_dir)],
            capture_output=True,
            text=True,
            check=True,
        )
        (self.session_dir / "drafts" / "overrides" / "fake.json").write_text("{}")

        second_run = subprocess.run(
            [sys.executable, str(TOOLS_DIR / "pack.py"), "--out-dir", str(self.out_dir), "--session-dir", str(self.session_dir)],
            capture_output=True,
            text=True,
        )
        self.assertNotEqual(second_run.returncode, 0)
        self.assertIn("REFUSING", second_run.stderr)

    def test_missing_out_dir_inputs_fails_loud_not_silently(self):
        empty_out = self.tmp / "empty-out"
        empty_out.mkdir()
        run = subprocess.run(
            [sys.executable, str(TOOLS_DIR / "pack.py"), "--out-dir", str(empty_out), "--session-dir", str(self.session_dir)],
            capture_output=True,
            text=True,
        )
        self.assertNotEqual(run.returncode, 0)
        self.assertFalse(self.session_dir.exists())

    def test_with_dossier_flag_no_backend_still_succeeds_no_dossier_field(self):
        """T-2 (AGENT_TASKS_Residual_Dossier_Module.md): --with-dossier set
        but no `claude` CLI on PATH -> pack.py still writes a normal,
        dossier-less pack (exit 0), logging what would have been attempted."""
        subprocess.run(["node", str(RUN_SLICE), str(NESTJS_FIXTURE), "--out", str(self.out_dir)], capture_output=True, text=True, check=True)
        env = dict(os.environ)
        # Strip only `claude` from PATH (node stays reachable -- pack.py's
        # own review-queue regeneration via hitl-review-trigger.js needs
        # it, unrelated to the LLM backend this test is actually about).
        node_dir = str(Path(shutil.which("node")).parent) if shutil.which("node") else ""
        env["PATH"] = node_dir
        run = subprocess.run(
            [sys.executable, str(TOOLS_DIR / "pack.py"), "--out-dir", str(self.out_dir), "--session-dir", str(self.session_dir), "--with-dossier"],
            capture_output=True,
            text=True,
            env=env,
        )
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertIn("no LLM backend available", run.stdout)
        residuals = json.loads((self.session_dir / "residuals.json").read_text())
        self.assertGreaterEqual(len(residuals["items"]), 1)
        self.assertTrue(all("dossier" not in r for r in residuals["items"]), "no-backend path must never attach a dossier field")

    def test_without_with_dossier_flag_backend_check_never_invoked(self):
        """No --with-dossier at all -> pack.py must not even check for a
        `claude` CLI backend (Simplicity First: the default path stays
        exactly what it was before this pass existed)."""
        subprocess.run(["node", str(RUN_SLICE), str(NESTJS_FIXTURE), "--out", str(self.out_dir)], capture_output=True, text=True, check=True)
        sys.path.insert(0, str(TOOLS_DIR))
        import pack

        with mock.patch.object(pack, "_llm_backend_available") as mock_backend:
            argv_backup = sys.argv
            sys.argv = ["pack.py", "--out-dir", str(self.out_dir), "--session-dir", str(self.session_dir)]
            try:
                rc = pack.pack_main()
            finally:
                sys.argv = argv_backup
        self.assertEqual(rc, 0)
        mock_backend.assert_not_called()


class TestRenderAgentsMd(unittest.TestCase):
    """Entry 25, Architect_Pilot_Feedback_Notes.md: a real Copilot Chat
    session invented its own Decision Record field names instead of the
    real schema, because AGENTS.md (the one file inside the pack the chat
    agent can actually read) never embedded it -- only a bare citation to
    pipeline/src/types/overrides.ts, a file outside the pack the agent is
    explicitly forbidden from opening. Locks that the real, required field
    names are now embedded directly, so this can't silently regress back to
    a one-line summary. No pipeline build required -- pure Python import."""

    def test_agents_md_embeds_the_real_decision_record_and_override_fields(self):
        from pack import _render_agents_md

        rendered = _render_agents_md()
        for field in ("decision_id", "final_decision", "target_type", "target_ref", "reviewed_at", "override_id", "decision_record_ref", "override_type"):
            self.assertIn(f'"{field}"', rendered, f"expected real field name {field!r} embedded in AGENTS.md's own text")

    def test_agents_md_shows_the_no_override_decision_shape(self):
        """The most common real outcome (leave-open/accepted) needs its own
        worked example — not just the decision+override pair — or an
        architect/agent could wrongly infer every decision needs a matching
        override file."""
        from pack import _render_agents_md

        rendered = _render_agents_md()
        self.assertIn("NO override", rendered)
        self.assertIn('"accepted"', rendered)


if __name__ == "__main__":
    unittest.main()
