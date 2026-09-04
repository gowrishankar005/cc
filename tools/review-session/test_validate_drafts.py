"""Exit criteria: good fixture passes; bad fixtures fail with clear
reasons. Mirrors override-applier.ts's own real validation semantics —
these fixtures are synthetic (S7: no sample hardcodes), not copied from a
real repo."""

import unittest

from validate_drafts import validate, load_decisions_by_id, summarize_by_trigger

GOOD_DECISION = {
    "decision_id": "D-001",
    "module": "architecture",
    "target_type": "node",
    "target_ref": "svc-orders",
    "final_decision": {"action": "added"},
    "rationale": "Real HTTP entry point confirmed via source read-back.",
    "reviewer": "architect:gowri",
    "reviewed_at": "2026-08-09T00:00:00Z",
    "status": "active",
    "residual_id": "R-001",
}

GOOD_NODE_ADD_OVERRIDE = {
    "override_id": "O-001",
    "module": "architecture",
    "target_ref": "svc-orders",
    "override_type": "node_add",
    "new_value": {"unique-id": "svc-orders", "node-type": "service", "name": "OrdersService", "description": "Real orders service."},
    "decision_record_ref": "D-001",
    "status": "active",
    "created_by": "architect:gowri",
    "created_at": "2026-08-09T00:00:00Z",
}


