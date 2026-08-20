"""Unit + real subprocess tests for bulk_apply.py (T-RT-1). All synthetic
input (S7: no sample hardcodes) — bulk_apply.py only ever reads a Session
Pack's own residuals.json/drafts/evidence, so a real run-slice scan isn't
needed to exercise it for real."""

import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

TOOLS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS_DIR))

from bulk_apply import build_replica, find_anchor_decision, find_anchor_override, select_targets  # noqa: E402


def _residual(rid, tier, cls, unit_ids, status="open"):
    return {"id": rid, "tier": tier, "class": cls, "trigger": "S2-http-without-security-control", "unitIds": unit_ids, "evidenceRefs": [], "rationale": "r", "status": status, "card": "c"}


class TestFindAnchor(unittest.TestCase):
    def test_finds_by_target_ref_match(self):
        anchor_residual = _residual("R-001", "A", "security-authority-policy", ["svc.py"])
        decisions = {"D-001": {"decision_id": "D-001", "target_ref": "svc.py", "status": "active", "final_decision": {"action": "accepted", "new_value": None}, "module": "architecture", "rationale": "r", "reviewer": "architect:x", "target_type": "node"}}
        found = find_anchor_decision(decisions, anchor_residual)
        self.assertEqual(found["decision_id"], "D-001")

    def test_refuses_when_no_decision_targets_the_anchor_unit(self):
        anchor_residual = _residual("R-001", "A", "security-authority-policy", ["svc.py"])
        with self.assertRaises(SystemExit):
            find_anchor_decision({}, anchor_residual)

    def test_refuses_ambiguous_multi_unit_anchor(self):
        anchor_residual = _residual("R-001", "A", "security-authority-policy", ["a.py", "b.py"])
        with self.assertRaises(SystemExit):
            find_anchor_decision({}, anchor_residual)

    def test_find_anchor_override_none_when_leave_open(self):
        decision = {"decision_id": "D-001"}
        self.assertIsNone(find_anchor_override({}, decision))


class TestSelectTargets(unittest.TestCase):
    def test_groups_by_same_tier_and_class_excludes_anchor(self):
        residuals_by_id = {
            "R-001": _residual("R-001", "A", "security-authority-policy", ["a.py"]),
            "R-002": _residual("R-002", "A", "security-authority-policy", ["b.py"]),
            "R-003": _residual("R-003", "A", "ontology-judgment", ["c.py"]),
        }
        targets = select_targets(residuals_by_id, "R-001", None)
        self.assertEqual([t["id"] for t in targets], ["R-002"])

    def test_excludes_carried_forward_and_applied(self):
        residuals_by_id = {
            "R-001": _residual("R-001", "A", "security-authority-policy", ["a.py"]),
            "R-002": _residual("R-002", "A", "security-authority-policy", ["b.py"], status="carried_forward"),
            "R-003": _residual("R-003", "A", "security-authority-policy", ["c.py"], status="applied"),
            "R-004": _residual("R-004", "A", "security-authority-policy", ["d.py"]),
        }
        targets = select_targets(residuals_by_id, "R-001", None)
        self.assertEqual([t["id"] for t in targets], ["R-004"])

    def test_explicit_targets_must_be_real_siblings(self):
        residuals_by_id = {
            "R-001": _residual("R-001", "A", "security-authority-policy", ["a.py"]),
            "R-003": _residual("R-003", "A", "ontology-judgment", ["c.py"]),
        }
        with self.assertRaises(SystemExit):
            select_targets(residuals_by_id, "R-001", ["R-003"])

    def test_explicit_unknown_target_id_refused(self):
        residuals_by_id = {"R-001": _residual("R-001", "A", "security-authority-policy", ["a.py"])}
        with self.assertRaises(SystemExit):
            select_targets(residuals_by_id, "R-001", ["R-999"])


