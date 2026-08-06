// Real, evidence-checked regression suite — formalizes checks that were run
// by hand, against real fixtures, throughout the "Java Slice 2" build
// session (see CLAUDE.md's pipeline-architecture section for the original
// findings each assertion here traces back to). Uses node:test (built into
// Node 22, no new dependency) — this is a handful of integration checks
// against the real CLI, not a reason to add a test framework.
//
// Fixtures under spikes/ (Bank of Anthos, Fineract) are disposable scratch
// clones per CLAUDE.md's own convention — tests SKIP, not fail, when they're
// absent, so a fresh checkout without them still runs the one fixture that's
// actually checked in (test/fixtures/nestjs-sample).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const PIPELINE_ROOT = path.resolve(__dirname, '..');
const RUN_SLICE = path.join(PIPELINE_ROOT, 'dist', 'orchestration', 'run-slice.js');
const CONTROL_URL_MAPPING = path.join(PIPELINE_ROOT, 'dist', 'rules', 'control-url-mapping.json');

const BOA_ROOT = path.resolve(PIPELINE_ROOT, '../spikes/boa/repo/src/accounts');
const FINERACT_ROOT = path.resolve(PIPELINE_ROOT, '../spikes/fineract/repo');
const FINERACT_KAFKA_ROOT = path.resolve(FINERACT_ROOT, 'fineract-provider/src/main/java/org/apache/fineract/infrastructure/springbatch/messagehandler/kafka');
const GHOSTFOLIO_ACCESS_ROOT = path.resolve(PIPELINE_ROOT, '../spikes/ghostfolio/repo/apps/api/src/app/access');

function runPipeline(roots, extraArgs = []) {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'loom-test-'));
  execFileSync('node', [RUN_SLICE, ...roots, '--out', outDir, ...extraArgs], { stdio: 'pipe' });
  const calm = JSON.parse(fs.readFileSync(path.join(outDir, 'architecture.calm.json'), 'utf8'));
  return { outDir, calm };
}

// Real finding, not assumed: calm-cli truncates its own stdout at exactly
// 8192 bytes when piped (not a TTY) — a classic Node CLI bug (process exits
// before a large piped write finishes flushing). Confirmed by testing
// against real Fineract fineract-core output (44 nodes, ~11KB of validation
// JSON — well past the 8192-byte cutoff). Not a maxBuffer issue (raising it
// didn't help) and not npx-specific (the same truncation happens invoking
// the calm binary directly). The robust fix, using calm-cli's own supported
// mechanism: -o writes results to a file instead of relying on captured
// stdout.
function validateCalm(calmPath) {
  const resultPath = calmPath + '.validate-result.json';
  execFileSync(path.join(PIPELINE_ROOT, 'node_modules/.bin/calm'), ['validate', '-u', CONTROL_URL_MAPPING, '-a', calmPath, '-f', 'json', '-o', resultPath], {
    cwd: PIPELINE_ROOT,
    stdio: 'pipe',
  });
  const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
  return { errors: result.jsonSchemaValidationOutputs.length, warnings: result.spectralSchemaValidationOutputs.length };
}

function findNode(calm, uniqueIdSuffix) {
  return calm.nodes.find((n) => n['unique-id'].endsWith(uniqueIdSuffix));
}

