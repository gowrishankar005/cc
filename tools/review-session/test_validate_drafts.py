"""Exit criteria: good fixture passes; bad fixtures fail with clear
reasons. Mirrors override-applier.ts's own real validation semantics —
these fixtures are synthetic (S7: no sample hardcodes), not copied from a
real repo."""

import unittest

from validate_drafts import validate

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


if __name__ == "__main__":
    unittest.main()
