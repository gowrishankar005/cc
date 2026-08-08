#!/usr/bin/env node
/**
 * Validate hand-authored gold CALM and platform-generated CALM, then compare
 * them semantically (not unique-id byte equality — gold is independent of the generator).
 *
 * Steps per package:
 *  1. calm validate gold/calm/<id>/architecture.calm.json
 *  2. calm validate generated/<id>/architecture.calm.json
 *  3. Semantic structural compare (node types, path interfaces, connects topology, controls)
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LAB = path.join(__dirname, '..');
const PIPE = path.join(LAB, '..', 'pipeline');
const URL_MAP = path.join(PIPE, 'dist/rules/control-url-mapping.json');

const CORE = [
  'py-accounts-api',
  'py-ledger-worker',
  'ts-nestjs-users',
  'java-jaxrs-charges',
  'java-spring-payments',
  'java-rbac-datatable',
  'lib-fintech-common',
];

const ALL_GOLD = [
  ...CORE,
  'java-kafka-settlement',
  'py-jwt-gateway',
  'ts-orders-dynamo',
  'deploy-k8s-trust',
  'py-multi-root',
  // Wild-type Fineract (hand-authored; generate separately against real module roots)
  'fineract-charge',
  // T-L1-1/T-L1-5 — multi-root gold: score only against a generated CALM
  // produced by scanning fineract-charge + fineract-provider TOGETHER (see
  // coe-lab/docs/multi-root-l2-protocol.md). Different claim triple from
  // 'fineract-charge' above — never interchangeable, enforced by the
  // root-set/scan-mode guard in validateOne().
  'fineract-charge-provider',
  'fineract-core',
  'fineract-system-map',
  // T-Y1-2 (Serverless_HTTP_and_Dynamo_Ownership_Design.md) — expected-fail
  // until B-lambda-http (Y3-Y4) / B-dynamo-handler-kind (Y2) ship, same
  // precedent as fineract-charge above. Not in CORE.
  'java-lambda-apigw',
];

function parseArgs(argv) {
  const out = { strict: false, allCore: false, allGold: false, generate: false, goldOnly: false, requireL2: false, allowRootMismatch: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--package') out.pkg = argv[++i];
    else if (a === '--all-core') out.allCore = true;
    else if (a === '--all-gold') out.allGold = true;
    else if (a === '--strict') out.strict = true;
    else if (a === '--generate-first') out.generate = true;
    else if (a === '--gold-only') out.goldOnly = true;
    // T-L1-2 — refuse-by-default guard against scoring a generated CALM
    // whose real scan-mode (read from its own x-aac-package-roots metadata,
    // never a self-declared flag) doesn't match what the gold package
    // claims via x-lab-scan-mode. This is the concrete mechanism that
    // closes the abuse case named in AGENT_TASKS_Layered_Architecture_Story.md
    // T-L1-2: dropping a multi-root scan's output into generated/fineract-charge/
    // (the SINGLE-root gold's folder) must not silently score as if it were
    // a single-root run, in either direction.
    else if (a === '--allow-root-mismatch') out.allowRootMismatch = true;
    // AREC Wave 3 T-A3 — L2 (architecture-story/relationship-topology) is
    // the layer this project's own methodology (Fineract RCA) found weakest
    // and least built (R2 multi-hop is specified-unbuilt). Default exit code
    // does NOT fail on an L2-only gap — L0 (schema) and L1 (unit/node
    // recall) are what CI-style gating should hold the line on today; L2 is
    // reported honestly (PASS/FAIL/N/A) but only affects exit code with this
    // flag, so it can be turned on deliberately once R2 lands (T-C2) without
    // a silent behavior change today.
    else if (a === '--require-l2') out.requireL2 = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function calmValidate(archPath) {
  if (!fs.existsSync(archPath)) {
    return { ok: false, log: `missing file: ${archPath}` };
  }
  const args = ['--no-install', 'calm', 'validate', '-a', archPath, '-f', 'json'];
  if (fs.existsSync(URL_MAP)) {
    args.splice(3, 0, '-u', URL_MAP);
  }
  const v = spawnSync('npx', args, { encoding: 'utf8', cwd: PIPE, shell: true });
  const raw = `${v.stdout || ''}${v.stderr || ''}`;
  const start = raw.indexOf('{');
  if (start < 0) {
    return { ok: v.status === 0, log: raw.slice(0, 500), hasErrors: v.status !== 0, hasWarnings: false };
  }
  try {
    const doc = JSON.parse(raw.slice(start));
    const hasErrors = !!doc.hasErrors;
    const hasWarnings = !!doc.hasWarnings;
    return {
      ok: !hasErrors,
      hasErrors,
      hasWarnings,
      log: hasErrors ? JSON.stringify(doc.jsonSchemaValidationOutputs || doc, null, 0).slice(0, 400) : 'ok',
    };
  } catch {
    return { ok: v.status === 0, log: raw.slice(0, 500), hasErrors: v.status !== 0, hasWarnings: false };
  }
}

/** Architectural units only — drop generator/system composite noise for compare. */
function architecturalNodes(doc) {
  return (doc.nodes || []).filter((n) => n['node-type'] !== 'system');
}

