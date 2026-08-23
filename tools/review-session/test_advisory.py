"""Tests for advisory.py (T-RT-4). Tests parse_and_validate_response and
process_advisory_batch -- the actual guardrails -- against SYNTHETIC raw-
response text, never a live model call (no ANTHROPIC_API_KEY in this
environment; see advisory.py's own module docstring for the honest
disclosure this shares with draft_tier_b.py)."""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from advisory import build_advisory_prompt, parse_and_validate_response, process_advisory_batch, render_advisory_report

TOOLS_DIR = Path(__file__).resolve().parent

RESIDUAL = {
    "id": "R-001",
    "tier": "A",
    "class": "security-authority-policy",
    "trigger": "S2-http-without-security-control",
    "unitIds": ["svc.py"],
    "evidenceRefs": ["svc.py:10"],
    "rationale": "r",
    "status": "open",
}

GOOD_CANDIDATE = {
    "id": "proposed-jax-rs-custom-auth",
    "language": "java",
    "framework": "jax-rs",
    "matchSignal": "CustomAuthCheck",
    "matchSource": "decorator",
    "category": "security-control",
    "weight": 20,
    "calmNodeType": "service",
    "rationale": "svc.py:10 shows a custom auth annotation the catalogue doesn't map yet.",
}


class TestParseAndValidateResponse(unittest.TestCase):
    def test_valid_advisory_with_no_candidate(self):
        raw = json.dumps({"explanation": "svc.py:10 has an HTTP route with no detected auth control.", "hypotheses": ["Auth may be enforced upstream by a gateway not visible to this scan."], "catalogue_rule_candidate": None})
        result = parse_and_validate_response(raw, RESIDUAL)
        self.assertEqual(result["outcome"], "advised", result.get("reason"))
        self.assertIsNone(result["catalogue_rule_candidate"])
        self.assertEqual(len(result["hypotheses"]), 1)

    def test_valid_advisory_with_candidate(self):
        raw = json.dumps({"explanation": "svc.py:10 uses a custom decorator this catalogue does not map.", "hypotheses": ["The decorator is a real, uncatalogued auth control."], "catalogue_rule_candidate": GOOD_CANDIDATE})
        result = parse_and_validate_response(raw, RESIDUAL)
        self.assertEqual(result["outcome"], "advised", result.get("reason"))
        self.assertEqual(result["catalogue_rule_candidate"]["id"], "proposed-jax-rs-custom-auth")

    def test_malformed_json_rejected(self):
        result = parse_and_validate_response("not json at all {{{", RESIDUAL)
        self.assertEqual(result["outcome"], "invalid_response")

    def test_response_not_an_object_rejected(self):
        result = parse_and_validate_response(json.dumps(["a", "b"]), RESIDUAL)
        self.assertEqual(result["outcome"], "invalid_response")

    # --- The core T-RT-4 hard boundary: never a fact ---
    def test_decision_key_present_rejected_outright(self):
        raw = json.dumps({"explanation": "x", "hypotheses": [], "catalogue_rule_candidate": None, "decision": {"decision_id": "D-1"}})
        result = parse_and_validate_response(raw, RESIDUAL)
        self.assertEqual(result["outcome"], "invalid_response")
        self.assertIn("never writes a fact", result["reason"])

    def test_override_key_present_rejected_outright(self):
        raw = json.dumps({"explanation": "x", "hypotheses": [], "catalogue_rule_candidate": None, "override": {"override_id": "O-1"}})
        result = parse_and_validate_response(raw, RESIDUAL)
        self.assertEqual(result["outcome"], "invalid_response")
        self.assertIn("never writes a fact", result["reason"])

    def test_missing_required_field_rejected(self):
        raw = json.dumps({"explanation": "x", "hypotheses": []})
        result = parse_and_validate_response(raw, RESIDUAL)
        self.assertEqual(result["outcome"], "invalid_response")
        self.assertIn("catalogue_rule_candidate", str(result["reason"]))

    def test_empty_explanation_rejected(self):
        raw = json.dumps({"explanation": "   ", "hypotheses": [], "catalogue_rule_candidate": None})
        result = parse_and_validate_response(raw, RESIDUAL)
        self.assertEqual(result["outcome"], "invalid_response")

    def test_non_string_hypothesis_rejected(self):
        raw = json.dumps({"explanation": "x", "hypotheses": [123], "catalogue_rule_candidate": None})
        result = parse_and_validate_response(raw, RESIDUAL)
        self.assertEqual(result["outcome"], "invalid_response")

    # --- Invented evidence ref -> rejected (prose-form hard rule 1) ---
    def test_invented_evidence_ref_in_explanation_rejected(self):
        raw = json.dumps({"explanation": "See other.py:99 for a similar case.", "hypotheses": [], "catalogue_rule_candidate": None})
        result = parse_and_validate_response(raw, RESIDUAL)
        self.assertEqual(result["outcome"], "invalid_response")
        self.assertIn("other.py:99", result["reason"])

    def test_invented_evidence_ref_in_hypothesis_rejected(self):
        raw = json.dumps({"explanation": "svc.py:10 is the only evidence.", "hypotheses": ["Compare against ghost.py:1 for confirmation."], "catalogue_rule_candidate": None})
        result = parse_and_validate_response(raw, RESIDUAL)
        self.assertEqual(result["outcome"], "invalid_response")
        self.assertIn("ghost.py:1", result["reason"])

    def test_real_evidence_ref_cited_is_fine(self):
        raw = json.dumps({"explanation": "svc.py:10 shows the route with no auth control.", "hypotheses": [], "catalogue_rule_candidate": None})
        result = parse_and_validate_response(raw, RESIDUAL)
        self.assertEqual(result["outcome"], "advised", result.get("reason"))

    # --- catalogue_rule_candidate shape validation ---
    def test_candidate_missing_field_rejected(self):
        bad = dict(GOOD_CANDIDATE)
        del bad["weight"]
        raw = json.dumps({"explanation": "x", "hypotheses": [], "catalogue_rule_candidate": bad})
        result = parse_and_validate_response(raw, RESIDUAL)
        self.assertEqual(result["outcome"], "invalid_response")
        self.assertIn("weight", str(result["reason"]))

    def test_candidate_bad_match_source_rejected(self):
        bad = dict(GOOD_CANDIDATE, matchSource="prior-knowledge")
        raw = json.dumps({"explanation": "x", "hypotheses": [], "catalogue_rule_candidate": bad})
        result = parse_and_validate_response(raw, RESIDUAL)
        self.assertEqual(result["outcome"], "invalid_response")

    def test_candidate_bad_category_rejected(self):
        bad = dict(GOOD_CANDIDATE, category="not-a-real-category")
        raw = json.dumps({"explanation": "x", "hypotheses": [], "catalogue_rule_candidate": bad})
        result = parse_and_validate_response(raw, RESIDUAL)
        self.assertEqual(result["outcome"], "invalid_response")

    def test_candidate_bad_calm_node_type_rejected(self):
        bad = dict(GOOD_CANDIDATE, calmNodeType="external-system")
        raw = json.dumps({"explanation": "x", "hypotheses": [], "catalogue_rule_candidate": bad})
        result = parse_and_validate_response(raw, RESIDUAL)
        self.assertEqual(result["outcome"], "invalid_response")

    def test_candidate_weight_out_of_range_rejected(self):
        bad = dict(GOOD_CANDIDATE, weight=100)
        raw = json.dumps({"explanation": "x", "hypotheses": [], "catalogue_rule_candidate": bad})
        result = parse_and_validate_response(raw, RESIDUAL)
        self.assertEqual(result["outcome"], "invalid_response")

    def test_invented_evidence_ref_in_candidate_rationale_rejected(self):
        """Hard rule 1 must also cover catalogue_rule_candidate.rationale --
        it's LLM-generated free text same as explanation/hypotheses, and was
        found NOT covered by the evidence-ref scan on first review."""
        bad = dict(GOOD_CANDIDATE, rationale="See other.py:42 for a matching case.")
        raw = json.dumps({"explanation": "svc.py:10 is the only real evidence.", "hypotheses": [], "catalogue_rule_candidate": bad})
        result = parse_and_validate_response(raw, RESIDUAL)
        self.assertEqual(result["outcome"], "invalid_response")
        self.assertIn("other.py:42", result["reason"])


