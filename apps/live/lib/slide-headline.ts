// A slide's headline (docs/specs/012-collaboration/presentation-mode.md "The Slide Deck panel"):
// what the deck's row calls a slide nobody has named, read off the slide itself. The text with the
// most weight on it: its type size (textSize by textScale) times its length (up to
// HEADLINE_LENGTH_CAP characters), so a heading outweighs a huge short figure ("86k") and a large
// statement outweighs a small eyebrow; the topmost on a tie. On one line, cut to
// SLIDE_HEADLINE_MAX characters. Pure.
import {
  illustratePagesOf,
  LABEL_FONT_PX,
  resolveSlide,
  type Deck,
  type Slide,
  type Tab,
  type TextSize,
} from '@livediagram/document';

// Longer than a row shows; the row truncates with an ellipsis.
export const SLIDE_HEADLINE_MAX = 80;
// Past this many characters a text weighs no more for being longer (a paragraph is no headline).
export const HEADLINE_LENGTH_CAP = 40;

const SIZE: Record<string, number> = { sm: 12, md: 14, lg: 18, xl: 24, scale: 14 };

// A preset's weight from the table; an exact px from the Text Size slider on the same footing,
// by its ratio to Medium on the canvas (22px there weighs what `md` does here).
function sizeWeight(size: TextSize | undefined): number {
  if (typeof size === 'number') return ((SIZE.md ?? 14) * size) / LABEL_FONT_PX.md;
  return SIZE[size ?? 'md'] ?? 14;
}

export function slideHeadline(slide: Slide, tab: Tab | undefined): string | null {
  if (!tab || slide.itemId) return null;
  let best: { label: string; size: number; y: number } | null = null;
  for (const el of resolveSlide(slide, tab)) {
    if (el.type !== 'text') continue;
    const label = (el.label ?? '').replace(/\s+/g, ' ').trim();
    if (!label) continue;
    const size =
      sizeWeight(el.textSize) * (el.textScale ?? 1) * Math.min(label.length, HEADLINE_LENGTH_CAP);
    if (!best || size > best.size + 0.01 || (Math.abs(size - best.size) <= 0.01 && el.y < best.y)) {
      best = { label, size, y: el.y };
    }
  }
  if (!best) return null;
  return best.label.length > SLIDE_HEADLINE_MAX
    ? `${best.label.slice(0, SLIDE_HEADLINE_MAX - 1)}…`
    : best.label;
}

/** Every slide's headline, by slide id (absent where a slide has no text). */
export function slideHeadlines(deck: Deck, tabs: readonly Tab[]): Map<string, string> {
  const byId = new Map(tabs.map((t) => [t.id, t]));
  const out = new Map<string, string>();
  for (const s of deck.slides) {
    const h = slideHeadline(s, byId.get(s.tabId));
    if (h) out.set(s.id, h);
  }
  return out;
}

/** What a presented slide is called (presentation-mode.md "Jump to a slide"): its own name, an item slide's
 *  card, the headline on it, the name of the page it shows, the name of the tab it comes from, and only then
 *  its position, so the deck's list reads as the talk does rather than "Slide 1, Slide 2". */
export function presentedSlideName(
  slide: Slide,
  tab: Tab | undefined,
  index: number,
  cardTitle?: string,
): string {
  const own = slide.name?.trim();
  if (own) return own;
  if (cardTitle?.trim()) return cardTitle.trim();
  const headline = slideHeadline(slide, tab);
  if (headline) return headline;
  const page =
    slide.pageId && tab ? illustratePagesOf(tab).find((p) => p.id === slide.pageId) : undefined;
  if (page?.name?.trim()) return page.name.trim();
  if (tab?.name?.trim()) return tab.name.trim();
  return `Slide ${index + 1}`;
}
