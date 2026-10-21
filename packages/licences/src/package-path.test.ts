import { describe, expect, it } from 'vitest';

import { locatePackage, vendoredCandidates } from './package-path.ts';

describe('locatePackage', () => {
  it('finds a package, its root and the version pnpm stored it under', () => {
    expect(
      locatePackage('node_modules/.pnpm/svgpath@2.6.0/node_modules/svgpath/lib/path.js'),
    ).toEqual({
      name: 'svgpath',
      root: 'node_modules/.pnpm/svgpath@2.6.0/node_modules/svgpath',
      storeVersion: '2.6.0',
    });
  });

  it('reads scoped names and drops the peer suffix from the store key', () => {
    const path =
      'node_modules/.pnpm/@clerk+react@6.17.0_react-dom@19.3.0_react@19.3.0/node_modules/@clerk/react/dist/index.mjs';
    expect(locatePackage(path)).toMatchObject({ name: '@clerk/react', storeVersion: '6.17.0' });
  });

  it('keeps prerelease versions whole', () => {
    const path =
      'node_modules/.pnpm/onnxruntime-web@1.22.0-dev.20250409-89f8206ba4/node_modules/onnxruntime-web/dist/ort.mjs';
    expect(locatePackage(path)?.storeVersion).toBe('1.22.0-dev.20250409-89f8206ba4');
  });

  it('refuses a package nested outside the pnpm store layout', () => {
    const path =
      'node_modules/.pnpm/next@16.3.6/node_modules/next/node_modules/@swc/helpers/esm/a.js';
    expect(() => locatePackage(path)).toThrow(/StorePathUnrecognised/);
  });

  it('returns null for first-party source', () => {
    expect(locatePackage('packages/icons/src/index.ts')).toBeNull();
  });

  it.each([
    ['outside the pnpm store', 'node_modules/svgpath/index.js'],
    ['a store key for another name', 'node_modules/.pnpm/other@1.0.0/node_modules/svgpath/a.js'],
    ['a scope without a name', 'node_modules/.pnpm/@x+y@1.0.0/node_modules/@x'],
    ['an empty version', 'node_modules/.pnpm/svgpath@_x/node_modules/svgpath/a.js'],
  ])('refuses a path %s', (_, path) => {
    expect(() => locatePackage(path)).toThrow(/StorePathUnrecognised/);
  });
});

describe('vendoredCandidates', () => {
  it('lists the directories between the package root and the file, innermost first', () => {
    expect(vendoredCandidates('r/next', 'r/next/dist/compiled/react/cjs/react.js')).toEqual([
      'r/next/dist/compiled/react/cjs',
      'r/next/dist/compiled/react',
      'r/next/dist/compiled',
      'r/next/dist',
    ]);
  });

  it('lists nothing for a file at the root', () => {
    expect(vendoredCandidates('r/next', 'r/next/index.js')).toEqual([]);
  });
});
