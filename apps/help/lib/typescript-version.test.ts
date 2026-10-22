import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { workspaceManifests } from '../../../scripts/ci-test-filters.mjs';

// One TypeScript (docs/development/engineering-notes.md#typescript): every workspace that type-checks
// lists the root manifest's `typescript`, TypeScript 7, and nothing aliases another TypeScript under
// a second name. A workspace on its own version type-checks against a different compiler than CI
// expects, and an alias brings back the classic compiler API the repo has moved off. It lives here
// with the other repo-wide guards, whose test re-runs whenever any manifest changes.

type Manifest = {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const root = JSON.parse(
  readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'),
) as Manifest;
const workspaces = workspaceManifests() as Manifest[];
const specOf = (m: Manifest, dep: string) => m.devDependencies?.[dep] ?? m.dependencies?.[dep];
const deps = (m: Manifest) => Object.entries({ ...m.dependencies, ...m.devDependencies });

describe('workspace TypeScript', () => {
  it('is TypeScript 7 at the root', () => {
    expect(specOf(root, 'typescript')).toMatch(/^\^7\./);
  });

  it('is the root version in every workspace that runs tsc', () => {
    const drifted = workspaces
      .filter((m) => m.scripts?.typecheck?.includes('tsc'))
      .filter((m) => specOf(m, 'typescript') !== specOf(root, 'typescript'))
      .map((m) => `${m.name}: ${specOf(m, 'typescript') ?? 'missing'}`);
    expect(drifted).toEqual([]);
  });

  it('is never aliased', () => {
    const aliases = [root, ...workspaces].flatMap((m) =>
      deps(m)
        .filter(([, spec]) => /^npm:(typescript|@typescript\/)/.test(spec))
        .map(([name, spec]) => `${m.name}: ${name} -> ${spec}`),
    );
    expect(aliases).toEqual([]);
  });
});
