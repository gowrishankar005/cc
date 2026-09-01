# Wild-type gold policy

**Status:** Wave 1-A5  
**Rule:** Wild-type architecture gold lives **only under `coe-lab/gold/`**. Never under `spikes/`.

---

## What is wild-type gold

Hand-authored (or independently reviewed) expected architecture for **real external codebases** used as evidence (a reference Java/JAX-RS banking platform's modules, later Ghostfolio slices, etc.), not synthetic lab fixtures.

| Location | Role |
|---|---|
| `coe-lab/gold/calm/fineract-*/` | Full CALM gold (hand-authored) |
| `coe-lab/gold/packages/*.gold.json` | Semantic gold when a wild package is scored |
| `spikes/<name>/repo` | Disposable source clone only — **not** gold |

---

## Ownership & refresh

| Role | Responsibility |
|---|---|
| **Eval / lab maintainer** | Owns wild gold accuracy; updates when intent of architecture under test changes |
| **Platform implementers** | Must **not** read gold to invent detectors (ISOLATION.md) |
| **Refresh trigger** | Fixture/module source intent change; claim register cell change; AREC strategy ship that changes expected story |

Cadence: when a reference Java/JAX-RS banking platform gold or claim cells change; not every platform commit.

---

## Compare modes

| Mode | When | Pass |
|---|---|---|
| **L0** | Always after authoring | calm validate |
| **L1** | Unit/path/control presence | Semantic match |
| **L2** | Architecture story | Service→db (etc.) per gold; **a reference Java/JAX-RS banking platform L2 fails today** |
| **Extras** | Extra gen entities | Soft for core entity inventory; hard only if gold `mustNotDetect` |

**Lab core green does not supersede wild gold.**  
A pipeline can L1-pass coe-lab packages and L2-fail fineract-charge simultaneously — report both.

---

## Authoring rules

1. Derive from **source** (+ semantic intent), never from `generated/` bootstrap.  
2. `calm validate` before commit.  
3. Document grain (class vs module) — system-map is module grain.  
4. Link findings: `fineract-gold-vs-platform-finding.md`.

See also `gold/calm/FINERACT_GOLD.md`.