class TestValidateDrafts(unittest.TestCase):
    def test_good_fixture_passes(self):
        report = validate({"D-001": GOOD_DECISION}, [GOOD_NODE_ADD_OVERRIDE], calm_node_ids=set())
        self.assertTrue(report.valid, f"expected valid, got errors: {report.errors}")
        self.assertEqual(report.errors, [])

    def test_missing_required_decision_field_fails(self):
        bad_decision = dict(GOOD_DECISION)
        del bad_decision["rationale"]
        report = validate({"D-001": bad_decision}, [GOOD_NODE_ADD_OVERRIDE], calm_node_ids=set())
        self.assertFalse(report.valid)
        self.assertTrue(any("rationale" in e for e in report.errors), report.errors)

    def test_dangling_decision_record_ref_fails(self):
        override = dict(GOOD_NODE_ADD_OVERRIDE)
        override["decision_record_ref"] = "D-999-does-not-exist"
        report = validate({"D-001": GOOD_DECISION}, [override], calm_node_ids=set())
        self.assertFalse(report.valid)
        self.assertTrue(any("does not resolve" in e for e in report.errors), report.errors)

    def test_superseded_decision_rejected(self):
        superseded = dict(GOOD_DECISION, status="superseded")
        report = validate({"D-001": superseded}, [GOOD_NODE_ADD_OVERRIDE], calm_node_ids=set())
        self.assertFalse(report.valid)
        self.assertTrue(any("not 'active'" in e for e in report.errors), report.errors)

    def test_unknown_override_type_fails(self):
        override = dict(GOOD_NODE_ADD_OVERRIDE, override_type="delete_everything")
        report = validate({"D-001": GOOD_DECISION}, [override], calm_node_ids=set())
        self.assertFalse(report.valid)
        self.assertTrue(any("not one of" in e for e in report.errors), report.errors)

    def test_boundary_change_is_warning_not_error(self):
        override = dict(GOOD_NODE_ADD_OVERRIDE, override_type="boundary_change", target_ref="svc-orders", new_value=None)
        report = validate({"D-001": GOOD_DECISION}, [override], calm_node_ids=set())
        self.assertTrue(report.valid, "boundary_change is recognized-but-not-implemented, must not be a hard error")
        self.assertTrue(any("not yet implemented" in w for w in report.warnings), report.warnings)

    def test_type_change_orphan_fails(self):
        decision = dict(GOOD_DECISION, target_type="node")
        override = {
            "override_id": "O-002",
            "module": "architecture",
            "target_ref": "svc-does-not-exist",
            "override_type": "type_change",
            "new_value": "database",
            "decision_record_ref": "D-001",
            "status": "active",
            "created_by": "architect:gowri",
            "created_at": "2026-08-09T00:00:00Z",
        }
        report = validate({"D-001": decision}, [override], calm_node_ids={"svc-orders"})  # real CALM given, target not in it
        self.assertFalse(report.valid)
        self.assertTrue(any("orphan" in e for e in report.errors), report.errors)

    def test_type_change_on_real_existing_node_passes(self):
        override = {
            "override_id": "O-002",
            "module": "architecture",
            "target_ref": "svc-orders",
            "override_type": "type_change",
            "new_value": "database",
            "decision_record_ref": "D-001",
            "status": "active",
            "created_by": "architect:gowri",
            "created_at": "2026-08-09T00:00:00Z",
        }
        report = validate({"D-001": GOOD_DECISION}, [override], calm_node_ids={"svc-orders"})
        self.assertTrue(report.valid, report.errors)

    def test_relationship_add_dangling_endpoint_fails(self):
        rel_override = {
            "override_id": "O-003",
            "module": "architecture",
            "target_ref": "rel-svc-db",
            "override_type": "relationship_add",
            "new_value": {
                "unique-id": "rel-svc-db",
                "description": "real connects edge",
                "relationship-type": {"connects": {"source": {"node": "svc-orders"}, "destination": {"node": "db-ghost-does-not-exist"}}},
            },
            "decision_record_ref": "D-001",
            "status": "active",
            "created_by": "architect:gowri",
            "created_at": "2026-08-09T00:00:00Z",
        }
        report = validate({"D-001": GOOD_DECISION}, [rel_override], calm_node_ids={"svc-orders"})
        self.assertFalse(report.valid)
        self.assertTrue(any("dangling endpoint" in e for e in report.errors), report.errors)

    def test_relationship_add_endpoint_added_in_same_batch_passes(self):
        """Design §6's own explicit exception: an endpoint node_add'd in the
        SAME draft batch counts as existing, even though it's not in CALM yet."""
        node_add = dict(GOOD_NODE_ADD_OVERRIDE, target_ref="db-orders", new_value={"unique-id": "db-orders", "node-type": "database", "name": "OrdersDb", "description": "real db"})
        node_add["override_id"] = "O-004"
        rel_override = {
            "override_id": "O-005",
            "module": "architecture",
            "target_ref": "rel-svc-db",
            "override_type": "relationship_add",
            "new_value": {
                "unique-id": "rel-svc-db",
                "description": "real connects edge",
                "relationship-type": {"connects": {"source": {"node": "svc-orders"}, "destination": {"node": "db-orders"}}},
            },
            "decision_record_ref": "D-001",
            "status": "active",
            "created_by": "architect:gowri",
            "created_at": "2026-08-09T00:00:00Z",
        }
        report = validate({"D-001": GOOD_DECISION}, [GOOD_NODE_ADD_OVERRIDE, node_add, rel_override], calm_node_ids=set())
        self.assertTrue(report.valid, report.errors)

    def test_no_calm_given_skips_endpoint_checks_without_crashing(self):
        report = validate({"D-001": GOOD_DECISION}, [GOOD_NODE_ADD_OVERRIDE], calm_node_ids=None)
        self.assertTrue(report.valid)

    def test_empty_overrides_is_valid_with_warning(self):
        report = validate({}, [], calm_node_ids=set())
        self.assertTrue(report.valid)
        self.assertTrue(any("nothing to apply" in w for w in report.warnings), report.warnings)

    def test_boundary_change_with_dangling_decision_ref_still_fails(self):
        """Real bug found on review: check order must match override-applier.ts
        exactly (status -> decision_record_ref resolution -> decision.status ->
        THEN dispatch on override_type). Checking override_type/not-implemented
        first let a boundary_change override with a totally dangling
        decision_record_ref pass as valid, when the real applier checks the
        ref BEFORE it would ever reach the boundary_change skip case and
        would genuinely reject this."""
        override = {"override_id": "O-bad", "module": "architecture", "target_ref": "x", "override_type": "boundary_change", "new_value": None, "decision_record_ref": "D-does-not-exist", "status": "active", "created_by": "x", "created_at": "x"}
        report = validate({}, [override], calm_node_ids=set())
        self.assertFalse(report.valid, "must be rejected — decision_record_ref check happens before override_type dispatch in the real applier")
        self.assertTrue(any("does not resolve" in e for e in report.errors), report.errors)

    def test_relationship_add_referencing_a_node_add_that_will_be_rejected_still_fails(self):
        """Real bug found on review: the same-batch node_add exception (design
        §6) must only count node_add overrides that will ACTUALLY apply, not
        any override merely labeled node_add with a parseable shape. A
        node_add with a dangling decision_record_ref will be rejected at real
        apply time, so a relationship_add referencing its unique-id is a
        genuine dangling endpoint, not a valid same-batch reference."""
        node_add = dict(GOOD_NODE_ADD_OVERRIDE, override_id="O-nodeadd", target_ref="db-new", new_value={"unique-id": "db-new", "node-type": "database", "name": "X", "description": "x"}, decision_record_ref="D-does-not-exist")
        rel_add = {
            "override_id": "O-reladd",
            "module": "architecture",
            "target_ref": "rel-1",
            "override_type": "relationship_add",
            "new_value": {"unique-id": "rel-1", "description": "x", "relationship-type": {"connects": {"source": {"node": "svc-1"}, "destination": {"node": "db-new"}}}},
            "decision_record_ref": "D-001",
            "status": "active",
            "created_by": "x",
            "created_at": "x",
        }
        report = validate({"D-001": GOOD_DECISION}, [node_add, rel_add], calm_node_ids={"svc-1"})
        self.assertFalse(report.valid)
        self.assertEqual(len(report.errors), 2, f"expected both the node_add's own rejection AND the relationship_add's dangling endpoint to be reported, got: {report.errors}")
        self.assertTrue(any("dangling endpoint" in e for e in report.errors), report.errors)

    def test_relationship_remove_orphan_target_fails(self):
        """Real bug found on review: relationship_remove never checked target
        existence against real CALM relationships at all — a nonexistent
        target silently passed as valid, when the real applier rejects it as
        an orphan (same class of check type_change/node_remove already get)."""
        override = {"override_id": "O-relremove", "module": "architecture", "target_ref": "rel-does-not-exist", "override_type": "relationship_remove", "decision_record_ref": "D-001", "status": "active", "created_by": "x", "created_at": "x"}
        report = validate({"D-001": GOOD_DECISION}, [override], calm_node_ids=set(), calm_relationship_ids=set())
        self.assertFalse(report.valid)
        self.assertTrue(any("orphan" in e for e in report.errors), report.errors)

    def test_relationship_remove_on_real_existing_relationship_passes(self):
        override = {"override_id": "O-relremove", "module": "architecture", "target_ref": "rel-real", "override_type": "relationship_remove", "decision_record_ref": "D-001", "status": "active", "created_by": "x", "created_at": "x"}
        report = validate({"D-001": GOOD_DECISION}, [override], calm_node_ids=set(), calm_relationship_ids={"rel-real"})
        self.assertTrue(report.valid, report.errors)


