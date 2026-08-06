const fs = require('fs');
const path = require('path');
const { CodeGraph } = require('@colbymchenry/codegraph');

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']);

function extractLiteralArg(sourceLines, line, annotationName) {
  const lineText = sourceLines[line - 1] || '';
  const re = new RegExp(`@${annotationName}\\s*\\(\\s*"([^"]*)"\\s*\\)`);
  const m = lineText.match(re);
  return m ? m[1] : null;
}

async function assembleRoutes(moduleRoot, relFile) {
  const absFile = path.join(moduleRoot, relFile);
  const source = fs.readFileSync(absFile, 'utf8');
  const sourceLines = source.split('\n');

  const cg = fs.existsSync(path.join(moduleRoot, '.codegraph'))
    ? await CodeGraph.open(moduleRoot, { sync: true })
    : await CodeGraph.init(moduleRoot, { index: true });

  const result = cg.extractFromSource(relFile, source);
  const decoratesRefs = result.unresolvedReferences.filter(r => r.referenceKind === 'decorates');
  const nodesById = new Map(result.nodes.map(n => [n.id, n]));
  const classNode = result.nodes.find(n => n.kind === 'class');

  const byNode = new Map();
  for (const ref of decoratesRefs) {
    if (!byNode.has(ref.fromNodeId)) byNode.set(ref.fromNodeId, []);
    byNode.get(ref.fromNodeId).push(ref);
  }

  const classPathRef = (byNode.get(classNode.id) || []).find(r => r.referenceName === 'Path');
  const classPath = classPathRef ? extractLiteralArg(sourceLines, classPathRef.line, 'Path') : null;

  const assembled = [];
  for (const [nodeId, refs] of byNode) {
    if (nodeId === classNode.id) continue;
    const methodNode = nodesById.get(nodeId);
    if (!methodNode) continue;
    const httpRef = refs.find(r => HTTP_METHODS.has(r.referenceName));
    if (!httpRef) continue;
    const pathRef = refs.find(r => r.referenceName === 'Path');
    const methodPath = pathRef ? extractLiteralArg(sourceLines, pathRef.line, 'Path') : null;
    const fullPath = [classPath, methodPath].filter(Boolean).join('/');
    assembled.push({ method: methodNode.name, route: `${httpRef.referenceName} ${fullPath}` });
  }
  return assembled;
}

async function check(label, moduleRoot, relFile, groundTruth) {
  console.log(`\n########## ${label} ##########`);
  const assembled = await assembleRoutes(moduleRoot, relFile);
  let matches = 0;
  for (const gt of groundTruth) {
    const found = assembled.find(a => a.method === gt.method);
    const ok = found && found.route === gt.route;
    if (ok) matches++;
    console.log(`${ok ? 'MATCH   ' : 'MISMATCH'}  ${gt.method.padEnd(28)} expected="${gt.route}"  got="${found ? found.route : '(missing)'}"`);
  }
  const extra = assembled.filter(a => !groundTruth.find(gt => gt.method === a.method));
  extra.forEach(e => console.log(`EXTRA     ${e.method.padEnd(28)} got="${e.route}" (not in ground truth — check if spurious)`));
  console.log(`${label}: ${matches}/${groundTruth.length} matched, ${extra.length} extra`);
  return { matches, total: groundTruth.length, extra: extra.length };
}

async function main() {
  const fineract = path.resolve(__dirname, '../../spikes/fineract/repo');

  const r1 = await check(
    'ChargesApiResource',
    path.join(fineract, 'fineract-charge'),
    'src/main/java/org/apache/fineract/portfolio/charge/api/ChargesApiResource.java',
    [
      { method: 'retrieveAllCharges', route: 'GET /v1/charges' },
      { method: 'retrieveCharge', route: 'GET /v1/charges/{chargeId}' },
      { method: 'retrieveNewChargeDetails', route: 'GET /v1/charges/template' },
      { method: 'createCharge', route: 'POST /v1/charges' },
      { method: 'updateCharge', route: 'PUT /v1/charges/{chargeId}' },
      { method: 'deleteCharge', route: 'DELETE /v1/charges/{chargeId}' },
    ]
  );

  const r2 = await check(
    'SchedulerApiResource',
    path.join(fineract, 'fineract-provider'),
    'src/main/java/org/apache/fineract/infrastructure/jobs/api/SchedulerApiResource.java',
    [
      { method: 'retrieveStatus', route: 'GET /v1/scheduler' },
      { method: 'changeSchedulerStatus', route: 'POST /v1/scheduler' },
    ]
  );

  const r3 = await check(
    'DelinquencyApiResource',
    path.join(fineract, 'fineract-loan'),
    'src/main/java/org/apache/fineract/portfolio/delinquency/api/DelinquencyApiResource.java',
    [
      { method: 'getDelinquencyRanges', route: 'GET /v1/delinquency/ranges' },
      { method: 'getDelinquencyRange', route: 'GET /v1/delinquency/ranges/{delinquencyRangeId}' },
      { method: 'createDelinquencyRange', route: 'POST /v1/delinquency/ranges' },
      { method: 'updateDelinquencyRange', route: 'PUT /v1/delinquency/ranges/{delinquencyRangeId}' },
      { method: 'deleteDelinquencyRange', route: 'DELETE /v1/delinquency/ranges/{delinquencyRangeId}' },
      { method: 'getTemplate', route: 'GET /v1/delinquency/buckets/template' },
      { method: 'getDelinquencyBuckets', route: 'GET /v1/delinquency/buckets' },
      { method: 'getDelinquencyBucket', route: 'GET /v1/delinquency/buckets/{delinquencyBucketId}' },
    ]
  );

  const totalMatches = r1.matches + r2.matches + r3.matches;
  const totalRoutes = r1.total + r2.total + r3.total;
  const totalExtra = r1.extra + r2.extra + r3.extra;
  console.log(`\n========== OVERALL: ${totalMatches}/${totalRoutes} matched, ${totalExtra} extra across 3 real Fineract resource files ==========`);
}

main().catch(e => { console.error('FAILED:', e); process.exit(1); });
