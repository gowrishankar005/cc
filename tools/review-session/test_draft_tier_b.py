"""The 6-fixture fabricate-trap suite. Tests parse_and_validate_response — the
actual guardrail — against SYNTHETIC raw-response text, never a live model
call in this suite itself (T-1, AGENT_TASKS_Residual_Assist_Redesign.md,
already exercised the real `claude` CLI backend live and separately; see
draft_tier_b.py's own module docstring for the full disclosure of what's
backend-only here and what T-1 proved live).

Honest note on fixture 3 (§5.1 hard rule 3, "no prior-knowledge fill"):
whether a model's answer came from genuine training-data recall is not
something this tool — or any tool operating only on the response text —
can mechanically detect. What IS mechanically enforced, and what this
fixture actually tests, is the same real backstop as fixture 2: any
target/id the response references that isn't already in the residual's
own inputs gets rejected, regardless of how plausible or "well-known" it
looks. That's the practical, disclosed proxy for rule 3, not a claim of
literally detecting prior-knowledge use.
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from draft_tier_b import _apply_bar_not_met_outcomes, build_user_prompt, parse_and_validate_response, process_tier_b_batch

TOOLS_DIR = Path(__file__).resolve().parent

RESIDUAL = {
    "id": "R-001",
    "tier": "B",
    "class": "multi-candidate-bridge",
    "trigger": "S1-zero-service-touching-relationships",
    "unitIds": ["svc.py", "db.py"],
    "evidenceRefs": [],
    "rationale": "r",
    "status": "open",
}

GOOD_DECISION = {
    "decision_id": "D-001",
    "module": "architecture",
    "target_type": "relationship",
    "target_ref": "rel-svc-db",
    "final_decision": {"action": "added"},
    "rationale": "R-001: evidence at svc.py:10 shows a real import of db.py.",
    "reviewer": "llm-advisory:claude-sonnet-4-5",
    "reviewed_at": "2026-08-09T00:00:00Z",
    "status": "active",
    "residual_id": "R-001",
}

GOOD_RELATIONSHIP_ADD_OVERRIDE = {
    "override_id": "O-001",
    "module": "architecture",
    "target_ref": "rel-svc-db",
    "override_type": "relationship_add",
    "new_value": {"unique-id": "rel-svc-db", "description": "real import", "relationship-type": {"connects": {"source": {"node": "svc.py"}, "destination": {"node": "db.py"}}}},
    "decision_record_ref": "D-001",
    "status": "active",
    "created_by": "llm-advisory:claude-sonnet-4-5",
    "created_at": "2026-08-09T00:00:00Z",
}


class TestParseAndValidateResponse(unittest.TestCase):
    # --- Fixture 1: partial evidence -> cannot_decide (pass-through) ---
    def test_fixture1_partial_evidence_cannot_decide_passes_through(self):
        raw = json.dumps({"cannot_decide": "missing evidence: no import statement found linking svc.py to db.py"})
        result = parse_and_validate_response(raw, RESIDUAL, calm_node_ids={"svc.py", "db.py"}, calm_relationship_ids=set())
        self.assertEqual(result["outcome"], "cannot_decide")
        self.assertIn("missing evidence", result["reason"])

    # --- Fixture 2: invented node id -> rejected, never silently accepted ---
    def test_fixture2_invented_node_id_rejected(self):
        bad_override = dict(GOOD_RELATIONSHIP_ADD_OVERRIDE, new_value={"unique-id": "rel-svc-ghost", "description": "x", "relationship-type": {"connects": {"source": {"node": "svc.py"}, "destination": {"node": "db-ghost-not-in-pack"}}}}, target_ref="rel-svc-ghost")
        bad_decision = dict(GOOD_DECISION, target_ref="rel-svc-ghost")
        bad_override["decision_record_ref"] = "D-001"
        raw = json.dumps({"decision": bad_decision, "override": bad_override})
        result = parse_and_validate_response(raw, RESIDUAL, calm_node_ids={"svc.py", "db.py"}, calm_relationship_ids=set())
        self.assertEqual(result["outcome"], "invalid_response")
        self.assertIn("dangling", " ".join(result["reason"]) if isinstance(result["reason"], list) else result["reason"])

    # --- Fixture 3: "well-known" but out-of-pack target -> same rejection mechanism as fixture 2 ---
    def test_fixture3_out_of_pack_target_rejected_same_as_invented_id(self):
        """See module docstring: this is the practical, mechanical proxy for
        'no prior-knowledge fill' — a target_ref outside this residual's own
        unitIds is rejected regardless of how plausible it looks."""
        bad_decision = dict(GOOD_DECISION, target_ref="UserService")  # plausible-sounding, but not one of RESIDUAL's real unitIds
        bad_override = dict(GOOD_RELATIONSHIP_ADD_OVERRIDE, override_type="type_change", target_ref="UserService", new_value="service", decision_record_ref="D-001")
        raw = json.dumps({"decision": bad_decision, "override": bad_override})
        result = parse_and_validate_response(raw, RESIDUAL, calm_node_ids={"svc.py", "db.py"}, calm_relationship_ids=set())
        self.assertEqual(result["outcome"], "invalid_response")
        self.assertIn("not one of this residual's own unit ids", result["reason"])

    # --- Fixture 4: ambiguous candidates -> cannot_decide (pass-through) ---
    def test_fixture4_ambiguous_cannot_decide_passes_through(self):
        raw = json.dumps({"cannot_decide": "ambiguous between svc.py and db.py — both plausibly could own this relationship"})
        result = parse_and_validate_response(raw, RESIDUAL, calm_node_ids={"svc.py", "db.py"}, calm_relationship_ids=set())
        self.assertEqual(result["outcome"], "cannot_decide")
        self.assertIn("ambiguous", result["reason"])

    # --- Fixture 5 (positive): full evidence bar met, relationship_add ---
    def test_fixture5_valid_relationship_add_drafted(self):
        raw = json.dumps({"decision": GOOD_DECISION, "override": GOOD_RELATIONSHIP_ADD_OVERRIDE})
        result = parse_and_validate_response(raw, RESIDUAL, calm_node_ids={"svc.py", "db.py"}, calm_relationship_ids=set())
        self.assertEqual(result["outcome"], "drafted", result.get("reason"))
        self.assertEqual(result["override"]["override_type"], "relationship_add")

    # --- Fixture 6 (positive): valid type_change ---
    def test_fixture6_valid_type_change_drafted(self):
        decision = dict(GOOD_DECISION, target_ref="svc.py", target_type="node")
        override = {
            "override_id": "O-002",
            "module": "architecture",
            "target_ref": "svc.py",
            "override_type": "type_change",
            "new_value": "database",
            "decision_record_ref": "D-001",
            "status": "active",
            "created_by": "llm-advisory:claude-sonnet-4-5",
            "created_at": "2026-08-09T00:00:00Z",
        }
        raw = json.dumps({"decision": decision, "override": override})
        result = parse_and_validate_response(raw, RESIDUAL, calm_node_ids={"svc.py", "db.py"}, calm_relationship_ids=set())
        self.assertEqual(result["outcome"], "drafted", result.get("reason"))
        self.assertEqual(result["override"]["override_type"], "type_change")

    # --- Extra guardrail tests, beyond the 6 named fixtures ---
    def test_malformed_json_rejected(self):
        result = parse_and_validate_response("not json at all {{{", RESIDUAL, calm_node_ids=set(), calm_relationship_ids=set())
        self.assertEqual(result["outcome"], "invalid_response")

    def test_reviewer_impersonating_architect_rejected(self):
        decision = dict(GOOD_DECISION, reviewer="architect:gowri")  # hard rule 6 — must never claim to be human
        raw = json.dumps({"decision": decision, "override": GOOD_RELATIONSHIP_ADD_OVERRIDE})
        result = parse_and_validate_response(raw, RESIDUAL, calm_node_ids={"svc.py", "db.py"}, calm_relationship_ids=set())
        self.assertEqual(result["outcome"], "invalid_response")
        self.assertIn("llm-advisory", result["reason"])

    def test_architect_only_override_type_rejected(self):
        """node_remove/boundary_change/relationship_remove are architect-only
        judgment calls per design §3 Tier B table — never Tier-B-draftable."""
        override = dict(GOOD_RELATIONSHIP_ADD_OVERRIDE, override_type="node_remove")
        raw = json.dumps({"decision": GOOD_DECISION, "override": override})
        result = parse_and_validate_response(raw, RESIDUAL, calm_node_ids={"svc.py", "db.py"}, calm_relationship_ids=set())
        self.assertEqual(result["outcome"], "invalid_response")
        self.assertIn("not Tier-B-draftable", result["reason"])

    def test_decision_record_ref_mismatch_rejected(self):
        override = dict(GOOD_RELATIONSHIP_ADD_OVERRIDE, decision_record_ref="D-does-not-match")
        raw = json.dumps({"decision": GOOD_DECISION, "override": override})
        result = parse_and_validate_response(raw, RESIDUAL, calm_node_ids={"svc.py", "db.py"}, calm_relationship_ids=set())
        self.assertEqual(result["outcome"], "invalid_response")

    def test_no_calm_given_still_enforces_pack_scoped_target_check(self):
        """Even without --calm, the target_ref-must-be-in-residual's-own-unitIds
        check (fixture 3's mechanism) still applies — it doesn't depend on
        calm_node_ids being available."""
        decision = dict(GOOD_DECISION, target_ref="totally-unrelated-node")
        override = {
            "override_id": "O-003",
            "module": "architecture",
            "target_ref": "totally-unrelated-node",
            "override_type": "type_change",
            "new_value": "database",
            "decision_record_ref": "D-001",
            "status": "active",
            "created_by": "llm-advisory:x",
            "created_at": "2026-08-09T00:00:00Z",
        }
        raw = json.dumps({"decision": decision, "override": override})
        result = parse_and_validate_response(raw, RESIDUAL, calm_node_ids=None, calm_relationship_ids=None)
        self.assertEqual(result["outcome"], "invalid_response")


class TestBuildUserPrompt(unittest.TestCase):
    def test_only_relevant_unit_and_evidence_included(self):
        """Hard rule 'INPUTS you may read... and nothing else' — the prompt
        must not leak unit-index/evidence entries for units outside this
        residual's own unitIds."""
        unit_index = {
            "svc.py": {"kind": "service", "confidence": 40, "evidenceRefs": ["svc.py:10"]},
            "db.py": {"kind": "database", "confidence": 40, "evidenceRefs": ["db.py:5"]},
            "unrelated.py": {"kind": "service", "confidence": 100, "evidenceRefs": ["unrelated.py:1"]},
        }
        packs = {"svc.py:10": "import db", "db.py:5": "class Db:", "unrelated.py:1": "class Unrelated:"}
        prompt = build_user_prompt(RESIDUAL, unit_index, packs)
        self.assertIn("svc.py", prompt)
        self.assertIn("db.py", prompt)
        self.assertNotIn("unrelated.py", prompt)
        self.assertNotIn("Unrelated", prompt)


class TestCrossResidualCollision(unittest.TestCase):
    """Real bug found on review: nothing checked whether a model returned
    the same decision_id/override_id for two DIFFERENT residuals in one
    batch — the second write silently overwrote the first, same class of
    bug already found and fixed in apply.py's _merge_drafts. Confirmed
    with a failing repro before fixing (see the commit that adds this
    test)."""

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="draft-batch-test-"))
        self.decisions_dir = self.tmp / "decisions"
        self.overrides_dir = self.tmp / "overrides"
        self.decisions_dir.mkdir()
        self.overrides_dir.mkdir()

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_colliding_ids_across_residuals_second_one_refused_not_overwritten(self):
        residual1 = dict(RESIDUAL, id="R-001", unitIds=["svc.py"])
        residual2 = dict(RESIDUAL, id="R-002", unitIds=["other.py"])

        # Both "model responses" reuse the SAME decision_id/override_id —
        # a real, plausible failure mode (a model defaulting to generic ids).
        def fake_draft_fn(residual, unit_index, packs, calm_node_ids, calm_relationship_ids):
            decision = dict(GOOD_DECISION, target_ref=residual["unitIds"][0])
            override = dict(GOOD_RELATIONSHIP_ADD_OVERRIDE, override_type="type_change", target_ref=residual["unitIds"][0], new_value="database", decision_record_ref="D-001")
            return {"outcome": "drafted", "decision": decision, "override": override}

        results = process_tier_b_batch([residual1, residual2], {}, {}, {"svc.py", "other.py"}, set(), self.decisions_dir, self.overrides_dir, draft_fn=fake_draft_fn)

        outcomes = {r[0]: r[1] for r in results}
        self.assertEqual(outcomes["R-001"], "drafted")
        self.assertEqual(outcomes["R-002"], "collision")

        decision_files = list(self.decisions_dir.glob("*.json"))
        self.assertEqual(len(decision_files), 1, "only the FIRST residual's draft should be written — the second must be refused, not silently overwrite it")
        written = json.loads(decision_files[0].read_text())
        self.assertEqual(written["target_ref"], "svc.py", "the surviving file must be R-001's draft, not R-002's silently overwriting it")

    def test_non_colliding_ids_both_written(self):
        residual1 = dict(RESIDUAL, id="R-001", unitIds=["svc.py"])
        residual2 = dict(RESIDUAL, id="R-002", unitIds=["other.py"])

        counter = {"n": 0}

        def fake_draft_fn(residual, unit_index, packs, calm_node_ids, calm_relationship_ids):
            counter["n"] += 1
            decision = dict(GOOD_DECISION, decision_id=f"D-{counter['n']:03d}", target_ref=residual["unitIds"][0])
            override = dict(GOOD_RELATIONSHIP_ADD_OVERRIDE, override_id=f"O-{counter['n']:03d}", override_type="type_change", target_ref=residual["unitIds"][0], new_value="database", decision_record_ref=f"D-{counter['n']:03d}")
            return {"outcome": "drafted", "decision": decision, "override": override}

        results = process_tier_b_batch([residual1, residual2], {}, {}, {"svc.py", "other.py"}, set(), self.decisions_dir, self.overrides_dir, draft_fn=fake_draft_fn)

        self.assertTrue(all(r[1] == "drafted" for r in results))
        self.assertEqual(len(list(self.decisions_dir.glob("*.json"))), 2)
        self.assertEqual(len(list(self.overrides_dir.glob("*.json"))), 2)


