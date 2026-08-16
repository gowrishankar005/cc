#!/usr/bin/env node
/**
 * T-LM-2 (AGENT_TASKS_Ext_Lens_Modules.md) -- deterministic scorer:
 * resilience-lens-report.json vs gold/modules/resilience-lens/<pkg>.gold.json.
 * No LLM. Evaluation only.
 *
 * Same pattern as score-module-threat-signals.mjs (T-LM-0) -- the lane
 * file's own instruction was to reuse that gold+scorer template for the
 * first new lens, not invent a second shape. Matches on `unitNameContains`
 * (a stable substring of the real unit id) plus the two boolean facts
 * (hasRetry, hasTimeout) rather than the full unique-id or a free-form
 * category, since resilience-lens's findings are exactly two booleans, not
 * a STRIDE-shaped classification.
 *
 * Review fix (2026-08-16) -- the CLI harness (arg parsing, --all/--pkg
 * resolution, markdown table, exit-code convention) moved to
 * lib/module-scorer.mjs, shared with score-module-threat-signals.mjs. Only
 * the match/describe predicates below are specific to this module.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { runScorerCli } from './lib/module-scorer.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GOLD_DIR = path.join(__dirname, '..', 'gold', 'modules', 'resilience-lens');
const GENERATED_DIR = path.join(__dirname, '..', 'generated');

runScorerCli({
  goldDir: GOLD_DIR,
  generatedDir: GENERATED_DIR,
  reportRelPath: ['modules', 'resilience-lens', 'resilience-lens-report.json'],
  matchFn: (actual, expected) =>
    actual.unitId.includes(expected.unitNameContains) && actual.hasRetry === expected.hasRetry && actual.hasTimeout === expected.hasTimeout,
  describeExpected: (expected) => `${expected.unitNameContains} (retry=${expected.hasRetry}, timeout=${expected.hasTimeout})`,
  describeActual: (actual) => `${actual.unitId} (retry=${actual.hasRetry}, timeout=${actual.hasTimeout})`,
  usage: 'Usage: score-module-resilience-lens.mjs --all | --pkg <name>',
});