class TestLoadDecisionsById(unittest.TestCase):
    """Entry 25, Architect_Pilot_Feedback_Notes.md: a real Copilot Chat
    session drafted 23 decision files using invented field names
    (residual_id/construct/option) instead of the real decision_id/
    final_decision/status schema. The OLD code (a bare dict comprehension in
    both validate_drafts.py's main() and apply.py's _run_validation())
    silently DROPPED every file missing decision_id instead of reporting an
    error -- with all 23 missing it, the result was an empty dict and a
    trivially "valid" report. These tests exercise the loading step itself
    (every prior test in this file calls validate() directly with an
    already-correct dict, which is exactly why this defect had zero test
    coverage before)."""

    def test_well_formed_decision_is_kept(self):
        decisions_by_id, errors = load_decisions_by_id([GOOD_DECISION])
        self.assertEqual(decisions_by_id, {"D-001": GOOD_DECISION})
        self.assertEqual(errors, [])

    def test_decision_missing_decision_id_is_reported_not_silently_dropped(self):
        """The exact real shape a live chat session actually wrote to disk."""
        malformed = {"residual_id": "R-001", "construct": "signal-catalogue-candidate", "option": "[1]", "rationale": "...", "reviewer": "llm-advisory:claude", "timestamp": "2026-09-01T00:00:00Z"}
        decisions_by_id, errors = load_decisions_by_id([GOOD_DECISION, malformed])
        self.assertEqual(decisions_by_id, {"D-001": GOOD_DECISION}, "the well-formed decision must still be kept")
        self.assertEqual(len(errors), 1, f"the malformed decision must produce exactly one error, not be silently dropped: {errors}")
        self.assertIn("decision_id", errors[0])
        self.assertIn("residual_id", errors[0], "the error should name the real (wrong) fields present, to help diagnose an invented schema")

    def test_all_decisions_malformed_yields_all_errors_not_empty_report(self):
        """Second, independent instance of the real bug (per this repo's own
        'verify against a second instance' rule): with EVERY decision file
        malformed (the real shape of the actual failed session), the result
        must be N real errors, never a silently-empty, trivially-valid dict."""
        malformed = [{"residual_id": f"R-{i:03d}", "construct": "x", "option": "[1]"} for i in range(1, 4)]
        decisions_by_id, errors = load_decisions_by_id(malformed)
        self.assertEqual(decisions_by_id, {})
        self.assertEqual(len(errors), 3)

    def test_decision_id_present_but_not_a_string_is_reported(self):
        malformed = dict(GOOD_DECISION)
        malformed["decision_id"] = 12345
        decisions_by_id, errors = load_decisions_by_id([malformed])
        self.assertEqual(decisions_by_id, {})
        self.assertEqual(len(errors), 1)

    def test_end_to_end_via_validate_all_malformed_decisions_fail_validation(self):
        """Full integration: load_decisions_by_id's errors must actually
        surface through validate()'s report, matching how both real callers
        (validate_drafts.py's main(), apply.py's _run_validation()) use it —
        report.errors = load_errors + report.errors."""
        malformed = {"residual_id": "R-001", "construct": "x", "option": "[1]"}
        decisions_by_id, load_errors = load_decisions_by_id([malformed])
        report = validate(decisions_by_id, [], calm_node_ids=set())
        report.errors = load_errors + report.errors
        self.assertFalse(report.valid, "a pack where every decision file is schema-invalid must never validate as clean")
        self.assertTrue(any("decision_id" in e for e in report.errors), report.errors)


