import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// docs/specs/016-platform/nextjs.md (in each product) "One configuration": every Next app in the
// monorepo spreads the shared config and keeps only its own settings; "Versions": shared packages
// peer on the React minor the apps run.

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, 'utf8');

const PRODUCTS = ['livediagram', 'liveplanner', 'livedocuments', 'livedesign'];
// Every Next app, found rather than listed, so a new one is held to the same rule.
const APPS = [...PRODUCTS, 'liveworkspace'].flatMap((folder) =>
  readdirSync(`${root}${folder}/apps`)
    .map((app) => `${folder}/apps/${app}`)
    .filter((app) => existsSync(`${root}${app}/next.config.ts`)),
);
// The React Compiler runs in each product's editor alone.
const EDITORS = [
  'livediagram/apps/editor',
  'liveplanner/apps/editor',
  'livedocuments/apps/editor',
  'livedesign/apps/live',
];
const SHARED_KEYS = [
  'output',
  'distDir',
  'images',
  'typescript',
  'reactCompiler',
  'experimental',
  'env',
];

it('finds every product editor and the liveworkspace site', () => {
  expect(APPS).toEqual(expect.arrayContaining([...EDITORS, 'liveworkspace/apps/site']));
});

describe.each(APPS)('%s/next.config.ts', (app) => {
  const source = read(`${app}/next.config.ts`);

  it('spreads the shared config', () => {
    expect(source).toMatch(
      /import \{[^}]*\bliveworkspaceNextConfig\b[^}]*\} from '@liveworkspace\/next-config'/,
    );
    expect(source).toMatch(/\.\.\.liveworkspaceNextConfig\(/);
  });

  it.each(SHARED_KEYS)('sets no %s of its own', (key) => {
    expect(source).not.toMatch(new RegExp(`^\\s*${key}\\s*:`, 'm'));
  });

  it('asks for the React Compiler only if it is an editor', () => {
    expect(/reactCompiler: true/.test(source)).toBe(EDITORS.includes(app));
  });
});

describe('shared packages', () => {
  const pkgs = PRODUCTS.flatMap((p) => [`${p}/packages/ui`, `${p}/packages/template-previews`]);
  it.each(pkgs)('%s peers on React 19.3', (pkg) => {
    const peers = JSON.parse(read(`${pkg}/package.json`)).peerDependencies;
    expect(peers.react).toBe('^19.3.0');
    expect(peers['react-dom']).toBe('^19.3.0');
  });
});
