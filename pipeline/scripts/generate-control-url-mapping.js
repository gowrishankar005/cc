#!/usr/bin/env node
/**
 * Generates dist/rules/control-url-mapping.json — a URL-to-local-file
 * mapping for `calm validate -u`, per its own documented flag
 * ("Path to mapping file which maps URLs to local paths").
 *
 * Real finding, not assumed (found by actually running `calm validate`
 * against generated controls, not from reading the schema alone):
 * calm-cli does a LIVE remote-host-allowlist check against every control's
 * `requirement-url`, even under plain `-a` schema validation — a bare
 * placeholder https:// URL fails with "Host ... is not allowlisted", and
 * neither a non-allowlisted https:// host nor a file:// URL is accepted
 * (calm-cli: "Only HTTP and HTTPS are allowed" for the URL itself, but a
 * live host-allowlist for https:// specifically). This falsifies an earlier
 * design-doc assumption (requirements v0.10 §0: "still schema-valid CALM,
 * the field just needs to be a string") — that was true for bare JSON Schema
 * conformance, not for what `calm validate` actually does at runtime.
 *
 * The correct fix, using calm-cli's own documented mechanism: keep the
 * placeholder https:// URL in the generated CALM document (so it's an
 * honest, stable, project-owned identifier — not a real live schema, per
 * v0.10 §0's disclosure), and provide a URL-to-local-file mapping so
 * `calm validate -u <this file>` resolves it to the real, checked-in,
 * schema-conformant local requirement file instead of trying to fetch it.
 *
 * Absolute paths, generated fresh per build (not checked in) — resolving
 * relative to __dirname is what makes this portable across checkouts.
 */
const fs = require('fs');
const path = require('path');
const { parse: parseYaml } = require('yaml');

const rulesDir = path.join(__dirname, '..', 'dist', 'rules');
const catalogue = parseYaml(fs.readFileSync(path.join(__dirname, '..', 'src', 'rules', 'control-requirement-catalogue.yml'), 'utf8'));

const mapping = {};
for (const control of catalogue.controls) {
  const localPath = path.join(rulesDir, 'control-requirements', `${control.controlId}.requirement.json`);
  if (!fs.existsSync(localPath)) {
    throw new Error(
      `control-requirement-catalogue.yml declares controlId "${control.controlId}" with requirementUrl "${control.requirementUrl}", but no matching local schema file exists at src/rules/control-requirements/${control.controlId}.requirement.json — every catalogue row needs one, so calm validate -u can resolve it without a real network fetch.`
    );
  }
  mapping[control.requirementUrl] = localPath;
}

fs.writeFileSync(path.join(rulesDir, 'control-url-mapping.json'), JSON.stringify(mapping, null, 2));
console.log(`[generate-control-url-mapping] wrote ${Object.keys(mapping).length} mapping(s) to dist/rules/control-url-mapping.json`);
