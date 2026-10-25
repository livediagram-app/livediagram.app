import { describe, expect, it } from 'vitest';
import { parentRouteHref, routeHref } from './article-route';

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
