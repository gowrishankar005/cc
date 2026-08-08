"""T-RS1-2's own stated exit bar: "Pack on NestJS fixture or BoA out-dir
succeeds offline." Automated, not just the manual run this was originally
proven with — same "lock every proven behavior into a regression test"
discipline as pipeline/test/regression.test.js.

Requires the pipeline to be built (`cd pipeline && npm run build`) — skips
cleanly if dist/ isn't present, same convention pipeline/test/regression.test.js
uses for scratch-clone-dependent fixtures.
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

        # NestJS fixture's real S2 residual (Controller with no security-control evidence) must be present.
        residuals = json.loads((self.session_dir / "residuals.json").read_text())
        self.assertEqual(len(residuals["items"]), 1)
        self.assertEqual(residuals["items"][0]["trigger"], "S2-http-without-security-control")
        self.assertEqual(residuals["items"][0]["tier"], "A")

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


if __name__ == "__main__":
    unittest.main()