function pathSet(node) {
  const paths = new Set();
  for (const iface of node.interfaces || []) {
    if (iface.path) paths.add(String(iface.path).trim());
    else if (iface.type === 'path-interface' && iface['unique-id']) {
      // fallback
    }
  }
  return paths;
}

function hasControls(node) {
  return !!(node.controls && Object.keys(node.controls).length > 0);
}

/**
 * AREC Wave 3 T-A3 — gold marked with an explicit grain (e.g. `x-lab-grain:
 * gradle-module` on fineract-system-map, module-level nodes) is not
 * comparable to a class/file-grain generated CALM at all — not just for L2
 * topology, for L1 node matching too (every "gold node" would spuriously
 * read as missing). Reads a real metadata key rather than naming any
 * specific package, so a future non-Fineract module-grain gold gets the
 * same honest N/A automatically.
 */
function goldGrain(gold) {
  return gold.metadata?.find((m) => m.key === 'x-lab-grain')?.value;
}

/**
 * T-L1-2 — is this gold declared multi-root (x-lab-scan-mode: multi-root)?
 * Absence means single-root, the default/primary claim mode (Claim Register Q11).
 */
function goldWantsMultiRoot(gold) {
  return gold.metadata?.find((m) => m.key === 'x-lab-scan-mode')?.value === 'multi-root';
}

/**
 * T-L1-2 — real root count of a GENERATED CALM file, read from the field
 * the platform itself already stamps on every run (`x-aac-package-roots`,
 * metadata-builder.ts) — never a CLI flag the invoker could get wrong or
 * forget. Returns undefined if the field is absent (older/manual CALM),
 * which is treated as "unknown," not "single," so it fails loud rather than
 * silently assuming a mode.
 */
function generatedRootCount(actual) {
  const roots = actual.metadata?.find((m) => m.key === 'x-aac-package-roots')?.value;
  return Array.isArray(roots) ? roots.length : undefined;
}

/**
 * Match gold architectural units against generated units by type + interface paths.
 * Generated may use file-based unique-ids; we match by content.
 *
 * AREC Wave 3 T-A3 — issues are now split into l1 (node/unit-level: missing
 * gold node, missing interface path, missing controls, extra generated
 * node) and l2 (relationship/architecture-story-level: missing connects
 * topology) buckets, since lab L1 "ALL PASS" was previously indistinguishable
 * from a real L2 architecture-story pass — exactly the false-comfort finding
 * from the Fineract RCA (validation-approach-vnext.md).
 */
