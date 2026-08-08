#!/usr/bin/env node
/**
 * T-L1-4 — synthetic unit test for endpoint-aware L2 (x-lab-l2-mode: endpoint).
 *
 * Proves the thing type-multiset L2 structurally cannot: two services, two
 * databases. Generated has service-A->database-A (correct) AND
 * service-B->database-B is MISSING, but generated has an unrelated
 * service-A->database-B edge instead. Type-multiset L2 would see
 * {service->database: 2 needed, 2 have} and PASS — wrongly, since neither
 * gold-required SPECIFIC pair is actually satisfied by that unrelated edge
 * doing double duty. Endpoint mode must catch this and type-multiset mode
 * must NOT (proving the two modes really do check different things, not
 * just relabeling the same result).
 *
 * Self-contained: writes a temp package under gold/calm + generated,
 * shells out to validate-calm-pair.mjs, asserts, tears down. Not wired into
 * `npm test` (pipeline's suite) since this is a coe-lab-only mechanism with
 * no pipeline/src involvement — run directly: node coe-lab/scripts/test-endpoint-l2.mjs
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LAB = path.join(__dirname, '..');
const PKG = '_test-endpoint-l2-synthetic';
const goldDir = path.join(LAB, 'gold/calm', PKG);
const genDir = path.join(LAB, 'generated', PKG);

const gold = {
  '$schema': 'https://calm.finos.org/release/1.2/meta/calm.json',
  'unique-id': 'test-endpoint-l2-gold',
  name: 'synthetic endpoint-L2 test',
  description: 'Not a real system — proves endpoint-aware L2 catches a mismatched-specific-pair case type-multiset L2 would miss.',
  metadata: [
    { key: 'x-lab-gold-source', value: 'hand-authored' },
    { key: 'x-lab-l2-mode', value: 'endpoint' },
  ],
  nodes: [
    { 'unique-id': 'service-a', 'node-type': 'service', name: 'Service A', description: 'synthetic service A' },
    { 'unique-id': 'service-b', 'node-type': 'service', name: 'Service B', description: 'synthetic service B' },
    { 'unique-id': 'db-a', 'node-type': 'database', name: 'Database A', description: 'synthetic database A' },
    { 'unique-id': 'db-b', 'node-type': 'database', name: 'Database B', description: 'synthetic database B' },
  ],
  relationships: [
    { 'unique-id': 'r1', description: 'A to A', 'relationship-type': { connects: { source: { node: 'service-a' }, destination: { node: 'db-a' } } } },
    { 'unique-id': 'r2', description: 'B to B', 'relationship-type': { connects: { source: { node: 'service-b' }, destination: { node: 'db-b' } } } },
  ],
};

const generated = {
  '$schema': 'https://calm.finos.org/release/1.2/meta/calm.json',
  'unique-id': 'test-endpoint-l2-generated',
  name: 'synthetic endpoint-L2 test — generated',
  nodes: [
    { 'unique-id': 'gen-service-a', 'node-type': 'service', name: 'Service A', description: 'synthetic generated service A' },
    { 'unique-id': 'gen-service-b', 'node-type': 'service', name: 'Service B', description: 'synthetic generated service B' },
    { 'unique-id': 'gen-db-a', 'node-type': 'database', name: 'Database A', description: 'synthetic generated database A' },
    { 'unique-id': 'gen-db-b', 'node-type': 'database', name: 'Database B', description: 'synthetic generated database B' },
  ],
  relationships: [
    // Correct: A->A
    { 'unique-id': 'g1', description: 'A to A', 'relationship-type': { connects: { source: { node: 'gen-service-a' }, destination: { node: 'gen-db-a' } } } },
    // WRONG for gold's B->B requirement: A->B instead. Same TYPE pair
    // (service->database) as what B->B needs, so type-multiset L2 sees
    // "2 needed, 2 have" and passes — the exact false-comfort case this
    // mechanism exists to catch.
    { 'unique-id': 'g2', description: 'A to B (wrong)', 'relationship-type': { connects: { source: { node: 'gen-service-a' }, destination: { node: 'gen-db-b' } } } },
  ],
};

function run(pkg, extraArgs) {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'validate-calm-pair.mjs'), '--package', pkg, '--require-l2', ...extraArgs], { encoding: 'utf8', cwd: LAB });
  return r.stdout || '';
}

function assertContains(out, needle, label) {
  if (!out.includes(needle)) {
    console.error(`FAIL: ${label}\nExpected output to contain: ${needle}\n--- actual output ---\n${out}`);
    process.exitCode = 1;
    return false;
  }
  console.log(`ok - ${label}`);
  return true;
}

function main() {
  fs.mkdirSync(goldDir, { recursive: true });
  fs.mkdirSync(genDir, { recursive: true });
  fs.writeFileSync(path.join(goldDir, 'architecture.calm.json'), JSON.stringify(gold, null, 2));
  fs.writeFileSync(path.join(genDir, 'architecture.calm.json'), JSON.stringify(generated, null, 2));

  try {
    // Case 1: endpoint mode (x-lab-l2-mode: endpoint is in the gold above) must FAIL L2.
    const endpointOut = run(PKG, ['--allow-root-mismatch']);
    assertContains(endpointOut, 'L2 story:         FAIL', 'endpoint mode correctly FAILs on the mismatched-specific-pair case');
    assertContains(endpointOut, 'no generated connects edge from matched node gen-service-b to matched node gen-db-b', 'endpoint mode names the exact missing specific pair');

    // Case 2: same fixture, but with x-lab-l2-mode stripped (type-multiset
    // default) must PASS — proving the two modes really do disagree on this
    // fixture, not just relabel the same result.
    const goldNoEndpoint = JSON.parse(JSON.stringify(gold));
    goldNoEndpoint.metadata = goldNoEndpoint.metadata.filter((m) => m.key !== 'x-lab-l2-mode');
    fs.writeFileSync(path.join(goldDir, 'architecture.calm.json'), JSON.stringify(goldNoEndpoint, null, 2));
    const typeMultisetOut = run(PKG, ['--allow-root-mismatch']);
    assertContains(typeMultisetOut, 'L2 story:         PASS', 'type-multiset (default) mode PASSes on the SAME fixture — proves it is genuinely weaker, the exact gap T-L1-4 exists to close for gold that opts in');
  } finally {
    fs.rmSync(goldDir, { recursive: true, force: true });
    fs.rmSync(genDir, { recursive: true, force: true });
  }

  if (process.exitCode) {
    console.log('\nFAILED');
  } else {
    console.log('\nALL OK');
  }
}

main();
