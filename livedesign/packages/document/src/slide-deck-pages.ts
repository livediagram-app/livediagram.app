// The deck follows a tab's slide pages (docs/specs/007-editor/pages-mode.md "Slides"): every slide page is in the
// deck, and a tab's page slides run in its page order. Pure, so the editor runs it on every change to the pages and a
// viewer reads the same deck an editor would store.

import { pageUnits } from './page-units';
import { opensInOf } from './editor-mode';
import { pagesOf, type Page } from './page';
import type { Tab } from './index';
import type { Deck, Slide } from './slide-deck';

// The slide a slide page's own slide takes: named by its tab and page, so two editors adding it at once write the
// same slide and the deck they each save is the same deck.
export const pageSlideIdFor = (tabId: string, pageId: string): string => `page:${tabId}:${pageId}`;

// The tabs whose pages the deck follows: Pages tabs whose pages have loaded. A tab not yet loaded carries no
// `pages`, and reading it would take its page slides for slides of deleted pages. Read once per `pages` array: an
// element edit keeps the array, so the deck's per-edit checks cost a lookup, not a parse of every page.
const readPages = new WeakMap<object, Page[]>();
function followedPages(tab: Tab): Page[] | null {
  if (opensInOf(tab) !== 'pages' || !Array.isArray(tab.pages)) return null;
  // An empty list reads as the default first page, which takes the tab's orientation: not cached.
  if (tab.pages.length === 0) return pagesOf(tab);
  const known = readPages.get(tab.pages);
  if (known) return known;
  const pages = pagesOf(tab);
  readPages.set(tab.pages, pages);
  return pages;
}

const isSlidePage = (p: Page) => p.kind === 'slide';

// The slides that left the deck with their page, kept for the session (useSlideDeck holds one) so the page coming
// back brings them back. Bounded: the oldest are forgotten past GONE_SLIDES_MAX, well past a tab's 100 pages.
export const GONE_SLIDES_MAX = 200;
export class GoneSlides {
  private readonly byPage = new Map<string, Slide[]>();
  private count = 0;
  private static key = (tabId: string, pageId: string) => `${tabId}\n${pageId}`;
  // Idempotent, as a state updater may run twice: a slide already remembered is replaced by its latest self.
  remember(slide: Slide): void {
    const key = GoneSlides.key(slide.tabId, slide.pageId!);
    const list = this.byPage.get(key) ?? [];
    const at = list.findIndex((s) => s.id === slide.id);
    if (at >= 0) list[at] = slide;
    else {
      list.push(slide);
      this.count++;
    }
    // Newest last, so the oldest page is the first forgotten.
    this.byPage.delete(key);
    this.byPage.set(key, list);
    while (this.count > GONE_SLIDES_MAX) {
      const [oldest, dropped] = this.byPage.entries().next().value as [string, Slide[]];
      this.byPage.delete(oldest);
      this.count -= dropped.length;
    }
  }
  // The slides a returning page left with that the deck does not hold, forgotten as they are handed back (so a slide
  // deleted by hand after it came back stays deleted). A state updater may run twice over the same deck: `run` is
  // that deck's slides, and a second run over it is handed the same slides again.
  private given: { run: readonly Slide[]; byPage: Map<string, Slide[]> } | null = null;
  take(tabId: string, pageId: string, slides: readonly Slide[], run: readonly Slide[]): Slide[] {
    const key = GoneSlides.key(tabId, pageId);
    if (this.given?.run !== run) this.given = { run, byPage: new Map() };
    const again = this.given.byPage.get(key);
    if (again) return again;
    const list = this.byPage.get(key);
    if (!list) return [];
    this.byPage.delete(key);
    this.count -= list.length;
    const held = new Set(slides.map((s) => s.id));
    const back = list.filter((s) => !held.has(s.id));
    this.given.byPage.set(key, back);
    return back;
  }
}

// One line per followed tab, its pages in order with the slide pages marked: what the deck follows, so a caller can
// re-run the deck only when it changes, not on every element edit.
export function deckPagesKey(tabs: readonly Tab[]): string {
  let key = '';
  for (const tab of tabs) {
    const pages = followedPages(tab);
    if (!pages) continue;
    key += `${tab.id}:${pages.map((p) => (isSlidePage(p) ? `${p.id}*` : p.id)).join(',')}\n`;
  }
  return key;
}

