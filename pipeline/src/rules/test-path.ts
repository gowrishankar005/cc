/**
 * Real, generic test-file detection. `IgnoredItem.reason` has carried a
 * `'TEST_CODE'` value since this project's earliest taxonomy design but no
 * code path ever assigned it — confirmed by grep before writing this file.
 * Found the hard way: a real scan of a reference Java/JAX-RS banking platform
 * typed a genuine JUnit test (`OperationIdReaderTest.java`) as a `service`
 * node at confidence 100 with a fabricated route, and 17 more `/test/`-path
 * files as real `database` units (Graphify-driven side, same root cause).
 *
 * Generic across this project's polyglot scope (Java/Python/TypeScript),
 * matching real conventions each ecosystem's own tooling uses — not a
 * repo-specific exclusion list. Path-and-filename heuristic only,
 * deliberately not content-based (no `@Test`-annotation sniffing): cheap,
 * fast, and consistent with every other structural-only detector in this
 * pipeline (no code path here parses file contents to decide).
 */
const TEST_DIR_SEGMENTS = new Set(['test', 'tests', '__tests__']);

const TEST_FILENAME_PATTERNS: RegExp[] = [
  /Tests?\.java$/, // JUnit convention: FooTest.java, FooTests.java
  /^test_.*\.py$/, // pytest/unittest convention: test_foo.py
  /_test\.py$/, // the other real pytest convention: foo_test.py
  /\.test\.tsx?$/, // Jest/Vitest convention: foo.test.ts
  /\.spec\.tsx?$/, // Jasmine/Angular convention: foo.spec.ts
];

/**
 * `filePath` is expected relative to a package root (this project's own
 * convention throughout — `TypedUnit.filePath`, `SpringConfigFile.filePath`,
 * etc.), so a leading `test/` segment is checked the same way an embedded
 * `/test/` segment is, not just as a substring.
 */
export function isTestPath(filePath: string): boolean {
  const segments = filePath.split(/[/\\]/);
  if (segments.some((segment) => TEST_DIR_SEGMENTS.has(segment))) return true;

  const filename = segments[segments.length - 1] ?? '';
  return TEST_FILENAME_PATTERNS.some((pattern) => pattern.test(filename));
}