class TestApplyBarNotMetOutcomes(unittest.TestCase):
    """T-2's §3 draftOutcome state (AGENT_TASKS_Residual_Dossier_Module.md):
    a Tier B residual that was actually attempted and whose evidence bar
    wasn't met must gain draftOutcome: 'bar-not-met' -- otherwise it reads
    identically to a residual that was never Tier-B-eligible at all."""

    def test_cannot_decide_outcome_gets_bar_not_met(self):
        residual = dict(RESIDUAL, id="R-001")
        tier_b_by_id = {"R-001": residual}
        results = [("R-001", "cannot_decide", "missing evidence: no import found")]
        changed = _apply_bar_not_met_outcomes(results, tier_b_by_id)
        self.assertTrue(changed)
        self.assertEqual(residual["draftOutcome"], "bar-not-met")

    def test_drafted_outcome_gets_no_draft_outcome_field(self):
        residual = dict(RESIDUAL, id="R-001")
        tier_b_by_id = {"R-001": residual}
        results = [("R-001", "drafted", "D-001 / O-001")]
        changed = _apply_bar_not_met_outcomes(results, tier_b_by_id)
        self.assertFalse(changed)
        self.assertNotIn("draftOutcome", residual)

    def test_no_key_outcome_gets_no_draft_outcome_field(self):
        """Evidence bar unmet is a different state from 'no backend was even
        available to try' -- only cannot_decide should ever mean bar-not-met."""
        residual = dict(RESIDUAL, id="R-001")
        tier_b_by_id = {"R-001": residual}
        results = [("R-001", "no_key", "no LLM backend available")]
        changed = _apply_bar_not_met_outcomes(results, tier_b_by_id)
        self.assertFalse(changed)
        self.assertNotIn("draftOutcome", residual)

    def test_returns_false_when_no_residuals_changed(self):
        tier_b_by_id = {"R-001": dict(RESIDUAL, id="R-001")}
        changed = _apply_bar_not_met_outcomes([], tier_b_by_id)
        self.assertFalse(changed)


