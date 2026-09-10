# CALM Control Creation Guide

<!--
PATCHED 2026-09-10 — real, measured bug fix, not a style preference.

Diagnosis: `requirement-url` is a REQUIRED field on every control-detail (see schema
below), and the ORIGINAL version of this file's worked examples all used a fictional
domain (`schemas.company.com`, `requirements.company.com`, `configs.company.com`).
An agent given real source to model has nothing to substitute for that convention
except the real target repo's real domain — producing a URL that LOOKS resolvable
but 404s. Confirmed on two separate real runs (Bank of Anthos, Apache Fineract),
both producing schema-valid-except-for-this output, every time.

Fix: `calm-cli-instructions.md` already documents `--url-to-local-file-mapping`
for exactly this case ("resources live in the repo but aren't public yet"). This
patch makes that the DEFAULT taught pattern in every example below, instead of an
unused CLI flag the agent never gets pointed at. Weaver (a separate project) already
uses this same pattern for its own generated CALM output's control-requirement-urls.
-->

## Critical Requirements

🚨 **ALWAYS call the control creation tool before creating any controls**

🚨 **NEVER invent a `requirement-url` pointing at an external domain you have not
independently confirmed resolves — including the real target repo's own real domain.**
If the requirement isn't a real, published, fetchable document, it doesn't get an
external URL. Use a local file instead (see "Local Requirement Files" below) — this
is not a fallback for when you're unsure, it's the default for anything you're
generating yourself rather than citing.

## Official JSON Schema Definition

The complete control schema from the FINOS CALM v1.2 specification:

```json
{
    "controls": {
        "type": "object",
        "patternProperties": {
            "^[a-zA-Z0-9-]+$": {
                "type": "object",
                "properties": {
                    "description": {
                        "type": "string",
                        "description": "A description of a control and how it applies to a given architecture"
                    },
                    "requirements": {
                        "type": "array",
                        "items": {
                            "$ref": "#/defs/control-detail"
                        }
                    }
                },
                "required": ["description", "requirements"]
            }
        }
    },
    "control-detail": {
        "type": "object",
        "properties": {
            "requirement-url": {
                "type": "string",
                "description": "The requirement schema that specifies how a control should be defined"
            },
            "config-url": {
                "type": "string",
                "description": "The configuration of how the control requirement schema is met"
            },
            "config": {
                "type": "object",
                "description": "Inline configuration of how the control requirement schema is met"
            }
        },
        "required": ["requirement-url"],
        "oneOf": [
            {
                "required": ["config-url"]
            },
            {
                "required": ["config"]
            }
        ]
    }
}
```

## Overview

Controls in CALM represent compliance policies, governance rules, and enforcement mechanisms applied to architecture elements.

## Local Requirement Files (read this before writing any `requirement-url`)

Every `requirement-url` you write must resolve to something real. In practice, when
you're generating a control from source you just analyzed (not citing a published
industry standard you know is real, like an actual NIST/ISO document), that means:

1. Write a real local `requirement.json` file next to your architecture output —
   a small JSON Schema 2020-12 document describing what the control requires.
2. Point `requirement-url` at `https://` (calm-cli only accepts `http`/`https`
   schemes for this field — a custom scheme fails a different way) using the
   `.invalid` TLD — an IANA-reserved special-use domain (RFC 2606) **guaranteed
   to never resolve**, e.g.
   `https://{repo-name}.invalid/controls/{control-id}/requirement.json`. Never a
   real-vendor-looking domain (`company.com`, the target project's own real domain,
   etc.) unless you've actually confirmed that exact URL is live — `.invalid` makes
   "this is a deliberate local placeholder" unambiguous to any reader, the way a
   plausible-looking real domain never can.
3. Add an entry to a `url-mapping.json` file mapping that URL to the local file's
   real path, and pass it to the CLI: `calm validate -a arch.json -u url-mapping.json`
   (also works with `calm generate`/`calm docify`/`calm template`).

**Example — the correct pattern, end to end (verified: `calm validate` returns
0 errors with this exact shape):**

`fineract-core.architecture.json` (excerpt):
```json
"controls": {
    "tenant-isolation": {
        "description": "Per-tenant datasource routing prevents cross-tenant data access",
        "requirements": [
            {
                "requirement-url": "https://fineract-core.invalid/controls/tenant-isolation/requirement.json",
                "config": {
                    "mechanism": "per-tenant schema routing",
                    "evidence": "TenantAwareRoutingDataSource, resolved from X-Fineract-Platform-TenantId header"
                }
            }
        ]
    }
}
```

`controls/tenant-isolation/requirement.json` (a real file you generate alongside it):
```json
{
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "title": "Tenant Isolation Requirement",
    "type": "object",
    "properties": {
        "mechanism": { "type": "string" },
        "evidence": { "type": "string" }
    },
    "required": ["mechanism", "evidence"]
}
```

`url-mapping.json` (also a real file you generate):
```json
{
    "https://fineract-core.invalid/controls/tenant-isolation/requirement.json": "controls/tenant-isolation.requirement.json"
}
```

Then: `calm validate -a fineract-core.architecture.json -u url-mapping.json` —
resolves locally, no fabricated external URL, no unresolvable-host validation error.

**The one exception**: if you are citing a REAL, well-known published standard (an
actual NIST SP number, a real ISO 27001 control, a real OWASP reference) and you are
confident of the exact real URL, you may use it directly — but say so explicitly in
the control's description, and prefer a URL you can fetch and confirm over one you're
recalling from training.