class TestBuildAdvisoryPrompt(unittest.TestCase):
    def test_only_relevant_unit_and_evidence_included(self):
        unit_index = {
            "svc.py": {"kind": "service", "confidence": 40, "evidenceRefs": ["svc.py:10"]},
            "unrelated.py": {"kind": "service", "confidence": 100, "evidenceRefs": ["unrelated.py:1"]},
        }
        packs = {"svc.py:10": "no auth decorator here", "unrelated.py:1": "class Unrelated:"}
        prompt = build_advisory_prompt(RESIDUAL, unit_index, packs)
        self.assertIn("svc.py", prompt)
        self.assertNotIn("unrelated.py", prompt)
        self.assertNotIn("Unrelated", prompt)


class TestProcessAdvisoryBatch(unittest.TestCase):
    def test_advisory_attached_never_mutates_input_dict(self):
        def fake_advise_fn(residual, unit_index, packs, api_key):
            return {"outcome": "advised", "explanation": "e", "hypotheses": ["h"], "catalogue_rule_candidate": None}

        updated, episodes, candidates = process_advisory_batch([RESIDUAL], {}, {}, "fake-key", advise_fn=fake_advise_fn, now_fn=lambda: "2026-08-20T00:00:00Z", id_fn=lambda: "AE-1")
        self.assertNotIn("advisory", RESIDUAL, "the input residual dict must never be mutated in place")
        self.assertIn("advisory", updated[0])
        self.assertEqual(updated[0]["advisory"]["explanation"], "e")
        self.assertEqual(len(episodes), 1)
        self.assertEqual(episodes[0]["outcome"], "advised")
        self.assertEqual(episodes[0]["model"], "claude-sonnet-4-5-20250929")
        self.assertEqual(candidates, [])

    def test_candidate_appended_with_episode_metadata(self):
        def fake_advise_fn(residual, unit_index, packs, api_key):
            return {"outcome": "advised", "explanation": "e", "hypotheses": [], "catalogue_rule_candidate": GOOD_CANDIDATE}

        updated, episodes, candidates = process_advisory_batch([RESIDUAL], {}, {}, "fake-key", advise_fn=fake_advise_fn, now_fn=lambda: "2026-08-20T00:00:00Z", id_fn=lambda: "AE-1")
        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0]["status"], "proposed")
        self.assertEqual(candidates[0]["sourceResidualId"], "R-001")
        self.assertEqual(candidates[0]["proposedAt"], "2026-08-20T00:00:00Z")
        self.assertTrue(updated[0]["advisory"]["hasCatalogueRuleCandidate"])

    def test_duplicate_candidate_id_within_batch_refused_not_overwritten(self):
        residual2 = dict(RESIDUAL, id="R-002")

        def fake_advise_fn(residual, unit_index, packs, api_key):
            return {"outcome": "advised", "explanation": "e", "hypotheses": [], "catalogue_rule_candidate": GOOD_CANDIDATE}

        updated, episodes, candidates = process_advisory_batch([RESIDUAL, residual2], {}, {}, "fake-key", advise_fn=fake_advise_fn, now_fn=lambda: "2026-08-20T00:00:00Z", id_fn=lambda: "AE-1")
        self.assertEqual(len(candidates), 1, "only the FIRST residual's candidate should be written -- the second must be refused, not silently overwrite it")
        outcomes = {e["residualId"]: e["outcome"] for e in episodes}
        self.assertEqual(outcomes["R-001"], "advised")
        self.assertEqual(outcomes["R-002"], "candidate_id_collision")

    def test_no_key_outcome_logged_not_treated_as_advised(self):
        def fake_advise_fn(residual, unit_index, packs, api_key):
            return {"outcome": "no_key", "reason": "no ANTHROPIC_API_KEY set -- nothing advised"}

        updated, episodes, candidates = process_advisory_batch([RESIDUAL], {}, {}, None, advise_fn=fake_advise_fn, now_fn=lambda: "2026-08-20T00:00:00Z", id_fn=lambda: "AE-1")
        self.assertNotIn("advisory", updated[0])
        self.assertEqual(episodes[0]["outcome"], "no_key")
        self.assertEqual(candidates, [])

    def test_invalid_response_outcome_never_attaches_advisory(self):
        def fake_advise_fn(residual, unit_index, packs, api_key):
            return {"outcome": "invalid_response", "reason": "malformed"}

        updated, episodes, candidates = process_advisory_batch([RESIDUAL], {}, {}, "fake-key", advise_fn=fake_advise_fn, now_fn=lambda: "2026-08-20T00:00:00Z", id_fn=lambda: "AE-1")
        self.assertNotIn("advisory", updated[0])
        self.assertEqual(episodes[0]["outcome"], "invalid_response")


