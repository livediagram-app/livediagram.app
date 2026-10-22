import { describe, expect, it } from 'vitest';
import { CARD_SUBTITLE_MAX } from '@livedesign/ui';
import { articleHref, articles, categories, categoryHref } from './articles';
import {
  cardRoute,
  cardText,
  HELP_CARD_FOOTER,
  HELP_CARDS,
  helpCardImage,
  helpCardParams,
  routeFromParams,
} from './help-cards';
import { helpMetadata } from './seo';

describe('help social cards', () => {
  it('has a card for every article and every category landing', () => {
    for (const a of articles) expect(HELP_CARDS.has(cardRoute(articleHref(a))), a.slug).toBe(true);
    for (const c of categories)
      expect(HELP_CARDS.has(cardRoute(categoryHref(c.slug))), c.slug).toBe(true);
    expect(HELP_CARDS.size).toBeGreaterThan(220);
  });

  it("titles an article's card with the article, under its top category", () => {
    const themes = articles.find((a) => articleHref(a) === '/canvas/themes/')!;
    expect(HELP_CARDS.get('canvas/themes')).toMatchObject({
      kicker: 'Canvas',
      title: themes.title,
      footer: HELP_CARD_FOOTER,
    });
  });

  it('keeps every subtitle to two lines, ending on a whole word', () => {
    for (const [route, card] of HELP_CARDS) {
      expect(card.subtitle!.length, route).toBeLessThanOrEqual(CARD_SUBTITLE_MAX);
      expect(card.subtitle, route).toMatch(/(?:[.!?)]|\w…|\w)$/);
    }
  });

  it('uses only characters the card font carries, so the build never fetches one', () => {
    // Printable Latin (to Latin Extended-B) plus the typographic punctuation the copy uses.
    const outside = /[^\u0020-\u024F‘’“”…–—]/u;
    for (const [route, card] of HELP_CARDS) {
      for (const text of [card.kicker, card.title, card.subtitle]) {
        expect(outside.exec(text!)?.[0], `${route}: ${text}`).toBeUndefined();
      }
    }
    expect(cardText('The Command Palette (⌘K)')).toBe('The Command Palette (Cmd+K)');
  });

  it('builds one PNG path per card and reads it back', () => {
    const params = helpCardParams();
    expect(params).toHaveLength(HELP_CARDS.size);
    expect(params).toContainEqual({ card: ['canvas', 'themes.png'] });
    for (const { card } of params) expect(HELP_CARDS.has(routeFromParams(card)!)).toBe(true);
    expect(routeFromParams(['canvas', 'themes'])).toBeNull();
    expect(routeFromParams([])).toBeNull();
  });

  it("links a page's own card in its metadata, and the brand card elsewhere", () => {
    expect(helpCardImage('/help/canvas/themes/')?.url).toBe(
      'https://livedesign.app/help/og/canvas/themes.png',
    );
    expect(helpCardImage('/help/')).toBeUndefined();
    const md = helpMetadata({ title: 'Themes', description: 'd', path: '/help/canvas/themes/' });
    expect(md.twitter).toMatchObject({
      images: ['https://livedesign.app/help/og/canvas/themes.png'],
    });
    const home = helpMetadata({ title: 'Help', description: 'd', path: '/help/' });
    expect(home.twitter).toMatchObject({ images: ['https://livedesign.app/twitter-image'] });
  });
});
