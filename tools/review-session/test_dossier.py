"""Tests for dossier.py (T-2, AGENT_TASKS_Residual_Dossier_Module.md).
Tests parse_and_validate_dossier_response and process_dossier_batch — the
actual guardrails — against SYNTHETIC raw-response text, never a live model
call in this suite itself (same convention test_advisory.py / test_draft_tier_b.py
already established)."""

import json
import unittest
from unittest import mock

import dossier
from dossier import build_dossier_prompt, dossier_for_residual, parse_and_validate_dossier_response, process_dossier_batch

TIER_A_RESIDUAL = {
    "id": "R-001",
    "tier": "A",
    "class": "security-authority-policy",
    "trigger": "S2-http-without-security-control",
    "unitIds": ["svc.py"],
    "evidenceRefs": ["svc.py:10"],
    "rationale": "r",
    "status": "open",
}

TIER_B_RESIDUAL = {
    "id": "R-002",
    "tier": "B",
    "class": "multi-candidate-bridge",
    "trigger": "multi-hop-single-candidate-below-threshold",
    "unitIds": ["svc.py", "db.py"],
    "evidenceRefs": ["svc.py:10", "db.py:5"],
    "rationale": "r",
    "status": "open",
}

TIER_C_RESIDUAL = {
    "id": "R-003",
    "tier": "C",
    "class": "missing-intermediates-not-in-scan",
    "trigger": "S5-cfn-routes-found-but-unbound",
    "unitIds": [],
    "evidenceRefs": ["routes.yml:1"],
    "rationale": "r",
    "status": "open",
}


class TestParseAndValidateDossierResponse(unittest.TestCase):
    def test_valid_dossier_tier_a(self):
        raw = json.dumps({"explanation": "svc.py:10 has an HTTP route with no detected auth control.", "hypotheses": ["Auth may be enforced upstream."], "evidenceRefsUsed": ["svc.py:10"]})
        result = parse_and_validate_dossier_response(raw, TIER_A_RESIDUAL)
        self.assertEqual(result["outcome"], "dossiered", result.get("reason"))
        self.assertEqual(result["evidenceRefsUsed"], ["svc.py:10"])

    def test_valid_dossier_tier_b(self):
        raw = json.dumps({"explanation": "svc.py:10 imports db.py:5 directly.", "hypotheses": ["This is a real persistence edge."], "evidenceRefsUsed": ["svc.py:10", "db.py:5"]})
        result = parse_and_validate_dossier_response(raw, TIER_B_RESIDUAL)
        self.assertEqual(result["outcome"], "dossiered", result.get("reason"))
        self.assertEqual(set(result["evidenceRefsUsed"]), {"svc.py:10", "db.py:5"})

    def test_valid_dossier_tier_c(self):
        raw = json.dumps({"explanation": "routes.yml:1 references a route with no matching handler in this scan.", "hypotheses": ["The handler may live in a package outside this scan's roots."], "evidenceRefsUsed": ["routes.yml:1"]})
        result = parse_and_validate_dossier_response(raw, TIER_C_RESIDUAL)
        self.assertEqual(result["outcome"], "dossiered", result.get("reason"))

    def test_malformed_json_rejected(self):
        result = parse_and_validate_dossier_response("not json at all {{{", TIER_A_RESIDUAL)
        self.assertEqual(result["outcome"], "invalid_response")

    def test_decision_key_present_rejected_outright(self):
        raw = json.dumps({"explanation": "x", "hypotheses": [], "evidenceRefsUsed": [], "decision": {"decision_id": "D-1"}})
        result = parse_and_validate_dossier_response(raw, TIER_A_RESIDUAL)
        self.assertEqual(result["outcome"], "invalid_response")
        self.assertIn("never writes a fact", result["reason"])

    def test_override_key_present_rejected_outright(self):
        raw = json.dumps({"explanation": "x", "hypotheses": [], "evidenceRefsUsed": [], "override": {"override_id": "O-1"}})
        result = parse_and_validate_dossier_response(raw, TIER_A_RESIDUAL)
        self.assertEqual(result["outcome"], "invalid_response")
        self.assertIn("never writes a fact", result["reason"])

    def test_missing_required_field_rejected(self):
        raw = json.dumps({"explanation": "x", "hypotheses": []})
        result = parse_and_validate_dossier_response(raw, TIER_A_RESIDUAL)
        self.assertEqual(result["outcome"], "invalid_response")
        self.assertIn("evidenceRefsUsed", str(result["reason"]))

    def test_invented_evidence_ref_in_evidence_refs_used_rejected(self):
        raw = json.dumps({"explanation": "svc.py:10 is the only evidence.", "hypotheses": [], "evidenceRefsUsed": ["ghost.py:1"]})
        result = parse_and_validate_dossier_response(raw, TIER_A_RESIDUAL)
        self.assertEqual(result["outcome"], "invalid_response")
        self.assertIn("ghost.py:1", result["reason"])

    def test_invented_evidence_ref_in_explanation_rejected(self):
        raw = json.dumps({"explanation": "See other.py:99 for a similar case.", "hypotheses": [], "evidenceRefsUsed": []})
        result = parse_and_validate_dossier_response(raw, TIER_A_RESIDUAL)
        self.assertEqual(result["outcome"], "invalid_response")
        self.assertIn("other.py:99", result["reason"])

    def test_invented_evidence_ref_in_hypothesis_rejected(self):
        raw = json.dumps({"explanation": "svc.py:10 is the only evidence.", "hypotheses": ["Compare against ghost.py:1."], "evidenceRefsUsed": []})
        result = parse_and_validate_dossier_response(raw, TIER_A_RESIDUAL)
        self.assertEqual(result["outcome"], "invalid_response")
        self.assertIn("ghost.py:1", result["reason"])

    def test_non_string_hypothesis_rejected(self):
        raw = json.dumps({"explanation": "x", "hypotheses": [123], "evidenceRefsUsed": []})
        result = parse_and_validate_dossier_response(raw, TIER_A_RESIDUAL)
        self.assertEqual(result["outcome"], "invalid_response")

    def test_non_string_evidence_ref_used_rejected(self):
        raw = json.dumps({"explanation": "x", "hypotheses": [], "evidenceRefsUsed": [123]})
        result = parse_and_validate_dossier_response(raw, TIER_A_RESIDUAL)
        self.assertEqual(result["outcome"], "invalid_response")

    # --- Real bug found on a real live run (2026-08-23): residual.evidenceRefs
    # is often EMPTY for a whole-unit trigger, with the real evidence living
    # on the unit's own evidenceRefs (unit_index) instead. A response citing
    # exactly what was in its own prompt must not be rejected. ---
    def test_ref_only_on_unit_index_not_residual_evidence_refs_is_accepted(self):
        residual_with_empty_refs = dict(TIER_A_RESIDUAL, evidenceRefs=[])
        unit_index = {"svc.py": {"kind": "service", "confidence": 100, "evidenceRefs": ["svc.py:10"]}}
        raw = json.dumps({"explanation": "svc.py:10 has an HTTP route with no detected auth control.", "hypotheses": [], "evidenceRefsUsed": ["svc.py:10"]})
        result = parse_and_validate_dossier_response(raw, residual_with_empty_refs, unit_index)
        self.assertEqual(result["outcome"], "dossiered", result.get("reason"))

    def test_ref_on_neither_residual_nor_unit_index_still_rejected(self):
        residual_with_empty_refs = dict(TIER_A_RESIDUAL, evidenceRefs=[])
        unit_index = {"svc.py": {"kind": "service", "confidence": 100, "evidenceRefs": ["svc.py:10"]}}
        raw = json.dumps({"explanation": "svc.py:10 is the evidence.", "hypotheses": [], "evidenceRefsUsed": ["ghost.py:1"]})
        result = parse_and_validate_dossier_response(raw, residual_with_empty_refs, unit_index)
        self.assertEqual(result["outcome"], "invalid_response")
        self.assertIn("ghost.py:1", result["reason"])


