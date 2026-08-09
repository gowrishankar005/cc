# Root cause: why Weaver misses Spring config/build/Docker files, and the organic fix

**Trigger:** a direct question from the audit (`spring-boot-approach-audit-of-weaver.md`, finding A1) — does CodeGraph or Graphify already read `application.yml`/build files/Dockerfiles, and is that why Weaver misses them? Checked against the actual installed package source this session (`node_modules/@colbymchenry/codegraph`, the `graphifyy` pip install), not assumed.

## 1. CodeGraph: doesn't attempt these formats at all

`grep -rn "\.yml\|\.yaml\|\.properties\|pom.xml\|build.gradle\|Dockerfile\|docker-compose" node_modules/@colbymchenry/codegraph/dist/` returns nothing except one doc-comment mentioning `pom.xml` as an example of "non-mapper XML" it explicitly does **not** extract (`mybatis-extractor.d.ts`). CodeGraph is a pure source-AST engine — its `Language` grammar list is source languages only (`java`, `python`, `typescript`, …); `yaml`, `properties`, and `xml` are explicitly excluded from `GrammarLanguage` (`grammars.d.ts:10`). There is no code path in CodeGraph that could ever see Spring config, by design — this isn't a bug, it's out of the tool's stated scope.

## 2. Graphify: reads `pom.xml`, but the mechanism that would catch everything else is switched off by the exact flag Weaver passes

This is the real finding — Graphify's classifier (`graphify/detect.py`) sorts every file into `FileType.CODE`, `FileType.DOCUMENT`, or unclassified, and the classification is decisive:

```python
CODE_EXTENSIONS = {'.py', '.ts', ..., '.java', '.groovy', '.gradle', ...}   # detect.py:31
DOC_EXTENSIONS  = {'.md', '.mdx', ..., '.html', '.yaml', '.yml'}            # detect.py:32
```

`application.yml`/`application-*.yml` → `.yml` → `DOC_EXTENSIONS` → `FileType.DOCUMENT`. Document-typed files are only ever processed through Graphify's **LLM semantic-extraction path** — and `graphify-provider.ts` (Weaver's own code) invokes `graphify extract <root> --code-only --no-cluster`. `--code-only` exists specifically so a mixed repo doesn't hard-fail without an LLM key configured, and its effect is explicit in Graphify's own source:

```python
# cli.py:2964
# --code-only: index code (pure local AST, no key) and skip the semantic
# (doc/paper/image) pass entirely...
if code_only and semantic_files:
    print(f"[graphify extract] --code-only: skipping {len(semantic_files)} non-code file(s)...")
    semantic_files = []
```

So `application.yml` is not silently missed — it's **explicitly enumerated and explicitly skipped**, every run, with a log line Weaver never surfaces or reads.

`application.properties` is worse: `.properties` doesn't appear in `CODE_EXTENSIONS` *or* `DOC_EXTENSIONS` at all (confirmed by grep — its only appearance in `detect.py` is inside an unrelated credential-sniffing heuristic list at line 181). `classify_file()` returns `None` for it, and it lands in the `unclassified` bucket — not attempted under *any* mode, `--code-only` or not.

`Dockerfile` (extensionless, no shebang) hits the same `classify_file() → None → unclassified` path. `docker-compose.yml` is `.yml` → same fate as `application.yml`, skipped under `--code-only`.

`pom.xml` is the one partial exception: `manifest_ingest.py` special-cases known package-manifest filenames (`pom.xml`, `pyproject.toml`, `go.mod`, `apm.yml`) and routes them through a **deterministic, non-LLM** parser — but that parser only extracts a package name + `depends_on` dependency edges (a plain dependency-graph fact), never Spring-specific content. `build.gradle` gets swept into `CODE_EXTENSIONS` (the `.gradle` extension is there) and tree-sitter-parsed as generic Groovy/Kotlin-DSL code — with no Gradle-aware extractor behind it, so nothing meaningful comes out for Weaver's reconciler to use even though the file is technically "indexed."

## 3. Verdict — this is a real, mechanical explanation, and it means the fix is not "configure the tools differently"