class TestBuildReplica(unittest.TestCase):
    def setUp(self):
        self.anchor_decision = {
            "decision_id": "D-001",
            "module": "architecture",
            "target_type": "node",
            "target_ref": "a.py",
            "final_decision": {"action": "overridden", "new_value": "database"},
            "rationale": "PrismaService-style ORM base -> database.",
            "reviewer": "architect:x",
            "source_run_id": "run-1",
        }
        self.anchor_override = {
            "override_id": "O-001",
            "module": "architecture",
            "target_ref": "a.py",
            "override_type": "type_change",
            "new_value": "database",
            "created_by": "architect:x",
        }
        self.unit_index = {"b.py": {"kind": "service", "confidence": 40, "evidenceRefs": ["b.py:1"]}}
        self.evidence_packs = {"b.py:1": "class BService extends PrismaClient {}"}

    def test_replica_has_own_target_ref_and_own_evidence_not_anchors(self):
        target = _residual("R-002", "A", "security-authority-policy", ["b.py"])
        decision, override = build_replica(target, self.anchor_decision, self.anchor_override, "R-001", "batch1", self.unit_index, self.evidence_packs, set(), set())
        self.assertEqual(decision["target_ref"], "b.py")
        self.assertNotIn("a.py", decision.get("evidence_snapshot", []))
        self.assertIn("b.py:1: class BService extends PrismaClient {}", decision["evidence_snapshot"])
        self.assertEqual(decision["final_decision"], {"action": "overridden", "new_value": "database"})
        self.assertEqual(override["target_ref"], "b.py")
        self.assertEqual(override["decision_record_ref"], decision["decision_id"])

    def test_each_replica_gets_its_own_decision_id(self):
        t1 = _residual("R-002", "A", "security-authority-policy", ["b.py"])
        t2 = _residual("R-003", "A", "security-authority-policy", ["b.py"])
        d1, _ = build_replica(t1, self.anchor_decision, self.anchor_override, "R-001", "batch1", self.unit_index, self.evidence_packs, set(), set())
        d2, _ = build_replica(t2, self.anchor_decision, self.anchor_override, "R-001", "batch1", self.unit_index, self.evidence_packs, set(), set())
        self.assertNotEqual(d1["decision_id"], d2["decision_id"])

    def test_skips_target_with_ambiguous_unit_count(self):
        target = _residual("R-002", "A", "security-authority-policy", ["b.py", "c.py"])
        decision, override = build_replica(target, self.anchor_decision, self.anchor_override, "R-001", "batch1", self.unit_index, self.evidence_packs, set(), set())
        self.assertIsNone(decision)
        self.assertIsNone(override)

    def test_refuses_to_overwrite_existing_decision_id(self):
        target = _residual("R-002", "A", "security-authority-policy", ["b.py"])
        decision, override = build_replica(target, self.anchor_decision, self.anchor_override, "R-001", "batch1", self.unit_index, self.evidence_packs, {"D-bulk-batch1-R-002"}, set())
        self.assertIsNone(decision)

    def test_no_override_anchor_leave_open_produces_decision_only(self):
        leave_open_decision = dict(self.anchor_decision, final_decision={"action": "accepted", "new_value": None})
        target = _residual("R-002", "A", "security-authority-policy", ["b.py"])
        decision, override = build_replica(target, leave_open_decision, None, "R-001", "batch1", self.unit_index, self.evidence_packs, set(), set())
        self.assertIsNotNone(decision)
        self.assertIsNone(override)


