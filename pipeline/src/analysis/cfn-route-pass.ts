import { AnalysisContext, AnalysisPass } from './pass-registry';
import { discoverCfnRouteBindings } from '../scanner/cfn-manifest-provider';
import { scoreConfidence } from './confidence-scorer';
import { Evidence } from '../types/typed-facts';

const ROUTE_WEIGHT = 40; // matches openApiPass's ROUTE_WEIGHT convention — a resolved CFN path/method/handler binding is as decisive as a native-typed route

/**
 * T-Y4-1 (Serverless_HTTP_and_Dynamo_Ownership_Design.md §2/§4) — binds
 * cfn-manifest-provider.ts's raw path/method/handler bindings to real
 * scanned units. Opt-in: only runs when --cfn-manifests <dir> was passed.
 * Runs AFTER mapSignalsPass (needs ctx.allUnits populated — this pass
 * never creates a new unit, only attaches evidence to one that already
 * exists from T-Y3-1's serverless-entry-point signal).
 *
 * Join key: the Handler string's fully-qualified class name (e.g.
 * "lab.lambdaapigw.TierService" from "lab.lambdaapigw.TierService::getTiers")
 * matched against scanned units by file path, same "endsWith" convention
 * already used elsewhere in this pipeline (multi-hop-bridge-detector.ts's
 * own file-path matching). Same never-guess discipline as openApiPass's
 * merge check: 0 or 2+ candidate units for one handler class -> honest
 * unresolved, never a guess.
 */
export const cfnRoutePass: AnalysisPass = {
  name: 'cfnRoute',
  run(ctx: AnalysisContext) {
    if (!ctx.cfnManifestsDir) return;

    const bindings = discoverCfnRouteBindings(ctx.cfnManifestsDir);
    let boundCount = 0;
    let unresolvedCount = 0;

    for (const binding of bindings) {
      // "package.Class::method" or "package.Class" (no explicit method,
      // some real templates just name the class and rely on a default
      // entry point) — only the class portion matters for unit matching.
      const classPart = binding.handlerString.split('::')[0];
      const simpleClassName = classPart.split('.').pop();
      if (!simpleClassName) {
        unresolvedCount++;
        continue;
      }

      const candidates = ctx.allUnits.filter((u) => u.filePath.endsWith(`/${simpleClassName}.java`) || u.filePath === `${simpleClassName}.java`);
      if (candidates.length !== 1) {
        // 0 (handler class not in scanned roots) or 2+ (ambiguous simple
        // name across packages — never guess which one) both stay
        // honestly unresolved, same discipline as every other "never
        // fabricate" check in this pipeline.
        unresolvedCount++;
        ctx.allIgnoredItems.push({
          ref: binding.sourceFiles.join(';'),
          reason: 'CROSS_DOMAIN_UNRESOLVED',
          detail: `unresolved-cfn-route: handler "${binding.handlerString}" (${binding.httpMethod} ${binding.path}) matched ${candidates.length} scanned unit(s) by class name "${simpleClassName}" (need exactly 1) — no interface attached.`,
        });
        continue;
      }

      const unit = candidates[0];
      const evidence: Evidence = {
        signal: `${binding.httpMethod} ${binding.path}`,
        source: 'structured-file',
        category: 'http-entry-point',
        weight: ROUTE_WEIGHT,
        ref: binding.sourceFiles.join(';'),
      };
      // Dedupe: the same real path can appear more than once across
      // reruns/duplicate template resources — never push an exact
      // duplicate signal onto the same unit.
      if (!unit.evidence.some((e) => e.source === 'structured-file' && e.signal === evidence.signal)) {
        unit.evidence.push(evidence);
        unit.confidence = scoreConfidence(unit.evidence);
      }
      boundCount++;
    }

    console.log(`[cfn-route] ${bindings.length} real CFN route binding(s) found, ${boundCount} bound to a scanned unit, ${unresolvedCount} unresolved`);
  },
};
