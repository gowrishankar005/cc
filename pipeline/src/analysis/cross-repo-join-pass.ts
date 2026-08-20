import * as path from 'path';
import { AnalysisContext, AnalysisPass, pushAll } from './pass-registry';
import { discoverRepoManifests } from '../scanner/repo-manifest-provider';
import { discoverCdxgenComponents } from '../scanner/cdxgen-provider';
import { discoverSpringConfigFiles } from '../scanner/spring-config-provider';
import { detectCrossRepoJoins, RootJoinInputs } from './cross_package/cross-repo-join-detector';

/**
 * T-MR-2 — opt-in, same convention as `k8sManifestsDir`: a no-op when
 * `ctx.repoManifestsDir` is unset. Re-discovers cdxgen/spring-config data
 * per root directly (same "call the provider per pass" convention
 * `cdxgen-corroboration-pass.ts` already uses — no existing ctx field
 * caches raw cdxgen components across passes) rather than adding new
 * `AnalysisContext` plumbing for a mechanism only exercised when this one
 * flag is passed.
 *
 * Review finding (2026-08-20) — a real bug caught by inspecting actual
 * generated CALM output, not just reading the code: `ctx.packageRoots`
 * holds the FULL RESOLVED ABSOLUTE PATH (`run-slice.ts`'s `main()` calls
 * `path.resolve` on every positional arg), and this pass originally fed
 * that raw string straight into `repoRootNodeId`. Two real problems: (1)
 * the exact same repo scanned from a different checkout location (a
 * different CI machine, a different local clone path) produces a
 * DIFFERENT `repo-root:` node/relationship id — breaking T-CL-1/T-CL-2's
 * whole "stable identity across reruns" guarantee for every cross-repo
 * relationship, the one fact class this pipeline's incremental-merge
 * mechanism exists to track correctly; (2) it leaks the scanning machine's
 * local filesystem layout into the architecture output's node id AND
 * human-readable `name` — every other synthetic anchor in this codebase
 * (k8s-namespace, the whole-run `system` node) uses a short, portable
 * label, never an absolute path. Fixed to `path.basename(root)` — still a
 * real, disclosed limitation (two DIFFERENT package roots sharing a
 * basename, e.g. two repos each with a `src` root, collide onto one
 * repo-root anchor — see `scope-limitations.yml`'s
 * `cross-repo-join-root-granularity-only`), but no longer environment-path
 * dependent.
 */
export const crossRepoJoinPass: AnalysisPass = {
  name: 'crossRepoJoin',
  run(ctx: AnalysisContext) {
    if (!ctx.repoManifestsDir) return;
    const manifests = discoverRepoManifests(ctx.repoManifestsDir);
    if (manifests.length === 0) return;

    const inputsByRoot = new Map<string, RootJoinInputs>();
    for (const root of ctx.packageRoots) {
      const openApiDocuments = ctx.openApiDocumentsByRoot?.get(root) ?? [];
      const cdxgenComponents = discoverCdxgenComponents(root);
      const springConfigValues = discoverSpringConfigFiles(root).flatMap((f) => [...f.properties.values()]);
      // Map key stays the real, unique absolute root (construction-time
      // lookup only, never read by the detector); `root` inside the value
      // is the portable LABEL actually used to build the synthetic
      // repo-root node id — see this pass's own doc comment above for why
      // the two must not be the same string.
      inputsByRoot.set(root, { root: path.basename(root), openApiDocuments, cdxgenComponents, springConfigValues });
    }

    const { relationships } = detectCrossRepoJoins(inputsByRoot, manifests);
    pushAll(ctx.relationships, relationships);
    console.log(`[run-slice] cross-repo join: ${manifests.length} manifest(s) read, ${relationships.length} relationship(s) resolved`);
  },
};