class TestBuildDossierPrompt(unittest.TestCase):
    def test_only_relevant_unit_and_evidence_included(self):
        unit_index = {
            "svc.py": {"kind": "service", "confidence": 40, "evidenceRefs": ["svc.py:10"]},
            "unrelated.py": {"kind": "service", "confidence": 100, "evidenceRefs": ["unrelated.py:1"]},
        }
        packs = {"svc.py:10": "no auth decorator here", "unrelated.py:1": "class Unrelated:"}
        prompt = build_dossier_prompt(TIER_A_RESIDUAL, unit_index, packs)
        self.assertIn("svc.py", prompt)
        self.assertNotIn("unrelated.py", prompt)


class TestProcessDossierBatch(unittest.TestCase):
    def test_dossier_attached_for_tier_a_b_and_c_alike(self):
        def fake_dossier_fn(residual, unit_index, packs):
            return {"outcome": "dossiered", "explanation": "e", "hypotheses": ["h"], "evidenceRefsUsed": list(residual.get("evidenceRefs", []))}

        updated, episodes = process_dossier_batch(
            [TIER_A_RESIDUAL, TIER_B_RESIDUAL, TIER_C_RESIDUAL], {}, {}, dossier_fn=fake_dossier_fn, now_fn=lambda: "2026-08-23T00:00:00Z"
        )
        self.assertEqual(len(updated), 3)
        for r in updated:
            self.assertIn("dossier", r)
            self.assertEqual(r["dossier"]["explanation"], "e")
        self.assertEqual(len(episodes), 3)
        self.assertTrue(all(e["outcome"] == "dossiered" for e in episodes))

    def test_input_residuals_never_mutated_in_place(self):
        def fake_dossier_fn(residual, unit_index, packs):
            return {"outcome": "dossiered", "explanation": "e", "hypotheses": [], "evidenceRefsUsed": []}

        process_dossier_batch([TIER_A_RESIDUAL], {}, {}, dossier_fn=fake_dossier_fn, now_fn=lambda: "t")
        self.assertNotIn("dossier", TIER_A_RESIDUAL)

    def test_no_key_outcome_logged_not_treated_as_dossiered(self):
        def fake_dossier_fn(residual, unit_index, packs):
            return {"outcome": "no_key", "reason": "no LLM backend available -- nothing dossiered"}

        updated, episodes = process_dossier_batch([TIER_A_RESIDUAL], {}, {}, dossier_fn=fake_dossier_fn, now_fn=lambda: "t")
        self.assertNotIn("dossier", updated[0])
        self.assertEqual(episodes[0]["outcome"], "no_key")

    def test_invalid_response_outcome_never_attaches_dossier(self):
        def fake_dossier_fn(residual, unit_index, packs):
            return {"outcome": "invalid_response", "reason": "malformed"}

        updated, episodes = process_dossier_batch([TIER_A_RESIDUAL], {}, {}, dossier_fn=fake_dossier_fn, now_fn=lambda: "t")
        self.assertNotIn("dossier", updated[0])
        self.assertEqual(episodes[0]["outcome"], "invalid_response")