test('NestJS fixture — native-route-beats-decorator-fallback precedence (checked in, always runs)', () => {
  const { outDir, calm } = runPipeline([path.join(PIPELINE_ROOT, 'test/fixtures/nestjs-sample')]);
  try {
    assert.equal(calm.nodes.length, 1, 'expected exactly 1 node');
    const node = calm.nodes[0];
    assert.equal(node['node-type'], 'service');
    // The original bug: decorator fallback ALSO firing for the same routes
    // native typing already found, producing redundant "Get"/"Post" entries.
    // Exactly 3 clean interfaces, no duplicates, is the regression check.
    assert.equal(node.interfaces.length, 3, 'expected exactly 3 interfaces, no duplicate Get/Post fallback entries');
    const paths = node.interfaces.map((i) => i.path).sort();
    assert.deepEqual(paths, ['GET /users', 'GET /users/:id', 'POST /users']);

    const { errors } = validateCalm(path.join(outDir, 'architecture.calm.json'));
    assert.equal(errors, 0);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('Bank of Anthos — cross-package Graphify pass, real relationships, 0 errors 0 warnings', { skip: !fs.existsSync(BOA_ROOT) && 'spikes/boa/repo not present (scratch clone, see CLAUDE.md)' }, () => {
  const { outDir, calm } = runPipeline([path.join(BOA_ROOT, 'userservice'), path.join(BOA_ROOT, 'contacts')]);
  try {
    const userservice = findNode(calm, 'userservice.py');
    const contacts = findNode(calm, 'contacts.py');
    assert.ok(userservice, 'userservice.py node missing');
    assert.ok(contacts, 'contacts.py node missing');
    assert.equal(userservice.interfaces.length, 4, 'userservice.py should have 4 routes');
    assert.equal(contacts.interfaces.length, 4, 'contacts.py should have 4 routes');

    const userDb = findNode(calm, 'UserDb');
    const contactsDb = findNode(calm, 'ContactsDb');
    assert.ok(userDb, 'db.py::UserDb node missing — persistence-detector.ts regression');
    assert.ok(contactsDb, 'db.py::ContactsDb node missing — persistence-detector.ts regression');
    assert.equal(userDb['node-type'], 'database');
    assert.equal(contactsDb['node-type'], 'database');

    assert.ok(calm.relationships.length >= 1, 'expected at least 1 real relationship from the Graphify pass — 0 here means the cross-package/persistence fix regressed');

    // T-X2-1 acceptance ("no duplicate DB nodes") — the decorator-based
    // jpa-entity path and the driver-import Graphify path use disjoint
    // TypedUnit.id schemes (bare filePath vs. filePath::ClassName) by
    // construction; this locks that invariant in generically instead of
    // re-deriving it by reading both mechanisms' code each time.
    const ids = calm.nodes.map((n) => n['unique-id']);
    assert.equal(new Set(ids).size, ids.length, 'duplicate unique-id found — persistence double-emit regression');

    const { errors, warnings } = validateCalm(path.join(outDir, 'architecture.calm.json'));
    assert.equal(errors, 0);
    assert.equal(warnings, 0, 'unreferenced-node warnings mean a node lost its relationship — check the reconciler');
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test(
  'Fineract fineract-charge — JAX-RS route composition + JPA persistence typing',
  { skip: !fs.existsSync(FINERACT_ROOT) && 'spikes/fineract/repo not present (scratch clone, see CLAUDE.md)' },
  () => {
    const { outDir, calm } = runPipeline([path.join(FINERACT_ROOT, 'fineract-charge')]);
    try {
      const chargesResource = findNode(calm, 'ChargesApiResource.java');
      assert.ok(chargesResource, 'ChargesApiResource.java node missing');
      assert.equal(chargesResource['node-type'], 'service');
      // Grep-verified ground truth (docs/spikes/fineract-route-assembly-spike/) —
      // exact set, not just a count, so a regex/attribution regression is caught.
      const routes = chargesResource.interfaces.map((i) => i.path).sort();
      assert.deepEqual(routes, [
        'DELETE /v1/charges/{chargeId}',
        'GET /v1/charges',
        'GET /v1/charges/template',
        'GET /v1/charges/{chargeId}',
        'POST /v1/charges',
        'PUT /v1/charges/{chargeId}',
      ]);

      const charge = findNode(calm, 'Charge.java');
      assert.ok(charge, 'Charge.java node missing — JPA @Entity decorator detection regression');
      assert.equal(charge['node-type'], 'database', 'Charge.java must be typed database, not service — the signal-mapper.ts hardcoded-kind bug');
      assert.equal(charge.interfaces, undefined, 'Charge.java must have NO interfaces — the @Getter/GET word-boundary-matching bug');

      const { errors } = validateCalm(path.join(outDir, 'architecture.calm.json'));
      assert.equal(errors, 0);
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  }
);

test(
  'Fineract fineract-core — control-builder finds real @PreAuthorize evidence on a route-less service',
  { skip: !fs.existsSync(FINERACT_ROOT) && 'spikes/fineract/repo not present (scratch clone, see CLAUDE.md)' },
  () => {
    const { outDir, calm } = runPipeline([path.join(FINERACT_ROOT, 'fineract-core')]);
    try {
      const datatableService = findNode(calm, 'DatatableWriteService.java');
      assert.ok(datatableService, 'DatatableWriteService.java node missing — a pure-interface, no-HTTP-route class control-builder.ts is specifically meant to surface');
      assert.equal(datatableService['node-type'], 'service');
      assert.ok(datatableService.controls, 'expected a controls object');
      const rbac = datatableService.controls['security-rbac-001'];
      assert.ok(rbac, 'expected the security-rbac-001 control');
      // Grep-verified exact lines (CLAUDE.md's control-builder.ts finding).
      const lines = rbac.requirements.map((r) => r.config.evidenceRef).sort();
      assert.deepEqual(lines, [
        'src/main/java/org/apache/fineract/infrastructure/dataqueries/service/DatatableWriteService.java:27',
        'src/main/java/org/apache/fineract/infrastructure/dataqueries/service/DatatableWriteService.java:30',
        'src/main/java/org/apache/fineract/infrastructure/dataqueries/service/DatatableWriteService.java:33',
        'src/main/java/org/apache/fineract/infrastructure/dataqueries/service/DatatableWriteService.java:36',
      ]);

      // T-X2-1 acceptance ("no duplicate DB nodes") — 44 real units (36
      // @Entity + 8 JAX-RS) is the largest real fixture in this suite, the
      // most likely to reveal a persistence double-emit if one existed.
      const ids = calm.nodes.map((n) => n['unique-id']);
      assert.equal(new Set(ids).size, ids.length, 'duplicate unique-id found — persistence double-emit regression');

      const { errors } = validateCalm(path.join(outDir, 'architecture.calm.json'));
      assert.equal(errors, 0, 'control-url-mapping regression — calm-cli host-allowlist check failing again');
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  }
);

test('SQS/SNS import-only messaging detection — low confidence, topic kind, dispatcher wiring (T-X7-2, synthetic — no real fixture yet)', () => {
  const { detectMessagingUnits } = require(path.join(PIPELINE_ROOT, 'dist/analysis/cross_package/messaging-detector'));
  const graph = {
    nodes: [
      { id: 'file1', label: 'file1', file_type: 'ts', source_file: 'worker.ts', source_location: 'L1', _origin: 'x' },
      { id: 'class1', label: 'QueueWorker', file_type: 'ts', source_file: 'worker.ts', source_location: 'L3', _origin: 'x' },
    ],
    edges: [
      { source: 'file1', target: '@aws-sdk/client-sqs', relation: 'imports_from', context: '', confidence: 'EXTRACTED', source_file: 'worker.ts', source_location: 'L1', weight: 1, _origin: 'x' },
      { source: 'file1', target: 'class1', relation: 'contains', context: '', confidence: 'EXTRACTED', source_file: 'worker.ts', source_location: 'L1', weight: 1, _origin: 'x' },
    ],
  };
  const run = { graph, resolveRoot: (f) => (f === 'worker.ts' ? { root: '/root', relativeFilePath: 'worker.ts' } : undefined) };

  const unitsByRoot = detectMessagingUnits(run);
  const units = unitsByRoot.get('/root');
  assert.equal(units.length, 1);
  assert.equal(units[0].kind, 'topic');
  assert.equal(units[0].confidence, 20, 'import-only messaging evidence must stay LOW confidence, never promoted');
  assert.equal(units[0].evidence[0].signal, '@aws-sdk/client-sqs');
  assert.equal(units[0].evidence[0].category, 'messaging');
});

test(
  'Kafka consumer — @KafkaListener detected as a real topic/network node (T-X7-1/T-X7-2, real Fineract evidence)',
  { skip: !fs.existsSync(FINERACT_KAFKA_ROOT) && 'spikes/fineract/repo not present (scratch clone, see CLAUDE.md)' },
  () => {
    const { outDir, calm } = runPipeline([FINERACT_KAFKA_ROOT]);
    try {
      const listener = findNode(calm, 'KafkaRemoteMessageListener.java');
      assert.ok(listener, 'KafkaRemoteMessageListener.java node missing — @KafkaListener decorator detection regression');
      assert.equal(listener['node-type'], 'network', 'topic-kind units must map to CALM node-type network (node-type-mapping.yml)');
      // Grep-verified ground truth: @KafkaListener is at line 45.
      const provenance = listener.metadata.find((m) => m.key === 'x-aac-provenance').value;
      assert.ok(provenance.some((ref) => ref.endsWith(':45')), 'expected provenance at the real @KafkaListener line (45)');

      const { errors } = validateCalm(path.join(outDir, 'architecture.calm.json'));
      assert.equal(errors, 0);
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  }
);

test('Module registry — two independent modules both run against the same typed-facts.json (Goal A), outputs namespaced (T-M2)', () => {
  const { outDir } = runPipeline([path.join(PIPELINE_ROOT, 'test/fixtures/nestjs-sample')]);
  try {
    // calm-generator's output — both the back-compat top-level copy AND the namespaced one (T-M2)
    assert.ok(fs.existsSync(path.join(outDir, 'architecture.calm.json')), 'top-level back-compat copy missing');
    assert.ok(fs.existsSync(path.join(outDir, 'modules/calm-generator/architecture.calm.json')), 'namespaced copy missing');
    // threat-signals' output — a second, independent module, no changes
    // needed upstream of typed-facts.json to build it (Solution Design v2 §9).
    // Namespaced only (T-M2) — no top-level copy, nothing depends on one.
    const threatPath = path.join(outDir, 'modules/threat-signals/threat-signals-report.json');
    assert.ok(fs.existsSync(threatPath), 'threat-signals module did not run — module registry regression');
    const threatReport = JSON.parse(fs.readFileSync(threatPath, 'utf8'));
    assert.ok(Array.isArray(threatReport.findings));
    assert.ok(!fs.existsSync(path.join(outDir, 'threat-signals-report.json')), 'threat-signals should no longer write a top-level copy — collision-prone by design');
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test(
  'K8s trust — shared jwt-key secret produces a real shares-secret relationship (T-X5-1, requirements v0.7 §3 real case)',
  { skip: !fs.existsSync(BOA_ROOT) && 'spikes/boa/repo not present (scratch clone, see CLAUDE.md)' },
  () => {
    const k8sManifestsDir = path.resolve(BOA_ROOT, '..', '..', 'kubernetes-manifests'); // BOA_ROOT is .../repo/src/accounts; manifests live at .../repo/kubernetes-manifests
    const { outDir, calm } = runPipeline(
      [path.join(BOA_ROOT, 'userservice'), path.join(BOA_ROOT, 'contacts')],
      ['--k8s-manifests', k8sManifestsDir]
    );
    try {
      const trustRel = calm.relationships.find((r) => r.description?.startsWith('shares-secret'));
      assert.ok(trustRel, 'expected a shares-secret relationship between contacts and userservice (both mount k8s secret "jwt-key")');
      // Grep-verified ground truth: userservice mounts BOTH jwtRS256.key (private) and
      // jwtRS256.key.pub (public) — the issuer; contacts mounts ONLY the .pub key — the verifier.
      // Direction is verifier -> issuer.
      assert.deepEqual(trustRel['relationship-type'].connects, { source: { node: 'contacts.py' }, destination: { node: 'userservice.py' } });
      assert.equal(trustRel.protocol, undefined, 'a shared secret name is not a network protocol, never invented');

      // Real, honest limitation locked in: frontend/balance-reader/ledger-writer/
      // transaction-history also mount the same secret (grep-verified) but weren't
      // in this run's package roots — they must appear as unresolved, not silently dropped.
      const unresolved = JSON.parse(fs.readFileSync(path.join(outDir, 'ignored-items-report.json'), 'utf8')).filter((i) => i.ref.startsWith('k8s:'));
      assert.ok(unresolved.length >= 4, 'expected unresolved entries for the verifiers not present in this run\'s package roots');

      const { errors, warnings } = validateCalm(path.join(outDir, 'architecture.calm.json'));
      assert.equal(errors, 0);
      assert.equal(warnings, 0);
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  }
);

test(
  'Node/TS real evidence (ghostfolio/ghostfolio, NestJS+Prisma) — Graphify ref_ target normalization + Controller/database precedence (generic fixes, real bugs found by testing against a real repo)',
  { skip: !fs.existsSync(GHOSTFOLIO_ACCESS_ROOT) && 'spikes/ghostfolio/repo not present (scratch clone)' },
  () => {
    const { outDir, calm } = runPipeline([GHOSTFOLIO_ACCESS_ROOT]);
    try {
      // Real bug #1 (fixed): Graphify never uses the literal "@prisma/client" as an
      // imports_from edge target for external packages — only its own ref_prisma_client
      // normalization. Without expandWithGraphifyRefTargets(), this would be 0.
      const accessService = findNode(calm, 'AccessService');
      assert.ok(accessService, 'AccessService must be detected as a real Prisma-importing persistence unit');
      assert.equal(accessService['node-type'], 'database');
      assert.equal(accessService.metadata.find((m) => m.key === 'x-aac-confidence').value, 20, 'import-only evidence stays low confidence');

      // Real bug #2 (fixed): AccessController ALSO imports @prisma/client (for its own
      // DTO typing, `import { Access as AccessModel } from '@prisma/client'`) but has
      // real route evidence — it must stay `service`, not become a second, wrong `database` node.
      const accessController = findNode(calm, 'access.controller.ts');
      assert.ok(accessController, 'access.controller.ts must exist as a service unit');
      assert.equal(accessController['node-type'], 'service');
      assert.ok(!calm.nodes.some((n) => n['unique-id'].includes('AccessController') && n['node-type'] === 'database'), 'AccessController must never also appear as a database node');

      const { errors, warnings } = validateCalm(path.join(outDir, 'architecture.calm.json'));
      assert.equal(errors, 0);
      assert.equal(warnings, 0);
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  }
);

test('K8s manifests absent — --k8s-manifests omitted entirely is a no-op, run completes normally (T-X5-1)', () => {
  const { calm } = runPipeline([path.join(PIPELINE_ROOT, 'test/fixtures/nestjs-sample')]);
  assert.ok(!calm.relationships.some((r) => r.description?.startsWith('shares-secret')), 'no k8s trust relationship should appear when --k8s-manifests was never passed');
});

test('--from-facts reconstruct-only mode — byte-identical output with no rescan, refuses incompatible contractVersion (T-X6-3)', () => {
  const { outDir: origDir, calm: origCalm } = runPipeline([path.join(PIPELINE_ROOT, 'test/fixtures/nestjs-sample')]);
  try {
    const reconstructDir = fs.mkdtempSync(path.join(os.tmpdir(), 'loom-test-'));
    try {
      execFileSync('node', [RUN_SLICE, '--from-facts', path.join(origDir, 'typed-facts.json'), '--out', reconstructDir], { stdio: 'pipe' });
      const reconstructCalm = JSON.parse(fs.readFileSync(path.join(reconstructDir, 'architecture.calm.json'), 'utf8'));
      assert.deepEqual(reconstructCalm, origCalm, '--from-facts must reproduce byte-identical CALM output from frozen facts (facts.generatedAt is reused verbatim, not regenerated)');

      // Refuses an incompatible contractVersion rather than attempting reconstruction.
      const badFactsPath = path.join(reconstructDir, 'bad-facts.json');
      const facts = JSON.parse(fs.readFileSync(path.join(origDir, 'typed-facts.json'), 'utf8'));
      facts.contractVersion = '99.0.0';
      fs.writeFileSync(badFactsPath, JSON.stringify(facts));
      const badOutDir = fs.mkdtempSync(path.join(os.tmpdir(), 'loom-test-'));
      try {
        assert.throws(() => execFileSync('node', [RUN_SLICE, '--from-facts', badFactsPath, '--out', badOutDir], { stdio: 'pipe' }), /FAILED|Command failed/);
      } finally {
        fs.rmSync(badOutDir, { recursive: true, force: true });
      }
    } finally {
      fs.rmSync(reconstructDir, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(origDir, { recursive: true, force: true });
  }
});

test('Orphan/stale override detection — reported separately from other rejections, --strict-overrides fails the run (T-X6-2)', () => {
  const { applyOverrides } = require(path.join(PIPELINE_ROOT, 'dist/modules/calm-generator/override-applier'));
  const baseCalm = { nodes: [{ 'unique-id': 'svc.py', 'node-type': 'service', name: 'svc.py', description: 'x' }], relationships: [] };

  // 1. Unit-level: type_change against a node that no longer exists is an orphan, not just a generic rejection.
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loom-orphan-'));
    try {
      fs.writeFileSync(
        path.join(dir, 'dr.json'),
        JSON.stringify({
          decision_id: 'dr-orphan',
          module: 'architecture',
          target_type: 'node',
          target_ref: 'ghost.py',
          final_decision: { action: 'overridden' },
          rationale: 'stale test',
          reviewer: 'test',
          reviewed_at: new Date().toISOString(),
          status: 'active',
        })
      );
      fs.writeFileSync(
        path.join(dir, 'ov.json'),
        JSON.stringify({
          override_id: 'ov-orphan',
          module: 'architecture',
          target_ref: 'ghost.py', // renamed/removed since this override was authored
          override_type: 'type_change',
          new_value: 'database',
          decision_record_ref: 'dr-orphan',
          status: 'active',
          created_by: 'test',
          created_at: new Date().toISOString(),
        })
      );
      const { result } = applyOverrides(baseCalm, dir);
      assert.equal(result.orphans.length, 1, 'expected exactly one orphan for the ghost.py type_change');
      assert.equal(result.orphans[0].override_id, 'ov-orphan');
      assert.equal(result.orphans[0].target_ref, 'ghost.py');
      assert.equal(result.rejected.length, 1, 'an orphan is still also a rejection — subset, not a separate outcome');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  // 2. CLI-level: --strict-overrides must fail the run when an orphan exists; default must not.
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loom-orphan-cli-'));
    try {
      fs.writeFileSync(
        path.join(dir, 'dr.json'),
        JSON.stringify({
          decision_id: 'dr-orphan-2',
          module: 'architecture',
          target_type: 'node',
          target_ref: 'ghost-service',
          final_decision: { action: 'removed' },
          rationale: 'stale test',
          reviewer: 'test',
          reviewed_at: new Date().toISOString(),
          status: 'active',
        })
      );
      fs.writeFileSync(
        path.join(dir, 'ov.json'),
        JSON.stringify({
          override_id: 'ov-orphan-2',
          module: 'architecture',
          target_ref: 'ghost-service',
          override_type: 'node_remove',
          decision_record_ref: 'dr-orphan-2',
          status: 'active',
          created_by: 'test',
          created_at: new Date().toISOString(),
        })
      );

      const outDirDefault = fs.mkdtempSync(path.join(os.tmpdir(), 'loom-test-'));
      try {
        execFileSync('node', [RUN_SLICE, path.join(PIPELINE_ROOT, 'test/fixtures/nestjs-sample'), '--out', outDirDefault, '--overrides', dir], { stdio: 'pipe' });
      } finally {
        fs.rmSync(outDirDefault, { recursive: true, force: true });
      }

      const outDirStrict = fs.mkdtempSync(path.join(os.tmpdir(), 'loom-test-'));
      try {
        assert.throws(() =>
          execFileSync('node', [RUN_SLICE, path.join(PIPELINE_ROOT, 'test/fixtures/nestjs-sample'), '--out', outDirStrict, '--overrides', dir, '--strict-overrides'], { stdio: 'pipe' })
        );
      } finally {
        fs.rmSync(outDirStrict, { recursive: true, force: true });
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('Relationship overrides — relationship_add/relationship_remove with DR enforcement (T-X6-1)', () => {
  const { applyOverrides } = require(path.join(PIPELINE_ROOT, 'dist/modules/calm-generator/override-applier'));
  const baseCalm = {
    nodes: [
      { 'unique-id': 'auth-service.py', 'node-type': 'service', name: 'auth-service.py', description: 'x' },
      { 'unique-id': 'billing-service.py', 'node-type': 'service', name: 'billing-service.py', description: 'x' },
    ],
    relationships: [],
  };
  const decisionRecord = (id, status = 'active') => ({
    decision_id: id,
    module: 'architecture',
    target_type: 'relationship',
    target_ref: 'auth-service.py--calls-->billing-service.py',
    final_decision: { action: 'added' },
    rationale: 'k8s shared-secret trust, test fixture',
    reviewer: 'test',
    reviewed_at: new Date().toISOString(),
    status,
  });
  const relOverride = (id, drId, targetRef = 'auth-service.py--calls-->billing-service.py') => ({
    override_id: id,
    module: 'architecture',
    target_ref: targetRef,
    override_type: 'relationship_add',
    new_value: {
      'unique-id': targetRef,
      description: 'test edge',
      'relationship-type': { connects: { source: { node: 'auth-service.py' }, destination: { node: 'billing-service.py' } } },
    },
    decision_record_ref: drId,
    status: 'active',
    created_by: 'test',
    created_at: new Date().toISOString(),
  });

  // 1. DR + override present, active -> applied.
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loom-overrides-'));
    try {
      fs.writeFileSync(path.join(dir, 'dr.json'), JSON.stringify(decisionRecord('dr-1')));
      fs.writeFileSync(path.join(dir, 'ov.json'), JSON.stringify(relOverride('ov-1', 'dr-1')));
      const { calm, result } = applyOverrides(baseCalm, dir);
      assert.equal(result.applied.length, 1, 'expected relationship_add to be applied');
      assert.equal(result.rejected.length, 0);
      assert.equal(calm.relationships.length, 1);
      assert.deepEqual(calm.relationships[0]['relationship-type'].connects, {
        source: { node: 'auth-service.py' },
        destination: { node: 'billing-service.py' },
      });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  // 2. Override references a decision_record_ref that doesn't resolve -> rejected, not applied.
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loom-overrides-'));
    try {
      fs.writeFileSync(path.join(dir, 'ov.json'), JSON.stringify(relOverride('ov-2', 'dr-does-not-exist')));
      const { calm, result } = applyOverrides(baseCalm, dir);
      assert.equal(result.applied.length, 0, 'no DR -> must be rejected, never applied');
      assert.equal(result.rejected.length, 1);
      assert.equal(calm.relationships.length, 0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  // 3. relationship_add targeting a node that doesn't exist -> rejected (no dangling endpoint).
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loom-overrides-'));
    try {
      fs.writeFileSync(path.join(dir, 'dr.json'), JSON.stringify(decisionRecord('dr-3')));
      const badOverride = relOverride('ov-3', 'dr-3', 'auth-service.py--calls-->ghost-service.py');
      badOverride.new_value['relationship-type'].connects.destination.node = 'ghost-service.py';
      fs.writeFileSync(path.join(dir, 'ov.json'), JSON.stringify(badOverride));
      const { calm, result } = applyOverrides(baseCalm, dir);
      assert.equal(result.applied.length, 0, 'relationship_add to a nonexistent node must be rejected');
      assert.equal(result.rejected.length, 1);
      assert.ok(result.rejected[0].reason.includes('ghost-service.py'));
      assert.equal(calm.relationships.length, 0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  // 4. relationship_remove — add then remove in the same pass, ends with 0 relationships.
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loom-overrides-'));
    try {
      fs.writeFileSync(path.join(dir, 'dr1.json'), JSON.stringify(decisionRecord('dr-4a')));
      fs.writeFileSync(path.join(dir, 'ov1.json'), JSON.stringify(relOverride('ov-4a', 'dr-4a')));
      fs.writeFileSync(path.join(dir, 'dr2.json'), JSON.stringify({ ...decisionRecord('dr-4b'), final_decision: { action: 'removed' } }));
      fs.writeFileSync(
        path.join(dir, 'ov2.json'),
        JSON.stringify({
          override_id: 'ov-4b',
          module: 'architecture',
          target_ref: 'auth-service.py--calls-->billing-service.py',
          override_type: 'relationship_remove',
          decision_record_ref: 'dr-4b',
          status: 'active',
          created_by: 'test',
          created_at: new Date().toISOString(),
        })
      );
      const { calm, result } = applyOverrides(baseCalm, dir);
      assert.equal(result.applied.length, 2);
      assert.equal(calm.relationships.length, 0, 'add then remove in the same pass should net to 0 relationships');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('Relationship overrides end-to-end via CLI --overrides, calm validate 0 errors (T-X6-1)', () => {
  const overridesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'loom-overrides-e2e-'));
  try {
    const targetRef = 'src/users.controller.ts--connects-->orphan-service';
    fs.writeFileSync(
      path.join(overridesDir, 'dr.json'),
      JSON.stringify({
        decision_id: 'dr-e2e',
        module: 'architecture',
        target_type: 'node',
        target_ref: 'orphan-service',
        final_decision: { action: 'added' },
        rationale: 'end-to-end CLI test',
        reviewer: 'test',
        reviewed_at: new Date().toISOString(),
        status: 'active',
      })
    );
    fs.writeFileSync(
      path.join(overridesDir, 'ov.json'),
      JSON.stringify({
        override_id: 'ov-e2e',
        module: 'architecture',
        target_ref: 'orphan-service', // node_add's target_ref is the NEW node's own id, not the relationship's — matches new_value['unique-id']
        override_type: 'node_add',
        new_value: { 'unique-id': 'orphan-service', 'node-type': 'service', name: 'orphan-service', description: 'test' },
        decision_record_ref: 'dr-e2e',
        status: 'active',
        created_by: 'test',
        created_at: new Date().toISOString(),
      })
    );
    // Separate DR for the relationship_add — one DR per decision, not shared with the node_add above.
    fs.writeFileSync(
      path.join(overridesDir, 'dr2.json'),
      JSON.stringify({
        decision_id: 'dr-e2e-2',
        module: 'architecture',
        target_type: 'relationship',
        target_ref: targetRef,
        final_decision: { action: 'added' },
        rationale: 'end-to-end CLI test relationship',
        reviewer: 'test',
        reviewed_at: new Date().toISOString(),
        status: 'active',
      })
    );
    fs.writeFileSync(
      path.join(overridesDir, 'ov2.json'),
      JSON.stringify({
        override_id: 'ov-e2e-2',
        module: 'architecture',
        target_ref: targetRef,
        override_type: 'relationship_add',
        new_value: {
          'unique-id': targetRef,
          description: 'test edge',
          'relationship-type': { connects: { source: { node: 'src/users.controller.ts' }, destination: { node: 'orphan-service' } } },
        },
        decision_record_ref: 'dr-e2e-2',
        status: 'active',
        created_by: 'test',
        created_at: new Date().toISOString(),
      })
    );

    const { outDir, calm } = runPipeline([path.join(PIPELINE_ROOT, 'test/fixtures/nestjs-sample')], ['--overrides', overridesDir]);
    try {
      assert.ok(calm.relationships.some((r) => r['unique-id'] === targetRef), 'relationship_add via --overrides did not land in architecture.calm.json');
      const report = JSON.parse(fs.readFileSync(path.join(outDir, 'modules/calm-generator/overrides-applied-report.json'), 'utf8'));
      assert.equal(report.applied.length, 2, 'expected node_add + relationship_add both applied');
      const { errors } = validateCalm(path.join(outDir, 'architecture.calm.json'));
      assert.equal(errors, 0);
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(overridesDir, { recursive: true, force: true });
  }
});

test('OpenAPI fixture — static provider discovers routes + securitySchemes, standalone unit, calm validate 0 errors (T-X4-1)', () => {
  const { outDir, calm } = runPipeline([path.join(PIPELINE_ROOT, 'test/fixtures/openapi-sample')]);
  try {
    assert.equal(calm.nodes.length, 1);
    const node = calm.nodes[0];
    assert.equal(node['node-type'], 'service');
    assert.equal(node.name, 'Widgets API');
    const paths = node.interfaces.map((i) => i.path).sort();
    assert.deepEqual(paths, ['GET /widgets', 'GET /widgets/{id}', 'POST /widgets']);

    const coverage = JSON.parse(fs.readFileSync(path.join(outDir, 'coverage-report.json'), 'utf8'));
    assert.equal(coverage.roots[0].openapiStatus, 'present');

    const { errors } = validateCalm(path.join(outDir, 'architecture.calm.json'));
    assert.equal(errors, 0);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test(
  'Outbound HTTP — real requests import in BoA frontend.py produces unresolved-http-target, not a fabricated relationship (T-X8-3, real evidence)',
  { skip: !fs.existsSync(BOA_ROOT) && 'spikes/boa/repo not present (scratch clone, see CLAUDE.md)' },
  () => {
    const { outDir, calm } = runPipeline([path.join(BOA_ROOT, '..', 'frontend')]);
    try {
      const ignored = JSON.parse(fs.readFileSync(path.join(outDir, 'ignored-items-report.json'), 'utf8'));
      const httpUnresolved = ignored.filter((i) => i.detail?.startsWith('unresolved-http-target:'));
      assert.ok(httpUnresolved.length >= 1, 'expected at least 1 unresolved-http-target ignored item — frontend.py genuinely imports requests and calls other services');
      assert.ok(httpUnresolved.every((i) => i.reason === 'CROSS_DOMAIN_UNRESOLVED'));
      assert.ok(httpUnresolved.every((i) => i.detail.includes('requests')), 'BoA frontend uses the Python requests library, grep-verified');
      // Never a fabricated relationship — every real target in frontend.py is env-var-mediated, not a literal, so none should be resolvable.
      assert.equal(calm.relationships.length, 0, 'no relationship should be fabricated from import-only evidence with no resolvable target');
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  }
);

test('Deployable manifest detection — package.json visible in coverage even with no correlation to a specific unit (T-X8-1)', () => {
  const { outDir } = runPipeline([path.join(PIPELINE_ROOT, 'test/fixtures/nestjs-sample')]);
  try {
    const coverage = JSON.parse(fs.readFileSync(path.join(outDir, 'coverage-report.json'), 'utf8'));
    assert.deepEqual(coverage.roots[0].deployableManifests, ['package.json']);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('OpenAPI absent — coverage reports openapiStatus: absent, run completes normally (T-X4-1 mitigation)', () => {
  const { outDir } = runPipeline([path.join(PIPELINE_ROOT, 'test/fixtures/nestjs-sample')]);
  try {
    const coverage = JSON.parse(fs.readFileSync(path.join(outDir, 'coverage-report.json'), 'utf8'));
    assert.equal(coverage.roots[0].openapiStatus, 'absent');
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test(
  'System node + composed-of — real BoA output, disableable via --no-system-node (T-X7-3)',
  { skip: !fs.existsSync(BOA_ROOT) && 'spikes/boa/repo not present (scratch clone, see CLAUDE.md)' },
  () => {
    const { outDir, calm } = runPipeline([path.join(BOA_ROOT, 'userservice'), path.join(BOA_ROOT, 'contacts')]);
    try {
      const systemNodes = calm.nodes.filter((n) => n['node-type'] === 'system');
      assert.equal(systemNodes.length, 1, 'expected exactly one system node when 2+ real nodes exist');
      const composedOf = calm.relationships.filter((r) => r['relationship-type']['composed-of']);
      assert.equal(composedOf.length, 1);
      const { container, nodes: composedNodeIds } = composedOf[0]['relationship-type']['composed-of'];
      assert.equal(container, systemNodes[0]['unique-id']);
      assert.equal(composedNodeIds.length, calm.nodes.length - 1, 'system must be composed-of every OTHER node, not itself');

      const { outDir: outDirNoSys, calm: calmNoSys } = runPipeline([path.join(BOA_ROOT, 'userservice'), path.join(BOA_ROOT, 'contacts')], ['--no-system-node']);
      try {
        assert.equal(calmNoSys.nodes.filter((n) => n['node-type'] === 'system').length, 0, '--no-system-node must suppress it entirely');
      } finally {
        fs.rmSync(outDirNoSys, { recursive: true, force: true });
      }
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  }
);

test('Interface merge precedence — native-route beats openapi beats decorator, deduped within tier (T-X4-2)', () => {
  const { buildCalm } = require(path.join(PIPELINE_ROOT, 'dist/modules/calm-generator/build-calm'));
  const facts = {
    contractVersion: '2.0.0',
    runVersion: 'test',
    generatedAt: new Date().toISOString(),
    packageRoots: [],
    units: [
      {
        id: 'svc.py',
        kind: 'service',
        name: 'svc.py',
        filePath: 'svc.py',
        startLine: 1,
        endLine: 10,
        evidence: [
          { signal: 'GET /users', source: 'native-route', category: 'http-entry-point', weight: 40, ref: 'svc.py:1' },
          { signal: 'GET /users', source: 'openapi', category: 'http-entry-point', weight: 40, ref: 'openapi.yaml:paths./users.get' },
          { signal: 'POST /users', source: 'decorator', category: 'http-entry-point', weight: 40, ref: 'svc.py:5' },
        ],
        confidence: 100,
      },
    ],
    relationships: [],
    ignoredItems: [],
  };

  const calm = buildCalm(facts);
  const node = calm.nodes[0];
  // native-route is the lowest tier present -> only its evidence wins, openapi/decorator entries for this unit are suppressed entirely.
  assert.equal(node.interfaces.length, 1, 'only the native-route-tier interface should survive when native-route evidence exists');
  assert.equal(node.interfaces[0].path, 'GET /users');
});

test('Evidence packs redact secret-looking lines, --no-snippets suppresses snippets entirely (T-X3-1)', () => {
  const { buildEvidencePacks } = require(path.join(PIPELINE_ROOT, 'dist/analysis/ir/evidence-packs'));
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'loom-evidence-pack-'));
  try {
    const filePath = path.join(fixtureDir, 'config.py');
    fs.writeFileSync(
      filePath,
      ['# some file', 'password = "hunter2"', '@app.custom_decorator()', 'def handler():', '    pass'].join('\n')
    );
    const ignoredItems = [{ ref: 'config.py:3', reason: 'INSUFFICIENT_EVIDENCE', detail: 'No signal-catalogue.yml rule matched raw signal "custom_decorator"' }];

    const withSnippets = buildEvidencePacks(ignoredItems, [fixtureDir], true);
    assert.equal(withSnippets.length, 1);
    assert.ok(withSnippets[0].snippet, 'expected a snippet when includeSnippets=true');
    const snippetText = withSnippets[0].snippet.join('\n');
    assert.ok(!snippetText.includes('hunter2'), 'secret value must be redacted');
    assert.ok(snippetText.includes('[REDACTED]'), 'redaction marker must be present');
    assert.ok(snippetText.includes('password'), 'redaction should keep the key name, only strip the value');

    const withoutSnippets = buildEvidencePacks(ignoredItems, [fixtureDir], false);
    assert.equal(withoutSnippets[0].snippet, undefined, '--no-snippets must produce no snippet at all');
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test('--strict-detect exits non-zero on a suspected detect()-gate silent failure, default stays warn-only (T-X1-2)', () => {
  const STRICT_ROOT = path.join(PIPELINE_ROOT, 'test/fixtures/strict-detect-sample');
  const codegraphCache = path.join(STRICT_ROOT, '.codegraph');

  const runAndCapture = (extraArgs) => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'loom-test-'));
    try {
      execFileSync('node', [RUN_SLICE, STRICT_ROOT, '--out', outDir, ...extraArgs], { stdio: 'pipe' });
      return { exitCode: 0 };
    } catch (err) {
      return { exitCode: err.status };
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  };

  try {
    assert.equal(runAndCapture([]).exitCode, 0, 'default (no flag) must stay warn-only, not fail the run');
    assert.equal(runAndCapture(['--strict-detect']).exitCode, 1, '--strict-detect must fail on grep-verified routes with 0 native routes');
  } finally {
    fs.rmSync(codegraphCache, { recursive: true, force: true });
  }
});

test('Platform artefacts — coverage-report.json and unmapped-signals-report.json write with real counts (T-X0-1/T-X0-2)', () => {
  const { outDir } = runPipeline([path.join(PIPELINE_ROOT, 'test/fixtures/nestjs-sample')]);
  try {
    const coverage = JSON.parse(fs.readFileSync(path.join(outDir, 'coverage-report.json'), 'utf8'));
    assert.equal(coverage.roots.length, 1);
    assert.equal(coverage.roots[0].nativeRouteCount, 3, 'NestJS fixture has 3 native routes');
    assert.equal(coverage.roots[0].filesByExt['.ts'], 1);
    assert.ok(['ok', 'failed', 'skipped'].includes(coverage.graphifyStatus));

    const unmapped = JSON.parse(fs.readFileSync(path.join(outDir, 'unmapped-signals-report.json'), 'utf8'));
    assert.equal(unmapped.clusterCount, 0, 'NestJS fixture has no unmapped signals — every decorator matches a catalogue rule');
    assert.ok(unmapped.footer.includes('T-XI-5'));

    // Generic cross-cutting fields exist and are real objects even when empty (post-review fix).
    assert.deepEqual(coverage.relationshipsByKind, {});
    assert.deepEqual(coverage.relationshipsBySource, {});
    assert.deepEqual(coverage.unresolvedByMechanism, {});
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('Platform IR (intelligence-ir.md) renders after modules run, reads module output as a projection appendix (T-X3-2)', () => {
  const { outDir } = runPipeline([path.join(PIPELINE_ROOT, 'test/fixtures/nestjs-sample')]);
  try {
    const irPath = path.join(outDir, 'intelligence-ir.md');
    assert.ok(fs.existsSync(irPath), 'intelligence-ir.md not written');
    const ir = fs.readFileSync(irPath, 'utf8');
    assert.ok(ir.startsWith('# Intelligence IR'));
    assert.ok(ir.includes('not a CALM draft'), 'IR must not be framed as a CALM draft (Extraction_Gaps §3.4)');
    assert.ok(ir.includes('## Units (1)'));
    assert.ok(ir.includes('CALM preview: 1 node(s)'), 'module-projection appendix must read real calm-generator output');
    assert.ok(ir.includes('Threat findings: 1'), 'module-projection appendix must read real threat-signals output');
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('Module registry — version-incompatible module is skipped, a throwing module is isolated, later modules still run', () => {
  const { runModules } = require(path.join(PIPELINE_ROOT, 'dist/modules/registry'));
  const facts = { contractVersion: '1.0.0', runVersion: 'x', generatedAt: 'x', packageRoots: [], units: [], relationships: [], ignoredItems: [] };

  let incompatibleRan = false;
  let goodRan = false;
  const incompatibleModule = { name: 'future-module', supportedMajorVersion: '2', run: () => { incompatibleRan = true; } };
  const throwingModule = { name: 'buggy-module', supportedMajorVersion: '1', run: () => { throw new Error('deliberate test failure'); } };
  const goodModule = { name: 'good-module', supportedMajorVersion: '1', run: () => { goodRan = true; } };

  assert.doesNotThrow(() => runModules([incompatibleModule, throwingModule, goodModule], facts, { outDir: os.tmpdir() }));
  assert.equal(incompatibleRan, false, 'a version-incompatible module must never be invoked');
  assert.equal(goodRan, true, 'a module after a throwing one must still run');
});

// T-B3 (docs/solution/AGENT_TASKS_Solution_Cleanup_and_Prioritized_Actions.md) —
// a real gap: no fixture in this suite has ever produced a genuine
// service->service TypedRelationship (BoA/Fineract only ever exercise
// service->database). The interacts/connects fix (v0.9 §1, Solution Design
// v2 §5.3) is only actually proven for that one edge shape unless this case
// is tested directly. Synthetic TypedFacts, run through the real buildCalm(),
// not the CLI — this is a unit test of relationship-builder.ts's mapping,
// not an integration test of the scanner.
test('Service->service relationship maps to connects, never interacts (v0.9 §1 fix, golden case)', () => {
  const { buildCalm } = require(path.join(PIPELINE_ROOT, 'dist/modules/calm-generator/build-calm'));
  const facts = {
    contractVersion: '1.0.0',
    runVersion: 'test',
    generatedAt: new Date().toISOString(),
    packageRoots: [],
    units: [
      { id: 'auth-service.py', kind: 'service', name: 'auth-service.py', filePath: 'auth-service.py', startLine: 1, endLine: 10, evidence: [{ signal: 'app.route', source: 'native-route', category: 'http-entry-point', weight: 40, ref: 'auth-service.py:1' }], confidence: 100 },
      { id: 'billing-service.py', kind: 'service', name: 'billing-service.py', filePath: 'billing-service.py', startLine: 1, endLine: 10, evidence: [{ signal: 'app.route', source: 'native-route', category: 'http-entry-point', weight: 40, ref: 'billing-service.py:1' }], confidence: 100 },
    ],
    relationships: [{ from: 'auth-service.py', to: 'billing-service.py', kind: 'calls', crossPackage: false, source: 'graphify' }],
    ignoredItems: [],
  };

  const calm = buildCalm(facts, false); // system node (T-X7-3) would add an unrelated 2nd relationship — this test is scoped to connects/interacts mapping only
  assert.equal(calm.relationships.length, 1);
  const rel = calm.relationships[0]['relationship-type'];
  assert.ok(rel.connects, 'service->service relationship must map to connects, not interacts — the v0.9 §1 bug this fix exists for');
  assert.equal(rel.interacts, undefined, 'interacts must never be emitted — no catalogue row requests it (§5.3)');
  assert.deepEqual(rel.connects, { source: { node: 'auth-service.py' }, destination: { node: 'billing-service.py' } });
});

test('Protocol population — JDBC inferred from real evidence (org.postgresql), never invented when unevidenced (T-X7-4)', () => {
  const { buildCalm } = require(path.join(PIPELINE_ROOT, 'dist/modules/calm-generator/build-calm'));
  const makeFacts = (dbEvidenceSignal) => ({
    contractVersion: '4.0.0',
    runVersion: 'test',
    generatedAt: new Date().toISOString(),
    packageRoots: [],
    units: [
      { id: 'Service.java', kind: 'service', name: 'Service.java', filePath: 'Service.java', startLine: 1, endLine: 10, evidence: [{ signal: 'GET /x', source: 'native-route', category: 'http-entry-point', weight: 40, ref: 'Service.java:1' }], confidence: 100 },
      { id: 'Db.java::Db', kind: 'database', name: 'Db', filePath: 'Db.java', startLine: 1, endLine: 5, evidence: [{ signal: dbEvidenceSignal, source: 'graphify-import', category: 'persistence', weight: 20, ref: 'Db.java:1' }], confidence: 20 },
    ],
    relationships: [{ from: 'Service.java', to: 'Db.java::Db', kind: 'connects', crossPackage: false, source: 'graphify' }],
    ignoredItems: [],
  });

  // Real, unambiguous evidence (org.postgresql IS the Postgres JDBC driver) -> JDBC, a real CALM protocol enum value.
  const calmWithEvidence = buildCalm(makeFacts('org.postgresql'), false);
  assert.equal(calmWithEvidence.relationships[0].protocol, 'JDBC');

  // No library maps to a known protocol -> stays unset, never guessed.
  const calmWithoutEvidence = buildCalm(makeFacts('sqlalchemy'), false);
  assert.equal(calmWithoutEvidence.relationships[0].protocol, undefined, 'sqlalchemy has no CALM protocol enum equivalent (Python, not JDBC) — must stay null, not invented');
});

test('shares-secret relationship kind maps to connects with a distinct description, protocol stays null (T-X5-0, golden case)', () => {
  const { buildCalm } = require(path.join(PIPELINE_ROOT, 'dist/modules/calm-generator/build-calm'));
  const facts = {
    contractVersion: '3.0.0',
    runVersion: 'test',
    generatedAt: new Date().toISOString(),
    packageRoots: [],
    units: [
      { id: 'auth-service.py', kind: 'service', name: 'auth-service.py', filePath: 'auth-service.py', startLine: 1, endLine: 10, evidence: [{ signal: 'app.route', source: 'native-route', category: 'http-entry-point', weight: 40, ref: 'auth-service.py:1' }], confidence: 100 },
      { id: 'billing-service.py', kind: 'service', name: 'billing-service.py', filePath: 'billing-service.py', startLine: 1, endLine: 10, evidence: [{ signal: 'app.route', source: 'native-route', category: 'http-entry-point', weight: 40, ref: 'billing-service.py:1' }], confidence: 100 },
    ],
    relationships: [{ from: 'auth-service.py', to: 'billing-service.py', kind: 'shares-secret', crossPackage: false, source: 'k8s' }],
    ignoredItems: [],
  };

  const calm = buildCalm(facts, false); // system node (T-X7-3) would add an unrelated 2nd relationship — this test is scoped to relationship-type mapping only
  assert.equal(calm.relationships.length, 1);
  const calmRel = calm.relationships[0];
  assert.ok(calmRel['relationship-type'].connects, 'shares-secret must still map to CALM connects — no dedicated trust shape exists');
  assert.deepEqual(calmRel['relationship-type'].connects, { source: { node: 'auth-service.py' }, destination: { node: 'billing-service.py' } });
  assert.equal(calmRel.protocol, undefined, 'protocol must stay unset/null — a shared secret name is not a network protocol, never invented');
  assert.ok(calmRel.description.includes('shares-secret'), 'the TypedRelationship.kind distinction must survive into the CALM description, even though the shape is connects');
});

test(
  'Env soft-graph — OFF by default, real BoA name-correlation when enabled, red-team: no ConfigMap VALUES ever leak (T-X9-0/T-X9-1)',
  { skip: !fs.existsSync(BOA_ROOT) && 'spikes/boa/repo not present (scratch clone, see CLAUDE.md)' },
  () => {
    const k8sManifestsDir = path.resolve(BOA_ROOT, '..', '..', 'kubernetes-manifests');
    const roots = [path.join(BOA_ROOT, 'userservice'), path.join(BOA_ROOT, 'contacts'), path.join(BOA_ROOT, '..', 'frontend')];

    // 1. Default (no flag, even with --k8s-manifests present) — must be a no-op.
    {
      const { outDir, calm } = runPipeline(roots, ['--k8s-manifests', k8sManifestsDir]);
      try {
        const envRels = calm.relationships.filter((r) => r.metadata?.some((m) => m.key === 'x-aac-confidence'));
        assert.equal(envRels.length, 0, 'env soft-graph must be OFF by default even when --k8s-manifests is passed');
      } finally {
        fs.rmSync(outDir, { recursive: true, force: true });
      }
    }

    // 2. --enable-env-soft-graph — real BoA name correlation.
    {
      const { outDir, calm } = runPipeline(roots, ['--k8s-manifests', k8sManifestsDir, '--enable-env-soft-graph']);
      try {
        const envRels = calm.relationships.filter((r) => r.metadata?.some((m) => m.key === 'x-aac-confidence' && m.value === 20));
        const pairs = envRels.map((r) => `${r['relationship-type'].connects.source.node}->${r['relationship-type'].connects.destination.node}`).sort();
        // Real, grep-verified: service-api-config's USERSERVICE_API_ADDR/CONTACTS_API_ADDR keys name-correlate
        // exactly to the real userservice/contacts deployments; frontend is the only deployment in this
        // run's roots that references that ConfigMap.
        assert.deepEqual(pairs, ['frontend.py->contacts.py', 'frontend.py->userservice.py']);

        const ignored = JSON.parse(fs.readFileSync(path.join(outDir, 'ignored-items-report.json'), 'utf8'));
        const envUnresolved = ignored.filter((i) => i.detail?.startsWith('unresolved-env-target:'));
        assert.ok(envUnresolved.length > 0, 'expected real unresolved entries too — e.g. BALANCES_API_ADDR has no naming correlation to "balance-reader"');

        const { errors, warnings } = validateCalm(path.join(outDir, 'architecture.calm.json'));
        assert.equal(errors, 0);
        assert.equal(warnings, 0);

        // RED TEAM (mandatory per T-X9-1): the real ConfigMap VALUES (k8s Service DNS
        // names/ports, e.g. "userservice:8080") must never appear anywhere in any
        // written artefact — only key NAMES are ever read.
        const allOutputFiles = fs.readdirSync(outDir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile());
        const secretValues = ['userservice:8080', 'contacts:8080', 'balancereader:8080', 'ledgerwriter:8080', 'transactionhistory:8080', '883745000'];
        for (const entry of allOutputFiles) {
          const content = fs.readFileSync(path.join(entry.parentPath ?? entry.path, entry.name), 'utf8');
          for (const value of secretValues) {
            assert.ok(!content.includes(value), `RED TEAM FAILURE: ConfigMap value "${value}" leaked into ${entry.name}`);
          }
        }
      } finally {
        fs.rmSync(outDir, { recursive: true, force: true });
      }
    }
  }
);

test(
  'Deployment correlation — Java Controller-class naming resolves via normalize+substring, never matches a database/topic unit (generic fix, real full-BoA evidence)',
  { skip: !fs.existsSync(BOA_ROOT) && 'spikes/boa/repo not present (scratch clone, see CLAUDE.md)' },
  () => {
    const k8sManifestsDir = path.resolve(BOA_ROOT, '..', '..', 'kubernetes-manifests');
    const ledgerRoot = path.resolve(BOA_ROOT, '..', 'ledger');
    const roots = [
      path.join(BOA_ROOT, 'userservice'),
      path.join(BOA_ROOT, 'contacts'),
      path.join(BOA_ROOT, '..', 'frontend'),
      path.join(ledgerRoot, 'balancereader'),
      path.join(ledgerRoot, 'ledgerwriter'),
      path.join(ledgerRoot, 'transactionhistory'),
    ];
    const { outDir, calm } = runPipeline(roots, ['--k8s-manifests', k8sManifestsDir, '--enable-env-soft-graph']);
    try {
      const trustTargets = calm.relationships.filter((r) => r.description?.startsWith('shares-secret')).map((r) => r['relationship-type'].connects.source.node);
      // Before the generic deployment-correlation fix, none of these three Java
      // services ever correlated (exact-match-only against verbose Controller
      // class names) — real regression guard, not a synthetic case.
      assert.ok(trustTargets.some((n) => n.endsWith('BalanceReaderController.java')), 'balance-reader must now correlate to BalanceReaderController.java');
      assert.ok(trustTargets.some((n) => n.endsWith('LedgerWriterController.java')), 'ledger-writer must now correlate to LedgerWriterController.java');
      assert.ok(trustTargets.some((n) => n.endsWith('TransactionHistoryController.java')), 'transaction-history must now correlate to TransactionHistoryController.java');

      // The real false-positive this fix's own substring matching introduced and then corrected:
      // "transaction" is a substring of "transactionhistory", which would wrongly match the JPA
      // entity Transaction.java instead of the real TransactionHistoryController.java service.
      // Scoped to the k8s-derived relationships only (shares-secret + x-aac-confidence env edges) —
      // Transaction.java legitimately appears as a same-package graphify connects target elsewhere
      // (LedgerWriterController -> Transaction.java is a real, correct, unrelated relationship).
      const k8sDerivedEndpoints = calm.relationships
        .filter((r) => r.description?.startsWith('shares-secret') || r.metadata?.some((m) => m.key === 'x-aac-confidence'))
        .flatMap((r) => {
          const c = r['relationship-type'].connects;
          return c ? [c.source.node, c.destination.node] : [];
        });
      assert.ok(!k8sDerivedEndpoints.some((n) => n.endsWith('Transaction.java')), 'a k8s Deployment must never correlate to a database-kind unit (Transaction.java, a JPA entity), only a service-kind one');

      const { errors, warnings } = validateCalm(path.join(outDir, 'architecture.calm.json'));
      assert.equal(errors, 0);
      assert.equal(warnings, 0);

      // Coverage cross-cutting breakdown (generic fix, T-X0-1 extension) — real counts, not hardcoded mechanism names.
      const coverage = JSON.parse(fs.readFileSync(path.join(outDir, 'coverage-report.json'), 'utf8'));
      assert.equal(coverage.relationshipsByKind['shares-secret'], 5);
      assert.equal(coverage.relationshipsBySource.k8s, 5 + 6, 'shares-secret (5) + env-soft-graph connects (6), both source: k8s');
      assert.ok(coverage.unresolvedByMechanism['unresolved-env-target'] > 0);
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  }
);
