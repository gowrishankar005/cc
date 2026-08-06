# Lab requirements (what “excellent validation” needs)

| # | Requirement | Delivered in |
|---|---|---|
| R1 | Isolated from platform implementation bias | `ISOLATION.md`, `gold/README.md`, root ignores |
| R2 | Research-backed package portfolio (fintech + Fidelity menu) | `docs/fidelity-and-fintech-stack-research.md` |
| R3 | Authored architecture as gold | `gold/packages/*.gold.json` + schema |
| R4 | Minimal honest fixtures | `fixtures/monorepo/packages/*` |
| R5 | Multi-language (Java, Python, TS) | package catalog |
| R6 | Multi-framework (Flask, Nest, Spring, JAX-RS, Kafka, AWS SDK) | package catalog |
| R7 | Trap package (false service) | `lib-fintech-common` |
| R8 | Multi-root scenario | py-accounts + py-ledger + multi gold |
| R9 | Stretch scenarios (messaging, dynamo, k8s) | stretch gold + expectedPlatformGaps |
| R10 | Deterministic scoring | `scripts/score-calm.mjs`, `docs/scoring.md` |
| R11 | Methodology & miss taxonomy | `docs/methodology.md` |
| R12 | Eval runner | `scripts/run-eval.sh` |
| R13 | Wild-type companions documented | research doc §4 |
| R14 | Versioned gold + changelog | gold fields |
| R15 | Non-goals explicit | `CHARTER.md` |
| R16 | Hand-authored full CALM gold + calm validate + semantic compare to generated | `gold/calm/`, `generated/`, `validate-calm-pair.mjs` |

## Trust bar (from TRUSTWORTHINESS_REVIEW.md)

Lab results are **trustworthy as gates** only when:

1. Core packages have empirical `score.json` from real `run-slice` runs  
2. `lib-fintech-common` has zero must-not-detect violations  
3. Multi-root Python score exists  
4. Stretch failures map to `expectedPlatformGaps` or a new gap class  
5. Wild-type regression (BoA/Fineract) still passes  

## Future (lab v0.2+)

- FastAPI package  
- Spring Data repository interface package  
- `@PreAuthorize` / `jwt.decode` control packages  
- Service→service HTTP client relationship gold  
- SNS alongside SQS  
- AsyncAPI  
- Automated CI workflow calling run-eval for core tier  
- Score dashboard aggregating all packages  
