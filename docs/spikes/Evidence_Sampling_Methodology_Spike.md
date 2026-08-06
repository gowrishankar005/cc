# Evidence Sampling Methodology — What Was Wrong, and the Fix

**Why this exists:** the user pushed back on the requirements-collection approach itself, not its content — a fair critique. This spike names the problem honestly, researches a real fix, and applies it once concretely before folding the result into the requirements series.

---

## 1. What was actually wrong, stated plainly

Every prior round of evidence-gathering this session followed the same pattern: something got flagged as a gap (controls? grep the 2-3 already-cloned repos for auth annotations. Java depth? grep the same repos again for more Java patterns). That's not a sampling methodology — it's opportunistic pattern-matching against **three repos found by convenience**, not by any defensible claim that they represent fintech engineering:
- Fineract — found because it was already in the original spike docs.
- Bank of Anthos — a Google reference app, not a fintech company's real code, chosen because it's polyglot and well-documented.
- CALM Hub — found only because we happened to already be pulling CALM's own schema files from that repo.

Each round's "fix" was really "find one more example, patch the specific gap that was pointed out." That produces a real, honest correction each time (nothing dishonest happened), but it never converges — there's no defined stopping point, no way to say "we've covered enough," and no structure preventing the next reactive gap from being just as narrowly evidenced as the last one. The pattern itself (discover gap → patch reactively → repeat) is the actual problem, not any individual finding.

---

## 2. The fix: a real sampling frame, not convenience sampling

Researched what a defensible, non-arbitrary source of "real fintech repos" would look like. The strongest available answer, and a genuinely well-justified one given this project's own subject matter: **FINOS maintains a curated project landscape** (`landscape.finos.org`, backed by `github.com/finos/finos-landscape`'s `landscape.yml`), with a real, published inclusion bar — "at least 300 GitHub stars" and "clearly fits an existing category." Using FINOS's own ecosystem inventory as the sampling frame is unusually well-justified here specifically, since **CALM — the exact standard this project generates output for — is itself a FINOS project**. There's no more authoritative available source for "what does real financial-services open source engineering look like" than the foundation that hosts the standard we're targeting.

**Fetched and parsed the real `landscape.yml` this session** (`gh api repos/finos/finos-landscape/contents/landscape.yml`, not a search result or a summary) — a categorized inventory: Enablement, Applications, Platforms & Runtimes, Infrastructure, Data & Business Logic, Legend, spanning dozens of real projects. Most are FINOS-hosted tooling/SIGs (governance, compliance frameworks, DSLs) rather than runnable backend applications — a real filtering step is needed, not "use the whole list."

---

## 3. Applying it once, concretely, this session

### 3.1 TraderX — the best domain-diversity candidate found, honestly assessed as not-yet-usable

`finos/traderX` — 106 stars, updated within days, explicitly a FINOS reference **trading** application (services named in its own test scripts: `people-service`, `account-service`, `position-service`, `trade-feed`, `trade-processor`, `trade-service`, `web-angular` — confirmed via `scripts/test-*-overlay.sh` filenames). This is a real gap-filler: every repo evidenced so far is banking/accounts-domain; trading is a distinct fintech sub-domain with zero prior coverage.

**Checked before committing further effort, per this project's own discipline (verify, don't assume):** the current `main` branch has been restructured into a "SpecKit-First" generative framework (`README.md`: "TraderX is now organized as a root-canonical GitHub SpecKit project... generated and validated from requirements, stories, acceptance criteria"). There is no static, checked-in service source to grep — real code only exists after running `pipeline/generate-state.sh`, an unfamiliar generation toolchain not verified to work in this environment. **Decision: flagged as a high-value future candidate, not pursued further this round** — running an unverified generation pipeline to get evidence is a disproportionate effort spike relative to what this round needs, the same judgment already applied to rejecting low-star demo repos in the prior spike. Recorded rather than silently dropped.

### 3.2 Waltz — real evidence, closes a named backlog item

`finos/waltz` — 236 stars, updated within a day, real Java enterprise application (itself an architecture-inventory tool, incidentally adjacent in purpose to this project, though that's not why it was chosen). Sparse-cloned `waltz-web`/`waltz-data`/`waltz-model`. Found:
- `waltz-data/src/main/java/org/finos/waltz/data/GenericSelector.java:23-24` — real `org.jooq.Record1`, `org.jooq.Select` imports. **jOOQ**, a type-safe SQL-builder persistence technology distinct from JPA/Hibernate/Spring-Data, has been named in this project's Java backlog since v0.6 §3 (`"MyBatis, jOOQ"`) but never evidenced until now.
- No route annotations (`@Path`/`@GetMapping`/`@RestController`) found in the sparse-checked-out `waltz-web` module — either the web layer lives in a module not checked out, or Waltz uses a framework/structure not yet identified. Recorded as an open question, not resolved this round — don't claim a finding that wasn't actually confirmed.

---

## 4. The structural fix for going forward: a coverage matrix, not reactive discovery

Rather than continuing the "gap flagged → grep whatever's cloned" cycle, the next requirements version should carry an explicit **coverage matrix** — dimensions: fintech sub-domain (banking/accounts, trading, payments, data/compliance) × language (Java/Python/Node) × architectural concern (routes, persistence, messaging, auth, batch). Each cell gets either a real citation or an explicit "unevidenced" mark — visible gaps instead of gaps that only surface when someone happens to ask the right question. `landscape.yml`'s real, filtered, non-SIG/non-DSL entries become the candidate pool to fill remaining cells from, evaluated with the same discipline applied to TraderX and Waltz here (check star count/activity, check that real source actually exists at the current ref, before citing).
