import * as fs from 'fs';
import * as path from 'path';

/**
 * Fintech monorepos already encode "what is a
 * deployable" in build files; this pipeline previously ignored them
 * entirely. Deliberately narrow: checks for the four real, unambiguous
 * deployable markers directly AT a package root (not a recursive search —
 * these are root-level-by-convention files: `package.json` at a Node
 * package's root, `pom.xml`/`build.gradle` at a Maven/Gradle module's
 * root, `Dockerfile` at a service's build-context root).
 *
 * Honestly scoped: this does NOT attempt to correlate a manifest back to a
 * SPECIFIC TypedUnit (a package root can contain multiple file-level units;
 * which one "is" the deployable is genuinely ambiguous without deeper
 * convention-specific logic this pass doesn't build). What it DOES give is
 * real, previously-invisible coverage: "this root ships a deployable
 * manifest" is now visible in coverage-report.json even for a root that
 * produced zero architectural units — the real, concrete acceptance this
 * task's own gap (G-L1-10) named ("Coverage lists manifest present, 0
 * units").
 */
const MANIFEST_FILENAMES = ['package.json', 'pom.xml', 'build.gradle', 'build.gradle.kts', 'Dockerfile'] as const;

export interface DeployableManifest {
  type: (typeof MANIFEST_FILENAMES)[number];
  filePath: string; // relative to packageRoot
}

export function discoverDeployableManifests(packageRoot: string): DeployableManifest[] {
  const found: DeployableManifest[] = [];
  for (const filename of MANIFEST_FILENAMES) {
    if (fs.existsSync(path.join(packageRoot, filename))) {
      found.push({ type: filename as DeployableManifest['type'], filePath: filename });
    }
  }
  return found;
}
