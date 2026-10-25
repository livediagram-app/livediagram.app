import { articleHref, categoryHref, topCategorySlug } from '@liveworkspace/help-registry';
import type { HelpCatalogue } from '../types';

// The help centre's own social cards (docs/specs/018-help/help-app.md "SEO" in each product): one per article
// and per category landing, on the product's branded card (renderSocialCard in its ui package), pre-rendered to a
// PNG at build time by the app's app/og/[...card]/route.tsx. A link to an article then previews with its own
// title instead of the generic brand card. Pages outside the registry (the home, the features index) keep the
// brand card.

/** The words a help card shows; the product's renderSocialCard draws them. */
export interface HelpCard {
  kicker: string;
  title: string;
  subtitle: string;
  footer: string;
}

// Beside the product's own `<name>.app` pill, so the brand is not said twice.
export const HELP_CARD_FOOTER = 'Help Centre';

// `canvas/themes`: the route, without the `/help/` prefix or slashes, a card is keyed by.
export const cardRoute = (href: string) => href.replace(/^\/(?:help\/)?|\/$/g, '');

// Key symbols spelled out: next/og's built-in font has no glyph for them, and a missing glyph makes the
// build fetch a font from the network (and draw a box when that fails). Kept to what titles use today;
// helpCardProblems fails on any other character outside the font.
const KEY_SYMBOLS: Record<string, string> = {
  '⌘': 'Cmd+',
  '⌥': 'Option+',
  '⇧': 'Shift+',
  '⌃': 'Ctrl+',
};
export const cardText = (text: string) => text.replace(/[⌘⌥⇧⌃]/g, (k) => KEY_SYMBOLS[k]!);

/** Every card of a catalogue, keyed by route. */
export function buildHelpCards(
  catalogue: HelpCatalogue,
  cardSubtitle: (text: string) => string,
): ReadonlyMap<string, HelpCard> {
  const { articles, categories } = catalogue;
  const categoryTitle = new Map(categories.map((c) => [c.slug, c.title]));
  const cards = new Map<string, HelpCard>();
  for (const cat of categories) {
    cards.set(cardRoute(categoryHref(cat.slug)), {
      kicker: 'Help Topic',
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

// The catch-all params app/og/[...card]/route.tsx is built for: `canvas/themes` → ['canvas', 'themes.png'].
export function helpCardParams(cards: ReadonlyMap<string, HelpCard>): { card: string[] }[] {
  return [...cards.keys()].map((route) => {
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
