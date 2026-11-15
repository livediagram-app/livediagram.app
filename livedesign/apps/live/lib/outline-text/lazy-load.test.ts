// docs/specs/007-editor/blueprints/logo-pages.md "Performance": fontkit (about 160 KB gzipped) and the outliner load
// only when a Logo Kit is made, so no editor page's first load carries them. Only a dynamic import() of
// outline-svg is allowed outside this folder, and fontkit is imported here alone.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP = fileURLToPath(new URL('../..', import.meta.url));
const HERE = fileURLToPath(new URL('.', import.meta.url));

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name === 'node_modules' || e.name.startsWith('.') || e.name === 'out') return [];
    const path = join(dir, e.name);
    if (e.isDirectory()) return sources(path);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [path] : [];
  });
}

// `import ... from '<spec>'` and `export ... from '<spec>'`, the static forms a bundler puts in the importer's chunk.
const staticSpecs = (code: string) =>
  [...code.matchAll(/^\s*(?:import|export)\b[^'"]*?\bfrom\s*['"]([^'"]+)['"]/gm)].map((m) => m[1]!);

describe('the outliner stays out of first load', () => {
  const files = ['app', 'components', 'hooks', 'lib'].flatMap((d) => sources(join(APP, d)));

  it('reads the app', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('imports fontkit only inside lib/outline-text', () => {
    const offenders = files
      .filter((f) => !f.startsWith(HERE))
      .filter((f) => staticSpecs(readFileSync(f, 'utf8')).includes('fontkit'))
      .map((f) => relative(APP, f));
    expect(offenders).toEqual([]);
  });

  it('reaches outline-svg only by a dynamic import outside lib/outline-text', () => {
    const offenders = files
      .filter((f) => !f.startsWith(HERE))
      .filter((f) => staticSpecs(readFileSync(f, 'utf8')).some((s) => s.endsWith('outline-svg')))
      .map((f) => relative(APP, f));
    expect(offenders).toEqual([]);
    const kit = readFileSync(join(APP, 'lib/export-logo-kit.ts'), 'utf8');
    expect(kit).toContain("import('./outline-text/outline-svg')");
  });

  it('imports fontkit in outline-svg dynamically too', () => {
    const svg = readFileSync(join(HERE, 'outline-svg.ts'), 'utf8');
    expect(staticSpecs(svg)).not.toContain('fontkit');
    expect(svg).toContain("import('fontkit')");
  });
});
