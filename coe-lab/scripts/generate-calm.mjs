#!/usr/bin/env node
/**
 * Run platform CALM generator on a lab fixture → generated/<id>/
 *
 * Gold under gold/calm/ is hand-authored and validated with calm validate —
 * do NOT copy generator output into gold (circular). Use validate-calm-pair.mjs
 * for semantic compare gold vs generated.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LAB = path.join(__dirname, '..');
const ROOT = path.join(LAB, '..');
const PIPE = path.join(ROOT, 'pipeline');

const CORE = [
  'py-accounts-api',
  'py-ledger-worker',
  'ts-nestjs-users',
  'java-jaxrs-charges',
  'java-spring-payments',
  'java-rbac-datatable',
  'lib-fintech-common',
];

function parseArgs(argv) {
  const out = { allCore: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--package') out.pkg = argv[++i];
    else if (a === '--all-core') out.allCore = true;
    else if (a === '--bootstrap-expected') {
      console.error(
        '[generate-calm] --bootstrap-expected is removed. Gold CALM is hand-authored under gold/calm/ and must pass calm validate independently. See gold/calm/README.md.'
      );
      process.exit(2);
    } else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function generateOne(pkg) {
  const fixture = path.join(LAB, 'fixtures/monorepo/packages', pkg);
  if (!fs.existsSync(fixture)) {
    console.error(`Missing fixture: ${fixture}`);
    return false;
  }
  const outDir = path.join(LAB, 'generated', pkg);
  fs.mkdirSync(outDir, { recursive: true });

  const run = spawnSync(
    process.execPath,
    [path.join(PIPE, 'dist/orchestration/run-slice.js'), fixture, '--out', outDir],
    { encoding: 'utf8', cwd: PIPE }
  );
  process.stdout.write(run.stdout || '');
  process.stderr.write(run.stderr || '');
  if (run.status !== 0) {
    console.error(`[generate-calm] run-slice failed for ${pkg} (exit ${run.status})`);
    return false;
  }

  const calmPath = path.join(outDir, 'architecture.calm.json');
  if (!fs.existsSync(calmPath)) {
    console.error(`[generate-calm] no architecture.calm.json for ${pkg}`);
    return false;
  }

  // Schema validate if calm CLI available via npm script path
  const validate = spawnSync(
    'npx',
    ['--no-install', 'calm', 'validate', '-u', path.join(PIPE, 'dist/rules/control-url-mapping.json'), '-a', calmPath],
    { encoding: 'utf8', cwd: PIPE, shell: true }
  );
  if (validate.status !== 0) {
    console.warn(`[generate-calm] calm validate non-zero for ${pkg}:\n${validate.stderr || validate.stdout}`);
  } else {
    console.log(`[generate-calm] calm validate ok: ${pkg}`);
  }

  return true;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || (!args.pkg && !args.allCore)) {
    console.log(`Usage:
  node scripts/generate-calm.mjs --package <id>
  node scripts/generate-calm.mjs --all-core
Writes platform output to generated/<id>/ only (never gold/).
Requires: pipeline built (cd pipeline && npm run build)`);
    process.exit(args.help ? 0 : 2);
  }

  const runSlice = path.join(PIPE, 'dist/orchestration/run-slice.js');
  if (!fs.existsSync(runSlice)) {
    console.error('Build pipeline first: cd pipeline && npm run build');
    process.exit(1);
  }

  const packages = args.allCore ? CORE : [args.pkg];
  let ok = true;
  for (const p of packages) {
    console.log(`\n=== generate ${p} ===`);
    if (!generateOne(p)) ok = false;
  }
  process.exit(ok ? 0 : 1);
}

main();
