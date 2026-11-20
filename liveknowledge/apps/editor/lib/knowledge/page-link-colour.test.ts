import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@liveknowledge/document';
import { articleStyleVars } from '@/lib/article/article-style-vars';
import { PAGE_LINK_ON_DARK, PAGE_LINK_ON_LIGHT, pageLinkColour } from './page-link-colour';
import { pageLinkCss } from './page-link-titles';

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

  it('is the colour the writing hands its links, not the article style’s accent', () => {
    const { vars } = articleStyleVars(undefined, '#0ea5e9', { tone: WHITE, dark: false });
    const v = vars as Record<string, string>;
    expect(v['--article-page-link']).toBe(PAGE_LINK_ON_LIGHT);
    expect(v['--article-page-link']).not.toBe(v['--article-accent']);
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
