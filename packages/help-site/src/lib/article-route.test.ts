import { describe, expect, it } from 'vitest';
import { articleCrumbs, parentRouteHref, routeHref } from './article-route';

// Each app's pages are held to these by the shared suite (testing.tsx, "sub-article parents").
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
    expect(parentRouteHref('/about/what-is-livediagram/')).toBe('/about/');
    expect(parentRouteHref('/canvas/')).toBe('/');
    expect(parentRouteHref('/')).toBe('/');
  });
});

describe('articleCrumbs', () => {
  it('links the category to its own landing, not the parent’s path', () => {
    expect(
      articleCrumbs({
        pathname: '/developers/working-with-documents/edit-operations',
        title: 'Edit Operations Reference',
        categoryTitle: 'Developers',
        parentTitle: 'Working with Canvases',
      }),
    ).toEqual([
      { label: 'Developers', href: '/developers/' },
      { label: 'Working with Canvases', href: '/developers/working-with-documents/' },
      { label: 'Edit Operations Reference' },
    ]);
  });

  it('never gives two crumbs one URL', () => {
    const crumbs = articleCrumbs({
      pathname: '/selection-modes/avatar-mode/avatar-tour/',
      title: 'The Avatar Tour',
      categoryTitle: 'Selection Modes',
      parentTitle: 'Avatar Mode',
    });
    expect(crumbs.map((c) => c.label)).toEqual([
      'Selection Modes',
      'Avatar Mode',
      'The Avatar Tour',
    ]);
    const hrefs = crumbs.flatMap((c) => (c.href ? [c.href] : []));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('is the category then the article for a top-level article, skipping a category that repeats', () => {
    expect(
      articleCrumbs({ pathname: '/canvas/zoom/', title: 'Zoom', categoryTitle: 'Canvas' }),
    ).toEqual([{ label: 'Canvas', href: '/canvas/' }, { label: 'Zoom' }]);
    expect(
      articleCrumbs({ pathname: '/canvas/canvas/', title: 'Canvas', categoryTitle: 'Canvas' }),
    ).toEqual([{ label: 'Canvas' }]);
  });
});
