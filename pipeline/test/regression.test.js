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
const FINERACT_KAFKA_PRODUCER_ROOT = path.resolve(FINERACT_ROOT, 'fineract-provider/src/main/java/org/apache/fineract/infrastructure/event/external/producer/kafka');
const GHOSTFOLIO_ACCESS_ROOT = path.resolve(PIPELINE_ROOT, '../spikes/ghostfolio/repo/apps/api/src/app/access');
const GHOSTFOLIO_PRISMA_ROOT = path.resolve(PIPELINE_ROOT, '../spikes/ghostfolio/repo/apps/api/src/services/prisma');
const FINERACT_SECURITY_ROOT = path.resolve(FINERACT_ROOT, 'fineract-security');
const FINERACT_PROVIDER_ROOT = path.resolve(FINERACT_ROOT, 'fineract-provider');
const WALTZ_DATA_ROOT = path.resolve(PIPELINE_ROOT, '../spikes/waltz/repo/waltz-data');
const WALTZ_WEB_ROOT = path.resolve(PIPELINE_ROOT, '../spikes/waltz/repo/waltz-web');
const LAB_ROOT = path.resolve(PIPELINE_ROOT, '../coe-lab'); // checked-in, not a scratch clone — no skip guard needed

function runPipeline(roots, extraArgs = [], nodeArgs = []) {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'loom-test-'));
  execFileSync('node', [...nodeArgs, RUN_SLICE, ...roots, '--out', outDir, ...extraArgs], { stdio: 'pipe' });
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

function relMetadata(rel, key) {
  return rel.metadata?.find((m) => m.key === key)?.value;
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

    // AREC T-A2 — every real (non-system-node) relationship must be graded;
    // a service<->database edge (R1 one-hop) must be graded 'architecture',
    // never left ungraded or mis-labeled 'structural'. The system node's own
    // composed-of relationship (T-X7-3) is excluded: it's synthetic CALM
    // scaffolding built directly by system-node-builder.ts, not a
    // TypedRelationship any Analysis-layer producer emitted — grading it
    // would be meaningless (there is no R/S question to answer about "the
    // system contains node X").
    for (const rel of calm.relationships) {
      if (rel['relationship-type']['composed-of']) continue;
      assert.ok(relMetadata(rel, 'x-aac-relationship-grade'), `relationship ${rel['unique-id']} missing x-aac-relationship-grade`);
    }
    const serviceIds = new Set([userservice, contacts].map((n) => n['unique-id']));
    const dbIds = new Set([userDb, contactsDb].map((n) => n['unique-id']));
    const serviceToDbRel = calm.relationships.find((rel) => {
      const conn = rel['relationship-type']?.connects;
      if (!conn) return false;
      const a = conn.source.node,
        b = conn.destination.node;
      return (serviceIds.has(a) && dbIds.has(b)) || (serviceIds.has(b) && dbIds.has(a));
    });
    // AREC Wave 3 T-B1 (R1 lock) — this IS the hard regression T-B1 asks
    // for: a real service->database `connects` relationship, asserted by
    // ENDPOINT KIND (not just "relationships.length >= 1", which a
    // structural-only entity mesh could also satisfy) so R2 work in Session
    // C/D cannot silently regress the one architecture shape that already
    // works. If this starts failing, R1 broke — fix R1, don't loosen this.
    assert.ok(serviceToDbRel, 'T-B1 R1 lock: expected a service->database relationship (R1 one-hop) — BoA-class shape must never regress');
    assert.equal(relMetadata(serviceToDbRel, 'x-aac-relationship-grade'), 'architecture', 'service->database relationship must be graded architecture, not structural');

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

      // AREC Wave 3 T-E3 — Spring Data repository detection (extends-based).
      // Real evidence: ChargeRepository.java's `extends JpaRepository<Charge, Long>`.
      const repo = findNode(calm, 'ChargeRepository.java');
      assert.ok(repo, 'ChargeRepository.java node missing — spring-data-repository extends-detection regression');
      assert.equal(repo['node-type'], 'database', 'a Spring Data repository interface must be typed database');
      // Real knock-on win: ChargeRepository is now a visible TypedUnit, so
      // the standard R0 Graphify reconciler picks up its real imports edge
      // to Charge — a genuine additional relationship, not fabricated.
      const repoToCharge = calm.relationships.find((rel) => {
        const conn = rel['relationship-type']?.connects;
        return conn && conn.source.node === repo['unique-id'] && conn.destination.node === charge['unique-id'];
      });
      assert.ok(repoToCharge, 'expected a real ChargeRepository -> Charge connects relationship now that ChargeRepository is a real unit');

      const { errors, warnings } = validateCalm(path.join(outDir, 'architecture.calm.json'));
      assert.equal(errors, 0);
      assert.equal(warnings, 0);
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

      // AREC Wave 3 T-D1 — real bug found and fixed this session:
      // AppUser.java is a genuine @Entity that ALSO calls
      // validateHasPermission()/validateHasReadPermission() internally. The
      // old "service wins any tie" precedence would have mistyped it
      // 'service', discarding its persistence identity. Must stay 'database'
      // AND still carry the real security-rbac-002 (call-site) control —
      // both facts are true about this class at once.
      const appUser = findNode(calm, 'AppUser.java');
      assert.ok(appUser, 'AppUser.java node missing');
      assert.equal(appUser['node-type'], 'database', 'a real @Entity with internal auth-check calls must stay database, not be reclassified service (T-D1 precedence fix)');
      assert.ok(appUser.controls?.['security-rbac-002'], 'expected AppUser to also carry the call-site security-rbac-002 control despite being database-typed');

      const { errors } = validateCalm(path.join(outDir, 'architecture.calm.json'));
      assert.equal(errors, 0, 'control-url-mapping regression — calm-cli host-allowlist check failing again');
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  }
);

