"""Stated exit bar: "Pack on NestJS fixture or a Python-app out-dir
succeeds offline." Automated, not just the manual run this was originally
proven with — same "lock every proven behavior into a regression test"
discipline as pipeline/test/regression.test.js.

Requires the pipeline to be built (`cd pipeline && npm run build`) — skips
cleanly if dist/ isn't present, same convention pipeline/test/regression.test.js
uses for scratch-clone-dependent fixtures.
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

TOOLS_DIR = Path(__file__).resolve().parent
REPO_ROOT = TOOLS_DIR.parents[1]
RUN_SLICE = REPO_ROOT / "pipeline" / "dist" / "orchestration" / "run-slice.js"
NESTJS_FIXTURE = REPO_ROOT / "pipeline" / "test" / "fixtures" / "nestjs-sample"
SPRING_CONFIG_FIXTURE = REPO_ROOT / "pipeline" / "test" / "fixtures" / "spring-config-sample"


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
        self.assertTrue((self.session_dir / "evidence" / "paths.json").exists())

        # NestJS fixture's real S2 residual (Controller with no security-control evidence) must be present.
        # Leftover fuel (unmapped/ignored) may append further residuals after it.
        residuals = json.loads((self.session_dir / "residuals.json").read_text())
        self.assertGreaterEqual(len(residuals["items"]), 1)
        s2 = next((r for r in residuals["items"] if r["trigger"] == "S2-http-without-security-control"), None)
        self.assertIsNotNone(s2, "expected the NestJS S2 residual")
        self.assertEqual(s2["tier"], "A")
        session_md = (self.session_dir / "SESSION.md").read_text()
        self.assertIn("CodeGraph", session_md)
        self.assertIn("fetch-span", session_md)

        # Real completeness-visibility gap found 2026-09-04: manifest.json's
        # residualCount alone gave no signal of how many trigger classes a
        # pack actually spans. manifest's per-trigger inventory must be real
        # (matches residuals.json's own trigger field), and SESSION.md must
        # show the same breakdown, not just a per-tier count.
        manifest = json.loads((self.session_dir / "manifest.json").read_text())
        self.assertIn("residualsByTrigger", manifest)
        self.assertIn("S2-http-without-security-control", manifest["residualsByTrigger"])
        self.assertEqual(manifest["residualsByTrigger"]["S2-http-without-security-control"]["tier"], "A")
        self.assertGreaterEqual(manifest["residualsByTrigger"]["S2-http-without-security-control"]["count"], 1)
        self.assertEqual(sum(e["count"] for e in manifest["residualsByTrigger"].values()), len(residuals["items"]))
        self.assertIn("### By trigger class", session_md)
        self.assertIn("S2-http-without-security-control", session_md)

        # Architect_Pilot_Feedback_Notes.md Entry 20: the NestJS fixture lives
        # under REPO_ROOT (pipeline/test/fixtures/...), so at least one
        # evidence ref must resolve to a real, REPO_ROOT-relative clickable
        # path -- not just the bare package-root-relative scan ref -- and
        # that path must actually appear in the residual's own rendered card.
        paths = json.loads((self.session_dir / "evidence" / "paths.json").read_text())
        self.assertGreater(len(paths), 0, "expected at least one clickable evidence path for the NestJS fixture (lives under REPO_ROOT)")
        clickable = next(iter(paths.values()))
        self.assertIn("pipeline/test/fixtures/nestjs-sample", clickable)
        all_cards_text = "\n".join(r["card"] for r in residuals["items"])
        self.assertTrue(
            any(p in all_cards_text for p in paths.values()),
            "at least one rendered card must show a clickable REPO_ROOT-relative evidence path, not just the bare scan ref",
        )

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

    def test_with_dossier_flag_no_backend_still_succeeds_no_dossier_field(self):
        """T-2 (AGENT_TASKS_Residual_Dossier_Module.md): --with-dossier set
        but no `claude` CLI on PATH -> pack.py still writes a normal,
        dossier-less pack (exit 0), logging what would have been attempted."""
        subprocess.run(["node", str(RUN_SLICE), str(NESTJS_FIXTURE), "--out", str(self.out_dir)], capture_output=True, text=True, check=True)
        env = dict(os.environ)
        # Strip only `claude` from PATH (node stays reachable -- pack.py's
        # own review-queue regeneration via hitl-review-trigger.js needs
        # it, unrelated to the LLM backend this test is actually about).
        node_dir = str(Path(shutil.which("node")).parent) if shutil.which("node") else ""
        env["PATH"] = node_dir
        run = subprocess.run(
            [sys.executable, str(TOOLS_DIR / "pack.py"), "--out-dir", str(self.out_dir), "--session-dir", str(self.session_dir), "--with-dossier"],
            capture_output=True,
            text=True,
            env=env,
        )
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertIn("no LLM backend available", run.stdout)
        residuals = json.loads((self.session_dir / "residuals.json").read_text())
        self.assertGreaterEqual(len(residuals["items"]), 1)
        self.assertTrue(all("dossier" not in r for r in residuals["items"]), "no-backend path must never attach a dossier field")

    def test_without_with_dossier_flag_backend_check_never_invoked(self):
        """No --with-dossier at all -> pack.py must not even check for a
        `claude` CLI backend (Simplicity First: the default path stays
        exactly what it was before this pass existed)."""
        subprocess.run(["node", str(RUN_SLICE), str(NESTJS_FIXTURE), "--out", str(self.out_dir)], capture_output=True, text=True, check=True)
        sys.path.insert(0, str(TOOLS_DIR))
        import pack

        with mock.patch.object(pack, "_llm_backend_available") as mock_backend:
            argv_backup = sys.argv
            sys.argv = ["pack.py", "--out-dir", str(self.out_dir), "--session-dir", str(self.session_dir)]
            try:
                rc = pack.pack_main()
            finally:
                sys.argv = argv_backup
        self.assertEqual(rc, 0)
        mock_backend.assert_not_called()


@unittest.skipUnless(RUN_SLICE.exists() and SPRING_CONFIG_FIXTURE.exists(), "pipeline/dist not built or fixture missing")
class TestStructuredConfigEvidenceSnippetGap(unittest.TestCase):
    """Real gap found 2026-08-23, first real end-to-end pack --with-dossier
    run against this exact fixture: a structured-file-derived unit's
    evidenceRefs use a dotted-key-path shape (e.g.
    "application-prod.yml:spring.datasource.url"), not file:line --
    _build_evidence_packs used to silently omit these from packs.json
    entirely, so any LLM pass saw empty evidence_snippets with no signal
    why. Fixed with an explicit placeholder instead of silence."""

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="review-session-spring-config-test-"))
        self.out_dir = self.tmp / "out"
        self.session_dir = self.tmp / "session"
        run = subprocess.run(["node", str(RUN_SLICE), str(SPRING_CONFIG_FIXTURE), "--out", str(self.out_dir)], capture_output=True, text=True)
        self.assertEqual(run.returncode, 0, run.stderr)
        pack_run = subprocess.run([sys.executable, str(TOOLS_DIR / "pack.py"), "--out-dir", str(self.out_dir), "--session-dir", str(self.session_dir)], capture_output=True, text=True)
        self.assertEqual(pack_run.returncode, 0, pack_run.stderr)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)
        for cache in (".codegraph", ".graphify-cache", "graphify-out"):
            shutil.rmtree(SPRING_CONFIG_FIXTURE / cache, ignore_errors=True)

    def test_dotted_key_path_ref_gets_an_honest_placeholder_not_silence(self):
        packs = json.loads((self.session_dir / "evidence" / "packs.json").read_text())
        dotted_refs = [k for k in packs if ":" in k and not k.rsplit(":", 1)[-1].isdigit()]
        self.assertGreater(len(dotted_refs), 0, "expected at least one dotted-key-path evidenceRef in this fixture's own real output")
        for ref in dotted_refs:
            self.assertIn("no source snippet available", packs[ref])
            self.assertIn(ref, packs[ref], "the placeholder must name the real ref it's standing in for")

    def test_real_file_line_refs_still_get_a_real_snippet_not_a_placeholder(self):
        """Negative case: this fix must not turn EVERY ref into a
        placeholder — a genuine file:line ref in the same fixture (the
        Java controller's own source) must still get a real snippet."""
        packs = json.loads((self.session_dir / "evidence" / "packs.json").read_text())
        file_line_refs = [k for k in packs if ":" in k and k.rsplit(":", 1)[-1].isdigit()]
        self.assertGreater(len(file_line_refs), 0, "expected at least one real file:line evidenceRef in this fixture")
        for ref in file_line_refs:
            self.assertNotIn("no source snippet available", packs[ref])


class TestRenderAgentsMd(unittest.TestCase):
    """Entry 25, Architect_Pilot_Feedback_Notes.md: a real Copilot Chat
    session invented its own Decision Record field names instead of the
    real schema, because AGENTS.md (the one file inside the pack the chat
    agent can actually read) never embedded it -- only a bare citation to
    pipeline/src/types/overrides.ts, a file outside the pack the agent is
    explicitly forbidden from opening. Locks that the real, required field
    names are now embedded directly, so this can't silently regress back to
    a one-line summary. No pipeline build required -- pure Python import."""

    def test_agents_md_embeds_the_real_decision_record_and_override_fields(self):
        from pack import _render_agents_md

        rendered = _render_agents_md()
        for field in ("decision_id", "final_decision", "target_type", "target_ref", "reviewed_at", "override_id", "decision_record_ref", "override_type", "residual_id"):
            self.assertIn(f'"{field}"', rendered, f"expected real field name {field!r} embedded in AGENTS.md's own text")

    def test_agents_md_shows_the_no_override_decision_shape(self):
        """The most common real outcome (leave-open/accepted) needs its own
        worked example — not just the decision+override pair — or an
        architect/agent could wrongly infer every decision needs a matching
        override file."""
        from pack import _render_agents_md

        rendered = _render_agents_md()
        self.assertIn("NO override", rendered)
        self.assertIn('"accepted"', rendered)


class TestDossierLimit(unittest.TestCase):
    """Real, live-found risk fixed 2026-09-05: a full pack (50+ open
    residuals) hit sustained claude CLI rate-limiting twice in the same
    real session, and the second time consumed enough real usage quota to
    lock the calling session out for hours. --dossier-limit bounds the
    batch instead of all-or-nothing. Pure function tests -- no pipeline
    build, no live claude CLI call (dossier.process_dossier_batch mocked)."""

    def _residual(self, rid):
        return {"id": rid, "status": "open", "tier": "A"}

    def test_limit_below_open_count_only_dossiers_the_first_n(self):
        from pack import _run_dossier_pass
        import dossier

        residuals = [self._residual(f"R-{i:03d}") for i in range(1, 21)]  # 20 open residuals
        with mock.patch("pack._llm_backend_available", return_value=True), \
             mock.patch.object(dossier, "process_dossier_batch", return_value=([], [])) as mock_batch:
            _run_dossier_pass(residuals, {}, {}, dossier_limit=15)
        targets_passed = mock_batch.call_args[0][0]
        self.assertEqual(len(targets_passed), 15, "must dossier only the first 15 of 20 open residuals, not all of them")
        self.assertEqual([r["id"] for r in targets_passed], [f"R-{i:03d}" for i in range(1, 16)])

    def test_limit_above_open_count_is_a_no_op(self):
        """A generous limit must never change behavior for a genuinely small pack."""
        from pack import _run_dossier_pass
        import dossier

        residuals = [self._residual(f"R-{i:03d}") for i in range(1, 4)]  # 3 open residuals
        with mock.patch("pack._llm_backend_available", return_value=True), \
             mock.patch.object(dossier, "process_dossier_batch", return_value=([], [])) as mock_batch:
            _run_dossier_pass(residuals, {}, {}, dossier_limit=15)
        self.assertEqual(len(mock_batch.call_args[0][0]), 3)

    def test_no_limit_given_dossiers_every_open_residual_unchanged(self):
        """Simplicity First: omitting --dossier-limit must reproduce the
        exact prior behavior -- every open residual, no truncation."""
        from pack import _run_dossier_pass
        import dossier

        residuals = [self._residual(f"R-{i:03d}") for i in range(1, 21)]
        with mock.patch("pack._llm_backend_available", return_value=True), \
             mock.patch.object(dossier, "process_dossier_batch", return_value=([], [])) as mock_batch:
            _run_dossier_pass(residuals, {}, {})  # no dossier_limit at all
        self.assertEqual(len(mock_batch.call_args[0][0]), 20)


class TestResidualsByTriggerCompletenessViews(unittest.TestCase):
    """Real gap found on review of this whole feature's own test coverage:
    every real end-to-end test that exercised the new completeness views
    (manifest.json's residualsByTrigger, SESSION.md's per-trigger section,
    apply.py's printed table) only ever used a fixture that produces ONE
    trigger class -- never the >=3-trigger-class, some-decided-some-not
    shape this feature's own stated verification bar requires. These are
    synthetic (no scan/pipeline build needed) so they can exercise that
    shape directly and cheaply."""

    def _residual(self, rid, trigger, tier):
        return {"id": rid, "tier": tier, "trigger": trigger, "class": "x", "unitIds": [], "evidenceRefs": [], "rationale": "r", "status": "open", "card": f"### {rid}\n"}

    def test_manifest_inventory_covers_at_least_three_trigger_classes(self):
        from pack import _residuals_by_trigger_inventory

        residuals = [
            self._residual("R-001", "S2-http-without-security-control", "A"),
            self._residual("R-002", "S2-http-without-security-control", "A"),
            self._residual("R-003", "unmapped-signal-cluster", "A"),
            self._residual("R-004", "unresolved-outbound-target", "B"),
            self._residual("R-005", "hand-rolled-resilience-candidate", "C"),
        ]
        inventory = _residuals_by_trigger_inventory(residuals)
        self.assertEqual(len(inventory), 4, "must break down by all real trigger classes present, not collapse them")
        self.assertEqual(inventory["S2-http-without-security-control"], {"tier": "A", "count": 2})
        self.assertEqual(inventory["unmapped-signal-cluster"], {"tier": "A", "count": 1})
        self.assertEqual(inventory["unresolved-outbound-target"], {"tier": "B", "count": 1})
        self.assertEqual(inventory["hand-rolled-resilience-candidate"], {"tier": "C", "count": 1})

    def test_session_md_shows_the_true_split_across_trigger_classes_some_decided_some_not(self):
        """The real verification bar this feature was built against: a
        multi-trigger-class pack, SOME residuals decided (with a real
        residual_id-bearing Decision Record already on disk) and some not
        -- SESSION.md's own render must show the true per-class split, not
        a synthetic single-class case."""
        from pack import _render_session_md

        residuals = [
            self._residual("R-001", "S2-http-without-security-control", "A"),
            self._residual("R-002", "unmapped-signal-cluster", "A"),
            self._residual("R-003", "unmapped-signal-cluster", "A"),
            self._residual("R-004", "unresolved-outbound-target", "B"),
        ]
        manifest = {"generatedAt": "2026-09-04T00:00:00Z", "outDir": "/tmp/x", "hasCalm": False}
        tmp = Path(tempfile.mkdtemp(prefix="session-md-multi-trigger-test-"))
        try:
            decisions_dir = tmp / "drafts" / "decisions"
            decisions_dir.mkdir(parents=True)
            # Only R-001 and one of the two unmapped-signal-cluster residuals get a real decision.
            for rid, did in (("R-001", "D-001"), ("R-002", "D-002")):
                (decisions_dir / f"{did}.json").write_text(json.dumps({"decision_id": did, "status": "active", "residual_id": rid}))

            rendered = _render_session_md(manifest, residuals, tmp)
            self.assertIn("### By trigger class", rendered)
            self.assertIn("[A] `S2-http-without-security-control`: 1/1 decided", rendered)
            self.assertIn("[A] `unmapped-signal-cluster`: 1/2 decided", rendered)
            self.assertIn("[B] `unresolved-outbound-target`: 0/1 decided", rendered)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
