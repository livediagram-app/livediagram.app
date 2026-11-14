// The package.json of every workspace in a product folder (its apps/ and packages/), for the repo-wide guards
// a product's tests keep, such as each help app's one-TypeScript check.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKSPACE_DIRS = ['apps', 'packages'];

/** @param {string | URL} root the product folder, as a path or a file URL */
export function workspaceManifests(root) {
  const dir = root instanceof URL ? fileURLToPath(root) : root;
  return WORKSPACE_DIRS.flatMap((sub) => {
    const parent = path.join(dir, sub);
    if (!existsSync(parent)) return [];
    return readdirSync(parent)
      .map((name) => path.join(parent, name, 'package.json'))
      .filter((file) => existsSync(file))
      .map((file) => JSON.parse(readFileSync(file, 'utf8')));
  });
}
