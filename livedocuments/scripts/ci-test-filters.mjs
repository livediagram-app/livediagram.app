// Prints the turbo filters that make CI's plain `test` run skip every workspace
// with `test:coverage`: its coverage run already runs the whole suite, so
// running `test` too would run it twice (docs/specs/016-platform/deployment.md).
// Derived from the manifests, so a workspace gaining or losing coverage needs
// no CI edit.
//
//   pnpm turbo run test $(node scripts/ci-test-filters.mjs)

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKSPACE_DIRS = ['apps', 'packages'];

/** @typedef {{ name: string, scripts?: Record<string, string> }} Manifest */

/**
 * One `--filter=!<name>` per workspace that defines `test:coverage`.
 * @param {Manifest[]} manifests
 * @returns {string[]}
 */
export function plainTestFilters(manifests) {
  return manifests.filter((m) => m.scripts?.['test:coverage']).map((m) => `--filter=!${m.name}`);
}

/**
 * The package.json of every workspace under apps/ and packages/.
 * @returns {Manifest[]}
 */
export function workspaceManifests() {
  return WORKSPACE_DIRS.flatMap((dir) =>
    readdirSync(path.join(ROOT, dir))
      .map((name) => path.join(ROOT, dir, name, 'package.json'))
      .filter((file) => existsSync(file))
      .map((file) => JSON.parse(readFileSync(file, 'utf8'))),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const filters = plainTestFilters(workspaceManifests());
  console.error(`[ci-test-filters] plain test skips ${filters.length} coverage workspaces`);
  console.log(filters.join(' '));
}
