import { describe, expect, it } from 'vitest';
import { cardText, HELP_CARD_FOOTER, routeFromParams } from './lib/help-cards';
import { ARTICLES, SITE } from './test/fixture';

// createHelpSite over a small catalogue. Each app's real catalogue is held to the same rules by the shared suite
// (testing.tsx), run in its lib/help-site.test.ts.

describe('help social cards', () => {
  it('has one card per article and category landing', () => {
    expect(SITE.cards.size).toBe(ARTICLES.length + 3);
    expect(SITE.cards.has('canvas')).toBe(true);
    expect(SITE.cards.has('canvas/themes/legend')).toBe(true);
  });

  it("titles an article's card with the article, under its top category", () => {
    expect(SITE.cards.get('canvas/themes')).toMatchObject({
      kicker: 'Canvas',
      title: 'Themes',
      footer: HELP_CARD_FOOTER,
    });
    expect(SITE.cards.get('canvas/themes/legend')?.kicker).toBe('Canvas');
    expect(SITE.cards.get('canvas')?.kicker).toBe('Help Topic');
  });

  it('spells out key symbols the card font has no glyph for', () => {
    expect(SITE.cards.get('tools/palette')?.title).toBe('The Command Palette (Cmd+K)');
    expect(cardText('⌥⇧⌃')).toBe('Option+Shift+Ctrl+');
  });

  it('builds one PNG path per card and reads it back', () => {
    const params = SITE.cardParams();
    expect(params).toHaveLength(SITE.cards.size);
    expect(params).toContainEqual({ card: ['canvas', 'themes.png'] });
    for (const { card } of params) expect(SITE.cardFor(card)).toBeDefined();
    expect(routeFromParams(['canvas', 'themes'])).toBeNull();
    expect(routeFromParams([])).toBeNull();
    expect(SITE.cardFor(['nope.png'])).toBeUndefined();
  });
});

describe('page metadata', () => {
  it("links a page's own card, and leaves the brand card elsewhere", () => {
    expect(SITE.cardImage('/help/canvas/themes/')).toEqual({
      url: 'https://testapp.example/help/og/canvas/themes.png',
      alt: 'Themes, testapp Help Centre',
    });
    expect(SITE.cardImage('/help/')).toBeUndefined();
    const md = SITE.helpMetadata({
      title: 'Themes',
      description: 'd',
      path: '/help/canvas/themes/',
    });
    expect(md.twitter).toMatchObject({
      images: ['https://testapp.example/help/og/canvas/themes.png'],
    });
    expect(md.openGraph).toMatchObject({ siteName: 'testapp Help', url: '/help/canvas/themes/' });
  });

  it('templates every child title with the product name', () => {
    expect(SITE.rootMetadata().title).toEqual({
      default: 'Help | testapp',
      template: '%s | testapp',
    });
    expect(SITE.rootMetadata({ other: { a: 'b' } }).other).toEqual({ a: 'b' });
  });
});

describe('article neighbours', () => {
  const byTitle = (t: string) => SITE.articleByTitle(t)!;

  it('finds every article by its title', () => {
    for (const a of ARTICLES) expect(SITE.articleByTitle(a.title)).toBe(a);
    expect(SITE.articleByTitle('No Such Article')).toBeUndefined();
  });

  it('follows the order the category page shows, across its groups', () => {
    expect(SITE.articleNeighbours(byTitle('Adding Elements'))).toEqual({
      prev: undefined,
      next: byTitle('Themes'),
    });
    expect(SITE.articleNeighbours(byTitle('Exporting a Tab')).next).toBeUndefined();
  });

  it('names the top-level category of a nested article', () => {
    expect(SITE.articleCategoryLink(byTitle('Legend'))).toEqual({
      title: 'Canvas',
      href: '/canvas/',
    });
  });
});

describe('feature hues and glyphs', () => {
  it("uses the feature's own, then its category's, then the fallback", () => {
    expect(SITE.featureColour('themes')).toBe('#d946ef');
    expect(SITE.featureColour('adding', 'canvas/x')).toBe('#0ea5e9');
    expect(SITE.featureColour('adding', 'tools')).toBe('#64748b');
    expect(SITE.featureIcon('adding', 'canvas')).toBe(SITE.art.categoryIcons.canvas);
    expect(SITE.featureIcon('adding', 'tools')).toBe(SITE.art.featureFallback);
  });
});

describe('sitemap and robots', () => {
  it('lists the home, the features index, every landing and every article', () => {
    const urls = SITE.sitemap().map((e) => e.url);
    expect(urls.slice(0, 2)).toEqual([
      'https://testapp.example/help/',
      'https://testapp.example/help/features/',
    ]);
    expect(urls).toContain('https://testapp.example/help/canvas/');
    expect(urls).toContain('https://testapp.example/help/canvas/themes/legend/');
    expect(urls).toHaveLength(2 + 3 + ARTICLES.length);
  });

  it('points crawlers at the sitemap', () => {
    expect(SITE.robots()).toEqual({
      rules: { userAgent: '*', allow: '/' },
      sitemap: 'https://testapp.example/help/sitemap.xml',
      host: 'https://testapp.example',
    });
  });
});
