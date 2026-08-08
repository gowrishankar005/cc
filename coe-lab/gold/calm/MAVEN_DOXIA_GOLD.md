# Wild-type Maven Doxia gold

**Source:** [apache/maven-doxia](https://github.com/apache/maven-doxia)  
**Clone:** `spikes/maven-doxia/repo` (disposable)  
**Gold:** `maven-doxia-system-map/` — **module grain** only

## Why module grain

Doxia has no HTTP entry points or persistence layer in catalogue scope. Meaningful architecture for this hard-test is **Maven module boundaries** + pom-level depends (core→sink-api, markdown→xhtml5/core).

## Compare note

Platform class-grain scan produces **empty** architecture (2026-08-08). See `docs/findings/maven-doxia-system-map-gold-vs-platform.md`.
