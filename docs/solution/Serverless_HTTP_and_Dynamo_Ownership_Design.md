# Serverless HTTP + Dynamo ownership design (T-Y1-1)

**Status:** design note, written before any Y2-Y4 code, per `AGENT_TASKS_Fidelity_Yardstick_and_Serverless.md`'s hard phase order.
**Scope:** answers every question needed to build `B-lambda-http` (Y3-Y4) and `B-dynamo-handler-kind` (Y2) generically. Grounded in real source and real CFN templates from `spikes/aws-saas-boost/repo` — every shape below was read from real files, not assumed.

---

## 1. Handler signals

**Java** (the only real-evidenced shape so far — both `aws-saas-boost-tier-service` and `aws-saas-boost-tenant-service` findings):

- A class `implements RequestHandler<I, O>` (real: `public class TenantService implements RequestHandler<Map<String, Object>, APIGatewayProxyResponseEvent>`) — the generic type parameters vary (`Map<String,Object>`, a custom event POJO, etc.), so the structural signal is **`implements RequestHandler`** (or `implements RequestStreamHandler` for the streaming variant), not a fixed type-parameter match.
- Corroborating, not sole-path, evidence: import of `com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent` / `APIGatewayProxyRequestEvent` (or the AWS SDK v2 `software.amazon.awssdk.services.apigateway.*` equivalents) — real in both evidenced classes.
- Mechanism: same `extractFromSource()`/`decorates`-ref read-back already used for JPA/JAX-RS (an `implements` reference is structurally identical to a `decorates`/`extends` reference for this purpose) — **no new extraction mechanism**, a new signal-catalogue row + wiring, same discipline as every other signal this project has added.

**Node** — explicitly named an open question per T-Y1-1, not silently assumed to transfer: AWS Lambda Node handlers are typically a bare exported function (`exports.handler = async (event) => {...}`) with **no structural class/interface signal at all** — a fundamentally different shape from Java's `implements RequestHandler`, closer to a naming-convention/file-shape check (`exports.handler` as the entry point, optionally typed `APIGatewayProxyHandler` if using `aws-lambda` type defs). **Decision: Node Lambda handlers are OUT of scope for Y2-Y5.** Not because they're unlikely to matter, but because zero real Node Lambda samples have been evidenced yet (same "don't build ahead of evidence" discipline as `D-terminal-refine`) — revisit when a real Node Lambda sample exists, same as the layered-story program's own L2b deferral.

**Python** — same reasoning, same decision: out of scope for Y2-Y5, no real sample evidenced.

## 2. CFN/SAM path extraction shape — the real, non-trivial part

Read directly from real SaaS Boost templates (`resources/saas-boost-private-api.yaml`, `resources/saas-boost-svc-tenant.yaml`), **not assumed from AWS docs**. The real shape is a **three-way join across up to three separate resources, often in separate files**:

```
AWS::ApiGateway::Resource (PathPart: 'tenants')
  └─ AWS::ApiGateway::Resource (PathPart: '{id}', ParentId: <parent's logical id>)
       └─ AWS::ApiGateway::Method (HttpMethod: GET, ResourceId: <resource's logical id>)
            Integration.Uri: !Sub ".../functions/${TenantServiceById}/invocations"
                                                    │
                                                    ▼
            AWS::Lambda::Function  (logical id: TenantServiceById, in a DIFFERENT file)
              Properties.Handler: "com.amazon.aws.partners.saasfactory.saasboost.TenantService::getTenantById"
```

Concretely, real evidence:
- **Path** is not a flat string on one resource — it's reconstructed by walking `AWS::ApiGateway::Resource`'s `ParentId` chain up to the root, joining each node's `PathPart` (`tenants` + `{id}` → `/tenants/{id}`).
- **Method** (`HttpMethod`) sits on a separate `AWS::ApiGateway::Method` resource, linked to its path node via `ResourceId`.
- **Handler binding** is not on the Method resource at all — the Method's `Integration.Uri` references a Lambda function via a CFN intrinsic (`!Sub`) naming another resource's **logical id** (e.g. `TenantServiceById`), which must be resolved to find the real `AWS::Lambda::Function` resource and read its `Handler:` property (the real `Class::method` string that ties back to the scanned Java class).
- **Real observed constraint**: in SaaS Boost, the API definition (`saas-boost-private-api.yaml`) and the Lambda function definitions (`saas-boost-svc-tenant.yaml`) are **separate files**. A v1 that only reads one file in isolation would fail on this exact real repo.

### Decision: v1 join scope

**D-cfn-v1** (already locked in the agent-tasks §0.4): explicit `Path`+`Method`+`Handler`/function-binding only, not a full AWS resource graph. Concretely, scoped as:

1. **Multi-file, same-directory join** — reuse the existing structured-file-ingestion pattern's own convention (the k8s-manifest provider already takes a directory, not a single file): load every `.yaml`/`.yml`/`.json` file in the given directory as one combined resource pool before resolving any `ParentId`/`Integration.Uri`/logical-id references. This is required by the real evidence above — a single-file join would not work on the actual repo this design is grounded in.
2. **Logical-id resolution is same-template-pool only** — no cross-stack imports (`Fn::ImportValue`), no nested-stack (`AWS::CloudFormation::Stack`) traversal. If a reference can't be resolved within the given directory's pool, that binding is left unresolved (honest silence — an ignored-item, same discipline as every other "can't find it, don't guess" rule in this project), not an error and not a guess.
3. **`PathPart` tree walk bounded** at a generous but finite depth (say 10) to avoid infinite loops on a malformed template — real templates in evidence are 2-3 levels deep.
4. **SAM shorthand (`AWS::Serverless::Function` with an `Events:` block)** is a real, different shape (implicit API Gateway wiring, no explicit `AWS::ApiGateway::Method` resource) — **named as a real variant, deferred**, not silently assumed to be covered by the raw-CFN join above. No real SAM-shorthand sample has been evidenced yet in this project's evidence repos.