## Where Controls Can Be Applied

Controls can be applied at multiple levels within a CALM architecture:

### 1. Architecture Level (Document Root)

Applied to the entire architecture document - affects all components:

```json
{
    "calm-version": "1.2.0",
    "architecture-version": "1.0.0",
    "controls": {
        "data-residency": {
            "description": "All data must remain within EU boundaries",
            "requirements": [
                {
                    "requirement-url": "https://{repo-name}.invalid/controls/data-residency/requirement.json",
                    "config": {
                        "allowed-regions": ["eu-west-1", "eu-central-1"],
                        "data-types": ["personal", "financial"]
                    }
                }
            ]
        }
    },
    "nodes": [...],
    "relationships": [...]
}
```

### 2. Node Level

Applied to specific components or services:

```json
{
    "unique-id": "payment-processor",
    "node-type": "service",
    "name": "Payment Processing Service",
    "controls": {
        "pci-compliance": {
            "description": "PCI-DSS requirements for payment card data processing",
            "requirements": [
                {
                    "requirement-url": "https://{repo-name}.invalid/controls/pci-compliance/requirement.json",
                    "config": {
                        "scope": "cardholder-data",
                        "validation-level": "Level-1",
                        "encryption": "end-to-end"
                    }
                }
            ]
        }
    },
    "interfaces": [...]
}
```

### 3. Flow Level

Applied to business processes and data flows:

```json
{
    "unique-id": "trade-settlement-flow",
    "name": "Trade Settlement Process",
    "description": "End-to-end trade settlement workflow",
    "controls": {
        "settlement-compliance": {
            "description": "Regulatory requirements for trade settlement timing and reporting",
            "requirements": [
                {
                    "requirement-url": "https://{repo-name}.invalid/controls/settlement-compliance/requirement.json",
                    "config": {
                        "settlement-period": "T+2",
                        "reporting-requirements": ["FINRA", "SEC"],
                        "audit-trail": "complete"
                    }
                }
            ]
        }
    },
    "transitions": [...]
}
```

### 4. Control Inheritance and Scope

- **Architecture-level controls** apply to all nodes, relationships, and flows unless overridden
- **Node-level controls** apply specifically to that component and its interfaces
- **Flow-level controls** apply to the entire business process flow
- **More specific controls override general ones** when there are conflicts
- **Controls are additive** - multiple levels can apply simultaneously
- **Decide deliberately where a control belongs** — don't duplicate the same control at every level "to be safe"; that just makes the model noisier without adding real information.

## Key Components

### Control Names

Control names use `patternProperties` with regex `^[a-zA-Z0-9-]+$`:

✅ **Valid**: `data-protection`, `access-control`, `audit-logging`
❌ **Invalid**: `data_protection`, `Data Protection`, `access.control`

### Required Properties

Each control MUST have:

- `description` (string) - Describes the control and how it applies
- `requirements` (array) - Array of control-detail objects (minimum 1)

### Control Details (Requirements)

Each requirement MUST have:

- `requirement-url` (string) - Schema defining the control requirement — see "Local Requirement Files" above for how to make this resolve for real

Each requirement MUST have exactly ONE of:

- `config-url` (string) - External configuration file
- `config` (object) - Inline configuration

## Validation Rules

1. Control names must match pattern `^[a-zA-Z0-9-]+$` (alphanumeric and hyphens only)
2. Each control must have `description` and `requirements` properties
3. Requirements array must have at least one control-detail object
4. Each control-detail must have `requirement-url`
5. Each control-detail must have either `config-url` OR `config` (not both)
6. **`requirement-url` must actually resolve** — either a real, confirmed-live external URL for a genuine published standard, or a local file + `url-mapping.json` entry per "Local Requirement Files" above. A URL that merely looks plausible is not acceptable.
7. If using `config-url`, it must follow the same resolve-or-map-locally rule as `requirement-url`.
8. **Before finishing, run `calm validate -a <file> -u url-mapping.json` and confirm `control-requirement-validation` produces zero errors** — don't assume the URLs resolve, check.

## Best Practices

- Use descriptive control names that reflect the security domain
- Generate real local requirement files for anything you derived from source yourself; reserve external URLs for standards you're genuinely citing
- Use inline config for simple, static configurations
- Use external config-url (mapped locally, same as requirement-url) for complex, environment-specific settings
- Include comprehensive descriptions explaining how controls apply
- Structure requirements to be independently verifiable
- Document the relationship between requirement schemas and configurations

## Cross-References

- **Standards Creation**: See standards creation tool for creating requirement Standards that controls reference
- **Node Creation**: Understand how controls are applied to individual nodes
- **Flow Creation**: Learn how controls work with business processes and flows
- **Architecture Creation**: See how controls are structured at the architecture document level
- **Pattern Creation**: Use controls in reusable architectural patterns
- **CLI Instructions**: See `--url-to-local-file-mapping` in calm-cli-instructions.md — this is how every locally-generated requirement/config file above actually resolves during `calm validate`/`generate`/`docify`

## Key Reminders

- Most controls reference requirement files that may use Standards as their base schemas
- Controls can be applied at architecture, node, and flow levels
- Each control must have both description and requirements properties
- **Every `requirement-url` you write yourself needs a real local file + url-mapping.json entry — no exceptions for "it looks like a real domain"**
- Reference the standards creation tool when creating base schemas for requirement files