Turning off `--code-only` is not the fix: it would route `.yml` files through Graphify's **LLM** extraction path, which (a) requires an API key Weaver doesn't assume is present, (b) is non-deterministic, and (c) directly violates this project's own core architectural rule — "no LLM in the core generation path" (`CLAUDE.md`). Chasing this gap by changing Graphify's flags would trade a real, deterministic gap for a worse, non-deterministic one. Neither underlying engine has (or, for Graphify, is *allowed* to have without an LLM) a deterministic path to this data. **The only organic fix is a small, dedicated, deterministic Weaver-native provider** — exactly the mechanism class the platform already uses for the two other structured-file formats it reads.

## 4. The organic fix — one new provider, reusing the existing mechanism, not a new one

Weaver already has this exact playbook: `scanner/k8s-manifest-provider.ts` and `scanner/openapi-provider.ts` are both small, deterministic, non-CodeGraph/non-Graphify readers of a structured file format, feeding facts into the existing `TypedUnit`/`Evidence`/catalogue pipeline. This is a straight fourth instance of a proven pattern, not a new mechanism — the project's own "don't invent a fifth mechanism" discipline is satisfied by construction, not by exception.

**`scanner/spring-config-provider.ts` (new)** — reads `application.yml`/`application-*.yml`/`application.properties` per package root (the `yaml` package is already a dependency, used by `k8s-manifest-provider.ts`; a `.properties` parser is a ~20-line key=value reader, no new dependency). Extracts, deterministically:

| Config key(s) | Fact produced |
|---|---|
| `spring.datasource.url` (`jdbc:postgresql://host:5432/db`) | A `database` `TypedUnit` corroboration + a `connects` edge with **`protocol` populated from the JDBC subprotocol** (`postgresql`→informs tech, scheme literally says `JDBC`) — directly closes audit finding B9, and does it from a source more authoritative than code-level driver-import inference |
| `spring.kafka.bootstrap-servers`, `spring.rabbitmq.*`, `spring.activemq.broker-url` | `network` node corroboration + messaging `connects` edge — reinforces the existing messaging catalogue instead of replacing it |
| `spring.data.redis.host`/`.port`, `spring.cache.type` | New `database`/cache-shaped node the code-only lane has no equivalent detector for today |
| `server.port` | Feeds a formal `interface-definition` (`tcp-host-port`, per the reference-example convention in §5 of the audit) — closes B5 for free, same pass |
| `<name>.feign.url` / declared Feign client base-URLs, or plain `services.<name>.url`-shaped custom keys | Corroborates outbound-HTTP edges the annotation-based `http-client-detection-catalogue.yml` lane already targets |

**`scanner/build-manifest-provider.ts` (new, smaller)** — reads `pom.xml`/`build.gradle` for the dependency-name list only (`kafka-clients`, `postgresql`, `spring-boot-starter-data-jpa`, …) as **corroborating**, not primary, evidence — a real driver/library dependency raises confidence on a signal the code/config lanes already found, the same corroboration role `descriptiveCategories` already plays elsewhere in the catalogue. Low individual value, cheap to add once the config provider exists (same file-reading infrastructure), and closes A2.

**Container/Dockerfile/compose reading is explicitly lower priority** — real value (service topology in local dev, exposed ports, image names) but no existing catalogue lane is blocked on it the way persistence/messaging/protocol are; sequence it after the config provider proves the pattern, not alongside it.

**Wiring, matching the existing catalogue-driven shape exactly**: new evidence category (`spring-config`, alongside the existing `http-entry-point`/`persistence`/`framework-bootstrap`/… categories in `signal-catalogue.yml`'s convention) → new rows in `persistence-detection-catalogue.yml` (a `spring-config-datasource` strategy, alongside the existing `driver-import`/`jpa-entity` rows and the still-`not-implemented` `spring-data-repository` row) and `messaging-detection-catalogue.yml` → `relationship-type-mapping.yml`'s `protocol: null` rows get a real value where the config provider supplies one, everywhere else stays `null` (no change to the "don't guess" discipline — this is a genuine new evidence source, not a new default).

## 5. Why this is worth prioritizing above the runtime-verification lane (audit finding A13)

Config-file reading is deterministic, cheap, and needs no bootable app, container, or credential — the config provider is buildable and testable against the same fixture repos already in `spikes/`/`coe-lab/` today. The runtime-verification lane (Actuator/in-process exporter) is the higher-fidelity long-term answer, but it needs a bootable app and is a genuinely new kind of lane for Weaver's architecture. This fix is not that — it's the same YAML-reading, structured-file-ingestion mechanism Weaver has proven twice already, aimed at the one format both underlying engines structurally cannot reach without compromising the "no LLM in the core path" rule.