class TestRenderAdvisoryReport(unittest.TestCase):
    def test_no_advised_residuals_says_so(self):
        report = render_advisory_report([RESIDUAL])
        self.assertIn("No residual in this pack has been advised on yet", report)

    def test_advised_residual_renders_explanation_and_hypotheses(self):
        advised = dict(RESIDUAL, advisory={"explanation": "svc.py:10 has no detected auth control.", "hypotheses": ["Auth may be enforced upstream."], "hasCatalogueRuleCandidate": False, "model": "claude-sonnet-4-5-20250929", "generatedAt": "2026-08-20T00:00:00Z"})
        report = render_advisory_report([advised])
        self.assertIn("R-001", report)
        self.assertIn("svc.py:10 has no detected auth control.", report)
        self.assertIn("Auth may be enforced upstream.", report)
        self.assertIn("claude-sonnet-4-5-20250929", report)

    def test_never_renders_as_a_decision(self):
        """The report's own framing must never read as authoritative --
        the whole point of T-RT-4's 'never writes a fact' boundary would
        be undermined by a report that LOOKS like one."""
        advised = dict(RESIDUAL, advisory={"explanation": "e", "hypotheses": ["h"], "hasCatalogueRuleCandidate": False, "model": "m", "generatedAt": "t"})
        report = render_advisory_report([advised])
        self.assertIn("Advisory only", report)
        self.assertIn("never a decision", report)

    def test_catalogue_rule_candidate_flag_points_at_the_real_file(self):
        advised = dict(RESIDUAL, advisory={"explanation": "e", "hypotheses": [], "hasCatalogueRuleCandidate": True, "model": "m", "generatedAt": "t"})
        report = render_advisory_report([advised])
        self.assertIn("catalogue-rule-candidates.json", report)
        self.assertIn("never auto-merged", report)

    def test_non_advised_residuals_skipped(self):
        report = render_advisory_report([RESIDUAL, dict(RESIDUAL, id="R-002")])
        self.assertIn("No residual in this pack has been advised on yet", report)
        self.assertNotIn("R-002", report)