test(
  'Robustness T-R1-3 follow-up (B-charge-jdbc-driver) — real multi-root closure of the flagship Fineract residual: ChargesApiResource -> ChargeReadPlatformServiceImpl now resolves, real cross-root confidence 10',
  {
    skip: !fs.existsSync(FINERACT_PROVIDER_ROOT) && 'spikes/fineract/repo/fineract-provider not present (scratch clone, see CLAUDE.md)',
    timeout: 180_000, // real combined scan of 2733+37 Java files — genuinely slow, not a hang
  },
  () => {
    // fineract-provider (2733 files) needs a raised heap ceiling — a real,
    // separate, non-bug finding from the earlier pushAll crash-fix session
    // (Node's default ~4GB limit, confirmed not a leak). Not needed for any
    // other test in this suite; scoped to this one via nodeArgs.
    const { outDir } = runPipeline(
      [path.join(FINERACT_ROOT, 'fineract-charge'), FINERACT_PROVIDER_ROOT],
      [],
      ['--max-old-space-size=8192']
    );
    try {
      const facts = JSON.parse(fs.readFileSync(path.join(outDir, 'typed-facts.json'), 'utf8'));
      const units = new Map(facts.units.map((u) => [u.id, u]));

      // The real closure: ChargeReadPlatformServiceImpl now imports a
      // catalogue-recognized driver (org.springframework.jdbc.core) directly,
      // so it becomes its OWN real database unit (Phase 1 "implementer IS the
      // store" case — R2b's extra hop isn't even needed for this one).
      const implUnit = [...units.values()].find((u) => u.filePath.endsWith('ChargeReadPlatformServiceImpl.java'));
      assert.ok(implUnit, 'ChargeReadPlatformServiceImpl.java must now be a real database unit');
      assert.equal(implUnit.kind, 'database');
      assert.ok(
        implUnit.evidence.some((e) => e.signal === 'org.springframework.jdbc.core.JdbcTemplate' || e.signal.startsWith('org.springframework.jdbc.core')),
        `expected evidence naming the real org.springframework.jdbc.core import, got: ${implUnit.evidence.map((e) => e.signal).join(', ')}`
      );

      // The flagship relationship itself — real, cross-root (fineract-charge
      // -> fineract-provider), R2 Phase 1's cross-root confidence tier (10),
      // not R2b's (R2b's extra hop wasn't needed once the implementer became
      // a unit in its own right).
      const flagshipRel = facts.relationships.find(
        (r) => r.from.endsWith('ChargesApiResource.java') && r.to.includes('ChargeReadPlatformServiceImpl')
      );
      assert.ok(flagshipRel, 'expected ChargesApiResource -> ChargeReadPlatformServiceImpl relationship — the exact residual named since requirements v0.9');
      assert.equal(flagshipRel.kind, 'calls');
      assert.equal(flagshipRel.crossPackage, true, 'ChargesApiResource (fineract-charge) and ChargeReadPlatformServiceImpl (fineract-provider) are in different roots');
      assert.equal(flagshipRel.confidence, 10, 'expected R2 Phase 1 cross-root confidence (10) — the implementer resolved as its own store unit, not via the R2b hop');
      assert.equal(flagshipRel.grade, 'architecture');
      assert.equal(flagshipRel.mechanism, 'r2-phase1', 'T-L2-1/AREC_Store_Terminal_Policy.md §2: the real flagship case resolves via Phase 1 short-circuit (S-layered-access), not R2b — this is the exact real-evidence claim the design note makes, now asserted, not just stated in prose');

      // T-L3-2 — mechanism visibility on the real multi-root run's own
      // coverage-report.json, the actual "visible on a multi-root sample
      // run" exit criterion, not just a typed-facts.json field check.
      // Real counts (checked directly, not assumed): this full real
      // fineract-charge+fineract-provider scan resolves 126 total multi-hop
      // edges across the whole codebase, not just the one flagship edge —
      // 121 via Phase 1, 5 via R2b. The flagship relationship's own
      // mechanism is already asserted above (r2-phase1); this only checks
      // the coverage breakdown reflects real, non-trivial counts for BOTH
      // mechanisms, which is the actual point of T-L3-2 (visibility of the
      // real breakdown), not a specific number that would be a maintenance
      // trap the next time Fineract's real source or the resolver changes.
      // Real finding while writing this assertion: NOT every kind:'calls'/
      // source:'graphify' relationship is multi-hop-derived — R0's own
      // direct reconciler (graphify-reconciler.ts) also emits kind:'calls'
      // whenever Graphify's raw edge.relation is itself 'calls' (a real,
      // same-package, non-bridge call edge). Those correctly leave
      // `mechanism` unset — a third, legitimate, non-multi-hop category —
      // so the two mechanism buckets are NOT expected to sum to every
      // 'calls'/'graphify' relationship. Checked directly against a real
      // run before asserting a stricter equality that would have been
      // wrong (126 multi-hop-mechanism edges vs 239 total calls/graphify
      // edges in this real scan).
      const coverage = JSON.parse(fs.readFileSync(path.join(outDir, 'coverage-report.json'), 'utf8'));
      assert.ok(coverage.relationshipsByMechanism['r2-phase1'] > 0, `expected relationshipsByMechanism.r2-phase1 > 0 in the real coverage report, got ${coverage.relationshipsByMechanism['r2-phase1']}`);
      assert.ok(coverage.relationshipsByMechanism['r2b'] > 0, `expected relationshipsByMechanism.r2b > 0 in the real coverage report (real layered chains beyond the flagship do resolve via R2b in this codebase), got ${coverage.relationshipsByMechanism['r2b']}`);

      const { errors, warnings } = validateCalm(path.join(outDir, 'architecture.calm.json'));
      assert.equal(errors, 0);
      assert.equal(warnings, 0);
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  }
);

test(
  'AREC T-D1/T-D2 — call-site control detection: real Fineract fineract-charge ChargesApiResource gets security-rbac-002 with expression, at grep-verified lines',
  { skip: !fs.existsSync(FINERACT_ROOT) && 'spikes/fineract/repo not present (scratch clone, see CLAUDE.md)' },
  () => {
    const { outDir, calm } = runPipeline([path.join(FINERACT_ROOT, 'fineract-charge')]);
    try {
      const resource = findNode(calm, 'ChargesApiResource.java');
      assert.ok(resource, 'ChargesApiResource.java node missing');
      const rbac = resource.controls?.['security-rbac-002'];
      assert.ok(rbac, 'expected security-rbac-002 (call-site) control — context.authenticatedUser().validateHasReadPermission(...) is real, grep-verified evidence in this file');
      // Grep-verified exact lines: 84, 101, 129 (docs/solution/AREC_R2_MultiHop_Strategy.md §1's own re-investigation of this file).
      const lines = rbac.requirements.map((r) => r.config.evidenceRef).sort();
      assert.deepEqual(lines, [
        'src/main/java/org/apache/fineract/portfolio/charge/api/ChargesApiResource.java:101',
        'src/main/java/org/apache/fineract/portfolio/charge/api/ChargesApiResource.java:129',
        'src/main/java/org/apache/fineract/portfolio/charge/api/ChargesApiResource.java:84',
      ]);
      // T-D2 (C-rich) — the call's raw argument text, not a resolved constant value.
      for (const req of rbac.requirements) {
        assert.equal(req.config.expression, 'RESOURCE_NAME_FOR_PERMISSIONS');
        // T-R2-3 (C-rich structured authority) — bare ALL_CAPS constant
        // shape, extracted as a literal token, never resolved to a value.
        assert.equal(req.config.authorityRef, 'RESOURCE_NAME_FOR_PERMISSIONS');
      }

      const { errors } = validateCalm(path.join(outDir, 'architecture.calm.json'));
      assert.equal(errors, 0);
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  }
);

test('AREC T-D1/T-D2 — call-site control detection: lab py-jwt-gateway fixture gets security-auth-001 (low weight, honest "token handling" wording), calm validate 0 errors', () => {
  const fixtureRoot = path.join(LAB_ROOT, 'fixtures/monorepo/packages/py-jwt-gateway');
  const { outDir, calm } = runPipeline([fixtureRoot]);
  try {
    const node = findNode(calm, 'auth_gateway.py');
    assert.ok(node, 'auth_gateway.py node missing');
    const auth = node.controls?.['security-auth-001'];
    assert.ok(auth, 'expected security-auth-001 (jwt.decode call-site) control');
    assert.equal(auth.requirements[0].config.evidenceRef, 'auth_gateway.py:14');
    // T-D2 — real, honest richness: shows the exact anti-pattern in source (verify_signature disabled), not hidden.
    assert.ok(auth.requirements[0].config.expression.includes('verify_signature'));

    const { errors } = validateCalm(path.join(outDir, 'architecture.calm.json'));
    assert.equal(errors, 0);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test(
  'Robustness T-R2-2 (C-call expansion) — real Waltz waltz-web: 4 real call sites get security-rbac-003 (UserRoleService.hasRole, a DIFFERENT real repo\'s own RBAC vocabulary), calm validate 0 errors',
  { skip: !fs.existsSync(WALTZ_WEB_ROOT) && 'spikes/waltz/repo/waltz-web not present (scratch clone, see CLAUDE.md)' },
  () => {
    const { outDir, calm } = runPipeline([WALTZ_WEB_ROOT]);
    try {
      // Grep-verified real call sites (WebUtilities.java:148, plus 3 real
      // endpoint classes that call it or the underlying service directly).
      // authorityRef (T-R2-3, C-rich structured authority): the 3 endpoint
      // classes' real argument text names a qualified SystemRole.XXX enum
      // member, extracted structurally; WebUtilities.java's own call site
      // (`hasRole(user, requiredRoles)`) only has plain variables — expect
      // NO authorityRef there, a real negative case, not an oversight.
      const expectedAuthorityRef = {
        'WebUtilities.java': undefined,
        'BulkUploadLegalEntityRelationshipEndpoint.java': 'SystemRole.BULK_LEGAL_ENTITY_RELATIONSHIP_EDITOR',
        'LicenceEndpoint.java': 'SystemRole.LICENCE_ADMIN',
        'SettingsEndpoint.java': 'SystemRole.ADMIN',
      };
      for (const [fileName, authorityRef] of Object.entries(expectedAuthorityRef)) {
        const node = findNode(calm, fileName);
        assert.ok(node, `${fileName} node missing`);
        const rbac = node.controls?.['security-rbac-003'];
        assert.ok(rbac, `expected security-rbac-003 (Waltz hasRole call-site) control on ${fileName}`);
        assert.equal(rbac.requirements[0].config.detectedVia, 'call');
        assert.equal(rbac.requirements[0].config.authorityRef, authorityRef, `authorityRef mismatch for ${fileName}`);
      }

      const { errors, warnings } = validateCalm(path.join(outDir, 'architecture.calm.json'));
      assert.equal(errors, 0);
      assert.equal(warnings, 0);
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  }
);

test('Robustness T-R2-2 (C-call expansion) — Fineract isAuthenticated() call-site: weighted 30 (below the fine-grained RBAC tier, a real stated distinction — authentication proves login, not authorization), synthetic buildCalm check since the signal alone sits below the unit confidence floor when isolated (same as jwt.decode\'s tier, by design)', () => {
  const { buildCalm } = require(path.join(PIPELINE_ROOT, 'dist/modules/calm-generator/build-calm'));
  const facts = {
    contractVersion: '7.0.0',
    runVersion: 'test',
    generatedAt: new Date().toISOString(),
    packageRoots: [],
    units: [
      {
        id: 'ClientSearchService.java',
        kind: 'service',
        name: 'ClientSearchService.java',
        filePath: 'ClientSearchService.java',
        startLine: 1,
        endLine: 20,
        evidence: [
          { signal: 'GET /clients/search', source: 'native-route', category: 'http-entry-point', weight: 40, ref: 'ClientSearchService.java:1' },
          // Real evidence: context.isAuthenticated() at ClientSearchService.java:52
          // (spikes/fineract/repo/fineract-provider) — grep-verified before
          // writing the catalogue row, not assumed. Combined here with a
          // route signal so the unit clears the confidence floor for this
          // shape-proof test, matching how it would combine in a real file
          // that also has an HTTP entry point.
          { signal: 'context.isAuthenticated', source: 'call', category: 'security-control', weight: 30, ref: 'ClientSearchService.java:52' },
        ],
        confidence: 70,
      },
    ],
    relationships: [],
    ignoredItems: [],
  };

  const calm = buildCalm(facts, false);
  const node = findNode(calm, 'ClientSearchService.java');
  assert.ok(node, 'ClientSearchService.java node missing');
  const auth = node.controls?.['security-auth-002'];
  assert.ok(auth, 'expected security-auth-002 (Fineract isAuthenticated call-site) control');
  assert.equal(auth.requirements[0].config.evidenceRef, 'ClientSearchService.java:52');
  assert.ok(
    auth.description.includes('NOT that they are authorized'),
    'description must state the real distinction from RBAC (authentication != authorization), not imply equivalent strength'
  );
});

test('AREC T-D1 — TypeScript decorator/call dedup: NestJS fixture produces ZERO unmapped signals despite call-fact extraction now running (real dup finding: TS decorators are ALSO referenceKind calls)', () => {
  const { outDir } = runPipeline([path.join(PIPELINE_ROOT, 'test/fixtures/nestjs-sample')]);
  try {
    const facts = JSON.parse(fs.readFileSync(path.join(outDir, 'typed-facts.json'), 'utf8'));
    const unmapped = facts.ignoredItems.filter((i) => i.detail?.includes('No signal-catalogue.yml rule matched'));
    assert.equal(unmapped.length, 0, `expected 0 unmapped signals (decorator/call dedup should prevent TS @Controller/@Get/@Post from double-counting as calls), got: ${unmapped.map((i) => i.detail).join(' | ')}`);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('AREC T-C1 — R2 multi-hop bridge: synthetic fixture proves the mechanism (service -> zero-evidence interface -> sole @Entity implementer)', () => {
  const fixtureRoot = path.join(PIPELINE_ROOT, 'test/fixtures/r2-bridge-sample');
  // Real finding while building this: graphify's persistent per-root cache
  // (.graphify-cache) can retain a stale node-id assignment across repeated
  // hand-edits of the SAME fixture during development — force a clean
  // extraction so this test never depends on whatever cache state a prior
  // local run left behind.
  fs.rmSync(path.join(fixtureRoot, '.graphify-cache'), { recursive: true, force: true });
  const { outDir, calm } = runPipeline([fixtureRoot]);
  try {
    fs.rmSync(path.join(fixtureRoot, '.graphify-cache'), { recursive: true, force: true });

    const resource = findNode(calm, 'WidgetApiResource.java');
    const impl = findNode(calm, 'WidgetReadServiceImpl.java');
    assert.ok(resource, 'WidgetApiResource.java node missing');
    assert.equal(resource['node-type'], 'service');
    assert.ok(impl, 'WidgetReadServiceImpl.java node missing (@Entity path)');
    assert.equal(impl['node-type'], 'database');

    // WidgetReadService.java (the bridge interface) must NOT become a node —
    // R2 never creates units for bridges themselves (design note §2.6).
    assert.equal(findNode(calm, 'WidgetReadService.java'), undefined, 'bridge interface must not become its own CALM node');

    const r2Rel = calm.relationships.find((rel) => {
      const conn = rel['relationship-type']?.connects;
      return conn && conn.source.node === resource['unique-id'] && conn.destination.node === impl['unique-id'];
    });
    assert.ok(r2Rel, 'expected a resolved R2 relationship from WidgetApiResource to WidgetReadServiceImpl');
    assert.equal(relMetadata(r2Rel, 'x-aac-relationship-grade'), 'architecture');
    assert.equal(relMetadata(r2Rel, 'x-aac-confidence'), 15, 'R2 same-root confidence must be low and fixed, per the design note (below any R1 value)');
    assert.equal(relMetadata(r2Rel, 'x-aac-mechanism'), 'r2-phase1', 'T-L2-1: Phase 1 short-circuit (implementer IS the store) must be distinguishable from R2b without decoding the confidence value');
    assert.ok(r2Rel.description.includes('calls'), 'R2 must use the calls kind, distinct from R1 imports/connects');

    const { errors, warnings } = validateCalm(path.join(outDir, 'architecture.calm.json'));
    assert.equal(errors, 0);
    assert.equal(warnings, 0);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.rmSync(path.join(fixtureRoot, '.graphify-cache'), { recursive: true, force: true });
  }
});

test('AREC R2b (T-R1-2) — implementer->store hop: synthetic fixture proves the mechanism (service -> zero-evidence interface -> PLAIN implementer -> imported entity), and the ambiguity path still refuses to guess', () => {
  const fixtureRoot = path.join(PIPELINE_ROOT, 'test/fixtures/r2b-implementer-hop-sample');
  fs.rmSync(path.join(fixtureRoot, '.graphify-cache'), { recursive: true, force: true });
  const { outDir, calm } = runPipeline([fixtureRoot]);
  try {
    fs.rmSync(path.join(fixtureRoot, '.graphify-cache'), { recursive: true, force: true });

    // Positive path: WidgetReadServiceImpl (the implementer) is a PLAIN
    // class — no @Entity, no driver import — distinct from r2-bridge-sample
    // (Phase 1) where the implementer itself IS the store. R2b must chase
    // the implementer's own import to WidgetEntity, and the implementer
    // itself must NOT become a CALM node (pure plumbing, same as the bridge
    // interface — design note §2.6 extended to this hop).
    const resource = findNode(calm, 'WidgetApiResource.java');
    const entity = findNode(calm, 'WidgetEntity.java');
    assert.ok(resource, 'WidgetApiResource.java node missing');
    assert.equal(resource['node-type'], 'service');
    assert.ok(entity, 'WidgetEntity.java node missing');
    assert.equal(entity['node-type'], 'database');
    assert.equal(findNode(calm, 'WidgetReadService.java'), undefined, 'bridge interface must not become its own CALM node');
    assert.equal(findNode(calm, 'WidgetReadServiceImpl.java'), undefined, 'plain implementer must not become its own CALM node — it is plumbing, same as the bridge (§2.6)');

    const r2bRel = calm.relationships.find((rel) => {
      const conn = rel['relationship-type']?.connects;
      return conn && conn.source.node === resource['unique-id'] && conn.destination.node === entity['unique-id'];
    });
    assert.ok(r2bRel, 'expected a resolved R2b relationship from WidgetApiResource to WidgetEntity');
    assert.equal(relMetadata(r2bRel, 'x-aac-relationship-grade'), 'architecture');
    assert.equal(relMetadata(r2bRel, 'x-aac-confidence'), 8, 'R2b same-root confidence must be below both R2 Phase 1 tiers (15/10)');
    assert.ok(r2bRel.description.includes('calls'), 'R2b must use the calls kind, same as R2 Phase 1');
    assert.equal(relMetadata(r2bRel, 'x-aac-mechanism'), 'r2b', 'T-L2-1: R2b (implementer imports the store) must be distinguishable from Phase 1 without decoding the confidence value');

    // Ambiguity path: GadgetReadServiceImpl imports TWO real stores — R2b
    // must refuse to guess, same "never guess" discipline as Phase 1's own
    // 0-or-2+-implementers case, not silently pick one.
    assert.equal(findNode(calm, 'GadgetReadServiceImpl.java'), undefined, 'ambiguous implementer must not become a node either');
    const gadgetResource = findNode(calm, 'GadgetApiResource.java');
    const gadgetRel = calm.relationships.find((rel) => {
      const conn = rel['relationship-type']?.connects;
      return conn && conn.source.node === gadgetResource['unique-id'];
    });
    assert.equal(gadgetRel, undefined, 'ambiguous R2b case (2 store imports) must NOT emit a fabricated relationship');

    const facts = JSON.parse(fs.readFileSync(path.join(outDir, 'typed-facts.json'), 'utf8'));
    const ambiguousItem = facts.ignoredItems.find(
      (i) => i.detail?.startsWith('unresolved-multi-hop') && i.detail.includes('GadgetApiResource')
    );
    assert.ok(ambiguousItem, 'expected an honest unresolved-multi-hop ignored-item for the ambiguous Gadget case');
    assert.ok(ambiguousItem.detail.includes('2 candidate store unit'), `expected the item to name 2 candidates, got: ${ambiguousItem.detail}`);

    // T-L3-2 — the R2b-side counterpart to the flagship test's r2-phase1
    // assertion, proving relationshipsByMechanism buckets BOTH mechanism
    // values correctly, not just the one that happens to fire on Fineract.
    const coverage = JSON.parse(fs.readFileSync(path.join(outDir, 'coverage-report.json'), 'utf8'));
    assert.equal(coverage.relationshipsByMechanism['r2b'], 1, 'expected the R2b edge counted under relationshipsByMechanism.r2b');
    assert.equal(coverage.relationshipsByMechanism['r2-phase1'], undefined, 'no Phase 1 edges expected in this fixture — only the R2b hop fires');

    const { errors, warnings } = validateCalm(path.join(outDir, 'architecture.calm.json'));
    assert.equal(errors, 0);
    assert.equal(warnings, 0);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.rmSync(path.join(fixtureRoot, '.graphify-cache'), { recursive: true, force: true });
  }
});

test(
  'AREC T-C1 — R2 multi-hop bridge: real Fineract fineract-charge produces ZERO fabricated relationships and exactly 2 honest unresolved-multi-hop items (design note §1 prediction confirmed)',
  { skip: !fs.existsSync(FINERACT_ROOT) && 'spikes/fineract/repo not present (scratch clone, see CLAUDE.md)' },
  () => {
    const { outDir } = runPipeline([path.join(FINERACT_ROOT, 'fineract-charge')]);
    try {
      const facts = JSON.parse(fs.readFileSync(path.join(outDir, 'typed-facts.json'), 'utf8'));
      const multiHopItems = facts.ignoredItems.filter((i) => i.detail?.startsWith('unresolved-multi-hop'));
      // Real Fineract-charge alone: ChargesApiResource's ChargeReadPlatformService
      // bridge has 0 candidate implementers in scope (the real implementer
      // lives in fineract-provider, a third module — see the design note §1)
      // and a ChargeRequest DTO bridge also resolves to 0 — exactly 2, not the
      // 34 annotation-noise items an earlier version of this detector produced
      // before the isRealBridgeCandidate fix.
      assert.equal(multiHopItems.length, 2, `expected exactly 2 honest unresolved-multi-hop items, got ${multiHopItems.length}: ${multiHopItems.map((i) => i.detail).join(' | ')}`);
      const r2Relationships = facts.relationships.filter((r) => r.kind === 'calls' && r.source === 'graphify' && r.confidence !== undefined);
      assert.equal(r2Relationships.length, 0, 'fineract-charge alone must NOT close its S1 gap via R2 Phase 1 — a real, honestly-predicted residual (design note §1), never a fabricated edge');

      const coverage = JSON.parse(fs.readFileSync(path.join(outDir, 'coverage-report.json'), 'utf8'));
      assert.ok(
        coverage.completeness.silenceFlags.some((f) => f.startsWith('S1-zero-service-touching-relationships')),
        'S1 must still fire — this IS the honest residual, not a regression'
      );
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  }
);

test(
  'AREC T-A2/R2b — R0 grading: Fineract fineract-core direct-reconciler edges stay structural; R2b now resolves 3 real service->repository chains, graded architecture',
  { skip: !fs.existsSync(FINERACT_ROOT) && 'spikes/fineract/repo not present (scratch clone, see CLAUDE.md)' },
  () => {
    const { outDir, calm } = runPipeline([path.join(FINERACT_ROOT, 'fineract-core')]);
    try {
      // Documented pre-R2b baseline: fineract-core's 85 direct-reconciler
      // (graphify-reconciler.ts, confidence: undefined) relationships are
      // ALL database<->database (dual-unit Graphify entity mesh, no service
      // endpoint) — see coe-lab/docs/fineract-gold-vs-platform-finding.md.
      // Every one of THOSE must stay graded 'structural', never 'architecture'
      // (that would misrepresent entity-mesh noise as a real architecture
      // link — exactly what T-A2 exists to stop). R2b (confidence: defined,
      // 8/5 same-root/cross-root — the ONLY producers that set confidence on
      // a 'calls' relationship) is a SEPARATE, later-added mechanism that
      // correctly finds real service-rooted chains R0 structurally cannot
      // see — those must be graded 'architecture', not lumped in with R0's
      // entity mesh. Real, grep-verified finding (not assumed): R2b resolves
      // BusinessDateApiResource -> BusinessDateRepository,
      // ExternalEventConfigurationApiResource -> ExternalEventConfigurationRepository,
      // PaymentTypeApiResource -> PaymentTypeRepository — each a real
      // ApiResource referencing a bare bridge interface whose sole
      // implementer (e.g. BusinessDateReadPlatformServiceImpl) is not itself
      // a store but directly imports the real Spring Data repository
      // interface (confirmed via `grep -n "^import.*BusinessDate" ...Impl.java`).
      assert.ok(calm.relationships.length > 0, 'expected real relationships from fineract-core');
      // Excludes the system node's own composed-of relationship (T-X7-3) —
      // synthetic CALM scaffolding, not a graded TypedRelationship; see the
      // BoA test above for the full rationale.
      const graded = calm.relationships.filter((rel) => !rel['relationship-type']['composed-of']);
      assert.ok(graded.length > 0, 'expected real graded relationships from fineract-core');

      const r2Graded = graded.filter((rel) => relMetadata(rel, 'x-aac-confidence') !== undefined);
      const r0Graded = graded.filter((rel) => relMetadata(rel, 'x-aac-confidence') === undefined);
      // 85 pre-T-R1-3 -> 96 after: T-R1-3 added org.postgresql/org.jooq/
      // org.springframework.jdbc.core as real driver-import rows (previously
      // unreachable due to the Java symbol-vs-package Graphify gap), which
      // surfaced 11 more real database units and their real entity-mesh
      // edges in fineract-core alone — a real, expected count shift from a
      // separate, later fix, not a rebaseline-to-force-green.
      assert.equal(r0Graded.length, 96, `expected exactly 96 direct-reconciler relationships (post-T-R1-3 baseline), got ${r0Graded.length}`);
      for (const rel of r0Graded) {
        assert.equal(relMetadata(rel, 'x-aac-relationship-grade'), 'structural', `expected structural grade on ${rel['unique-id']} (entity<->entity, no service endpoint)`);
      }

      assert.equal(r2Graded.length, 3, `expected exactly 3 R2b-resolved relationships, got ${r2Graded.length}: ${r2Graded.map((r) => r['unique-id']).join(' | ')}`);
      for (const rel of r2Graded) {
        assert.equal(relMetadata(rel, 'x-aac-relationship-grade'), 'architecture', `expected architecture grade on R2b relationship ${rel['unique-id']}`);
        assert.equal(relMetadata(rel, 'x-aac-confidence'), 8, 'R2b same-root confidence must be the fixed R2b tier (below both R2 Phase 1 tiers)');
      }
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  }
);

test(
  'AREC T-A1 — silence metrics: Fineract fineract-charge flags S1 (service+db present, 0 service-touching relationships)',
  { skip: !fs.existsSync(FINERACT_ROOT) && 'spikes/fineract/repo not present (scratch clone, see CLAUDE.md)' },
  () => {
    const { outDir } = runPipeline([path.join(FINERACT_ROOT, 'fineract-charge')]);
    try {
      const coverage = JSON.parse(fs.readFileSync(path.join(outDir, 'coverage-report.json'), 'utf8'));
      // This IS the documented baseline (coe-lab/docs/fineract-gold-vs-platform-finding.md):
      // ChargesApiResource (service) + Charge (database) both present, 0
      // relationships touch a service unit — dual-unit Graphify gate +
      // multi-hop layering (AREC R2, not yet built). If R2 ships and this
      // starts failing, that's real progress — update this test then, don't
      // silently leave S1 unasserted.
      assert.ok(coverage.completeness.serviceUnitCount >= 1, 'expected at least one service unit');
      assert.ok(coverage.completeness.databaseUnitCount >= 1, 'expected at least one database unit');
      assert.equal(coverage.completeness.serviceTouchingRelationshipCount, 0, 'expected 0 service-touching relationships (pre-R2 baseline)');
      assert.ok(
        coverage.completeness.silenceFlags.some((f) => f.startsWith('S1-zero-service-touching-relationships')),
        'expected S1 silence flag to be raised'
      );
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  }
);

test(
  'AREC T-A1 — silence metrics: S1 does NOT fire when a real service-touching relationship exists (Bank of Anthos, false-positive guard)',
  { skip: !fs.existsSync(BOA_ROOT) && 'spikes/boa/repo not present (scratch clone, see CLAUDE.md)' },
  () => {
    const { outDir } = runPipeline([path.join(BOA_ROOT, 'userservice'), path.join(BOA_ROOT, 'contacts')]);
    try {
      const coverage = JSON.parse(fs.readFileSync(path.join(outDir, 'coverage-report.json'), 'utf8'));
      assert.ok(coverage.completeness.serviceTouchingRelationshipCount > 0, 'expected BoA to have real service-touching relationships (R1 one-hop)');
      assert.ok(
        !coverage.completeness.silenceFlags.some((f) => f.startsWith('S1-zero-service-touching-relationships')),
        'S1 must not fire when service-touching relationships exist'
      );
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  }
);

test(
  'Robustness T-R0-2 — architecture coverage metric: real BoA shows 100% (2/2 services), real Fineract-charge shows 0% (0/1) — shapes differ sensibly',
  { skip: (!fs.existsSync(BOA_ROOT) || !fs.existsSync(FINERACT_ROOT)) && 'spikes/boa or spikes/fineract not present (scratch clone, see CLAUDE.md)' },
  () => {
    const boa = runPipeline([path.join(BOA_ROOT, 'userservice'), path.join(BOA_ROOT, 'contacts')]);
    try {
      const coverage = JSON.parse(fs.readFileSync(path.join(boa.outDir, 'coverage-report.json'), 'utf8'));
      assert.equal(coverage.completeness.serviceUnitCount, 2);
      assert.equal(coverage.completeness.servicesWithArchitectureOutbound, 2, 'both BoA services have a real R1 architecture-grade outbound edge');
      assert.equal(coverage.completeness.architectureOutboundCoverage, 1, 'expected 100% architecture coverage for BoA');
    } finally {
      fs.rmSync(boa.outDir, { recursive: true, force: true });
    }

    const charge = runPipeline([path.join(FINERACT_ROOT, 'fineract-charge')]);
    try {
      const coverage = JSON.parse(fs.readFileSync(path.join(charge.outDir, 'coverage-report.json'), 'utf8'));
      assert.equal(coverage.completeness.serviceUnitCount, 1);
      assert.equal(coverage.completeness.servicesWithArchitectureOutbound, 0, 'the R2 residual means ChargesApiResource has no architecture-grade outbound edge');
      assert.equal(coverage.completeness.architectureOutboundCoverage, 0, 'expected 0% architecture coverage for the fineract-charge residual');
    } finally {
      fs.rmSync(charge.outDir, { recursive: true, force: true });
    }
  }
);

test('Robustness T-R0-5 — Graphify partial/failed visibility: S0 fires in completeness.silenceFlags when graphifyStatus is not ok, absent when ok', () => {
  const { buildCoverageReport } = require(path.join(PIPELINE_ROOT, 'dist/analysis/coverage-report'));
  const baseCtx = {
    packageRoots: ['fake-root'],
    rawByRoot: new Map(),
    allUnits: [],
    allIgnoredItems: [],
    unitsByRoot: new Map(),
    relationships: [],
    openApiDocumentsByRoot: new Map(),
  };

  const failedReport = buildCoverageReport({ ...baseCtx, graphifyError: new Error('graphify binary not found') });
  assert.equal(failedReport.graphifyStatus, 'failed');
  assert.ok(
    failedReport.completeness.silenceFlags.some((f) => f.startsWith('S0-graphify-backbone-incomplete')),
    'expected S0 to fire when graphifyStatus is failed'
  );

  const okReport = buildCoverageReport({ ...baseCtx, graphifyRun: { graph: { nodes: [], edges: [] }, resolveRoot: () => undefined } });
  assert.equal(okReport.graphifyStatus, 'ok');
  assert.ok(
    !okReport.completeness.silenceFlags.some((f) => f.startsWith('S0-graphify-backbone-incomplete')),
    'S0 must not fire when graphifyStatus is ok'
  );
});

test('Robustness T-R0-2 — architecture coverage: N/A (undefined), not a fake 0%, when a run has no store units', () => {
  const { outDir } = runPipeline([path.join(PIPELINE_ROOT, 'test/fixtures/nestjs-sample')]);
  try {
    const coverage = JSON.parse(fs.readFileSync(path.join(outDir, 'coverage-report.json'), 'utf8'));
    // The NestJS fixture has 1 service unit and 0 database/topic units —
    // architecture coverage must not be computed (no store to connect to),
    // same precondition discipline as S1.
    assert.equal(coverage.completeness.databaseUnitCount, 0);
    assert.equal(coverage.completeness.topicUnitCount, 0);
    assert.equal(coverage.completeness.architectureOutboundCoverage, undefined, 'must be N/A, not a fake 0, when there are no store units');
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('Robustness — pushAll never throws RangeError on arrays large enough to exceed V8 call-argument limits (real crash found scanning fineract-provider, 2733 files, 167k+ ignored items)', () => {
  const { pushAll } = require(path.join(PIPELINE_ROOT, 'dist/analysis/pass-registry'));
  // 200k comfortably exceeds V8's spread/apply argument ceiling (the exact
  // shape that crashed `ctx.allIgnoredItems.push(...ignoredItems)` for real
  // against fineract-provider) — `target.push(...items)` throws
  // RangeError: Maximum call stack size exceeded at this size; pushAll must not.
  const large = new Array(200000).fill(0).map((_, i) => i);
  const target = [];
  assert.doesNotThrow(() => pushAll(target, large));
  assert.equal(target.length, 200000);
  assert.equal(target[0], 0);
  assert.equal(target[199999], 199999);
});

test('AREC T-E3 — DynamoDB persistence detection + persistence/messaging double-detector collision fix: lab ts-orders-dynamo fixture, no duplicate unique-ids, calm validate 0 errors', () => {
  const fixtureRoot = path.join(LAB_ROOT, 'fixtures/monorepo/packages/ts-orders-dynamo');
  fs.rmSync(path.join(fixtureRoot, '.graphify-cache'), { recursive: true, force: true });
  const { outDir, calm } = runPipeline([fixtureRoot]);
  try {
    fs.rmSync(path.join(fixtureRoot, '.graphify-cache'), { recursive: true, force: true });

    // Real bug found this session (T-E3): OrdersDynamoStore imports BOTH
    // @aws-sdk/client-dynamodb (persistence) AND @aws-sdk/client-sqs
    // (messaging) — detectPersistencePass and detectMessagingPass each
    // independently walked file->contains->class over the same file,
    // producing TWO TypedUnits with the SAME id but different kind, a live
    // calm-cli unique-ids-must-be-unique-in-architecture ERROR.
    const ids = calm.nodes.map((n) => n['unique-id']);
    assert.equal(new Set(ids).size, ids.length, 'duplicate unique-id found — persistence/messaging double-detector collision regression');

    const store = findNode(calm, 'OrdersDynamoStore');
    assert.ok(store, 'OrdersDynamoStore node missing — DynamoDB driver-import detection regression');
    assert.equal(store['node-type'], 'database', 'DynamoDB-importing class must be typed database (persistence wins the priority tie over messaging)');

    // B-msg-prod-sqs (Robustness, real re-check): T-E3's original fix
    // avoided the duplicate-id error by silently DROPPING the messaging
    // evidence for an already-claimed file — a real gap named and fixed
    // this round. The messaging evidence must now be MERGED onto the same
    // unit (still database-kind — persistence still wins the kind tie,
    // unchanged precedent), not lost. CALM node metadata doesn't carry raw
    // evidence.signal text (only file:line provenance — same lesson as
    // T-R1-3's own test fix), so check typed-facts.json directly for the
    // real merged evidence, matching the established pattern.
    assert.equal(store.description, 'Discovered from 2 signal(s) in src/orders.service.ts', 'expected 2 merged evidence signals (persistence + messaging), not 1');
    const facts = JSON.parse(fs.readFileSync(path.join(outDir, 'typed-facts.json'), 'utf8'));
    const storeUnit = facts.units.find((u) => u.id === 'src/orders.service.ts::OrdersDynamoStore');
    assert.ok(storeUnit, 'expected a typed-facts unit for OrdersDynamoStore');
    assert.ok(storeUnit.evidence.some((e) => e.category === 'persistence' && e.signal === 'ref_aws_sdk_client_dynamodb'));
    assert.ok(
      storeUnit.evidence.some((e) => e.category === 'messaging' && e.signal === 'ref_aws_sdk_client_sqs'),
      'expected the real SQS evidence merged onto this unit, not silently dropped'
    );

    const { errors, warnings } = validateCalm(path.join(outDir, 'architecture.calm.json'));
    assert.equal(errors, 0);
    assert.equal(warnings, 0);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.rmSync(path.join(fixtureRoot, '.graphify-cache'), { recursive: true, force: true });
  }
});

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

test(
  'AREC T-E1 — messaging PRODUCER: real Fineract KafkaExternalEventProducer.java (KafkaTemplate-typed field) detected as a real topic/network node',
  { skip: !fs.existsSync(FINERACT_KAFKA_PRODUCER_ROOT) && 'spikes/fineract/repo not present (scratch clone, see CLAUDE.md)' },
  () => {
    const { outDir, calm } = runPipeline([FINERACT_KAFKA_PRODUCER_ROOT]);
    try {
      const producer = findNode(calm, 'KafkaExternalEventProducer.java');
      assert.ok(producer, 'KafkaExternalEventProducer.java node missing — closes messaging-detection-catalogue.yml\'s previously not-implemented typed-field-producer strategy');
      assert.equal(producer['node-type'], 'network', 'topic-kind units must map to CALM node-type network (node-type-mapping.yml)');
      // Grep-verified ground truth: the KafkaTemplate-typed field is declared at line 48.
      const provenance = producer.metadata.find((m) => m.key === 'x-aac-provenance').value;
      assert.ok(provenance.some((ref) => ref.endsWith(':48')), 'expected provenance at the real KafkaTemplate field declaration line (48)');

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

test('Robustness T-R3-3 (trap-gold T3 promoted) — pure-helper classes (no HTTP/persistence/messaging/control evidence) must NOT become CALM nodes: lab lib-fintech-common produces ZERO nodes, calm validate 0 errors', () => {
  const fixtureRoot = path.join(LAB_ROOT, 'fixtures/monorepo/packages/lib-fintech-common');
  fs.rmSync(path.join(fixtureRoot, '.graphify-cache'), { recursive: true, force: true });
  const { outDir, calm } = runPipeline([fixtureRoot]);
  try {
    fs.rmSync(path.join(fixtureRoot, '.graphify-cache'), { recursive: true, force: true });
    // StringUtils.java / Money.java: plain business-logic classes, no HTTP
    // route, no @Entity, no decorator, no call-site control — zero
    // catalogue evidence of ANY kind, so zero units, so zero CALM nodes.
    // The trap: a naive "every class is a node" heuristic would wrongly
    // surface these as services.
    assert.equal(calm.nodes.length, 0, `expected ZERO CALM nodes from pure-helper classes, got ${calm.nodes.length}: ${calm.nodes.map((n) => n['unique-id']).join(', ')}`);

    const { errors, warnings } = validateCalm(path.join(outDir, 'architecture.calm.json'));
    assert.equal(errors, 0);
    assert.equal(warnings, 0);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.rmSync(path.join(fixtureRoot, '.graphify-cache'), { recursive: true, force: true });
  }
});

test('T-Y2/T-Y3-1 (Serverless_HTTP_and_Dynamo_Ownership_Design.md) — Lambda RequestHandler -> service (not database, not invisible); handler that owns DynamoDbClient directly still stays service; store class stays database; architecture-grade connects present', () => {
  const fixtureRoot = path.join(LAB_ROOT, 'fixtures/monorepo/packages/java-lambda-apigw');
  fs.rmSync(path.join(fixtureRoot, '.codegraph'), { recursive: true, force: true });
  fs.rmSync(path.join(fixtureRoot, '.graphify-cache'), { recursive: true, force: true });
  fs.rmSync(path.join(fixtureRoot, 'graphify-out'), { recursive: true, force: true });
  const { outDir, calm } = runPipeline([fixtureRoot]);
  try {
    // WDL-1 clean positive case: TierService has NO Dynamo import of its
    // own — before this fix it was invisible (0 units at all), matching
    // the real aws-saas-boost-tenant-service finding (HT-ASB-007).
    const tierService = findNode(calm, 'TierService.java');
    assert.ok(tierService, 'TierService.java must be a real service unit (was invisible before T-Y3-1)');
    assert.equal(tierService['node-type'], 'service');
    // Real bug found and fixed while building this: the raw `implements
    // RequestHandler<...>` signal text is NOT a path — it must not become
    // a bogus path-interface. Paths are Y4's job (CFN join), not yet built.
    assert.equal(tierService.interfaces, undefined, 'must NOT have a bogus interface built from the type-reference signal text before CFN path join (Y4) exists');

    // WDL-2 disconfirming case: LegacyTierHandler DOES own a DynamoDbClient
    // field directly — before this fix it was mis-typed `database` solely
    // from that import, matching the real aws-saas-boost-tier-service
    // finding (HT-ASB-002). Real finding this session: the fix required
    // ZERO new priority-mechanism code (T-Y2) — the existing
    // existingServiceFilePaths exclusion (built for B-ontology) already
    // worked correctly the moment T-Y3-1 supplied the missing
    // http-entry-point-tier evidence.
    const legacyHandler = findNode(calm, 'LegacyTierHandler.java');
    assert.ok(legacyHandler, 'LegacyTierHandler.java must be a real unit');
    assert.equal(legacyHandler['node-type'], 'service', 'a handler with real entry-point evidence must win the kind tie-break over a bare Dynamo import (D-dynamo-priority)');

    const tierStore = findNode(calm, 'TierStore');
    assert.ok(tierStore, 'TierStore must be a real database unit');
    assert.equal(tierStore['node-type'], 'database');

    const connectsRel = calm.relationships.find((rel) => {
      const conn = rel['relationship-type']?.connects;
      return conn && conn.source.node === tierService['unique-id'] && conn.destination.node === tierStore['unique-id'];
    });
    assert.ok(connectsRel, 'expected a resolved TierService -> TierStore relationship');
    assert.equal(relMetadata(connectsRel, 'x-aac-relationship-grade'), 'architecture');

    const { errors, warnings } = validateCalm(path.join(outDir, 'architecture.calm.json'));
    assert.equal(errors, 0);
    assert.equal(warnings, 0);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.rmSync(path.join(fixtureRoot, '.codegraph'), { recursive: true, force: true });
    fs.rmSync(path.join(fixtureRoot, '.graphify-cache'), { recursive: true, force: true });
    fs.rmSync(path.join(fixtureRoot, 'graphify-out'), { recursive: true, force: true });
  }
});

test('T-Y4-1 (Serverless_HTTP_and_Dynamo_Ownership_Design.md §2) — CFN/SAM path join: real path/method/handler binding resolved across TWO separate template files, attached to the real scanned units as real path-interfaces, calm validate + gold L0/L1/L2 all PASS', () => {
  const fixtureRoot = path.join(LAB_ROOT, 'fixtures/monorepo/packages/java-lambda-apigw');
  fs.rmSync(path.join(fixtureRoot, '.codegraph'), { recursive: true, force: true });
  fs.rmSync(path.join(fixtureRoot, '.graphify-cache'), { recursive: true, force: true });
  fs.rmSync(path.join(fixtureRoot, 'graphify-out'), { recursive: true, force: true });
  // --cfn-manifests points at the SAME fixture dir, which real-evidence
  // testing found needs its own multi-file join: api-gateway.yaml (Resource
  // tree + Method) and lambda-functions.yaml (Function/Handler) are
  // deliberately separate files, mirroring the real aws-saas-boost split.
  const { outDir, calm } = runPipeline([fixtureRoot], ['--cfn-manifests', fixtureRoot]);
  try {
    const tierService = findNode(calm, 'TierService.java');
    assert.ok(tierService, 'TierService.java must be a real service unit');
    const tierPaths = (tierService.interfaces || []).map((i) => i.path).sort();
    assert.deepEqual(tierPaths, ['GET /tiers', 'GET /tiers/{id}'], `expected the real CFN-resolved paths on TierService, got: ${tierPaths}`);

    const legacyHandler = findNode(calm, 'LegacyTierHandler.java');
    assert.ok(legacyHandler, 'LegacyTierHandler.java must be a real unit');
    const legacyPaths = (legacyHandler.interfaces || []).map((i) => i.path);
    assert.deepEqual(legacyPaths, ['PUT /tiers/{id}'], `expected the real CFN-resolved path on LegacyTierHandler, got: ${legacyPaths}`);

    const { errors, warnings } = validateCalm(path.join(outDir, 'architecture.calm.json'));
    assert.equal(errors, 0);
    assert.equal(warnings, 0);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.rmSync(path.join(fixtureRoot, '.codegraph'), { recursive: true, force: true });
    fs.rmSync(path.join(fixtureRoot, '.graphify-cache'), { recursive: true, force: true });
    fs.rmSync(path.join(fixtureRoot, 'graphify-out'), { recursive: true, force: true });
  }
});

test(
  'Node/TS real evidence (ghostfolio/ghostfolio, NestJS+Prisma) — Graphify ref_ target normalization + Controller/database precedence (generic fixes, real bugs found by testing against a real repo)',
  { skip: !fs.existsSync(GHOSTFOLIO_ACCESS_ROOT) && 'spikes/ghostfolio/repo not present (scratch clone)' },
  () => {
    const { outDir, calm } = runPipeline([GHOSTFOLIO_ACCESS_ROOT]);
    try {
      // Q13 ontology fix (Robustness): AccessService merely imports Prisma's
      // TYPES for its own method signatures (`import { Access, Prisma } from
      // '@prisma/client'`) — it does NOT own the client (does not `extends
      // PrismaClient`). Real evidence, re-verified: it must NOT be typed
      // database. This was the ORIGINAL real bug #1 fix's own follow-on
      // false-positive risk, disclosed as Q13 and left unfixed for a full
      // session before this ownership check closed it — see
      // class-ownership-resolver.ts / persistence-detection-catalogue.yml's
      // ownerBaseClass for the full real-evidence writeup.
      assert.equal(findNode(calm, 'AccessService'), undefined, 'AccessService must NOT be a database node — it imports Prisma types for typing only, never owns the client');

      // Real bug #2 (fixed, unrelated to Q13, still real): AccessController
      // ALSO imports @prisma/client (for its own DTO typing, `import {
      // Access as AccessModel } from '@prisma/client'`) but has real route
      // evidence — it must stay `service`, not become a second, wrong
      // `database` node.
      const accessController = findNode(calm, 'access.controller.ts');
      assert.ok(accessController, 'access.controller.ts must exist as a service unit');
      assert.equal(accessController['node-type'], 'service');
      assert.ok(!calm.nodes.some((n) => n['unique-id'].includes('AccessController') && n['node-type'] === 'database'), 'AccessController must never also appear as a database node');

      const { errors, warnings } = validateCalm(path.join(outDir, 'architecture.calm.json'));
      assert.equal(errors, 0);
      // 1 real, expected warning as of the Q13 fix (was 0 before it): with
      // AccessService correctly no longer a database node, AccessController
      // has nothing left in this narrow scan to connect to — a real,
      // honest `architecture-nodes-must-be-referenced` warning, not a bug.
      // Removing a false-positive node can orphan a previously-connected
      // real one; this is that trade-off made visible, not hidden.
      assert.equal(warnings, 1);
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  }
);

test(
  'Robustness (B-ontology, Q13 fix) — real Ghostfolio PrismaService (extends PrismaClient) correctly IS a database unit — the positive case the ownership check must not over-correct away',
  { skip: !fs.existsSync(GHOSTFOLIO_PRISMA_ROOT) && 'spikes/ghostfolio/repo not present (scratch clone)' },
  () => {
    const { outDir, calm } = runPipeline([GHOSTFOLIO_PRISMA_ROOT]);
    try {
      // Real source, grep-verified: services/prisma/prisma.service.ts:13-14
      // is `export class PrismaService\n  extends PrismaClient`, a genuinely
      // multi-line class header (class/extends/implements each on their own
      // line) — this is exactly the shape class-ownership-resolver.ts's
      // bounded multi-line scan exists for; a naive single-line read-back
      // would miss this.
      const prismaService = findNode(calm, 'PrismaService');
      assert.ok(prismaService, 'PrismaService must be detected as a real database unit — it genuinely owns the Prisma client');
      assert.equal(prismaService['node-type'], 'database');

      const { errors, warnings } = validateCalm(path.join(outDir, 'architecture.calm.json'));
      assert.equal(errors, 0);
      // 1 real, expected warning — this narrow scan (services/prisma only)
      // has exactly one node with nothing else in scope to connect to; an
      // artifact of the deliberately small scan scope, not the Q13 fix.
      assert.equal(warnings, 1);
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

test('AREC T-E4 — OpenAPI dual-unit merge (trap card T8): lab ts-nestjs-users (openapi.yaml + real controller, same routes) produces ONE node, not two', () => {
  const fixtureRoot = path.join(LAB_ROOT, 'fixtures/monorepo/packages/ts-nestjs-users');
  fs.rmSync(path.join(fixtureRoot, '.graphify-cache'), { recursive: true, force: true });
  const { outDir, calm } = runPipeline([fixtureRoot]);
  try {
    fs.rmSync(path.join(fixtureRoot, '.graphify-cache'), { recursive: true, force: true });

    // Before this fix: TWO service nodes for one real service
    // ('src/users.controller.ts' AND 'openapi.yaml') — a real unit-level
    // false positive (trap card T8). Merge policy: overlapping routes ->
    // one unit, openapi evidence (routes + securitySchemes) attached to the
    // code-derived unit, not a competing node.
    const serviceNodes = calm.nodes.filter((n) => n['node-type'] === 'service');
    assert.equal(serviceNodes.length, 1, `expected exactly 1 service node, got ${serviceNodes.length}: ${serviceNodes.map((n) => n['unique-id']).join(', ')}`);
    assert.equal(serviceNodes[0]['unique-id'], 'src/users.controller.ts');
    assert.equal(findNode(calm, 'openapi.yaml'), undefined, 'openapi.yaml must NOT be a standalone node once merged into the code-derived unit');

    // Native-route interfaces still win precedence (T-X4-2) — merge does
    // not duplicate interfaces from the lower-precedence openapi evidence.
    const paths = serviceNodes[0].interfaces.map((i) => i.path).sort();
    assert.deepEqual(paths, ['GET /users', 'GET /users/:id', 'POST /users']);

    // Real, additional value from the merge: the openapi doc's real
    // bearerAuth securityScheme is now security-control evidence ON the
    // merged unit, correctly suppressing threat-signals' "no
    // security-control evidence" false positive for this unit.
    const threatReport = JSON.parse(fs.readFileSync(path.join(outDir, 'modules/threat-signals/threat-signals-report.json'), 'utf8'));
    assert.equal(threatReport.findings.length, 0, 'bearerAuth securityScheme evidence should suppress the threat-signals false positive once merged');

    // AREC T-E4 (C-contract expand) — the real bearerAuth scheme
    // (`{type: http, scheme: bearer}`) must attach a REAL controls entry,
    // matched by its structural type/scheme, not its author-chosen name.
    assert.ok(serviceNodes[0].controls?.['security-contract-http-bearer-001'], 'expected a real security-contract-http-bearer-001 control from the openapi.yaml bearerAuth scheme');

    const { errors } = validateCalm(path.join(outDir, 'architecture.calm.json'));
    assert.equal(errors, 0);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.rmSync(path.join(fixtureRoot, '.graphify-cache'), { recursive: true, force: true });
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

test(
  'Robustness T-R1-3 — Java Graphify import target normalization: real Fineract org.postgresql import now correctly becomes a database unit (was silently unreachable before this fix)',
  { skip: !fs.existsSync(FINERACT_SECURITY_ROOT) && 'spikes/fineract/repo/fineract-security not present (scratch clone, see CLAUDE.md)' },
  () => {
    const { outDir, calm } = runPipeline([FINERACT_SECURITY_ROOT]);
    try {
      // Grep-verified: SqlInjectionPreventerServiceImpl.java:29 has
      // `import org.postgresql.core.Utils;` — Graphify's own edge target for
      // this is the bare symbol "utils" (confirmed real, not assumed), which
      // never matched the org.postgresql catalogue row before T-R1-3.
      const node = findNode(calm, 'SqlInjectionPreventerServiceImpl');
      assert.ok(node, 'SqlInjectionPreventerServiceImpl.java must be a real CALM node now');
      assert.equal(node['node-type'], 'database');

      // CALM node metadata only carries file:line provenance, not the raw
      // evidence signal — check typed-facts.json directly for the real
      // resolved import text (same pattern the jOOQ test below uses).
      const facts = JSON.parse(fs.readFileSync(path.join(outDir, 'typed-facts.json'), 'utf8'));
      const unit = facts.units.find((u) => u.filePath.endsWith('SqlInjectionPreventerServiceImpl.java'));
      assert.ok(unit, 'expected a typed-facts unit for SqlInjectionPreventerServiceImpl.java');
      assert.ok(
        unit.evidence.some((e) => e.signal === 'org.postgresql.core.Utils'),
        `expected evidence.signal to name the REAL resolved import "org.postgresql.core.Utils", not a guess or the generic unknown-lib fallback; got: ${unit.evidence.map((e) => e.signal).join(', ')}`
      );

      const { errors, warnings } = validateCalm(path.join(outDir, 'architecture.calm.json'));
      assert.equal(errors, 0);
      assert.equal(warnings, 0);
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  }
);

test(
  'Robustness T-R1-3 — jOOQ strategy dispatched (was not-implemented): real Waltz waltz-data produces 229 real database units, evidence names the real org.jooq.* import',
  { skip: !fs.existsSync(WALTZ_DATA_ROOT) && 'spikes/waltz/repo/waltz-data not present (scratch clone, see CLAUDE.md)' },
  () => {
    const { outDir } = runPipeline([WALTZ_DATA_ROOT]);
    try {
      const facts = JSON.parse(fs.readFileSync(path.join(outDir, 'typed-facts.json'), 'utf8'));
      const dbUnits = facts.units.filter((u) => u.kind === 'database');
      assert.equal(dbUnits.length, 229, `expected exactly 229 real database units from waltz-data, got ${dbUnits.length}`);

      // The exact class this catalogue row was originally evidenced against
      // (persistence-detection-catalogue.yml's jooq strategy comment,
      // real import org.jooq.Record1 at a grep-verified line).
      const genericSelector = dbUnits.find((u) => u.filePath.endsWith('GenericSelector.java'));
      assert.ok(genericSelector, 'GenericSelector.java must be detected as a real database unit');
      assert.ok(
        genericSelector.evidence.some((e) => e.signal.startsWith('org.jooq.')),
        `expected evidence.signal to name a real org.jooq.* import, got: ${genericSelector.evidence.map((e) => e.signal).join(', ')}`
      );

      const { errors, warnings } = validateCalm(path.join(outDir, 'architecture.calm.json'));
      assert.equal(errors, 0);
      assert.equal(warnings, 0);
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  }
);

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

test(
  'AREC T-E5 — HITL review trigger: real Fineract fineract-charge (S1) lists the actual units, real BoA (S2 only, S1 does not fire) lists only the flagged unit — offline, deterministic, no LLM',
  { skip: (!fs.existsSync(FINERACT_ROOT) || !fs.existsSync(BOA_ROOT)) && 'spikes/fineract or spikes/boa not present (scratch clone, see CLAUDE.md)' },
  () => {
    const { buildReviewQueue } = require(path.join(PIPELINE_ROOT, 'dist/analysis/ir/hitl-review-trigger'));

    const charge = runPipeline([path.join(FINERACT_ROOT, 'fineract-charge')]);
    try {
      const facts = JSON.parse(fs.readFileSync(path.join(charge.outDir, 'typed-facts.json'), 'utf8'));
      const coverage = JSON.parse(fs.readFileSync(path.join(charge.outDir, 'coverage-report.json'), 'utf8'));
      const queue = buildReviewQueue(facts, coverage);
      // Real baseline: fineract-charge has 1 service + 2 database units, 0
      // service-touching relationships -> S1 fires for all 3.
      assert.equal(queue.items.filter((i) => i.trigger === 'S1-zero-service-touching-relationships').length, 3);
      assert.ok(queue.items.some((i) => i.unitId.endsWith('ChargesApiResource.java')));
      // T-L3-3 — this unit has a real, named unresolved-multi-hop residual
      // on file (T-C1); the review-queue rationale must surface that
      // specific detail, not just a generic "see AREC R2" pointer.
      const chargesApiItem = queue.items.find((i) => i.unitId.endsWith('ChargesApiResource.java'));
      assert.ok(chargesApiItem.rationale.includes('unresolved-multi-hop'), `expected the specific unresolved-multi-hop detail in the rationale, got: ${chargesApiItem.rationale}`);
      // S2 must NOT fire here — ChargesApiResource has real security-rbac-002
      // call-site control evidence (T-D1), so it correctly has no S2 item.
      assert.equal(queue.items.filter((i) => i.trigger === 'S2-http-without-security-control').length, 0);
    } finally {
      fs.rmSync(charge.outDir, { recursive: true, force: true });
    }

    const boa = runPipeline([path.join(BOA_ROOT, 'userservice'), path.join(BOA_ROOT, 'contacts')]);
    try {
      const facts = JSON.parse(fs.readFileSync(path.join(boa.outDir, 'typed-facts.json'), 'utf8'));
      const coverage = JSON.parse(fs.readFileSync(path.join(boa.outDir, 'coverage-report.json'), 'utf8'));
      const queue = buildReviewQueue(facts, coverage);
      // Real baseline: BoA has real service->database relationships (R1) ->
      // S1 must NOT fire. userservice.py has no security-control evidence -> S2 fires for it alone.
      assert.equal(queue.items.filter((i) => i.trigger === 'S1-zero-service-touching-relationships').length, 0);
      const s2Items = queue.items.filter((i) => i.trigger === 'S2-http-without-security-control');
      assert.ok(s2Items.some((i) => i.unitId === 'userservice.py'));
    } finally {
      fs.rmSync(boa.outDir, { recursive: true, force: true });
    }
  }
);

test(
  'Robustness T-R4-1 — HITL review trigger: low-architecture-coverage fires on real Fineract fineract-security (17% coverage, S1 does NOT fire), mutually exclusive with S1',
  { skip: !fs.existsSync(FINERACT_SECURITY_ROOT) && 'spikes/fineract/repo/fineract-security not present (scratch clone, see CLAUDE.md)' },
  () => {
    const { buildReviewQueue } = require(path.join(PIPELINE_ROOT, 'dist/analysis/ir/hitl-review-trigger'));
    const { outDir } = runPipeline([FINERACT_SECURITY_ROOT]);
    try {
      const facts = JSON.parse(fs.readFileSync(path.join(outDir, 'typed-facts.json'), 'utf8'));
      const coverage = JSON.parse(fs.readFileSync(path.join(outDir, 'coverage-report.json'), 'utf8'));
      // Real baseline: fineract-security has real service->database
      // relationships (S1 does not fire) but only 17% architecture
      // coverage (1/6 services) — exactly the sparse-but-nonzero case S1
      // alone was designed to miss.
      assert.equal(coverage.completeness.architectureOutboundCoverage < 0.5, true, 'expected real sub-50% coverage on this fixture — if this fails, the fixture or catalogue changed and the test needs re-baselining, not silently loosening');
      const queue = buildReviewQueue(facts, coverage);
      assert.equal(queue.items.filter((i) => i.trigger === 'S1-zero-service-touching-relationships').length, 0, 'S1 must not fire — real relationships exist');
      const lowCoverageItems = queue.items.filter((i) => i.trigger === 'low-architecture-coverage');
      assert.ok(lowCoverageItems.length > 0, 'expected low-architecture-coverage items given real sub-threshold coverage');
      for (const item of lowCoverageItems) {
        assert.equal(item.unitKind, 'service');
      }
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  }
);

test('AREC T-E5 — HITL review trigger: no silence flags -> empty review queue (not an empty file, a real empty array)', () => {
  const { buildReviewQueue } = require(path.join(PIPELINE_ROOT, 'dist/analysis/ir/hitl-review-trigger'));
  const facts = {
    contractVersion: '7.0.0',
    runVersion: 'test',
    generatedAt: new Date().toISOString(),
    packageRoots: [],
    units: [],
    relationships: [],
    ignoredItems: [],
  };
  const coverage = { completeness: { silenceFlags: [] } };
  const queue = buildReviewQueue(facts, coverage);
  assert.deepEqual(queue.items, []);
});