// The deck with every followed tab's slide pages in it and its page slides in page order. The slots a tab's page
// slides already take keep their places among the other slides (another tab's, an element slide, a card), only which
// page fills which slot follows the pages; a new slide page's slide goes into the tab's run (its last slot, or the
// deck's end when the tab has none yet). A slide of a page that has gone leaves the deck with it: on a followed tab
// (its pages loaded) a page id it no longer has was deleted, and a page's id is never reused. `gone`, the session's
// memory of those slides, brings them back as they were (hidden, copies, a slide added for a non-slide page) when
// the page returns, by an undo or a peer's. The same deck object when nothing changes.
export function deckFollowingPages(deck: Deck, tabs: readonly Tab[], gone?: GoneSlides): Deck {
  let slides = deck.slides;
  for (const tab of tabs) {
    const pages = followedPages(tab);
    if (!pages) continue;
    const order = new Map(pages.map((p, i) => [p.id, i] as const));
    const kept = slides.filter((s) => {
      if (s.tabId !== tab.id || !s.pageId || order.has(s.pageId)) return true;
      gone?.remember(s);
      return false;
    });
    if (kept.length !== slides.length) slides = kept;
    // A page back again takes back the slides it left with, unless the deck has them already.
    const back = gone ? pages.flatMap((p) => gone.take(tab.id, p.id, slides, deck.slides)) : [];
    const slots: number[] = [];
    slides.forEach((s, i) => {
      if (s.tabId === tab.id && s.pageId && order.has(s.pageId)) slots.push(i);
    });
    const present = new Set([...slots.map((i) => slides[i]!.pageId), ...back.map((s) => s.pageId)]);
    const added: Slide[] = [
      ...back,
      ...pages
        .filter((p) => isSlidePage(p) && !present.has(p.id))
        .map((p) => ({
          id: pageSlideIdFor(tab.id, p.id),
          tabId: tab.id,
          elementIds: [],
          pageId: p.id,
        })),
    ];
    // By page, a page's own copies (a duplicated slide) keeping their deck order: a stable sort.
    const run = [...slots.map((i) => slides[i]!), ...added].sort(
      (a, b) => order.get(a.pageId!)! - order.get(b.pageId!)!,
    );
    const unchanged = added.length === 0 && slots.every((at, k) => slides[at] === run[k]);
    if (unchanged) continue;
    if (slots.length === 0) {
      slides = [...slides, ...run];
      continue;
    }
    const last = slots[slots.length - 1]!;
    const isSlot = new Set(slots);
    const next: Slide[] = [];
    let k = 0;
    slides.forEach((s, i) => {
      if (i === last) next.push(...run.slice(k));
      else if (isSlot.has(i)) next.push(run[k++]!);
      else next.push(s);
    });
    slides = next;
  }
  return slides === deck.slides ? deck : { slides };
}

// Where a drag in the Slide Deck should move a page slide's page, so the two orders stay one: just after the page
// whose slide now comes before it in the deck (that tab's page slides only), else just before the page whose slide
// comes after it, else first. Nothing moves while it already sits between those two in the tab. As the unit
// index pageMovedTo takes. Null when the slide is not a followed tab's page
// slide, or its page is already there.
export function pageMoveForDeckOrder(
  deck: Deck,
  slideId: string,
  tabs: readonly Tab[],
): { tabId: string; pageId: string; unitIndex: number } | null {
  const slide = deck.slides.find((s) => s.id === slideId);
  if (!slide?.pageId) return null;
  const tab = tabs.find((t) => t.id === slide.tabId);
  const pages = tab ? followedPages(tab) : null;
  if (!tab || !pages || !pages.some((p) => p.id === slide.pageId)) return null;
  const pageAt = new Map(pages.map((p, i) => [p.id, i] as const));
  // The nearest page slide of the same tab on each side in the deck, by its page.
  const neighbour = (step: -1 | 1): string | null => {
    for (let i = deck.slides.indexOf(slide) + step; i >= 0 && i < deck.slides.length; i += step) {
      const s = deck.slides[i]!;
      if (s.tabId === tab.id && s.pageId && s.pageId !== slide.pageId && pageAt.has(s.pageId)) {
        return s.pageId;
      }
    }
    return null;
  };
  const before = neighbour(-1);
  const after = neighbour(1);
  const own = pageAt.get(slide.pageId)!;
  // Already between them in the tab (other kinds of page may sit between): nothing to move.
  if (
    (before === null || pageAt.get(before)! < own) &&
    (after === null || own < pageAt.get(after)!)
  ) {
    return null;
  }
  const units = pageUnits(pages);
  const from = units.findIndex((u) => u.pageIds.includes(slide.pageId!));
  const rest = units.filter((_, i) => i !== from);
  const unitIndex =
    before !== null
      ? rest.findIndex((u) => u.pageIds.includes(before)) + 1
      : after !== null
        ? rest.findIndex((u) => u.pageIds.includes(after))
        : 0;
  return unitIndex === from ? null : { tabId: tab.id, pageId: slide.pageId, unitIndex };
}

// The slides that are the one slide in the deck of a followed tab's slide page: deleting one would only bring it
// straight back, so the Slide Deck offers Hide for it instead. A copy of it, or a slide of any other page, deletes as
// before. One pass over the deck and each tab's pages.
export function slidePageOwnSlideIds(deck: Deck, tabs: readonly Tab[]): Set<string> {
  const slidePages = new Map<string, Set<string>>();
  for (const tab of tabs) {
    const pages = followedPages(tab);
    if (pages) slidePages.set(tab.id, new Set(pages.filter(isSlidePage).map((p) => p.id)));
  }
  const byPage = new Map<string, string[]>();
  for (const s of deck.slides) {
    if (!s.pageId || !slidePages.get(s.tabId)?.has(s.pageId)) continue;
    const key = `${s.tabId}\n${s.pageId}`;
    (byPage.get(key) ?? byPage.set(key, []).get(key)!).push(s.id);
  }
  return new Set([...byPage.values()].filter((ids) => ids.length === 1).map((ids) => ids[0]!));
}
