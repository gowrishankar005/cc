#!/usr/bin/env node
/**
 * T-LM-0 (AGENT_TASKS_Ext_Lens_Modules.md) -- deterministic scorer:
 * threat-signals-report.json vs gold/modules/threat-signals/<pkg>.gold.json.
 * No LLM. Evaluation only.
 *
 * threat-signals is the first module scored this way -- before this script,
 * every lens module (including threat-signals itself) shipped unmeasurable,
 * which the lane file's own pre-flight named as a blocking gap: an
 * unmeasured lens may inform but must never gate a governance decision
 * (BR-110).
 *
 * Matches on `unitNameContains` (a stable substring of the real unit id,
 * e.g. a class/file name) rather than the full unique-id, since unique-ids
 * are root-relative file paths that are correct but verbose and brittle to
 * match exactly -- same trade-off calm scoring already makes.
 *
 * Review fix (2026-08-16) -- the CLI harness (arg parsing, --all/--pkg
 * resolution, markdown table, exit-code convention) moved to
 * lib/module-scorer.mjs, shared with score-module-resilience-lens.mjs. Only
 * the match/describe predicates below are specific to this module.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { runScorerCli } from './lib/module-scorer.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GOLD_DIR = path.join(__dirname, '..', 'gold', 'modules', 'threat-signals');
const GENERATED_DIR = path.join(__dirname, '..', 'generated');

runScorerCli({
  goldDir: GOLD_DIR,
  generatedDir: GENERATED_DIR,
  reportRelPath: ['modules', 'threat-signals', 'threat-signals-report.json'],
  matchFn: (actual, expected) => actual.unitId.includes(expected.unitNameContains) && actual.stride === expected.stride,
  describeExpected: (expected) => `${expected.unitNameContains} (${expected.stride})`,
  describeActual: (actual) => `${actual.unitId} (${actual.stride})`,
  usage: 'Usage: score-module-threat-signals.mjs --all | --pkg <name>',
});
