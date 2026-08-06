#!/usr/bin/env node
/**
 * Deterministic scorer: architecture.calm.json vs lab gold.
 * No LLM. Evaluation only — see coe-lab/docs/scoring.md
 */
import fs from 'fs';
import path from 'path';

function parseArgs(argv) {
  const out = { strict: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--calm') out.calm = argv[++i];
    else if (a === '--gold') out.gold = argv[++i];
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--strict') out.strict = true;
    else if (a === '--duration') out.durationMs = Number(argv[++i]);
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function normalizeInterface(s) {
  const t = String(s).trim().replace(/\s+/g, ' ');
  const m = t.match(/^([A-Za-z]+)\s+(.+)$/);
  if (!m) return t.toUpperCase();
  let p = m[2].replace(/\/+/g, '/');
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  // gold uses <id> / {id} / :id — normalize braces and :param
  p = p.replace(/<[^>]+>/g, '{id}').replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, '{$1}');
  return `${m[1].toUpperCase()} ${p}`;
}

function calmInterfaces(node) {
  const ifaces = node.interfaces || [];
  const out = [];
  for (const iface of ifaces) {
    if (typeof iface === 'string') {
      out.push(normalizeInterface(iface));
      continue;
    }
    if (!iface || typeof iface !== 'object') continue;
    // Real pipeline path-interface: { type: 'path-interface', path: 'GET /users' }
    // path often already includes METHOD — do not prefix GET again.
    const pathField = iface.path || iface['url-path'];
    if (typeof pathField === 'string') {
      if (/^[A-Za-z]+\s+\//.test(pathField.trim())) {
        out.push(normalizeInterface(pathField));
      } else {
        const method = (iface.method || iface['http-method'] || 'GET').toUpperCase();
        out.push(normalizeInterface(`${method} ${pathField}`));
      }
      continue;
    }
    if (iface['unique-id'] || iface.uniqueId) {
      out.push(normalizeInterface(iface['unique-id'] || iface.uniqueId));
    }
  }
  return out;
}

function nodeBlob(n) {
  return `${n['unique-id'] || ''} ${n.name || ''} ${n['node-type'] || ''}`.toLowerCase();
}

function matchNode(goldNode, calmNodes, used) {
  const wantType = goldNode.nodeType;
  const nameContains = goldNode.match?.nameContains?.toLowerCase();
  const uniqueId = goldNode.match?.uniqueId;
  for (let i = 0; i < calmNodes.length; i++) {
    if (used.has(i)) continue;
    const n = calmNodes[i];
    const type = n['node-type'];
    if (wantType && type && type !== wantType) continue;
    if (uniqueId && n['unique-id'] === uniqueId) {
      used.add(i);
      return { calm: n, index: i };
    }
    if (nameContains && nodeBlob(n).includes(nameContains)) {
      used.add(i);
      return { calm: n, index: i };
    }
  }
  return null;
}

function score(calm, gold) {
  const calmNodes = Array.isArray(calm.nodes) ? calm.nodes : [];
  const goldNodes = gold.nodes || [];
  const used = new Set();
  const matched = [];
  const fnNodes = [];

  for (const g of goldNodes) {
    const m = matchNode(g, calmNodes, used);
    if (m) matched.push({ gold: g, calm: m.calm });
    else fnNodes.push(g);
  }

  const ignoreFp = (gold.ignoreCalmNameContains || []).map((s) => s.toLowerCase());
  const fpNodes = [];
  for (let i = 0; i < calmNodes.length; i++) {
    if (used.has(i)) continue;
    const n = calmNodes[i];
    const t = n['node-type'];
    if (!['service', 'database', 'network', 'system', 'actor'].includes(t)) continue;
    const blob = nodeBlob(n);
    if (ignoreFp.some((s) => blob.includes(s))) continue;
    fpNodes.push(n);
  }

  const tp = matched.length;
  const fp = fpNodes.length;
  const fn = fnNodes.length;
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  // Interfaces
  let ifaceTp = 0;
  let ifaceFn = 0;
  let ifaceFp = 0;
  const goldIfaces = [];
  for (const g of goldNodes) {
    for (const iface of g.interfaces || []) {
      goldIfaces.push({ goldId: g.id, iface: normalizeInterface(iface) });
    }
  }
  const calmIfaceSet = new Set();
  for (const n of calmNodes) {
    for (const iface of calmInterfaces(n)) calmIfaceSet.add(iface);
  }
  const matchedIfaces = new Set();
  for (const g of goldIfaces) {
    if (calmIfaceSet.has(g.iface)) {
      ifaceTp++;
      matchedIfaces.add(g.iface);
    } else ifaceFn++;
  }
  for (const c of calmIfaceSet) {
    if (!matchedIfaces.has(c) && !goldIfaces.some((g) => g.iface === c)) {
      // only count FP if gold defined interfaces at all
      if (goldIfaces.length > 0) ifaceFp++;
    }
  }
  // stricter FP: calm iface not in gold list
  ifaceFp = 0;
  if (goldIfaces.length > 0) {
    const goldSet = new Set(goldIfaces.map((g) => g.iface));
    for (const c of calmIfaceSet) {
      if (!goldSet.has(c)) ifaceFp++;
    }
  }

  // Relationships (optional)
  const goldRels = gold.relationships || [];
  const calmRels = Array.isArray(calm.relationships) ? calm.relationships : [];
  const idToCalm = new Map(matched.map((m) => [m.gold.id, m.calm['unique-id']]));
  let relTp = 0;
  let relFn = 0;
  for (const r of goldRels) {
    const fromId = idToCalm.get(r.from);
    const toId = idToCalm.get(r.to);
    if (!fromId || !toId) {
      relFn++;
      continue;
    }
    const found = calmRels.some((cr) => {
      const c = cr['relationship-type'] || cr.relationshipType || cr;
      const conn = c.connects || c['connects'];
      if (conn) {
        const s = conn.source?.node || conn.source;
        const d = conn.destination?.node || conn.destination;
        return (s === fromId && d === toId) || (s === toId && d === fromId);
      }
      return false;
    });
    if (found) relTp++;
    else relFn++;
  }

  // must-not-detect
  const violations = [];
  for (const rule of gold.mustNotDetect || []) {
    const sub = (rule.nameContains || '').toLowerCase();
    for (const n of calmNodes) {
      if (['service', 'database', 'network'].includes(n['node-type']) && nodeBlob(n).includes(sub)) {
        violations.push({ rule, node: n['unique-id'] || n.name });
      }
    }
  }

  const tier = gold.tier || 'core';
  const nodePrecision = precision;
  const nodeRecall = recall;
  let pass = true;
  const reasons = [];
  // core/trap: enforce thresholds. stretch: report-only for node P/R (still fail on must-not-detect).
  if (tier === 'core' || tier === 'trap') {
    if (nodeRecall < 0.8 && goldNodes.length > 0) {
      pass = false;
      reasons.push(`node recall ${nodeRecall.toFixed(3)} < 0.8`);
    }
    if (nodePrecision < 0.7 && tp + fp > 0) {
      pass = false;
      reasons.push(`node precision ${nodePrecision.toFixed(3)} < 0.7`);
    }
  }
  if (violations.length > 0) {
    pass = false;
    reasons.push(`mustNotDetect violations: ${violations.length}`);
  }

  // Optional control evidence gate (lab control packages)
  let controlsFound = 0;
  for (const n of calmNodes) {
    if (n.controls && typeof n.controls === 'object' && Object.keys(n.controls).length > 0) {
      controlsFound++;
    }
  }
  if (gold.expectControls === true && controlsFound === 0 && (tier === 'core' || tier === 'trap')) {
    pass = false;
    reasons.push('expectControls:true but no calm node carries controls');
  }

  return {
    scorerVersion: '0.1.2',
    packageId: gold.packageId,
    tier,
    pass,
    gateMode: tier === 'stretch' ? 'report-only-node-metrics' : 'enforced',
    failReasons: reasons,
    controls: {
      expectControls: !!gold.expectControls,
      nodesWithControls: controlsFound,
    },
    nodes: {
      tp,
      fp,
      fn,
      precision: round(nodePrecision),
      recall: round(nodeRecall),
      f1: round(f1),
      falseNegatives: fnNodes.map((g) => g.id),
      falsePositives: fpNodes.map((n) => n['unique-id'] || n.name),
    },
    interfaces: {
      tp: ifaceTp,
      fp: ifaceFp,
      fn: ifaceFn,
      precision: round(ifaceTp + ifaceFp === 0 ? 1 : ifaceTp / (ifaceTp + ifaceFp)),
      recall: round(ifaceTp + ifaceFn === 0 ? 1 : ifaceTp / (ifaceTp + ifaceFn)),
    },
    relationships: {
      tp: relTp,
      fn: relFn,
      recall: round(relTp + relFn === 0 ? 1 : relTp / (relTp + relFn)),
    },
    mustNotDetectViolations: violations,
    outOfScope: gold.outOfScope || [],
    expectedPlatformGaps: gold.expectedPlatformGaps || [],
    calmNodeCount: calmNodes.length,
    calmRelationshipCount: calmRels.length,
  };
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.calm || !args.gold) {
    console.log(`Usage: node scripts/score-calm.mjs --calm <architecture.calm.json> --gold <package.gold.json> [--out score.json] [--strict]`);
    process.exit(args.help ? 0 : 2);
  }
  const calm = JSON.parse(fs.readFileSync(args.calm, 'utf8'));
  const gold = JSON.parse(fs.readFileSync(args.gold, 'utf8'));
  const result = score(calm, gold);
  if (args.durationMs != null) result.durationMs = args.durationMs;
  result.calmPath = path.resolve(args.calm);
  result.goldPath = path.resolve(args.gold);

  const text = JSON.stringify(result, null, 2);
  if (args.out) {
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(args.out, text);
  }
  console.log(text);

  if (args.strict && !result.pass) process.exit(1);
}

main();
