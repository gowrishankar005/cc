# Trap / negative-gold backlog (Wave 1-B3)

Cards for shapes that must **fail loudly** or **OOS-disclose** if completeness is claimed.  
Not all need fixtures yet — cards guide Wave 3 eval (W3-eval).

| ID | Family | Intent | Sample / gold | Layer that must fail if completeness claimed |
|---|---|---|---|---|
| T1 | R2 multi-hop | API does not import entity; store still real | fineract-charge gold L2 | L2 story; L3 S1 |
| T2 | C-call HTTP auth | Permission checks are calls not decorators | fineract ChargesApi; lab jwt-gateway | L2 controls; L3 S2 |
| T3 | Utility not service | Pure helpers must not be services | lab lib-fintech-common | L1 mustNotDetect |
| T4 | Controller + ORM types | HTTP file imports client types for DTO only | ghostfolio AccessController | L1 no dual database |
| T5 | K8s name ≠ entity | Deployment must not bind to JPA entity | BoA Transaction.java FP fixed | L2 k8s endpoints service-only |
| T6 | Messaging producer only | send() without listener | Fineract/lab producer path | L1/L2 producer OOS or fail |
| T7 | Dynamo/SQS cloud import | Cloud native units | lab ts-orders-dynamo | L1 weak until strategies |
| T8 | OpenAPI dual unit | Spec + controller same routes | lab ts-nestjs-users | L1 ignore openapi FP or merge |

Promotion: when Wave 3 implements a cell, convert card to automated expected-fail or expected-pass test.
