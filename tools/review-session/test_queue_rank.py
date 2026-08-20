"""Unit + real subprocess tests for queue_rank.py (T-RT-2). Synthetic
residuals.json fixtures only (S7)."""

import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

TOOLS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS_DIR))

from queue_rank import compute_ages, rank_backlog, render_report  # noqa: E402


def _residual(rid, score, signals, status="open", trigger="t", unit_ids=None):
    return {
        "id": rid,
        "tier": "A",
        "class": "ontology-judgment",
        "trigger": trigger,
        "unitIds": unit_ids if unit_ids is not None else [f"{rid}.py"],
        "evidenceRefs": [],
        "rationale": "r",
        "status": status,
        "card": "c",
        "consequence": {"signals": signals, "score": score},
    }


class TestRankBacklog(unittest.TestCase):
    def test_sorted_highest_score_first(self):
        residuals = [_residual("R-001", 1, ["pii-proxy"]), _residual("R-002", 3, ["pii-proxy", "external-system-identity", "trust-boundary-edge"]), _residual("R-003", 0, [])]
        ranked = rank_backlog(residuals)
        self.assertEqual([r["id"] for r in ranked], ["R-002", "R-001", "R-003"])

    def test_excludes_carried_forward_and_applied(self):
        residuals = [
            _residual("R-001", 2, ["pii-proxy"]),
            _residual("R-002", 3, ["pii-proxy"], status="carried_forward"),
            _residual("R-003", 5, ["pii-proxy"], status="applied"),
        ]
        ranked = rank_backlog(residuals)
        self.assertEqual([r["id"] for r in ranked], ["R-001"])

    def test_ties_broken_by_id(self):
        residuals = [_residual("R-002", 1, ["pii-proxy"]), _residual("R-001", 1, ["pii-proxy"])]
        ranked = rank_backlog(residuals)
        self.assertEqual([r["id"] for r in ranked], ["R-001", "R-002"])

    def test_missing_consequence_field_sorts_as_zero_never_crashes(self):
        no_consequence = {"id": "R-001", "tier": "A", "class": "x", "trigger": "t", "unitIds": [], "evidenceRefs": [], "rationale": "r", "status": "open", "card": "c"}
        ranked = rank_backlog([no_consequence, _residual("R-002", 2, ["pii-proxy"])])
        self.assertEqual([r["id"] for r in ranked], ["R-002", "R-001"])


