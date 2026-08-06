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
  'fineract-core',
  'fineract-system-map',
];

function parseArgs(argv) {
  const out = { strict: false, allCore: false, allGold: false, generate: false, goldOnly: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--package') out.pkg = argv[++i];
    else if (a === '--all-core') out.allCore = true;
    else if (a === '--all-gold') out.allGold = true;
    else if (a === '--strict') out.strict = true;
    else if (a === '--generate-first') out.generate = true;
    else if (a === '--gold-only') out.goldOnly = true;
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
 * Match gold architectural units against generated units by type + interface paths.
 * Generated may use file-based unique-ids; we match by content.
 */
function semanticCompare(gold, generated) {
  const issues = [];
  const gNodes = architecturalNodes(gold);
  const aNodes = architecturalNodes(generated);

  // Trap / empty architecture
  if (gNodes.length === 0) {
    if (aNodes.length > 0) {
      issues.push(
        `trap/empty gold expects 0 architectural nodes, generated has ${aNodes.length}: ${aNodes
          .map((n) => `${n['node-type']}:${n.name || n['unique-id']}`)
          .join(', ')}`
      );
    }
    return issues;
  }

  const used = new Set();

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
      issues.push(
        `missing gold node: ${g['unique-id']} (${gType}${gPaths.size ? ' paths=' + [...gPaths].join('|') : ''})`
      );
      continue;
    }
    used.add(best);
    const matched = aNodes[best];

    // Interface path coverage
    if (gPaths.size > 0) {
      const aPaths = pathSet(matched);
      for (const p of gPaths) {
        if (!aPaths.has(p)) issues.push(`missing interface path on ${g['unique-id']}: ${p}`);
      }
    }

    // Controls presence
    if (hasControls(g) && !hasControls(matched)) {
      issues.push(`missing controls on matched node for gold ${g['unique-id']} (matched ${matched['unique-id']})`);
    }
  }

  // Extra generated architectural nodes (not system) beyond gold — informational unless strict
  const extras = aNodes.filter((_, i) => !used.has(i));
  if (extras.length) {
    issues.push(
      `extra generated node(s) not in gold: ${extras
        .map((n) => `${n['node-type']}:${n.name || n['unique-id']}`)
        .join(', ')}`
    );
  }

  // Relationship topology: gold connects pairs of (sourceType→destType) with optional path context
  const goldConnects = (gold.relationships || [])
    .map((r) => r['relationship-type']?.connects)
    .filter(Boolean);
  const genConnects = (generated.relationships || [])
    .map((r) => r['relationship-type']?.connects)
    .filter(Boolean);

  if (goldConnects.length > 0) {
    // Build type multiset for gold endpoints
    const gIdToType = Object.fromEntries(gNodes.map((n) => [n['unique-id'], n['node-type']]));
    const aIdToType = Object.fromEntries(
      (generated.nodes || []).map((n) => [n['unique-id'], n['node-type']])
    );

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
        issues.push(`missing connects topology ${pair} (gold needs ${count}, generated has ${have})`);
      }
    }
  }

  return issues;
}

function validateOne(pkg, { strict, goldOnly }) {
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
  const issues = semanticCompare(gold, actual);

  // In non-strict mode, "extra" nodes are soft (score as warning, not fail)
  const hard = issues.filter((i) => !i.startsWith('extra generated'));
  const soft = issues.filter((i) => i.startsWith('extra generated'));
  const structuralOk = strict ? issues.length === 0 : hard.length === 0;

  return {
    pkg,
    ok: structuralOk && genSchema.ok,
    goldSchemaOk: true,
    genSchemaOk: genSchema.ok,
    structuralOk,
    hardIssues: hard,
    softIssues: soft,
    genSchemaLog: genSchema.ok ? 'ok' : genSchema.log,
    goldWarnings: goldSchema.hasWarnings,
    genWarnings: genSchema.hasWarnings,
  };
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || (!args.pkg && !args.allCore && !args.allGold)) {
    console.log(`Usage:
  node scripts/validate-calm-pair.mjs --package <id> [--generate-first] [--strict] [--gold-only]
  node scripts/validate-calm-pair.mjs --all-core [--generate-first] [--strict]
  node scripts/validate-calm-pair.mjs --all-gold [--gold-only]

Gold is hand-authored under gold/calm/ (not generator bootstrap).
Compare is semantic: node-type + path interfaces + connects topology + controls.`);
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
    console.log(`gold schema:  ${r.goldSchemaOk ? 'PASS' : 'FAIL'}${r.goldWarnings ? ' (warnings)' : ''}`);
    console.log(`gen schema:   ${r.genSchemaOk ? 'PASS' : 'FAIL'} ${r.genSchemaOk ? '' : r.genSchemaLog}`);
    console.log(`semantic:     ${r.structuralOk ? 'PASS' : 'FAIL'}`);
    for (const i of r.hardIssues || []) console.log('  -', i);
    for (const i of r.softIssues || []) console.log('  ~', i);
    if (!r.ok) allOk = false;
  }

  console.log(`\n${allOk ? 'ALL PASS' : 'SOME FAILED'} (${results.length} package(s))`);
  process.exit(allOk ? 0 : 1);
}

main();
