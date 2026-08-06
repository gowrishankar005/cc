# Package catalog (fixtures ↔ gold ↔ expectations)

| Package | Path under `fixtures/monorepo/packages/` | Gold file | Tier | In-scope expectations (v0.1) |
|---|---|---|---|---|
| py-accounts-api | `py-accounts-api` | `gold/packages/py-accounts-api.gold.json` | core | service + HTTP routes; database unit from SQLAlchemy |
| py-ledger-worker | `py-ledger-worker` | `gold/packages/py-ledger-worker.gold.json` | core | service + db; pair with accounts for multi-root |
| ts-nestjs-users | `ts-nestjs-users` | `gold/packages/ts-nestjs-users.gold.json` | core | NestJS service + GET/POST routes |
| ts-orders-dynamo | `ts-orders-dynamo` | `gold/packages/ts-orders-dynamo.gold.json` | stretch | service; dynamo/sqs as database/network if detector ready |
| java-spring-payments | `java-spring-payments` | `gold/packages/java-spring-payments.gold.json` | core | Spring MVC-style service + routes |
| java-jaxrs-charges | `java-jaxrs-charges` | `gold/packages/java-jaxrs-charges.gold.json` | core | JAX-RS routes + JPA entity database |
| java-kafka-settlement | `java-kafka-settlement` | `gold/packages/java-kafka-settlement.gold.json` | stretch | service + messaging topology when X7 ready |
| lib-fintech-common | `lib-fintech-common` | `gold/packages/lib-fintech-common.gold.json` | core trap | **zero** service nodes |
| deploy-k8s-trust | `../deploy/k8s` (manifests) | `gold/packages/deploy-k8s-trust.gold.json` | stretch | shared-secret relationship when X5 ready |
| java-rbac-datatable | `java-rbac-datatable` | `gold/packages/java-rbac-datatable.gold.json` | core | `@PreAuthorize` → service + CALM controls |
| py-jwt-gateway | `py-jwt-gateway` | `gold/packages/py-jwt-gateway.gold.json` | stretch | Flask routes; `jwt.decode` control is stretch |

## Multi-root eval recipe

```bash
# Cross-package Python pair (accounts + ledger)
node dist/orchestration/run-slice.js \
  ../coe-lab/fixtures/monorepo/packages/py-accounts-api \
  ../coe-lab/fixtures/monorepo/packages/py-ledger-worker \
  --out ../coe-lab/eval-results/py-multi
```

Score each package’s nodes against its gold; relationship gold for multi-root lives in `gold/packages/py-multi-root.gold.json`.
