# Review-flow capability map — HITL & LLM (Wave 1-C4)

**Purpose:** What human/LLM review can complete vs what requires AREC strategies.  
**Design refs:** v2 §7.1 advisory, §5.4 overrides, §13 IR (partial: intelligence-ir.md).

---

## Gap class → channel

| Gap class | HITL Override today | LLM advisory (as designed §7.1) | Needs AREC / mechanism |
|---|---|---|---|
| Missing service→db edge (known both nodes) | **Yes** `relationship_add` | **Maybe** if IR shows both nodes and asks “connect?” | R2 systematic multi-hop |
| Missing multi-hop (intermediates not units) | **Weak** (must invent intermediate nodes + edges) | **Weak** — IR hides non-units / full Graphify | R2 + possibly intermediate unit policy |
| Entity–entity noise | **Partial** bulk `relationship_remove` | Noisy | R0 grading / filter strategy |
| Missing `@PreAuthorize` control | N/A if evidence exists | N/A | Already C-dec |
| Missing call-site auth control | **Weak** (no first-class control_add UX) | **Partial** if snippet shows `validateHasReadPermission` | **C-call** |
| Wrong unit type | **Yes** type_change | Yes if flagged ambiguous | Catalogue/vote rules |
| Promote ignored → node | **Yes** node_add | Yes if ignored rendered | — |
| Silent empty neighborhood (high conf units) | No automatic trigger today | **Not in §7.1 trigger set** | **S silence** + optional advisory trigger (decision below) |
| Lab L1 pass / wild L2 fail narrative | Human process | — | Claim register + validation layers |

---

## Decision: empty-neighborhood review trigger

| Decision | **Yes — recommend** adding “high-confidence service (+ optional db present) with zero service-touching relationships” as a **review trigger** for IR/advisory **after Wave 3-S metrics exist**. |
|---|---|
| Rationale | a reference Java/JAX-RS banking platform miss was exactly false confidence without a flag. |
| Until Wave 3-S | Use wild L2 gold fail + finding doc; do not pretend advisory already covers it. |

---

## IR limitations (current)

| Limitation | Impact |
|---|---|
| Renders filtered TypedFacts, not full Graphify | Multi-hop intermediates invisible |
| Override authoring fenced block unbuilt | HITL uses raw Override JSON (works) |
| Advisory CLI not built as full product | Design only + threat-signals flags |

---

## Rule of thumb

> **Systematic patterns → AREC strategy.**  
> **One-off residual → HITL.**  
> **LLM proposes, never writes TypedFacts.**

---

## Changelog

| Date | Note |
|---|---|
| 2026-08-07 | Wave 1-C4 |
