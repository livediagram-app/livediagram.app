// What every page of the site loads up front (liveworkspace/docs/specs/010-site/blueprints/site.md "Performance and
// limits"). Next ships app/error.tsx and app/global-error.tsx in every page's first load, and Turbopack gives each its
// own copy of what they import: a static import of the error card from both once put about 20 KiB gzipped on every
// page, `/` and the Explorer included. The card stays behind components/LazyPageError.tsx, and the build's own
// budget (scripts/first-load-budget.ts) catches anything else that grows a first load.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const staticImports = (src: string) =>
  [...src.matchAll(/^import\s+(?!type\b)[^;]*?from\s+'([^']+)'/gms)].map((m) => m[1]!);

describe('every page’s first load', () => {
  it.each(['app/error.tsx', 'app/global-error.tsx'])(
    '%s loads the error card only when it shows',
    (file) => {
      const imports = staticImports(read(file));
      expect(imports).toContain('@/components/LazyPageError');
      expect(imports).not.toContain('@/components/PageError');
      // Nothing heavy of the shared UI either: its barrel brings the optically centred glyphs and their path maths.
      expect(
        imports.filter((p) => p === '@liveworkspace/ui' || p.startsWith('@liveworkspace/icons')),
      ).toEqual([]);
    },
  );

  it('the light pieces those files share import nothing heavy', () => {
    const lazy = read('components/LazyPageError.tsx');
    expect(staticImports(lazy)).toEqual(['@liveworkspace/ui/lazy-panel', './page-error-title']);
    expect(lazy).toContain("import('./PageError')");
    expect(staticImports(read('components/page-error-title.ts'))).toEqual(['react']);
  });

  it('the not-found card is drawn on the server, so it adds no script to any page', () => {
    // Next carries app/not-found.tsx's tree in every page: it and its card stay server components (Work Tracker 446).
    for (const file of ['app/not-found.tsx', 'components/ErrorCard.tsx']) {
      expect(read(file)).not.toMatch(/^['"]use client['"]/m);
      expect(staticImports(read(file))).not.toContain('@/components/PageError');
    }
  });

  it('the build checks each watched page against its budget', () => {
    const { scripts } = JSON.parse(read('package.json')) as { scripts: { build: string } };
    const build = scripts.build;
    expect(build).toMatch(
      /next build && node scripts\/asset-prefix\.mjs && node scripts\/first-load-budget\.ts/,
    );
  });
});
