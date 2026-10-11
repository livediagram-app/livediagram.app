import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// AGENTS.md "No god files": a source file past ~1000 lines is doing too much and must be broken up.
// Pure data is exempt, however long it grows: the landing copy and the comparison set are flat
// catalogues. Feature art splits by card family (components/feature-art/*), re-exported by the
// FeatureArt barrel.
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LIMIT = 1000;
const DATA = new Set(['lib/landing-content.tsx', 'lib/alternatives.ts']);

function sources(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? sources(join(dir, e.name))
      : /\.(tsx?|css)$/.test(e.name) && !/\.test\./.test(e.name)
        ? [join(dir, e.name)]
        : [],
  );
}

describe('marketing source file size', () => {
  const files = ['app', 'components', 'lib'].flatMap(sources);

  it('finds the sources it guards', () => {
    expect(files.length).toBeGreaterThan(50);
    for (const f of DATA) expect(files).toContain(f);
  });

  it.each(files.filter((f) => !DATA.has(f)))('%s stays under the line limit', (f) => {
    const lines = readFileSync(join(ROOT, f), 'utf8').split('\n').length;
    expect(lines).toBeLessThanOrEqual(LIMIT);
  });
});