## 3. OpenAPI precedence vs CFN

**D-openapi-fallback** (locked): if an OpenAPI document is present for the same package, its dual-unit merge (already built, T-E4) takes precedence for path recall; CFN join is the fallback / supplement for API Gateway paths OpenAPI doesn't itself describe. Rationale: OpenAPI is an explicit, already-proven, higher-signal source when it exists; CFN reconstruction is inherently more indirect (a multi-hop reference chain, per §2) and should not override a document the API's own author wrote. Document explicitly in `scope-limitations.yml` so a future session doesn't have to re-derive the precedence order.

## 4. Kind priority rules vs Dynamo import (`D-dynamo-priority`)

**Real counterexample this rule exists for** (`aws-saas-boost-tier-service`, HT-ASB-002): `TierService` — a real Lambda handler — directly imports `DynamoDbClient` (to construct the real store class), and under today's persistence-detection logic gets typed `database` solely from that import, even though it's architecturally a handler, not a store.

**Rule**: once a unit has **any** http-entry-point-category evidence (native route, OR the new Lambda-handler signal from §1), that evidence wins kind assignment over a bare driver-import signal alone — same precedent `signal-mapper.ts` already uses for `http-entry-point` beating `persistence` in the tie-break (the real, proven `ChargesApiResource`-class case), extended here to cover the *new* http-entry-point category this design adds. **Ownership check, not just presence check**: reuse the `ownerBaseClass`/class-ownership-resolver pattern from B-ontology (Q13's Prisma fix) — a class that merely imports a driver type (to pass it to a real store class's constructor, e.g. `TierService`'s real `new DynamoTierDataStore(dynamoDbClient)` pattern) is not the same as a class that *owns* the client (constructs and holds it as its own field with no further delegation). Concretely: `DynamoDbClient`/`DynamoDbEnhancedClient` join the `ownerBaseClass`-aware driver-import strategy already built for Prisma, generalizing a previously Prisma-only mechanism to a second real evidenced library — not a parallel new mechanism.

**Ordering dependency, named explicitly** (the one thing flagged in review before this note was written): this rule can be *built* in Y2 independent of Y3, but cannot *fully activate* until Y3 exists — a handler needs `http-entry-point` evidence (from §1's new signal) before the tie-break has anything to prefer over the Dynamo import. Y2 should build the generic priority rule now; it starts actually resolving handler-vs-store correctly the moment Y3 lands, without further Y2 changes.

## 5. Confidence bands

Consistent with existing conventions (`signal-catalogue.yml` weight tiers): Lambda-handler `implements RequestHandler` signal at **weight 40** (same tier as JAX-RS/JPA `@Entity` — a structural, sufficient-alone signal, not corroboration), matching the confidence this project already gives to other "sufficient alone" structural signals. `APIGatewayProxyResponseEvent`/`RequestEvent` import alone (without the `implements` signal) stays a corroboration-tier signal (weight 10), same tier as `jpa-table`.

## 6. `scope-limitations.yml` bullets to add (Y3-Y5, not this note)

- `serverless-http-java-only`: Lambda handler detection is Java-only through Y5; Node/Python handlers are a real, evidenced-absence gap, not silently assumed covered.
- `cfn-path-join-single-directory-no-cross-stack`: CFN/SAM path reconstruction only resolves references within the files given in one directory; `Fn::ImportValue`, nested stacks, and SAM `Events:`-shorthand wiring are not resolved — named, not silently missed.
- `openapi-precedes-cfn-for-paths`: when both exist for the same package, OpenAPI's dual-unit merge wins; CFN join only supplements paths OpenAPI doesn't cover.

## 7. Non-goals (explicit, per T-Y1-1)

- Full AWS resource-graph modeling (IAM roles, VPC config, environment variables as architecture) — only the Path/Method/Handler triple.
- Step Functions, EventBridge rules, ALB-only Lambda integration (no API Gateway) — real, common serverless patterns, explicitly deferred (`G-FY-04`/matrix §3.6-adjacent), not silently assumed covered by this design.
- SAM `Events:` shorthand — named as a real variant in §2, deferred until a real sample exists.
- Cross-stack / nested-stack reference resolution.
- Node/Python Lambda handler detection (§1) — deferred pending real evidence.
- Kinesis, OAuth2 depth — explicitly out of Y2-Y5 per `D-kinesis`/`D-oauth2` (agent-tasks §0.4), unaffected by this note.

---

## Changelog

| Date | Note |
|---|---|
| 2026-08-08 | Initial design note (T-Y1-1). Grounded in real SaaS Boost CFN templates (`saas-boost-private-api.yaml`, `saas-boost-svc-tenant.yaml`, `saas-boost-svc-tier.yaml`) — found the real path/method/handler binding is a three-way, often cross-file join, not a flat resource; scoped v1 accordingly (same-directory multi-file pool, no cross-stack, SAM shorthand deferred). Kind-priority rule generalizes the existing `ownerBaseClass` mechanism (B-ontology/Prisma) to a second real library (Dynamo) rather than inventing a parallel one. Node/Python handler detection explicitly deferred, no real sample yet — same discipline as `D-terminal-refine`'s own deferral in the layered-story program. |
