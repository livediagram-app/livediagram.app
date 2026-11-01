import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The template previews read the flows' and logo explorations' data through `@livedesign/templates/template-flow-data`,
// which the landing page ships to the browser: those modules must stay data alone, never pulling a builder (and the
// layouts it builds) into that bundle. Measured before the split: the landing page's JS carried the logo layout
// builders.
const SRC = new URL('../../../packages/templates/src/', import.meta.url);

describe('the template previews data door', () => {
  it('imports only types', () => {
    for (const file of [
      'template-flow-data.ts',
      'wireframe-flow-data.ts',
      'logo-exploration-data.ts',
    ]) {
      const src = readFileSync(new URL(file, SRC), 'utf8');
      for (const line of src.match(/^import .*$/gm) ?? [])
        expect(line, file).toMatch(/^import type /);
      // A re-export may only name the two data modules.
      for (const from of src.matchAll(/from '([^']+)'/g))
        expect(
          [
            './wireframe-flow-data',
            './logo-exploration-data',
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
