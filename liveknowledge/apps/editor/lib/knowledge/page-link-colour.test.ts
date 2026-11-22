import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@liveknowledge/document';
import { articleStyleVars } from '@/lib/article/article-style-vars';
import { PAGE_LINK_ON_DARK, PAGE_LINK_ON_LIGHT, pageLinkColour } from './page-link-colour';
import { pageLinkCss } from './page-link-titles';
import { LIME_ACCENT } from '@/lib/knowledge-style/knowledge-accent';

// docs/specs/030-knowledgebase/links-and-embeds.md "Page links": a live page link is the brand's colour, 4.5:1 on
// the page's paper; a link to a page that is gone stays the writing's own ink, struck through.
const WHITE = '#ffffff';
const SLATE_900 = '#0f172a';

describe('a page link’s colour', () => {
  it('is brand-700 on white paper and brand-300 on dark paper', () => {
    expect(pageLinkColour({ tone: WHITE, dark: false })).toBe(PAGE_LINK_ON_LIGHT);
    expect(pageLinkColour({ tone: SLATE_900, dark: true })).toBe(PAGE_LINK_ON_DARK);
    expect(contrastRatio(PAGE_LINK_ON_LIGHT, WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(PAGE_LINK_ON_DARK, SLATE_900)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['a cream page', '#fef3c7', false],
    ['a lime page', '#d9f99d', false],
    ['a mid grey page', '#94a3b8', false],
    ['a mid slate page', '#64748b', true],
    ['a deep green page', '#14532d', true],
    ['a black page', '#000000', true],
  ])('holds 4.5:1 on %s', (_name, tone, dark) => {
    expect(contrastRatio(pageLinkColour({ tone, dark }), tone)).toBeGreaterThanOrEqual(4.5);
  });

  it('is the brand’s under the product’s own theme, and the theme’s accent under any other', () => {
    // The product's own theme hands the writing lime, and its page links the brand's own steps.
    const lime = articleStyleVars(undefined, LIME_ACCENT, { tone: WHITE, dark: false })
      .vars as Record<string, string>;
    expect(lime['--article-page-link']).toBe(PAGE_LINK_ON_LIGHT);
    // Another theme: its accent, held to 4.5:1 (docs/specs/030-knowledgebase/page-surface.md "The chrome follows
    // the theme").
    const v = articleStyleVars(undefined, '#0ea5e9', { tone: WHITE, dark: false }).vars as Record<
      string,
      string
    >;
    expect(v['--article-page-link']).toBe(pageLinkColour({ tone: WHITE, dark: false }, '#0ea5e9'));
    expect(contrastRatio(v['--article-page-link']!, WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(pageLinkCss([{ id: 'p1', name: 'Release Process' }])).toContain(
      'color:var(--article-page-link,var(--article-accent))',
    );
  });

  it('leaves a deleted page’s link inert: no rule gives it the brand colour', () => {
    const css = pageLinkCss([{ id: 'p1', name: 'Release Process' }]);
    // Only a page that exists is named by a rule; any other link keeps the base look in app/article-pages.css
    // (the writing's ink at 0.65, struck through, a default cursor).
    expect(css).not.toContain('a.article-page-link{');
    expect(css).not.toContain('a.article-page-link,');
    expect(css.match(/\[data-page=/g)).toHaveLength(2);
  });
});
