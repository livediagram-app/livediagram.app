import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parentRouteHref, routeHref } from './article-route';

describe('routeHref', () => {
  it('adds the trailing slash the help app serves', () => {
    expect(routeHref('/palette/tools/data-elements/legend')).toBe(
      '/palette/tools/data-elements/legend/',
    );
    expect(routeHref('/canvas/')).toBe('/canvas/');
    expect(routeHref('/')).toBe('/');
    expect(routeHref('')).toBe('/');
  });
});

describe('parentRouteHref', () => {
  it('is the route one level up, at any depth', () => {
    expect(parentRouteHref('/palette/tools/data-elements/legend')).toBe(
      '/palette/tools/data-elements/',
    );
    expect(parentRouteHref('/developers/working-with-documents/edit-operations/')).toBe(
      '/developers/working-with-documents/',
    );
    expect(parentRouteHref('/about/what-is-livedocuments/')).toBe('/about/');
    expect(parentRouteHref('/canvas/')).toBe('/');
    expect(parentRouteHref('/')).toBe('/');
  });
});

// The breadcrumb's parent crumb links to the route one level up, so every
// article that names a parent must sit directly under a real page.
const APP_DIR = fileURLToPath(new URL('../app', import.meta.url));
const withParent = readdirSync(APP_DIR, { recursive: true })
  .map((p) => String(p).replaceAll('\\', '/'))
  .filter((p) => p.endsWith('/page.mdx'))
  .map((p) => p.slice(0, -'/page.mdx'.length))
  .filter((dir) => /parentArticle=\{/.test(readFileSync(`${APP_DIR}/${dir}/page.mdx`, 'utf8')));

describe('sub-article parents', () => {
  it('finds the sub-articles (guard against this test going blind)', () => {
    expect(withParent.length).toBeGreaterThan(50);
  });

  it('every sub-article sits directly under a real page', () => {
    const orphaned = withParent.filter((dir) => {
      const parent = parentRouteHref(`/${dir}`).replace(/^\/|\/$/g, '');
      return !(
        existsSync(`${APP_DIR}/${parent}/page.mdx`) || existsSync(`${APP_DIR}/${parent}/page.tsx`)
      );
    });
    expect(orphaned).toEqual([]);
  });
});
