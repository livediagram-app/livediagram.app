import { cardSubtitle, type SocialCardOptions } from '@livediagram/ui';
import { articleHref, articles, categories, categoryHref, topCategorySlug } from './articles';
import { HELP_URL } from './site';

// The help centre's own social cards (docs/specs/018-help/help-app.md "SEO"): one per article and per
// category landing, on the shared branded card (renderSocialCard in @livediagram/ui), pre-rendered to a
// PNG at build time by app/og/[...card]/route.tsx. A link to an article then previews with its own
// title instead of the generic brand card. Pages outside the registry (the home, the features index)
// keep the brand card.

export const HELP_CARD_FOOTER = 'livediagram Help Centre';

// `canvas/themes`: the route, without the `/help/` prefix or slashes, a card is keyed by.
export const cardRoute = (href: string) => href.replace(/^\/(?:help\/)?|\/$/g, '');

// Key symbols spelled out: next/og's built-in font has no glyph for them, and a missing glyph makes the
// build fetch a font from the network (and draw a box when that fails). Kept to what titles use today;
// help-cards.test.ts fails on any other character outside the font.
const KEY_SYMBOLS: Record<string, string> = {
  '⌘': 'Cmd+',
  '⌥': 'Option+',
  '⇧': 'Shift+',
  '⌃': 'Ctrl+',
};
export const cardText = (text: string) => text.replace(/[⌘⌥⇧⌃]/g, (k) => KEY_SYMBOLS[k]!);

const categoryTitle = new Map(categories.map((c) => [c.slug, c.title]));

function buildCards(): Map<string, SocialCardOptions> {
  const cards = new Map<string, SocialCardOptions>();
  for (const cat of categories) {
    cards.set(cardRoute(categoryHref(cat.slug)), {
      kicker: 'Help Centre',
      title: cardText(cat.title),
      subtitle: cardSubtitle(cardText(cat.description)),
      footer: HELP_CARD_FOOTER,
    });
  }
  for (const article of articles) {
    cards.set(cardRoute(articleHref(article)), {
      kicker: categoryTitle.get(topCategorySlug(article.categorySlug)) ?? 'Help Centre',
      title: cardText(article.title),
      subtitle: cardSubtitle(cardText(article.description)),
      footer: HELP_CARD_FOOTER,
    });
  }
  return cards;
}

export const HELP_CARDS: ReadonlyMap<string, SocialCardOptions> = buildCards();

// The card a help page links in its metadata: absolute, since a link preview resolves it from anywhere.
export function helpCardImage(path: string): { url: string; alt: string } | undefined {
  const route = cardRoute(path);
  const card = HELP_CARDS.get(route);
  if (!card) return undefined;
  return { url: `${HELP_URL}/og/${route}.png`, alt: `${card.title}, livediagram Help Centre` };
}

// The catch-all params app/og/[...card]/route.tsx is built for: `canvas/themes` → ['canvas', 'themes.png'].
export function helpCardParams(): { card: string[] }[] {
  return [...HELP_CARDS.keys()].map((route) => {
    const segments = route.split('/');
    segments[segments.length - 1] += '.png';
    return { card: segments };
  });
}

// Back from the params to the card's route; null for anything that is not `<route>.png`.
export function routeFromParams(card: string[]): string | null {
  const last = card[card.length - 1];
  if (!last?.endsWith('.png')) return null;
  return [...card.slice(0, -1), last.slice(0, -'.png'.length)].join('/');
}
