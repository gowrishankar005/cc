#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { IgnoredItem } from '../types/typed-facts';
import { CatalogueRule } from './rule-schema';

/**
 * OFFLINE ONLY. Never imported by orchestration/run-slice.ts or anything in
 * its call graph — that boundary is what keeps the core generation path
 * free of LLM calls (requirements v0.1-v0.6, restated every version: "no
 * LLM in the core generation path"). A human runs this deliberately, after
 * a scan, over the unknown-signal entries signal-mapper.ts logged.
 *
 * Writes rules/proposed-updates.json ONLY. Never writes signal-catalogue.yml.
 * Promotion (merging an accepted proposal into signal-catalogue.yml) is a
 * manual, human step — mirrors the Decision Record schema already drafted
 * in docs/spikes/Gap_Closure_Build_Ready_Specs_v0.1.md §6.
 */

interface ProposedRule extends Omit<CatalogueRule, 'id'> {
  id: string;
  rationale: string;
  proposedAt: string;
  status: 'proposed';
}

function extractUnknownSignals(ignoredItems: IgnoredItem[]): string[] {
  const signals = new Set<string>();
  for (const item of ignoredItems) {
    if (item.reason !== 'INSUFFICIENT_EVIDENCE' || !item.detail) continue;
    const m = /raw signal "([^"]+)"/.exec(item.detail);
    if (m) signals.add(m[1]);
  }
  return [...signals];
}

async function callLlmForSuggestions(unknownSignals: string[]): Promise<ProposedRule[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(
      '[suggest-rules] No ANTHROPIC_API_KEY set — cannot call an LLM backend. ' +
        'This tool is explicitly optional and offline; without a configured backend it has nothing to propose. ' +
        `Unknown signals found: ${unknownSignals.join(', ') || '(none)'}`
    );
    return [];
  }

  const prompt = `You are helping expand a static rule table that maps source-code decorator/annotation
names to architecture signal categories, for a deterministic (non-LLM) code-scanning pipeline.

For each raw signal name below, propose a candidate rule as JSON with fields:
id, language, framework, matchSignal, matchSource ("decorator" or "native-route"),
category ("http-entry-point" | "framework-bootstrap" | "persistence" | "messaging" | "folder-convention"),
weight (0-40), calmNodeType ("service" | "database"), rationale (one sentence).

These are PROPOSALS ONLY for human review — do not assume any of them will be auto-applied.

Raw signals: ${JSON.stringify(unknownSignals)}

Respond with a JSON array only.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM call failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { content: Array<{ text?: string }> };
  const text = data.content.map((c) => c.text ?? '').join('');
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error(`LLM response did not contain a JSON array: ${text}`);

  const rawProposals = JSON.parse(jsonMatch[0]) as Omit<ProposedRule, 'proposedAt' | 'status'>[];
  return rawProposals.map((p) => ({ ...p, proposedAt: new Date().toISOString(), status: 'proposed' as const }));
}

async function main() {
  const ignoredItemsPath = process.argv[2];
  if (!ignoredItemsPath) {
    console.error('Usage: suggest-rules <path-to-ignored-items-report.json>');
    process.exit(1);
  }

  const ignoredItems: IgnoredItem[] = JSON.parse(fs.readFileSync(ignoredItemsPath, 'utf8'));
  const unknownSignals = extractUnknownSignals(ignoredItems);

  if (unknownSignals.length === 0) {
    console.log('[suggest-rules] No unknown signals found in the given report. Nothing to propose.');
    return;
  }

  const proposals = await callLlmForSuggestions(unknownSignals);

  const outPath = path.join(__dirname, 'proposed-updates.json');
  fs.writeFileSync(outPath, JSON.stringify(proposals, null, 2));
  console.log(
    `[suggest-rules] Wrote ${proposals.length} proposal(s) to ${outPath}. ` +
      `These are DRAFTS — review and manually merge accepted entries into signal-catalogue.yml. ` +
      `This tool never writes signal-catalogue.yml directly.`
  );
}

main();
