import { AnalysisContext, AnalysisPass, pushAll } from './pass-registry';
import { discoverDeployments } from '../scanner/k8s-manifest-provider';
import { detectValueContradictions } from './cross_package/contradiction-detector';

/**
 * Contradiction detection between evidence sources (BACKLOG.md).
 * Opt-in, same convention as k8sTrustPass/envSoftGraphPass: only runs when
 * --k8s-manifests <dir> was passed. Runs after springConfigPass (needs its
 * spring.datasource.url-derived database units already in ctx.allUnits) —
 * position among k8sTrustPass/envSoftGraphPass is free, same reasoning
 * passes.ts's own doc comment already gives for those two (this pass reads
 * neither ctx.relationships nor multiHopExaminedPairs either).
 */
export const contradictionPass: AnalysisPass = {
  name: 'contradictionDetection',
  run(ctx: AnalysisContext) {
    if (!ctx.k8sManifestsDir) return;

    const deployments = discoverDeployments(ctx.k8sManifestsDir);
    const { ignoredItems } = detectValueContradictions(deployments, ctx.allUnits);
    pushAll(ctx.allIgnoredItems, ignoredItems);

    if (ignoredItems.length > 0) {
      console.log(`[contradiction-detection] ${ignoredItems.length} conflicting-evidence item(s) found — forced to review, never averaged`);
    }
  },
};
