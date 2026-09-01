"""CLI tests for pack.py fetch-span — no run-slice required."""

import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

TOOLS_DIR = Path(__file__).resolve().parent
PACK = TOOLS_DIR / "pack.py"


class TestFetchSpan(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="fetch-span-test-"))
        self.root = self.tmp / "pkg"
        self.root.mkdir()
        (self.root / "svc.py").write_text("line1\nline2\nSECRET=AKIAIOSFODNN7EXAMPLE\nline4\nline5\n")
        (self.root / "long.py").write_text("\n".join(f"line{i}" for i in range(1, 101)) + "\n")
        self.session = self.tmp / "session"
        (self.session / "evidence").mkdir(parents=True)
        (self.session / "drafts" / "decisions").mkdir(parents=True)
        (self.session / "drafts" / "overrides").mkdir(parents=True)
        (self.session / "manifest.json").write_text(
            json.dumps(
                {
                    "packageRoots": [str(self.root)],
                    "extraReadCount": 0,
                    "extraReadLines": 0,
                }
            )
        )
        (self.session / "residuals.json").write_text(
            json.dumps({"items": [{"id": "R-001", "tier": "A", "class": "insufficient-evidence", "evidenceRefs": [], "status": "open"}]})
        )
        (self.session / "evidence" / "packs.json").write_text("{}")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _run(self, extra):
        return subprocess.run(
            [sys.executable, str(PACK), "fetch-span", "--session-dir", str(self.session), *extra],
            capture_output=True,
            text=True,
        )

    def test_appends_redacted_span_and_records_cap(self):
        run = self._run(["--residual-id", "R-001", "--path", "svc.py", "--start-line", "1", "--end-line", "4"])
        self.assertEqual(run.returncode, 0, run.stderr)
        packs = json.loads((self.session / "evidence" / "packs.json").read_text())
        self.assertIn("svc.py:1", packs)
        self.assertNotIn("AKIAIOSFODNN7EXAMPLE", packs["svc.py:1"])
        residuals = json.loads((self.session / "residuals.json").read_text())
        self.assertIn("svc.py:1", residuals["items"][0]["evidenceRefs"])
        extra = json.loads((self.session / "evidence" / "extra-reads.json").read_text())
        self.assertEqual(len(extra["calls"]), 1)
        self.assertEqual(extra["totalLines"], 4)

    def test_missing_residual_id_fails(self):
        run = self._run(["--residual-id", "R-999", "--path", "svc.py", "--start-line", "1", "--end-line", "2"])
        self.assertNotEqual(run.returncode, 0)
        self.assertIn("R-999", run.stderr)

    def test_path_outside_roots_fails(self):
        outsider = self.tmp / "outside.py"
        outsider.write_text("nope\n")
        run = self._run(["--residual-id", "R-001", "--path", str(outsider), "--start-line", "1", "--end-line", "1"])
        self.assertNotEqual(run.returncode, 0)
        self.assertIn("outside", run.stderr.lower() + run.stdout.lower())

    def test_span_over_max_lines_fails(self):
        run = self._run(["--residual-id", "R-001", "--path", "svc.py", "--start-line", "1", "--end-line", "5", "--max-lines", "2"])
        self.assertNotEqual(run.returncode, 0)
        self.assertIn("max-lines", run.stderr)

    def test_session_call_cap(self):
        (self.session / "evidence" / "extra-reads.json").write_text(
            json.dumps({"calls": [{"residualId": f"R-{i:03d}", "ref": "x:1", "lines": 1} for i in range(10)], "totalLines": 10})
        )
        run = self._run(["--residual-id", "R-001", "--path", "svc.py", "--start-line", "1", "--end-line", "1"])
        self.assertNotEqual(run.returncode, 0)
        self.assertIn("cap", run.stderr)

    def test_anchor_mode_matches_equivalent_exact_range(self):
        from pack import _window_for_line

        w_start, w_end = _window_for_line(50, 100, 5)  # 0-indexed
        exact = self._run(
            ["--residual-id", "R-001", "--path", "long.py", "--start-line", str(w_start + 1), "--end-line", str(w_end)]
        )
        self.assertEqual(exact.returncode, 0, exact.stderr)
        exact_packs = json.loads((self.session / "evidence" / "packs.json").read_text())

        # separate session dir for the anchor-mode call, same fixture, same expected window
        session2 = self.tmp / "session2"
        (session2 / "evidence").mkdir(parents=True)
        (session2 / "drafts" / "decisions").mkdir(parents=True)
        (session2 / "drafts" / "overrides").mkdir(parents=True)
        (session2 / "manifest.json").write_text(json.dumps({"packageRoots": [str(self.root)], "extraReadCount": 0, "extraReadLines": 0}))
        (session2 / "residuals.json").write_text(
            json.dumps({"items": [{"id": "R-001", "tier": "A", "class": "insufficient-evidence", "evidenceRefs": [], "status": "open"}]})
        )
        (session2 / "evidence" / "packs.json").write_text("{}")
        anchor = subprocess.run(
            [sys.executable, str(PACK), "fetch-span", "--session-dir", str(session2),
             "--residual-id", "R-001", "--anchor", "long.py:50", "--context-lines", "5"],
            capture_output=True, text=True,
        )
        self.assertEqual(anchor.returncode, 0, anchor.stderr)
        anchor_packs = json.loads((session2 / "evidence" / "packs.json").read_text())

        self.assertIn(f"long.py:{w_start + 1}", anchor_packs)
        self.assertEqual(anchor_packs[f"long.py:{w_start + 1}"], exact_packs[f"long.py:{w_start + 1}"])

    def test_anchor_past_eof_fails(self):
        run = self._run(["--residual-id", "R-001", "--anchor", "svc.py:999"])
        self.assertNotEqual(run.returncode, 0)
        self.assertIn("past end of file", run.stderr)

    def test_anchor_outside_roots_fails(self):
        outsider = self.tmp / "outside.py"
        outsider.write_text("nope\n")
        run = self._run(["--residual-id", "R-001", "--anchor", f"{outsider}:1"])
        self.assertNotEqual(run.returncode, 0)
        self.assertIn("outside", run.stderr.lower() + run.stdout.lower())

    def test_anchor_combined_with_start_line_rejected(self):
        run = self._run(["--residual-id", "R-001", "--anchor", "svc.py:1", "--start-line", "1", "--end-line", "2"])
        self.assertNotEqual(run.returncode, 0)
        self.assertIn("cannot be combined", run.stderr)

    def test_anchor_and_exact_share_session_caps(self):
        anchor = self._run(["--residual-id", "R-001", "--anchor", "long.py:50", "--context-lines", "5"])
        self.assertEqual(anchor.returncode, 0, anchor.stderr)
        extra = json.loads((self.session / "evidence" / "extra-reads.json").read_text())
        self.assertEqual(len(extra["calls"]), 1)
        first_total = extra["totalLines"]

        exact = self._run(["--residual-id", "R-001", "--path", "svc.py", "--start-line", "1", "--end-line", "2"])
        self.assertEqual(exact.returncode, 0, exact.stderr)
        extra = json.loads((self.session / "evidence" / "extra-reads.json").read_text())
        self.assertEqual(len(extra["calls"]), 2)
        self.assertEqual(extra["totalLines"], first_total + 2)


class TestRankAndCap(unittest.TestCase):
    def test_uncapped_keeps_order(self):
        from pack import _rank_and_cap

        items = [
            {"id": "R-001", "status": "open", "consequence": {"score": 1}},
            {"id": "R-002", "status": "open", "consequence": {"score": 9}},
        ]
        self.assertEqual([r["id"] for r in _rank_and_cap(items, None)], ["R-001", "R-002"])

    def test_cap_keeps_highest_consequence_and_carried(self):
        from pack import _rank_and_cap

        items = [
            {"id": "R-001", "status": "open", "consequence": {"score": 1}},
            {"id": "R-002", "status": "carried_forward", "consequence": {"score": 0}},
            {"id": "R-003", "status": "open", "consequence": {"score": 5}},
        ]
        out = _rank_and_cap(items, 1)
        ids = [r["id"] for r in out]
        self.assertIn("R-002", ids)
        self.assertIn("R-003", ids)
        self.assertNotIn("R-001", ids)


if __name__ == "__main__":
    unittest.main()
