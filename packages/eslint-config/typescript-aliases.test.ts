import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Two TypeScripts (docs/development/contributing.md#two-typescripts): `typescript` is the
// 6.0 compiler API that typescript-eslint, Next.js and Prettier import, and
// `@typescript/native` is 7's `tsc`, which every `typecheck` runs. A workspace
// that lists a plain `typescript` type-checks on 6 instead, and invites a
// Dependabot major bump that can't install (#134). The root manifest holds the
// canonical pair.
type Manifest = {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const ROOT = resolve(__dirname, '../..');
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as Manifest;
const root = read(join(ROOT, 'package.json'));
const specOf = (m: Manifest, dep: string) => m.devDependencies?.[dep] ?? m.dependencies?.[dep];

const workspaces = ['apps', 'packages'].flatMap((dir) =>
  readdirSync(join(ROOT, dir))
    .map((name) => join(ROOT, dir, name, 'package.json'))
    .filter(existsSync)
    .map(read),
);

describe('workspace TypeScript aliases', () => {
  it('has a canonical pair at the root', () => {
    expect(specOf(root, 'typescript')).toMatch(/^npm:@typescript\/typescript6@/);
    expect(specOf(root, '@typescript/native')).toMatch(/^npm:typescript@/);
  });

  it('points every `typescript` at the 6.0 API alias', () => {
    const drifted = workspaces
      .filter((m) => specOf(m, 'typescript') !== undefined)
      .filter((m) => specOf(m, 'typescript') !== specOf(root, 'typescript'))
      .map((m) => `${m.name}: ${specOf(m, 'typescript')}`);
    expect(drifted).toEqual([]);
  });

  it('type-checks every workspace with the TypeScript 7 compiler', () => {
    const drifted = workspaces
      .filter((m) => m.scripts?.typecheck?.includes('tsc'))
      .filter((m) => specOf(m, '@typescript/native') !== specOf(root, '@typescript/native'))
      .map((m) => `${m.name}: ${specOf(m, '@typescript/native') ?? 'missing'}`);
    expect(drifted).toEqual([]);
  });
});
