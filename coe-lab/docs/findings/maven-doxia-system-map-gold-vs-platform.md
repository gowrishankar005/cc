# Finding: maven-doxia system-map gold vs platform

**Package-id:** `maven-doxia-system-map`  
**Date:** 2026-08-08  
**Source:** [apache/maven-doxia](https://github.com/apache/maven-doxia) @ local `spikes/maven-doxia/repo`  
**Gold:** `coe-lab/gold/calm/maven-doxia-system-map/architecture.calm.json`  
**Generated:** `tmp/coe-lab-hard-tests/maven-doxia-system-map/`  
**Track:** hard-test eval only — no platform code changed.

---

## 0. What this codebase is (scope honesty)

Apache Maven **Doxia** is a **content parsing / rendering library** (Parser → Sink event stream), multi-module Maven project (~158 Java sources in this shallow clone).  

It is **not** a fintech deployable: **no** JAX-RS/Spring HTTP surfaces, **no** JPA/SQL/messaging of the kind Weaver’s Slice 1/2 catalogues target.

Hand gold is therefore **module-grain** (`x-lab-grain: maven-module`), analogous to `fineract-system-map`, not route/entity gold.

---

## 1. Scorecard

| Layer | Gold | Generated | Verdict |
|---|---|---|---|
| **L0 schema** | PASS (0 errors) | PASS (0 errors) on **empty** CALM | Both valid; gen emptiness is still “schema green” |
| **L1 unit recall** | 8 module service nodes + system (gold intent) | **0 architectural nodes** | **FAIL / grain mismatch** — platform never emits Maven-module nodes |
| **L2 story** | 3 `connects` + 1 `composed-of` (module deps) | **0 relationships** | **FAIL** for gold story; N/A for HTTP service→db (not in gold) |
| **L3 silence** | n/a | **No S1** (S1 requires service+db units present) | Completeness flags **silent** on total emptiness |

| Platform run metrics | Value |
|---|---|
| TypedUnits | **0** |
| TypedRelationships | **0** |
| Decorator facts collected | 1397 |
| Ignored (INSUFFICIENT_EVIDENCE) | **14320** |
| Unmapped signal occurrences | **14320** |
| Graphify | `ok`, 0 dual-unit reconciler relationships |

---

## 2. Strengths (platform)

1. **No crash** on a non-app multi-module Java tree; completes with artefacts.  
2. **No false fintech architecture** — did not invent HTTP routes or databases for a content library.  
3. **Schema-valid empty CALM** + extensive `x-aac-scope-limitations` metadata still emitted.  
4. **Unmapped / ignored reports** populated (noise volume is a separate issue) — something to mine offline, not silent zero files.  
5. **Hard-test value as disconfirming sample:** proves Weaver’s default path is **HTTP/persistence-signal-centric**, not “any Java monorepo → architecture.”

---

## 3. Weaknesses / gaps (mechanism class)

| Gap class | Observation |
|---|---|
| **No module-grain extraction** | Gold modules (`doxia-core`, `doxia-sink-api`, …) never become nodes; no pom/`pom.xml` → unit strategy |
| **Library / SPI architecture invisible** | `@Named`/`@Singleton` `DefaultDoxia`, `Parser`, `Sink` are real architecture but not catalogue routes/entities → 0 units |
| **Empty CALM is L0-green** | Can look “successful” to operators who only run `calm validate` |
| **S1 precondition gap** | S1 needs service **and** database units; **zero of both** raises **no** silence flag — total miss is quieter than partial miss |
| **Noise floor** | 14k insufficient-evidence items (tests, HTML entities, iterators) drown signal; unmapped clusters dominated by JUnit/`Override`/assert noise |

---

## 4. Issues / errors

| Type | Present? |
|---|---|
| Crash / OOM | **No** |
| Schema validation error | **No** |
| Wrong positive architecture | **No** |
| Systematic empty architecture for library monorepo | **Yes** — expected given catalogues; still a product-scope finding |

### RCA (short — systematic empty, not a bug in calm-builder)

```text
Symptom: architecture.calm.json has nodes=[], relationships=[]
  → TypedFacts.units empty
    → No native routes; no JPA/entity; no driver-import matches
    → Decorator/call facts exist but do not match catalogue rules with enough weight to form units
    → Graphify edges not reconciled into architecture relationships (no dual TypedUnits)
  → Builders correctly emit empty document
Not root cause: calm-cli, Graphify failure (status ok), gold authoring circularity
```

---

## 5. Gold vs platform compare (semantic)

| Gold asserts | Platform |
|---|---|
| System node `doxia-system` | Missing |
| 8 module `service` nodes | Missing |
| `composed-of` system→modules | Missing |
| `doxia-core` → `doxia-sink-api` connects | Missing |
| markdown → xhtml5 / core connects | Missing |

Grain note: even if class-level units appeared later, they would **not** match module-grain gold without a separate mapping strategy (same class of issue as fineract-system-map vs class-grain gen).

---

## 6. Claim language after this sample

| Forbidden without caveats | Allowed |
|---|---|
| “Weaver recovers architecture for any Java monorepo” | “Weaver recovers HTTP/persistence-shaped architecture where catalogues fire; pure library module maps are unevidenced / empty” |
| “calm validate 0 errors means architecture recovered” | “Empty CALM can validate; check node counts + silence/coverage” |

---

## 7. Follow-ups (backlog only — not implemented here)

See `coe-lab-hard-test-backlog.md` HT-DOX-001…  

**Not** in this session: catalogue rows for Plexus/JSR-330, pom module nodes, or module-grain gold auto-mapping.