function semanticCompare(gold, generated) {
  const l1 = [];
  const l2 = [];
  const gNodes = architecturalNodes(gold);
  const aNodes = architecturalNodes(generated);

  // Trap / empty architecture
  if (gNodes.length === 0) {
    if (aNodes.length > 0) {
      l1.push(
        `trap/empty gold expects 0 architectural nodes, generated has ${aNodes.length}: ${aNodes
          .map((n) => `${n['node-type']}:${n.name || n['unique-id']}`)
          .join(', ')}`
      );
    }
    return { l1, l2, l2Applicable: false, l2NotApplicableReason: 'trap/empty gold — no architecture asserted' };
  }

  const used = new Set();
  // T-L1-4 — gold unique-id -> the generated node it actually matched to,
  // built during the same L1 matching pass above (no second pass, no
  // duplicated matching logic). Used only when x-lab-l2-mode: endpoint.
  const gIdToMatchedAId = {};

  for (const g of gNodes) {
    const gPaths = pathSet(g);
    const gType = g['node-type'];
    let best = null;
    let bestScore = -1;

    for (let i = 0; i < aNodes.length; i++) {
      if (used.has(i)) continue;
      const a = aNodes[i];
      if (a['node-type'] !== gType) continue;
      const aPaths = pathSet(a);
      let score = 1; // type match
      if (gPaths.size > 0) {
        let overlap = 0;
        for (const p of gPaths) if (aPaths.has(p)) overlap++;
        if (overlap === 0 && aPaths.size > 0) continue; // typed service with wrong routes
        score += overlap * 10;
        // name soft match
        const gName = String(g.name || g['unique-id']).toLowerCase();
        const aName = String(a.name || a['unique-id']).toLowerCase();
        if (aName.includes(gName.split(/\s+/)[0]) || gName.includes(aName.split(/[./]/)[0])) score += 2;
      } else {
        // no interfaces — soft name match preferred
        const gName = String(g.name || g['unique-id']).toLowerCase();
        const aName = String(a.name || a['unique-id']).toLowerCase();
        if (aName.includes(gName.toLowerCase()) || gName.includes(aName) ||
            aName.includes(gName.replace(/\s+/g, '')) ||
            a['unique-id']?.toLowerCase().includes(gName.split(/\s+/)[0])) {
          score += 5;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }

    if (best === null) {
      l1.push(
        `missing gold node: ${g['unique-id']} (${gType}${gPaths.size ? ' paths=' + [...gPaths].join('|') : ''})`
      );
      continue;
    }
    used.add(best);
    const matched = aNodes[best];
    gIdToMatchedAId[g['unique-id']] = matched['unique-id'];

    // Interface path coverage
    if (gPaths.size > 0) {
      const aPaths = pathSet(matched);
      for (const p of gPaths) {
        if (!aPaths.has(p)) l1.push(`missing interface path on ${g['unique-id']}: ${p}`);
      }
    }

    // Controls presence
    if (hasControls(g) && !hasControls(matched)) {
      l1.push(`missing controls on matched node for gold ${g['unique-id']} (matched ${matched['unique-id']})`);
    }
  }

  // Extra generated architectural nodes (not system) beyond gold — informational unless strict
  const extras = aNodes.filter((_, i) => !used.has(i));
  if (extras.length) {
    l1.push(
      `extra generated node(s) not in gold: ${extras
        .map((n) => `${n['node-type']}:${n.name || n['unique-id']}`)
        .join(', ')}`
    );
  }

  // Relationship topology (L2 — architecture story, not unit recall): gold
  // connects pairs of (sourceType→destType) with optional path context.
  const goldConnects = (gold.relationships || [])
    .map((r) => r['relationship-type']?.connects)
    .filter(Boolean);
  const genConnects = (generated.relationships || [])
    .map((r) => r['relationship-type']?.connects)
    .filter(Boolean);

  // AREC T-A3 — a package whose gold has ZERO connects-shaped relationships
  // makes no L2 claim at all (either it's a pure unit-recall fixture, or —
  // like fineract-system-map — its only relationships are composed-of, not
  // connects). L1 "ALL PASS" on such a package must never be read as
  // "architecture links verified" — reported as N/A, not PASS, so it can't
  // be misquoted as a green L2 result.
  if (goldConnects.length === 0) {
    return { l1, l2, l2Applicable: false, l2NotApplicableReason: 'gold has no connects-shaped relationships — L2 not asserted by this gold' };
  }

  // T-L1-4 — optional endpoint-aware L2, opt-in per gold via
  // x-lab-l2-mode: endpoint. Default (no metadata, every existing gold
  // package) stays the type-multiset check below — deliberately, so this
  // does not silently tighten every existing lab-core package's L2 bar.
  // Endpoint mode asks a stronger, more specific question: not just "is
  // there SOME service->database pair," but "does THIS gold node's matched
  // generated node actually connect to THAT gold node's matched generated
  // node" — using the L1 matching already computed above, no new matching
  // logic. A gold connects entry whose endpoint never matched an L1 node at
  // all cannot be satisfied by definition (reported as its own L2 miss, not
  // silently skipped).
  const l2Mode = gold.metadata?.find((m) => m.key === 'x-lab-l2-mode')?.value;
  if (l2Mode === 'endpoint') {
    const genConnectPairs = new Set(
      genConnects.map((c) => `${c.source?.node}->${c.destination?.node}`)
    );
    for (const c of goldConnects) {
      const gSrc = c.source?.node;
      const gDst = c.destination?.node;
      const aSrc = gIdToMatchedAId[gSrc];
      const aDst = gIdToMatchedAId[gDst];
      if (!aSrc || !aDst) {
        l2.push(`endpoint L2: gold connects ${gSrc}->${gDst} but one or both endpoints never matched a generated node (see L1 issues)`);
        continue;
      }
      if (!genConnectPairs.has(`${aSrc}->${aDst}`)) {
        l2.push(`endpoint L2: no generated connects edge from matched node ${aSrc} to matched node ${aDst} (gold: ${gSrc}->${gDst})`);
      }
    }
    return { l1, l2, l2Applicable: true };
  }

  // Build type multiset for gold endpoints (default L2 mode)
  const gIdToType = Object.fromEntries(gNodes.map((n) => [n['unique-id'], n['node-type']]));
  const aIdToType = Object.fromEntries((generated.nodes || []).map((n) => [n['unique-id'], n['node-type']]));

  const goldPairs = goldConnects.map((c) => {
    const st = gIdToType[c.source?.node] || '?';
    const dt = gIdToType[c.destination?.node] || '?';
    return `${st}->${dt}`;
  });
  const genPairs = genConnects.map((c) => {
    const st = aIdToType[c.source?.node] || '?';
    const dt = aIdToType[c.destination?.node] || '?';
    return `${st}->${dt}`;
  });

  const genBag = {};
  for (const p of genPairs) genBag[p] = (genBag[p] || 0) + 1;
  const needed = {};
  for (const p of goldPairs) needed[p] = (needed[p] || 0) + 1;
  for (const [pair, count] of Object.entries(needed)) {
    const have = genBag[pair] || 0;
    if (have < count) {
      l2.push(`missing connects topology ${pair} (gold needs ${count}, generated has ${have})`);
    }
  }

  return { l1, l2, l2Applicable: true };
}

function validateOne(pkg, { strict, goldOnly, requireL2, allowRootMismatch }) {
  const goldPath = path.join(LAB, 'gold/calm', pkg, 'architecture.calm.json');
  const actualPath = path.join(LAB, 'generated', pkg, 'architecture.calm.json');

  if (!fs.existsSync(goldPath)) {
    return { pkg, ok: false, error: `no hand-authored gold at ${goldPath}` };
  }

  const goldSchema = calmValidate(goldPath);
  if (!goldSchema.ok) {
    return {
      pkg,
      ok: false,
      goldSchemaOk: false,
      error: `gold calm validate failed: ${goldSchema.log}`,
    };
  }

  if (goldOnly) {
    return {
      pkg,
      ok: true,
      goldSchemaOk: true,
      goldOnly: true,
      goldWarnings: goldSchema.hasWarnings,
    };
  }

  if (!fs.existsSync(actualPath)) {
    return {
      pkg,
      ok: false,
      goldSchemaOk: true,
      error: `no generated calm at ${actualPath} — run generate-calm.mjs first`,
    };
  }

  const genSchema = calmValidate(actualPath);
  const gold = JSON.parse(fs.readFileSync(goldPath, 'utf8'));
  const actual = JSON.parse(fs.readFileSync(actualPath, 'utf8'));

  // AREC T-A3 — grain mismatch (e.g. fineract-system-map's module-level gold
  // vs a class/file-grain generated CALM) makes BOTH L1 and L2 meaningless,
  // not just L2: every gold node would spuriously read as "missing". Detected
  // generically from gold's own x-aac/x-lab metadata, never a package-name check.
  const grain = goldGrain(gold);
  if (grain) {
    return {
      pkg,
      ok: genSchema.ok, // exit code depends only on schema validity, never on an incomparable-grain compare
      goldSchemaOk: true,
      genSchemaOk: genSchema.ok,
      genSchemaLog: genSchema.ok ? 'ok' : genSchema.log,
      goldWarnings: goldSchema.hasWarnings,
      genWarnings: genSchema.hasWarnings,
      l1Status: 'N/A',
      l1Reason: `grain mismatch (gold x-lab-grain: "${grain}") — not comparable to a class/file-grain generated CALM`,
      l2Status: 'N/A',
      l2Reason: `grain mismatch (gold x-lab-grain: "${grain}")`,
    };
  }

  // T-L1-2 — root-set/scan-mode guard, checked BEFORE semantic compare so a
  // mismatch never even reaches L1/L2 scoring (refuse, don't silently N/A —
  // this is the exam-lock program's explicit "practical minimum" choice:
  // hard fail with a clear message, not a soft skip that could be missed).
  if (!allowRootMismatch) {
    const wantsMulti = goldWantsMultiRoot(gold);
    const genRoots = generatedRootCount(actual);
    const mismatch =
      genRoots === undefined
        ? `generated CALM has no x-aac-package-roots metadata — cannot confirm scan mode matches gold's x-lab-scan-mode (${wantsMulti ? 'multi-root' : 'single-root'} expected)`
        : wantsMulti && genRoots < 2
          ? `gold declares x-lab-scan-mode: multi-root but generated CALM's x-aac-package-roots has ${genRoots} root(s) — this looks like a single-root scan dropped into a multi-root gold's generated/ folder`
          : !wantsMulti && genRoots > 1
            ? `gold is single-root (no x-lab-scan-mode) but generated CALM's x-aac-package-roots has ${genRoots} roots — this looks like a multi-root scan dropped into a single-root gold's generated/ folder (the exact abuse case T-L1-2 exists to stop)`
            : null;
    if (mismatch) {
      return {
        pkg,
        ok: false,
        goldSchemaOk: true,
        genSchemaOk: genSchema.ok,
        error: `root-set/scan-mode mismatch — refusing to score (pass --allow-root-mismatch to override deliberately): ${mismatch}`,
      };
    }
  }

  const { l1, l2, l2Applicable, l2NotApplicableReason } = semanticCompare(gold, actual);

  // In non-strict mode, "extra" nodes are soft (score as warning, not fail)
  const hard = l1.filter((i) => !i.startsWith('extra generated'));
  const soft = l1.filter((i) => i.startsWith('extra generated'));
  const l1Ok = strict ? l1.length === 0 : hard.length === 0;
  const l2Ok = l2Applicable ? l2.length === 0 : true; // N/A counts as "not failing"

  // AREC T-A3 exit-code policy: default exit code is L0 (schema) + L1 (unit
  // recall) only. An L2 (architecture-story) gap alone does NOT fail the run
  // unless --require-l2 is passed — this is deliberate, not an oversight:
  // R2 (multi-hop architecture links) is Claim-Register specified-unbuilt
  // today, so gating CI on L2 would make every layered-Java package
  // permanently red for a gap that's honestly documented, not silently
  // ignored (see the l2Status line every result prints below).
  const ok = genSchema.ok && l1Ok && (!requireL2 || l2Ok);

  return {
    pkg,
    ok,
    goldSchemaOk: true,
    genSchemaOk: genSchema.ok,
    hardIssues: hard,
    softIssues: soft,
    genSchemaLog: genSchema.ok ? 'ok' : genSchema.log,
    goldWarnings: goldSchema.hasWarnings,
    genWarnings: genSchema.hasWarnings,
    l1Status: l1Ok ? 'PASS' : 'FAIL',
    l2Status: !l2Applicable ? 'N/A' : l2Ok ? 'PASS' : 'FAIL',
    l2Reason: !l2Applicable ? l2NotApplicableReason : undefined,
    l2Issues: l2,
  };
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || (!args.pkg && !args.allCore && !args.allGold)) {
    console.log(`Usage:
  node scripts/validate-calm-pair.mjs --package <id> [--generate-first] [--strict] [--gold-only] [--require-l2] [--allow-root-mismatch]
  node scripts/validate-calm-pair.mjs --all-core [--generate-first] [--strict] [--require-l2]
  node scripts/validate-calm-pair.mjs --all-gold [--gold-only]

Gold is hand-authored under gold/calm/ (not generator bootstrap).
Compare is layered: L0 schema, L1 unit/node recall, L2 architecture-story
(relationship topology). Exit code = L0 + L1 by default; pass --require-l2 to
also gate on L2 (off by default since R2 multi-hop is specified-unbuilt —
see Claim_Register.md). A package whose gold has no connects-shaped
relationships, or is module-grain (x-lab-grain metadata), reports L2 as N/A,
never a false PASS or FAIL.

Root-set / scan-mode guard (T-L1-2): a gold's x-lab-scan-mode ("multi-root"
or absent = single-root) is checked against the GENERATED CALM's own real
x-aac-package-roots metadata (never a self-declared flag). A mismatch in
either direction — e.g. a multi-root scan's output dropped into a
single-root gold's generated/ folder, or vice versa — refuses to score by
default: "no hand-gold PASS/FAIL by accidentally comparing across scan
modes." Pass --allow-root-mismatch only if you deliberately want the old,
unchecked behavior.

For fineract-charge (single-root) vs fineract-charge-provider (multi-root):
these are two different claim triples about the same real API, never
substitutable. See coe-lab/gold/calm/FINERACT_GOLD.md and
coe-lab/docs/standing-disconfirming-exams.md.

This script runs single-package-root scans only for generation
(--generate-first). Multi-root generated CALM (e.g. for
fineract-charge-provider) must be produced separately via a direct
run-slice invocation against both module roots, then copied to
generated/<pkg>/architecture.calm.json — see
coe-lab/docs/multi-root-l2-protocol.md for the exact command template.`);
    process.exit(args.help ? 0 : 2);
  }

  const packages = args.allGold ? ALL_GOLD : args.allCore ? CORE : [args.pkg];

  if (args.generate && !args.goldOnly) {
    const g = spawnSync(
      process.execPath,
      [
        path.join(__dirname, 'generate-calm.mjs'),
        ...(args.allCore || args.allGold ? ['--all-core'] : ['--package', args.pkg]),
      ],
      { encoding: 'utf8', cwd: LAB }
    );
    process.stdout.write(g.stdout || '');
    process.stderr.write(g.stderr || '');
    if (g.status !== 0) process.exit(g.status || 1);
  }

  const results = packages.map((p) => validateOne(p, args));
  let allOk = true;
  for (const r of results) {
    console.log(`\n=== ${r.pkg} ===`);
    if (r.error) {
      console.log('FAIL', r.error);
      allOk = false;
      continue;
    }
    if (r.goldOnly) {
      console.log('PASS gold calm validate', r.goldWarnings ? '(with warnings)' : '(0 errors, clean)');
      continue;
    }
    // AREC T-A3 — explicit L0/L1/L2 lines so a reader can never mistake an
    // L1 (unit) pass for an L2 (architecture story) pass, the exact
    // confusion the Fineract RCA found (validation-approach-vnext.md).
    console.log(`L0 schema (gold): ${r.goldSchemaOk ? 'PASS' : 'FAIL'}${r.goldWarnings ? ' (warnings)' : ''}`);
    console.log(`L0 schema (gen):  ${r.genSchemaOk ? 'PASS' : 'FAIL'} ${r.genSchemaOk ? '' : r.genSchemaLog}`);
    console.log(`L1 unit recall:   ${r.l1Status}${r.l1Reason ? ` (${r.l1Reason})` : ''}`);
    console.log(`L2 story:         ${r.l2Status}${r.l2Reason ? ` (${r.l2Reason})` : ''}`);
    for (const i of r.hardIssues || []) console.log('  L1 -', i);
    for (const i of r.softIssues || []) console.log('  L1 ~', i);
    for (const i of r.l2Issues || []) console.log('  L2 -', i);
    if (!r.ok) allOk = false;
  }

  console.log(`\n${allOk ? 'ALL PASS' : 'SOME FAILED'} (${results.length} package(s))`);
  process.exit(allOk ? 0 : 1);
}

main();
