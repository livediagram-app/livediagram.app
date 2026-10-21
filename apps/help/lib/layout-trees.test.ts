import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The repo layout trees in AGENTS.md and docs/development/architecture.md list every app and package
// (AGENTS.md "Keep docs and the README current"). They drifted twice: six packages and the cli app had
// gone missing from AGENTS.md, and render-png from architecture.md, because a tree is prose and nothing
// failed. Here a workspace on disk with no line in a tree fails, and so does a line naming one that is gone.
// It lives beside repo-paths-in-docs.test.ts, which owns the other documentation-to-disk checks.

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const TREES = ['AGENTS.md', 'docs/development/architecture.md'];

const workspaces = (dir: 'apps' | 'packages') =>
  readdirSync(`${ROOT}${dir}`, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(`${ROOT}${dir}/${d.name}/package.json`))
    .map((d) => d.name)
    .sort();

// The names a tree lists under `apps/` or `packages/`: its indented `name/` lines up to the next top-level one.
function listed(tree: string, dir: 'apps' | 'packages'): string[] {
  const block = tree.split(`\n${dir}/`)[1] ?? '';
  const names: string[] = [];
  for (const line of block.split('\n').slice(1)) {
    const m = /^ {2}([a-z][a-z0-9-]*)\//.exec(line);
    if (!m) break;
    names.push(m[1]!);
  }
  return names.sort();
}

describe('repo layout trees', () => {
  for (const file of TREES) {
    const tree = readFileSync(`${ROOT}${file}`, 'utf8');
    for (const dir of ['apps', 'packages'] as const) {
      it(`${file} lists exactly the ${dir} on disk`, () => {
        const onDisk = workspaces(dir);
        // Guard against going blind: the repo has many of each.
        expect(onDisk.length).toBeGreaterThan(5);
        expect(listed(tree, dir)).toEqual(onDisk);
      });
    }
  }
});
