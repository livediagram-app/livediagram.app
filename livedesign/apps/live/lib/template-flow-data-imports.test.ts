import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The template previews read the flows' and logo explorations' data through `@livedesign/templates/template-flow-data`,
// which the landing page ships to the browser: those modules must stay data alone, never pulling a builder (and the
// layouts it builds) into that bundle. Measured before the split: the landing page's JS carried the logo layout
// builders.
const SRC = new URL('../../../packages/templates/src/', import.meta.url);

describe('the template previews data door', () => {
  // The data modules: a value may come only from another of them (the flows are gathered from two data files and
  // written with one kit of helpers); anything else is a type.
  const DATA = [
    'template-flow-data.ts',
    'wireframe-flow-data.ts',
    'wireframe-flow-kit.ts',
    'wireframe-flows-apps.ts',
    'wireframe-flows-web.ts',
    'logo-exploration-data.ts',
  ];
  const DATA_MODULES = DATA.map((f) => `./${f.replace(/\.ts$/, '')}`);

  it('imports only types, or another data module', () => {
    for (const file of DATA) {
      const src = readFileSync(new URL(file, SRC), 'utf8');
      for (const m of src.matchAll(/^import (type )?[^;]*? from '([^']+)';$/gms))
        if (!m[1]) expect(DATA_MODULES, `${file} imports ${m[2]}`).toContain(m[2]);
      // A re-export may only name the two data modules.
      for (const from of src.matchAll(/from '([^']+)'/g))
        expect(
          [
            ...DATA_MODULES,
            './templates',
            './wireframe-layouts',
            './logo-layouts',
            '@livedesign/design',
          ],
          file,
        ).toContain(from[1]);
    }
  });
});
