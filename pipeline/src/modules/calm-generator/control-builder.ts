import { TypedUnit } from '../../types/typed-facts';
import { CalmNode } from '../../types/calm';
import { ControlRequirementCatalogue, findControlRequirement } from '../../rules/construct-mapping-schema';

/**
 * T-R2-3 (C-rich structured authority, Robustness Phase R2). Beyond the raw
 * `expression` text (T-D2), pulls out the one thing that's SAFELY structural
 * within it: a Java constant-style authority reference — either a qualified
 * enum member (`SystemRole.ADMIN`) or a bare ALL_CAPS constant
 * (`RESOURCE_NAME_FOR_PERMISSIONS`) — real, grep-verified shapes from both
 * evidence repos this catalogue is built against (a reference Java governance platform's
 * `SystemRole.LICENCE_ADMIN`/`SystemRole.ADMIN`, a reference Java/JAX-RS banking platform's
 * `RESOURCE_NAME_FOR_PERMISSIONS`). Deliberately NEVER resolves what the
 * constant equals (that's cross-file/whole-program resolution this
 * mechanism has never done and explicitly won't — see `extractCallArgumentText`'s
 * own comment) — this only extracts the LITERAL TOKEN already present in the
 * source text `expression` already captures, a naming-convention match, not
 * an inferred value. Absent, not a fake empty string, when no such token is
 * present (e.g. a call whose only arguments are plain variables) — matches
 * `expression`'s own "real per-signal richness, not invented uniformly"
 * discipline.
 */
const AUTHORITY_REF = /\b([A-Z][A-Za-z0-9]*\.[A-Z][A-Z0-9_]+|[A-Z][A-Z0-9_]{2,})\b/;

function extractAuthorityRef(expression: string | undefined): string | undefined {
  return expression ? AUTHORITY_REF.exec(expression)?.[1] : undefined;
}

/**
 * The sixth builder (Solution Design v2 §5.5) — attaches CALM `controls` to
 * already-built nodes (mutates in place), from evidence signal-mapper.ts
 * already tagged `category: 'security-control'`. Two-catalogue lookup, same
 * division of labor as every other construct: signal-catalogue.yml decided
 * THAT this evidence means "a control exists here"; control-requirement-catalogue.yml
 * decides WHICH control-id/description/requirement-url it maps to.
 *
 * Real evidence this was built against: spikes/fineract/repo/fineract-core/
 * .../DatatableWriteService.java — a Java `interface` with @PreAuthorize on
 * every method and no HTTP route annotation anywhere, i.e. a genuinely new
 * class of previously-invisible node (an RBAC-enforcing service layer, not
 * discoverable by any mechanism this pipeline had before this).
 *
 * Language currently threaded through in a way that could ambiguously match
 * a control rule meant for a different language (same class of risk already
 * found and fixed for the node-type/relationship catalogues) — mitigated the
 * same way: findControlRequirement takes an optional language and prefers a
 * same-language match. There is only one control row today, so this isn't
 * exercised yet, but the mechanism is in place before a second row needs it.
 */
export function attachControls(units: TypedUnit[], nodes: CalmNode[], catalogue: ControlRequirementCatalogue): void {
  const nodesById = new Map(nodes.map((n) => [n['unique-id'], n]));

  for (const unit of units) {
    const node = nodesById.get(unit.id);
    if (!node) continue;

    for (const ev of unit.evidence) {
      if (ev.category !== 'security-control') continue;

      // signal-mapper.ts derives Evidence.signal from the raw decorator
      // referenceName (e.g. "PreAuthorize") for decorator-sourced evidence —
      // there's no language field carried on Evidence itself (that lives on
      // DecoratorFact, one layer upstream, and isn't threaded through
      // TypedUnit today). Re-deriving it from the unit's filePath extension
      // is the same technique codegraph-provider.ts already uses.
      const language = unit.filePath.endsWith('.java') ? 'java' : unit.filePath.endsWith('.py') ? 'python' : unit.filePath.endsWith('.ts') ? 'typescript' : undefined;

      const rule = findControlRequirement(catalogue, ev.signal, language);
      if (!rule) continue; // no catalogue row for this signal — not every security-control-category signal is necessarily mapped yet

      if (!node.controls) node.controls = {};
      if (!node.controls[rule.controlId]) {
        node.controls[rule.controlId] = { description: rule.description, requirements: [] };
      }
      node.controls[rule.controlId].requirements.push({
        'requirement-url': rule.requirementUrl,
        config: {
          detectedVia: rule.detectionMechanism,
          evidenceRef: ev.ref,
          // AREC Wave 3 T-D2 (C-rich) — the evidence's own raw source-line
          // argument (e.g. "RESOURCE_NAME_FOR_PERMISSIONS" for a call-site
          // control), when the extractor found one. Absent, not a fake
          // empty string, for decorator evidence that carries no argument
          // today (e.g. @PreAuthorize) — this is real per-signal richness,
          // not invented for every control uniformly.
          ...(ev.argument !== undefined ? { expression: ev.argument } : {}),
          // T-R2-3 (C-rich structured authority) — see extractAuthorityRef's
          // own doc comment for what this is and isn't.
          ...(extractAuthorityRef(ev.argument) ? { authorityRef: extractAuthorityRef(ev.argument) } : {}),
          // Honest per v0.10 §0: requirement-url is a placeholder this
          // project doesn't yet host as a real schema — say so inline, not
          // just in a document-level disclosure someone could miss.
          note: 'requirement-url is a project-owned placeholder, not yet a real dereferenceable schema',
        },
      });
    }
  }
}
