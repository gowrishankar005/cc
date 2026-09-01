/**
 * Single shared JDBC-URL literal resolution + scheme extraction.
 *
 * Real bug found on independent code review (2026-08-16) of T-FS-3: this
 * logic previously existed as THREE independent hand-copied pieces —
 * spring-config-pass.ts's own jdbcScheme(), contradiction-detector.ts's
 * jdbcSchemeEngine() (a deliberate re-derivation, per its own "keep this
 * detector's only dependency on OUTPUT, not internals" comment), and
 * port-interface-builder.ts's isJdbcSignal prefix check. When
 * jdbcScheme() was taught to unwrap Spring's `${VAR:default}` placeholder
 * syntax (T-FS-3 real-instance verification against a reference Java/JAX-RS
 * banking platform),
 * contradiction-detector.ts's copy was updated in the same commit but
 * port-interface-builder.ts's WASN'T — proving that "must stay in sync"
 * comments are not a real guardrail. Fixed properly: one function, three
 * importers.
 */

/**
 * Unwraps Spring's `${ENV_VAR:default}` placeholder syntax when its
 * literal default is itself a `jdbc:` URL already sitting in checked-in
 * source text (e.g. a reference Java/JAX-RS banking platform's real
 * `spring.datasource.hikari.jdbcUrl=${FINERACT_HIKARI_JDBC_URL:jdbc:postgresql://localhost:5432/fineract_tenants}` —
 * property KEY/VALUE quoted verbatim from the real source file as evidence,
 * not genericized)
 * — narrow on purpose: only unwraps a `${...:jdbc:...}` shape, never
 * general placeholder resolution. A placeholder with no default at all
 * (`${SOME_VAR}`) or a non-jdbc default is left as raw text, matching
 * spring-config-property-vocabulary.md §4's existing "never resolved"
 * scope note for every other placeholder shape.
 *
 * A NESTED placeholder (`${FOO:${BAR:jdbc:postgresql://host}}`) is
 * deliberately left UNRESOLVED rather than unwrapped — a real bug found on
 * review: a naive single regex greedily matched through the nested `${...}`
 * and appended its stray closing brace into the captured URL, corrupting
 * `Evidence.argument` and surfacing the corrupted text verbatim in
 * human-facing contradiction messages. Reading Spring's own `:` -> "first
 * colon is the name/default separator" semantics correctly requires
 * checking for a nested `${` explicitly, not just pattern-matching greedily.
 */
export function resolveJdbcUrlLiteral(raw: string): string {
  if (!raw.startsWith('${') || !raw.endsWith('}')) return raw;
  const inner = raw.slice(2, -1);
  if (inner.includes('${')) return raw; // nested placeholder — genuinely unresolved, never guess at where it ends.
  const colonIdx = inner.indexOf(':'); // Spring's own semantics: only the FIRST colon separates the property name from its default; the default itself may contain further colons (e.g. a JDBC URL's own port).
  if (colonIdx === -1) return raw; // `${VAR}` alone, no default at all.
  const defaultValue = inner.slice(colonIdx + 1);
  return /^jdbc:[a-z0-9+]+:/i.test(defaultValue) ? defaultValue : raw;
}

/** The JDBC subprotocol scheme (e.g. "postgresql", "mysql"), lowercase — or undefined if `raw` doesn't resolve (directly or via a colon-default placeholder) to a `jdbc:` URL at all. */
export function jdbcScheme(raw: string): string | undefined {
  return /^jdbc:([a-z0-9+]+):/i.exec(resolveJdbcUrlLiteral(raw))?.[1]?.toLowerCase();
}
