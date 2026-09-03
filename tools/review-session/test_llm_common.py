"""Tests for llm_common.py (T-2, AGENT_TASKS_Residual_Dossier_Module.md) —
the shared evidence-assembly + network-boundary logic extracted from
advisory.py and draft_tier_b.py. No live backend call in this suite (same
convention every other test file here already uses)."""

import unittest
from unittest import mock

import llm_common
from llm_common import DEFAULT_MODEL, _strip_markdown_json_fence, build_evidence_prompt, call_llm_safe, known_evidence_refs


class TestBuildEvidencePrompt(unittest.TestCase):
    def test_only_relevant_unit_and_evidence_included(self):
        residual = {"id": "R-001", "unitIds": ["svc.py"], "evidenceRefs": ["svc.py:10"]}
        unit_index = {
            "svc.py": {"kind": "service", "confidence": 40, "evidenceRefs": ["svc.py:10"]},
            "unrelated.py": {"kind": "service", "confidence": 100, "evidenceRefs": ["unrelated.py:1"]},
        }
        packs = {"svc.py:10": "no auth decorator here", "unrelated.py:1": "class Unrelated:"}
        prompt = build_evidence_prompt(residual, unit_index, packs)
        self.assertIn("svc.py", prompt)
        self.assertNotIn("unrelated.py", prompt)
        self.assertNotIn("Unrelated", prompt)


class TestStripMarkdownJsonFence(unittest.TestCase):
    def test_bare_fence_stripped(self):
        text = '```json\n{"a": 1}\n```'
        self.assertEqual(_strip_markdown_json_fence(text), '{"a": 1}')

    def test_prose_before_fence_stripped(self):
        text = 'Here is my analysis.\n\n```json\n{"a": 1}\n```'
        self.assertEqual(_strip_markdown_json_fence(text), '{"a": 1}')

    def test_no_fence_returned_unchanged(self):
        text = '{"a": 1}'
        self.assertEqual(_strip_markdown_json_fence(text), '{"a": 1}')


class TestKnownEvidenceRefs(unittest.TestCase):
    """Real bug found on a real live pack.py --with-dossier run against the
    checked-in NestJS fixture (2026-08-23): residual.evidenceRefs is often
    EMPTY for a whole-unit trigger (S2-http-without-security-control), with
    the real evidence living on the unit's own evidenceRefs instead -- the
    same content build_evidence_prompt actually puts in the model's prompt."""

    def test_includes_residuals_own_evidence_refs(self):
        residual = {"unitIds": [], "evidenceRefs": ["a.py:1"]}
        self.assertEqual(known_evidence_refs(residual, {}), {"a.py:1"})

    def test_includes_unit_indexs_evidence_refs_for_residuals_unit_ids(self):
        residual = {"unitIds": ["svc.py"], "evidenceRefs": []}
        unit_index = {"svc.py": {"evidenceRefs": ["svc.py:10", "svc.py:20"]}}
        self.assertEqual(known_evidence_refs(residual, unit_index), {"svc.py:10", "svc.py:20"})

    def test_excludes_unrelated_units_evidence_refs(self):
        residual = {"unitIds": ["svc.py"], "evidenceRefs": []}
        unit_index = {"svc.py": {"evidenceRefs": ["svc.py:10"]}, "unrelated.py": {"evidenceRefs": ["unrelated.py:1"]}}
        self.assertEqual(known_evidence_refs(residual, unit_index), {"svc.py:10"})


class TestCallLlmSafe(unittest.TestCase):
    """Real, live-found bug (2026-09-03): _call_llm raising RuntimeError on
    a real, transient claude CLI failure (exit 1, empty stderr -- hit
    running a real ~30-residual dossier batch against a full real evidence
    set) used to propagate all the way up and crash the entire batch,
    discarding every prior successful result in the same run. call_llm_safe
    wraps this so a caller's batch loop can isolate one residual's failure
    from every other one."""

    def test_success_returns_raw_text_and_no_error(self):
        with mock.patch.object(llm_common, "_call_llm", return_value="real result text"):
            raw, error = call_llm_safe("system", "user")
        self.assertEqual(raw, "real result text")
        self.assertIsNone(error)

    def test_runtime_error_returns_none_and_the_real_reason_never_raises(self):
        with mock.patch.object(llm_common, "_call_llm", side_effect=RuntimeError("claude CLI exited 1: ")):
            raw, error = call_llm_safe("system", "user")
        self.assertIsNone(raw)
        self.assertEqual(error, "claude CLI exited 1: ")


class TestDefaultModel(unittest.TestCase):
    def test_default_model_matches_prior_hardcoded_value(self):
        """advisory.py and draft_tier_b.py used to each hardcode this same
        string independently — this pins it stays the same value now that
        both delegate to llm_common.DEFAULT_MODEL."""
        self.assertEqual(DEFAULT_MODEL, "claude-sonnet-4-5-20250929")


if __name__ == "__main__":
    unittest.main()
