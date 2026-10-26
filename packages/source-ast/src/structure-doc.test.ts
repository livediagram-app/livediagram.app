// docs/structure.md's "Today" tree is where a newcomer (and AGENTS.md's "read docs/structure.md first") learns what
// each shared package is for. Eleven packages had landed in packages/ without a line there, so the map quietly
// stopped matching the ground. This keeps every packages/* folder named in it. It lives here because source-ast is
// the package that reads the repo's own source for its static guards.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

describe('docs/structure.md', () => {
  it('names every shared package in its "Today" tree', () => {
    const doc = readFileSync(join(ROOT, 'docs/structure.md'), 'utf8');
    const named = new Set([...doc.matchAll(/^│ {2}[├└]─ ([a-z0-9-]+) /gm)].map((m) => m[1]));
    const packages = readdirSync(join(ROOT, 'packages')).filter((name) => {
      const dir = join(ROOT, 'packages', name);
      return statSync(dir).isDirectory() && readdirSync(dir).includes('package.json');
    });
    expect(packages.length).toBeGreaterThan(10);
    expect(packages.filter((name) => !named.has(name))).toEqual([]);
  });
});