class TestComputeAges(unittest.TestCase):
    def test_finds_first_seen_in_history_pack_by_signature(self):
        backlog = [_residual("R-005", 2, ["pii-proxy"], trigger="S5-zero-service-units-with-store-present", unit_ids=["db.py"])]
        history = [{"generatedAt": "2026-08-01T00:00:00Z", "items": [{"trigger": "S5-zero-service-units-with-store-present", "unitIds": ["db.py"]}]}]
        ages = compute_ages(backlog, history)
        self.assertEqual(ages["R-005"]["first_seen"], "2026-08-01T00:00:00Z")

    def test_no_match_in_history_not_present_in_result(self):
        backlog = [_residual("R-005", 2, ["pii-proxy"], trigger="S5-zero-service-units-with-store-present", unit_ids=["db.py"])]
        history = [{"generatedAt": "2026-08-01T00:00:00Z", "items": [{"trigger": "S2-http-without-security-control", "unitIds": ["other.py"]}]}]
        ages = compute_ages(backlog, history)
        self.assertNotIn("R-005", ages)

    def test_run_level_residual_no_unit_ids_never_matched(self):
        backlog = [_residual("R-005", 0, [], trigger="S5-cfn-routes-found-but-unbound", unit_ids=[])]
        history = [{"generatedAt": "2026-08-01T00:00:00Z", "items": [{"trigger": "S5-cfn-routes-found-but-unbound", "unitIds": []}]}]
        ages = compute_ages(backlog, history)
        self.assertNotIn("R-005", ages, "a run-level residual with no unit ids has no stable signature to match on")

    def test_matches_by_shared_unit_id_even_when_trigger_drifted(self):
        """Real bug found on review: an earlier version required BOTH
        trigger and unitIds to match, which is stricter than triage.py's
        own apply_baseline() (matches by unit id alone) — a residual whose
        trigger/class changed between scans on the SAME unit (exactly the
        'reconfirm' case apply_baseline already names as real) used to
        report age as unknown even though the underlying item is still the
        same open residual."""
        backlog = [_residual("R-009", 2, ["pii-proxy"], trigger="S2-http-without-security-control", unit_ids=["svc.py"])]
        history = [{"generatedAt": "2026-08-01T00:00:00Z", "items": [{"trigger": "S5-zero-service-units-with-store-present", "unitIds": ["svc.py"]}]}]
        ages = compute_ages(backlog, history)
        self.assertEqual(ages["R-009"]["first_seen"], "2026-08-01T00:00:00Z", "must still find the age even though this run's trigger differs from the history pack's (a real reconfirm-shaped drift)")

    def test_earliest_pack_wins_when_present_in_multiple(self):
        backlog = [_residual("R-005", 2, ["pii-proxy"], trigger="S5-zero-service-units-with-store-present", unit_ids=["db.py"])]
        history = [
            {"generatedAt": "2026-08-01T00:00:00Z", "items": [{"trigger": "S5-zero-service-units-with-store-present", "unitIds": ["db.py"]}]},
            {"generatedAt": "2026-08-10T00:00:00Z", "items": [{"trigger": "S5-zero-service-units-with-store-present", "unitIds": ["db.py"]}]},
        ]
        ages = compute_ages(backlog, history)
        self.assertEqual(ages["R-005"]["first_seen"], "2026-08-01T00:00:00Z", "the OLDEST (first in the caller-ordered history list) match must win")


class TestRenderReport(unittest.TestCase):
    def test_unknown_age_reported_honestly_not_zero(self):
        backlog = [_residual("R-001", 1, ["pii-proxy"])]
        report = render_report({"generatedAt": "2026-08-20T00:00:00Z"}, backlog, {})
        self.assertIn("unknown (no --history given", report)

    def test_backlog_size_in_header(self):
        backlog = [_residual("R-001", 1, ["pii-proxy"]), _residual("R-002", 0, [])]
        report = render_report({"generatedAt": "2026-08-20T00:00:00Z"}, backlog, {})
        self.assertIn("2 open residual(s)", report)


class TestQueueRankEndToEnd(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="queue-rank-test-"))
        self.session_dir = self.tmp / "session"
        self.session_dir.mkdir(parents=True)
        residuals = {
            "generatedAt": "2026-08-20T00:00:00Z",
            "items": [
                _residual("R-001", 1, ["pii-proxy"]),
                _residual("R-002", 3, ["pii-proxy", "external-system-identity", "trust-boundary-edge"]),
                _residual("R-003", 2, ["pii-proxy"], status="carried_forward"),
            ],
        }
        (self.session_dir / "residuals.json").write_text(json.dumps(residuals))

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_json_output_ranked_and_sized(self):
        run = subprocess.run([sys.executable, str(TOOLS_DIR / "queue_rank.py"), "--session-dir", str(self.session_dir), "--json"], capture_output=True, text=True)
        self.assertEqual(run.returncode, 0, run.stderr)
        out = json.loads(run.stdout)
        self.assertEqual(out["backlogSize"], 2, "carried_forward residual is already decided, not backlog")
        self.assertEqual([i["id"] for i in out["items"]], ["R-002", "R-001"])

    def test_markdown_output_lists_highest_first(self):
        run = subprocess.run([sys.executable, str(TOOLS_DIR / "queue_rank.py"), "--session-dir", str(self.session_dir)], capture_output=True, text=True)
        self.assertEqual(run.returncode, 0, run.stderr)
        pos_002 = run.stdout.index("R-002")
        pos_001 = run.stdout.index("R-001")
        self.assertLess(pos_002, pos_001)


if __name__ == "__main__":
    unittest.main()