class TestBulkApplyEndToEnd(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="bulk-apply-test-"))
        self.session_dir = self.tmp / "session"
        (self.session_dir / "drafts" / "decisions").mkdir(parents=True)
        (self.session_dir / "drafts" / "overrides").mkdir(parents=True)
        (self.session_dir / "evidence").mkdir(parents=True)

        residuals = {
            "generatedAt": "2026-08-20T00:00:00Z",
            "items": [
                _residual("R-001", "A", "security-authority-policy", ["a.py"]),
                _residual("R-002", "A", "security-authority-policy", ["b.py"]),
                _residual("R-003", "A", "security-authority-policy", ["c.py"]),
                _residual("R-004", "A", "ontology-judgment", ["d.py"]),
            ],
        }
        (self.session_dir / "residuals.json").write_text(json.dumps(residuals))
        (self.session_dir / "evidence" / "unit-index.json").write_text(json.dumps({}))
        (self.session_dir / "evidence" / "packs.json").write_text(json.dumps({}))

        decision = {
            "decision_id": "D-001",
            "module": "architecture",
            "target_type": "node",
            "target_ref": "a.py",
            "final_decision": {"action": "overridden", "new_value": "database"},
            "rationale": "Anchor answer: ORM base -> database.",
            "reviewer": "architect:test",
            "reviewed_at": "2026-08-20T00:00:00Z",
            "status": "active",
        }
        override = {
            "override_id": "O-001",
            "module": "architecture",
            "target_ref": "a.py",
            "override_type": "type_change",
            "new_value": "database",
            "decision_record_ref": "D-001",
            "status": "active",
            "created_by": "architect:test",
            "created_at": "2026-08-20T00:00:00Z",
        }
        (self.session_dir / "drafts" / "decisions" / "D-001.json").write_text(json.dumps(decision))
        (self.session_dir / "drafts" / "overrides" / "O-001.json").write_text(json.dumps(override))

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _run(self, *extra_args):
        return subprocess.run(
            [sys.executable, str(TOOLS_DIR / "bulk_apply.py"), "--session-dir", str(self.session_dir), "--anchor", "R-001", "--i-confirm-bulk-apply", *extra_args],
            capture_output=True,
            text=True,
        )

    def test_writes_one_decision_and_override_per_similar_residual(self):
        run = self._run()
        self.assertEqual(run.returncode, 0, run.stderr)
        decision_files = list((self.session_dir / "drafts" / "decisions").glob("D-bulk-*.json"))
        override_files = list((self.session_dir / "drafts" / "overrides").glob("O-bulk-*.json"))
        # R-002 and R-003 are siblings (same tier+class); R-004 is a different class, never touched.
        self.assertEqual(len(decision_files), 2, "one Decision Record per similar residual, per S9 — never one blanket record")
        self.assertEqual(len(override_files), 2)
        touched_targets = {json.loads(f.read_text())["target_ref"] for f in decision_files}
        self.assertEqual(touched_targets, {"b.py", "c.py"})

    def test_never_touches_a_different_class_residual(self):
        run = self._run()
        self.assertEqual(run.returncode, 0, run.stderr)
        for f in (self.session_dir / "drafts" / "decisions").glob("D-bulk-*.json"):
            self.assertNotEqual(json.loads(f.read_text())["target_ref"], "d.py")

    def test_lists_affected_units_before_commit(self):
        run = self._run()
        self.assertIn("affected unit id(s), listed before commit", run.stdout)
        self.assertIn("b.py", run.stdout)
        self.assertIn("c.py", run.stdout)

    def test_refuses_without_confirmation_noninteractive(self):
        run = subprocess.run(
            [sys.executable, str(TOOLS_DIR / "bulk_apply.py"), "--session-dir", str(self.session_dir), "--anchor", "R-001"],
            capture_output=True,
            text=True,
            input="",
        )
        self.assertNotEqual(run.returncode, 0)
        self.assertEqual(list((self.session_dir / "drafts" / "decisions").glob("D-bulk-*.json")), [], "must never write when not confirmed")

    def test_explicit_targets_narrows_the_batch(self):
        run = self._run("--targets", "R-002")
        self.assertEqual(run.returncode, 0, run.stderr)
        decision_files = list((self.session_dir / "drafts" / "decisions").glob("D-bulk-*.json"))
        self.assertEqual(len(decision_files), 1)
        self.assertEqual(json.loads(decision_files[0].read_text())["target_ref"], "b.py")

    def test_refuses_non_replicable_override_type(self):
        override = json.loads((self.session_dir / "drafts" / "overrides" / "O-001.json").read_text())
        override["override_type"] = "relationship_add"
        (self.session_dir / "drafts" / "overrides" / "O-001.json").write_text(json.dumps(override))
        run = self._run()
        self.assertNotEqual(run.returncode, 0)
        self.assertIn("cannot be safely recopied", run.stderr)
        self.assertEqual(list((self.session_dir / "drafts" / "decisions").glob("D-bulk-*.json")), [])


if __name__ == "__main__":
    unittest.main()
