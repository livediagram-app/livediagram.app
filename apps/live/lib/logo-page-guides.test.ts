// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { LOGO_PAGE_GUIDES_MAX, readLogoPageGuides, withLogoPageGuides } from './logo-page-guides';

// docs/specs/007-editor/logo-pages.md "Construction guides": a page's own Show Guides, kept here.
afterEach(() => localStorage.clear());

describe('logo page guides', () => {
  it('keeps each page’s choice, the latest last, and reads it back', () => {
    let g = withLogoPageGuides({}, 'a', false);
    g = withLogoPageGuides(g, 'b', true);
    g = withLogoPageGuides(g, 'a', true);
    expect(Object.keys(g)).toEqual(['b', 'a']);
    expect(readLogoPageGuides()).toEqual({ b: true, a: true });
  });

  it('drops the oldest past the cap, and ignores what is not a choice', () => {
    let g = {};
    for (let i = 0; i <= LOGO_PAGE_GUIDES_MAX; i++) g = withLogoPageGuides(g, `p${i}`, false);
    expect(Object.keys(g)).toHaveLength(LOGO_PAGE_GUIDES_MAX);
    expect('p0' in g).toBe(false);
    localStorage.setItem('livediagram:v2:logo-page-guides', '{"x":1,"y":true}');
    expect(readLogoPageGuides()).toEqual({ y: true });
    localStorage.setItem('livediagram:v2:logo-page-guides', 'not json');
    expect(readLogoPageGuides()).toEqual({});
  });
});