class TestNoKeyCliPath(unittest.TestCase):
    """Real subprocess end-to-end run against a synthetic Session Pack,
    proving the CLI's own no-key behavior for real (same convention
    test_draft_tier_b.py's own TestNoKeyCliPath already established)."""

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="advisory-test-"))
        self.session_dir = self.tmp / "session"
        (self.session_dir / "evidence").mkdir(parents=True)
        residual = dict(RESIDUAL, id="R-999-synthetic")
        (self.session_dir / "residuals.json").write_text(json.dumps({"generatedAt": "x", "items": [residual]}))
        (self.session_dir / "evidence" / "unit-index.json").write_text("{}")
        (self.session_dir / "evidence" / "packs.json").write_text("{}")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_no_key_writes_nothing_and_exits_zero(self):
        env = dict(os.environ)
        env.pop("ANTHROPIC_API_KEY", None)
        # T-1 (AGENT_TASKS_Residual_Assist_Redesign.md): neutralize PATH so
        # this proves "no backend at all," not "no API key, but `claude`
        # happens to be on this machine's PATH" -- deterministic regardless
        # of the environment this test runs in.
        env["PATH"] = ""
        run = subprocess.run([sys.executable, str(TOOLS_DIR / "advisory.py"), "--session-dir", str(self.session_dir)], capture_output=True, text=True, env=env)
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertIn("no LLM backend available", run.stdout)
        self.assertIn("R-999-synthetic", run.stdout)
        residuals_after = json.loads((self.session_dir / "residuals.json").read_text())
        self.assertNotIn("advisory", residuals_after["items"][0], "no-key path must never attach advisory")
        self.assertFalse((self.session_dir / "advisory").exists(), "no-key path must never create the advisory/ dir")

    def test_no_open_residuals_reports_cleanly(self):
        (self.session_dir / "residuals.json").write_text(json.dumps({"generatedAt": "x", "items": [dict(RESIDUAL, id="R-carried", status="carried_forward")]}))
        env = dict(os.environ)
        env.pop("ANTHROPIC_API_KEY", None)
        run = subprocess.run([sys.executable, str(TOOLS_DIR / "advisory.py"), "--session-dir", str(self.session_dir)], capture_output=True, text=True, env=env)
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertIn("nothing to do", run.stdout)

    def test_residual_filter_scopes_to_named_ids_only(self):
        residual2 = dict(RESIDUAL, id="R-998-other")
        (self.session_dir / "residuals.json").write_text(json.dumps({"generatedAt": "x", "items": [dict(RESIDUAL, id="R-999-synthetic"), residual2]}))
        env = dict(os.environ)
        env.pop("ANTHROPIC_API_KEY", None)
        # This test is about --residual filtering reaching the no-key path
        # for the right id, not about exercising a live backend -- strip
        # PATH so it stays deterministic regardless of what's installed
        # on the machine running it (T-1, same reasoning as the no-key test
        # above).
        env["PATH"] = ""
        run = subprocess.run([sys.executable, str(TOOLS_DIR / "advisory.py"), "--session-dir", str(self.session_dir), "--residual", "R-999-synthetic"], capture_output=True, text=True, env=env)
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertIn("R-999-synthetic", run.stdout)
        self.assertNotIn("R-998-other", run.stdout)


if __name__ == "__main__":
    unittest.main()
