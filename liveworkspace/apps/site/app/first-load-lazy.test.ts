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

  it('the root error boundary keeps the page light or dark without the Appearance store', () => {
    // A copy of the store (and the app list it resolves the address with) cost every page about 3 KiB (Work Tracker 772).
    expect(staticImports(read('app/global-error.tsx')).sort()).toEqual(
      ['@/components/LazyPageError', 'react'].sort(),
    );
  });

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

describe('the header on every page’s first load', () => {
  it('the Product and Support menus load their rows only when one is approached', () => {
    // The rows, their icons and the open menu took `/` past its budget (2026-11-23): only the two buttons are static.
    const menus = read('components/HeaderMenus.tsx');
    expect(staticImports(menus)).not.toContain('./HeaderMenuSurface');
    expect(menus).toContain("import('./HeaderMenuSurface')");
    expect(staticImports(read('components/header-menu-pages.ts'))).toEqual([
      '@liveworkspace/subscription-ui/flag',
    ]);
  });

  it('the account control loads the subscription provider only for someone signed in', () => {
    const control = read('components/AccountControl.tsx');
    expect(staticImports(control).filter((p) => /subscription/i.test(p))).toEqual([
      '@liveworkspace/subscription-ui/flag',
    ]);
    expect(control).toContain("import('@/components/subscription/SiteSubscription')");
  });
});

describe('Pro in the Explorer’s first load', () => {
  it('the upload ceiling reads Largest Image alone, not the whole limits table', () => {
    // The gallery's upload check is on the Explorer's first load: importing TIER_LIMITS there put the table (about
    // 0.5 KiB gzipped) on it for one number (packages/subscription/src/image-sizes.ts).
    const src = readFileSync(
      join(root, '../../../packages/subscription-ui/src/images/image-limits.ts'),
      'utf8',
    );
    expect(src).toContain('IMAGE_MAX_BYTES_ANY_TIER');
    expect(src).not.toMatch(/\bTIER_LIMITS\b|\bTIERS\b/);
  });
});

describe('the Explorer’s lens on the first load', () => {
  const explorer = (file: string) =>
    readFileSync(join(root, '../../../packages/explorer/src/explorer', file), 'utf8');

  it('the chips load from their own chunk; the lists draw them through lazy-lens', () => {
    // /explorer failed its own budget by 9 bytes on main (2026-11-25): the chips, Offline's view and the Details layout
    // left the first load (packages/explorer/src/explorer/panes-lazy-load.test.ts scans every module).
    expect(explorer('lazy-lens.tsx')).toContain("import('./Lens')");
    expect(staticImports(explorer('lazy-lens.tsx'))).not.toContain('./Lens');
    for (const file of ['ItemsPane.tsx', 'ThisBrowserPane.tsx']) {
      const imports = staticImports(explorer(file));
      expect(imports, file).toContain('./lazy-lens');
      expect(imports, file).not.toContain('./Lens');
    }
  });
});

describe('opening an item ahead in the Explorer’s first load', () => {
  const explorer = (path: string) => read(join('../../../packages/explorer/src/explorer', path));

  it('holds only the listeners; the prefetcher loads with the first intent', () => {
    // The prefetcher and the warm came in whole and took `/explorer` past its budget (2026-11-25, Work Tracker 1437).
    const listeners = explorer('use-intent-prefetch.ts');
    expect(staticImports(listeners)).toEqual(['react']);
    expect(listeners).toContain("import('./intent-prefetch')");
    expect(staticImports(explorer('Explorer.tsx'))).not.toContain('./intent-prefetch');
  });

  it('loads the warm, and the HTML parsing it needs, only with the first warm', () => {
    const prefetch = read('lib/explorer/item-prefetch.ts');
    expect(staticImports(prefetch)).toEqual(['@liveworkspace/sites']);
    expect(prefetch).toContain("import('./item-warm')");
  });
});
