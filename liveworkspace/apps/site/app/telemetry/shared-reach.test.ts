import { describe, expect, it } from 'vitest';
import { exportTarget } from './shared-reach';

describe('exportTarget', () => {
  it('picks an exact subpath, its import condition before its default', () => {
    expect(exportTarget({ '.': './src/index.ts' }, '.')).toBe('./src/index.ts');
    expect(exportTarget({ './x': { import: './src/x.mjs', default: './src/x.js' } }, './x')).toBe(
      './src/x.mjs',
    );
    expect(exportTarget({ './x': { default: './src/x.js' } }, './x')).toBe('./src/x.js');
  });

  it('fills every `*` in the target with the wildcard match, as Node does', () => {
    expect(exportTarget({ './*': './src/*.ts' }, './hooks/x')).toBe('./src/hooks/x.ts');
    expect(exportTarget({ './*': './src/*/*.ts' }, './panel')).toBe('./src/panel/panel.ts');
  });

  it('answers nothing for a subpath no key matches', () => {
    expect(exportTarget({ './hooks/*': './src/hooks/*.ts' }, './other')).toBeUndefined();
    expect(exportTarget({}, '.')).toBeUndefined();
  });
});