class TestNoKeyCliPath(unittest.TestCase):
    """No real Tier B residual exists anywhere in this pipeline's real
    output (triage.py never classifies to Tier B — see draft_tier_b.py's
    own module docstring), so this synthesizes a minimal Session Pack with
    one, exactly as if a future triage.py extension produced it, to prove
    the CLI's own no-key behavior for real via subprocess."""

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="draft-tier-b-test-"))
        self.session_dir = self.tmp / "session"
        (self.session_dir / "drafts" / "decisions").mkdir(parents=True)
        (self.session_dir / "drafts" / "overrides").mkdir(parents=True)
        (self.session_dir / "evidence").mkdir(parents=True)
        residual = dict(RESIDUAL, id="R-999-synthetic")
        (self.session_dir / "residuals.json").write_text(json.dumps({"generatedAt": "x", "items": [residual]}))
        (self.session_dir / "evidence" / "unit-index.json").write_text("{}")
        (self.session_dir / "evidence" / "packs.json").write_text("{}")
        (self.session_dir / "manifest.json").write_text("{}")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_no_key_writes_nothing_and_exits_zero(self):
        env = dict(os.environ)
        env.pop("ANTHROPIC_API_KEY", None)
        # T-1 (AGENT_TASKS_Residual_Assist_Redesign.md): this test must prove
        # the "no backend at all" path, not "no API key, but a `claude` CLI
        # happens to be on this machine's PATH" -- neutralize PATH so
        # shutil.which("claude") is deterministically None regardless of the
        # environment this test happens to run in.
        env["PATH"] = ""
        run = subprocess.run([sys.executable, str(TOOLS_DIR / "draft_tier_b.py"), "--session-dir", str(self.session_dir)], capture_output=True, text=True, env=env)
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertIn("no LLM backend available", run.stdout)
        self.assertIn("R-999-synthetic", run.stdout)
        self.assertEqual(list((self.session_dir / "drafts" / "decisions").glob("*.json")), [])
        self.assertEqual(list((self.session_dir / "drafts" / "overrides").glob("*.json")), [])

    def test_no_tier_b_residuals_reports_cleanly(self):
        (self.session_dir / "residuals.json").write_text(json.dumps({"generatedAt": "x", "items": []}))
        env = dict(os.environ)
        env.pop("ANTHROPIC_API_KEY", None)
        run = subprocess.run([sys.executable, str(TOOLS_DIR / "draft_tier_b.py"), "--session-dir", str(self.session_dir)], capture_output=True, text=True, env=env)
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertIn("nothing to draft", run.stdout)


if __name__ == "__main__":
    unittest.main()
