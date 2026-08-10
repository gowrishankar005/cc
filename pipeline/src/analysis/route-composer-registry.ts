import { DecoratorFact } from '../scanner/structural-engine';
import { composeJaxRsRoutes } from './jaxrs-route-composer';
import { pushAll } from './pass-registry';

/**
 * `composeJaxRsRoutes` used to be called directly, inline, in run-slice.ts's
 * main loop — correct behavior, wrong extension model. The next
 * language/framework needing route composition (a non-native route stack
 * with the same class-level+method-level annotation-composition shape as
 * JAX-RS) would have added another hardcoded branch next to it. This
 * registry is the fix: a `RouteComposer` is keyed by which
 * `DecoratorFact.language` values it handles, and `composeRoutesForFile`
 * finds all matching composers for a file — JAX-RS is the first citizen,
 * not a special case baked into the orchestrator.
 */
export interface RouteComposer {
  name: string;
  languages: string[]; // matched against DecoratorFact.language
  compose(fileDecoratorFacts: DecoratorFact[]): { composed: DecoratorFact[]; consumed: Set<DecoratorFact> };
}

const jaxRsComposer: RouteComposer = {
  name: 'jax-rs',
  languages: ['java'],
  compose: composeJaxRsRoutes,
};

export const ROUTE_COMPOSERS: RouteComposer[] = [jaxRsComposer];

/**
 * Runs every registered composer whose `languages` includes this file's
 * language against its decorator facts, merging results. Language is
 * derived from the facts themselves (every DecoratorFact for one file
 * shares the same `.language`, per codegraph-provider.ts's extraction) —
 * no separate parameter needed. Preserves the exact behavior the inline
 * call in run-slice.ts had (JAX-RS composition for Java files, no-op for
 * everything else, since `composeJaxRsRoutes` already no-ops on facts with
 * no `@Path`-shaped annotations) — verified by the full regression suite
 * after this refactor, not assumed.
 */
export function composeRoutesForFile(fileDecoratorFacts: DecoratorFact[]): { composed: DecoratorFact[]; consumed: Set<DecoratorFact> } {
  const composed: DecoratorFact[] = [];
  const consumed = new Set<DecoratorFact>();
  const language = fileDecoratorFacts[0]?.language;
  if (!language) return { composed, consumed };

  for (const composer of ROUTE_COMPOSERS) {
    if (!composer.languages.includes(language)) continue;
    const result = composer.compose(fileDecoratorFacts);
    pushAll(composed, result.composed);
    for (const f of result.consumed) consumed.add(f);
  }
  return { composed, consumed };
}