class TestSummarizeByTrigger(unittest.TestCase):
    """Real gap found 2026-09-04 reviewing a real, full 51-residual,
    5-trigger-class Session Pack: a review pass fully worked ONE trigger
    class and reported the result as a complete architecture -- nothing
    broke the pack down by trigger class anywhere, so the gap was
    invisible. This is the shared helper both apply.py and pack.py's
    SESSION.md render use so the two views can't drift apart."""

    def _residual(self, rid, trigger, tier="A"):
        return {"id": rid, "tier": tier, "trigger": trigger}

    def test_multiple_trigger_classes_counted_separately(self):
        residuals = [
            self._residual("R-001", "S2-http-without-security-control"),
            self._residual("R-002", "S2-http-without-security-control"),
            self._residual("R-003", "unmapped-signal-cluster"),
        ]
        decisions_by_id = {"D-001": {"status": "active", "residual_id": "R-001"}}
        summary = summarize_by_trigger(residuals, decisions_by_id)
        self.assertEqual(summary["S2-http-without-security-control"], {"tier": "A", "total": 2, "decided": 1})
        self.assertEqual(summary["unmapped-signal-cluster"], {"tier": "A", "total": 1, "decided": 0})

    def test_superseded_decision_not_counted_as_decided(self):
        residuals = [self._residual("R-001", "S2-http-without-security-control")]
        decisions_by_id = {"D-001": {"status": "superseded", "residual_id": "R-001"}}
        summary = summarize_by_trigger(residuals, decisions_by_id)
        self.assertEqual(summary["S2-http-without-security-control"]["decided"], 0)

    def test_decision_with_no_residual_id_never_crashes_or_miscounts(self):
        """A malformed/legacy decision missing residual_id (schema-invalid,
        already caught elsewhere by REQUIRED_DECISION_FIELDS) must not be
        silently treated as answering every residual, or crash this view."""
        residuals = [self._residual("R-001", "S2-http-without-security-control")]
        decisions_by_id = {"D-001": {"status": "active"}}
        summary = summarize_by_trigger(residuals, decisions_by_id)
        self.assertEqual(summary["S2-http-without-security-control"]["decided"], 0)

    def test_empty_residuals_returns_empty_summary(self):
        self.assertEqual(summarize_by_trigger([], {}), {})


if __name__ == "__main__":
    unittest.main()