class TestS2AuthJudgmentAddendum(unittest.TestCase):
    """Priority #4 of the 2026-09-02 LLM-assist candidate batch
    (BACKLOG.md's 'Call-site security-control dossier for uncatalogued auth
    patterns' row) -- a trigger-specific system-prompt steer, not a new
    mechanism. Must engage ONLY for S2-http-without-security-control, never
    leak into any other trigger's prompt."""

    def test_s2_residual_gets_addendum_appended_to_system_prompt(self):
        raw = json.dumps({"explanation": "e", "hypotheses": [], "evidenceRefsUsed": []})
        with mock.patch.object(dossier, "_llm_backend_available", return_value=True), mock.patch.object(dossier, "_call_llm", return_value=raw) as mock_call:
            dossier_for_residual(TIER_A_RESIDUAL, {}, {})
        system_prompt_used = mock_call.call_args[0][0]
        self.assertIn(dossier.S2_AUTH_JUDGMENT_ADDENDUM, system_prompt_used)
        self.assertIn(dossier.DOSSIER_SYSTEM_PROMPT, system_prompt_used)

    def test_non_s2_residual_does_not_get_addendum(self):
        raw = json.dumps({"explanation": "e", "hypotheses": [], "evidenceRefsUsed": []})
        with mock.patch.object(dossier, "_llm_backend_available", return_value=True), mock.patch.object(dossier, "_call_llm", return_value=raw) as mock_call:
            dossier_for_residual(TIER_B_RESIDUAL, {}, {})
        system_prompt_used = mock_call.call_args[0][0]
        self.assertNotIn(dossier.S2_AUTH_JUDGMENT_ADDENDUM, system_prompt_used)
        self.assertEqual(system_prompt_used, dossier.DOSSIER_SYSTEM_PROMPT)


TIER_A_S3_RESIDUAL = {
    "id": "R-004",
    "tier": "A",
    "class": "messaging-producer-unverified",
    "trigger": "S3-messaging-producer-unverified",
    "unitIds": ["KafkaExternalEventProducer.java"],
    "evidenceRefs": ["KafkaExternalEventProducer.java:48"],
    "rationale": "r",
    "status": "open",
}


class TestS3MessagingProducerAddendum(unittest.TestCase):
    """BACKLOG.md 'Messaging-producer usage verification', priority #5 of
    the 2026-09-02 LLM-assist candidate batch -- a trigger-specific
    system-prompt steer, not a new mechanism, same shape as the S2
    addendum above. Must engage ONLY for S3-messaging-producer-unverified,
    never leak into any other trigger's prompt (including S2's own)."""

    def test_s3_residual_gets_addendum_appended_to_system_prompt(self):
        raw = json.dumps({"explanation": "e", "hypotheses": [], "evidenceRefsUsed": []})
        with mock.patch.object(dossier, "_llm_backend_available", return_value=True), mock.patch.object(dossier, "_call_llm", return_value=raw) as mock_call:
            dossier_for_residual(TIER_A_S3_RESIDUAL, {}, {})
        system_prompt_used = mock_call.call_args[0][0]
        self.assertIn(dossier.S3_MESSAGING_PRODUCER_ADDENDUM, system_prompt_used)
        self.assertIn(dossier.DOSSIER_SYSTEM_PROMPT, system_prompt_used)
        self.assertNotIn(dossier.S2_AUTH_JUDGMENT_ADDENDUM, system_prompt_used, "S2's own addendum must never leak into an S3 residual's prompt")

    def test_s2_residual_does_not_get_s3_addendum(self):
        raw = json.dumps({"explanation": "e", "hypotheses": [], "evidenceRefsUsed": []})
        with mock.patch.object(dossier, "_llm_backend_available", return_value=True), mock.patch.object(dossier, "_call_llm", return_value=raw) as mock_call:
            dossier_for_residual(TIER_A_RESIDUAL, {}, {})
        system_prompt_used = mock_call.call_args[0][0]
        self.assertNotIn(dossier.S3_MESSAGING_PRODUCER_ADDENDUM, system_prompt_used)


if __name__ == "__main__":
    unittest.main()
