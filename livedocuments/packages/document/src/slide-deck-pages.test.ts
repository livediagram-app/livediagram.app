import { describe, expect, it } from 'vitest';
import {
  deckFollowingPages,
  GoneSlides,
  GONE_SLIDES_MAX,
  deckPagesKey,
  pageMoveForDeckOrder,
  pageSlideIdFor,
  slidePageOwnSlideIds,
} from './slide-deck-pages';
import type { Deck, Slide } from './slide-deck';
import type { Page } from './page';
import type { Tab } from './index';

// docs/specs/007-editor/pages-mode.md "Slides": slide pages are in the deck, in page order.

const slidePage = (id: string): Page => ({ id, orientation: 'landscape', kind: 'slide' });
const infoPage = (id: string): Page => ({
  id,
  orientation: 'portrait',
  kind: 'infographic',
});
const deckTab = (id: string, pages: Page[] | undefined): Tab => ({
  id,
  name: id,
  elements: [],
  ...(pages ? { pages } : {}),
});
const pageSlide = (tabId: string, pageId: string, extra: Partial<Slide> = {}): Slide => ({
  id: `s-${tabId}-${pageId}`,
  tabId,
  elementIds: [],
  pageId,
  ...extra,
});
const elementSlide = (id: string, tabId: string): Slide => ({ id, tabId, elementIds: ['e'] });
const pagesOf = (deck: Deck) => deck.slides.map((s) => s.pageId ?? s.id);

describe('deckFollowingPages', () => {
  it('puts every slide page of a new deck in, in page order, and nothing else', () => {
    const tab = deckTab('t', [slidePage('a'), infoPage('i'), slidePage('b'), slidePage('c')]);
    const deck = deckFollowingPages({ slides: [] }, [tab]);
    expect(pagesOf(deck)).toEqual(['a', 'b', 'c']);
    expect(deck.slides[0]).toEqual({
      id: pageSlideIdFor('t', 'a'),
      tabId: 't',
      elementIds: [],
      pageId: 'a',
    });
  });

  it('follows a reorder of the pages in the slots the page slides hold, other slides staying put', () => {
    const before: Deck = {
      slides: [
        pageSlide('t', 'a', { notes: 'Open strong' }),
        elementSlide('x', 'other'),
        pageSlide('t', 'b'),
        pageSlide('t', 'c', { hidden: true }),
      ],
    };
    const tab = deckTab('t', [slidePage('c'), slidePage('a'), slidePage('b')]);
    const after = deckFollowingPages(before, [tab]);
    expect(pagesOf(after)).toEqual(['c', 'x', 'a', 'b']);
    // Each slide moves whole: its notes and hidden flag go with it.
    expect(after.slides[0]).toBe(before.slides[3]);
    expect(after.slides[2]).toBe(before.slides[0]);
  });

  it("adds a new slide page's slide in the tab's run", () => {
    const before: Deck = { slides: [pageSlide('t', 'a'), elementSlide('x', 'other')] };
    const tab = deckTab('t', [slidePage('a'), slidePage('new')]);
    expect(pagesOf(deckFollowingPages(before, [tab]))).toEqual(['a', 'new', 'x']);
  });

  it('orders a page slide of an infographic page with the rest, but never adds one', () => {
    const before: Deck = { slides: [pageSlide('t', 'b'), pageSlide('t', 'i')] };
    const tab = deckTab('t', [infoPage('i'), slidePage('b'), infoPage('j')]);
    expect(pagesOf(deckFollowingPages(before, [tab]))).toEqual(['i', 'b']);
  });

  it('keeps a duplicated slide beside its page, and drops a slide of a deleted page', () => {
    const copy = pageSlide('t', 'a', { id: 'copy' });
    const before: Deck = {
      slides: [pageSlide('t', 'b'), pageSlide('t', 'gone'), pageSlide('t', 'a'), copy],
    };
    const tab = deckTab('t', [slidePage('a'), slidePage('b')]);
    const after = deckFollowingPages(before, [tab]);
    expect(after.slides.map((s) => s.id)).toEqual(['s-t-a', 'copy', 's-t-b']);
  });

  // A deleted page leaves the deck with it, whatever kind it was and however its slide got there; nothing else does.
  it("drops every slide of a deleted page, and keeps other slides, other tabs' and a loading tab's", () => {
    const before: Deck = {
      slides: [
        pageSlide('t', 'i'),
        elementSlide('el', 't'),
        pageSlide('t', 'a'),
        pageSlide('t', 'a', { id: 'copy', hidden: true }),
        pageSlide('u', 'x'),
        pageSlide('t', 'b'),
        pageSlide('loading', 'z'),
      ],
    };
    const after = deckFollowingPages(before, [
      deckTab('t', [slidePage('b')]),
      deckTab('u', [slidePage('x')]),
      deckTab('loading', undefined),
    ]);
    expect(after.slides.map((s) => s.id)).toEqual(['el', 's-u-x', 's-t-b', 's-loading-z']);
  });

  it('keeps the same deck when no page has gone and none is new', () => {
    const before: Deck = { slides: [pageSlide('t', 'a'), elementSlide('el', 't')] };
    expect(deckFollowingPages(before, [deckTab('t', [slidePage('a')])])).toBe(before);
  });

  it('leaves alone a tab not yet loaded, and a deck already in step', () => {
    const before: Deck = { slides: [pageSlide('t', 'b'), pageSlide('t', 'a')] };
    const pages = [slidePage('a'), slidePage('b')];
    expect(deckFollowingPages(before, [deckTab('t', undefined)])).toBe(before);
    const inStep: Deck = { slides: [pageSlide('t', 'a'), pageSlide('t', 'b')] };
    expect(deckFollowingPages(inStep, [deckTab('t', pages)])).toBe(inStep);
  });

  it('follows each tab on its own', () => {
    const before: Deck = {
      slides: [pageSlide('t', 'b'), pageSlide('u', 'y'), pageSlide('t', 'a'), pageSlide('u', 'x')],
    };
    const after = deckFollowingPages(before, [
      deckTab('t', [slidePage('a'), slidePage('b')]),
      deckTab('u', [slidePage('x'), slidePage('y')]),
    ]);
    expect(after.slides.map((s) => `${s.tabId}${s.pageId}`)).toEqual(['ta', 'ux', 'tb', 'uy']);
  });
});

describe('deckPagesKey', () => {
  it('changes with the pages and their kinds, not with anything else', () => {
    const one = deckPagesKey([deckTab('t', [slidePage('a'), infoPage('b')])]);
    expect(deckPagesKey([deckTab('t', [slidePage('a'), infoPage('b')])])).toBe(one);
    expect(deckPagesKey([deckTab('t', [infoPage('b'), slidePage('a')])])).not.toBe(one);
    expect(deckPagesKey([deckTab('t', [slidePage('a'), slidePage('b')])])).not.toBe(one);
  });
});

describe('pageMoveForDeckOrder', () => {
  const tab = deckTab('t', [slidePage('a'), infoPage('i'), slidePage('b'), slidePage('c')]);

  it('moves the page just after the page whose slide now comes before it', () => {
    // c dragged between a and b in the deck.
    const deck: Deck = { slides: [pageSlide('t', 'a'), pageSlide('t', 'c'), pageSlide('t', 'b')] };
    expect(pageMoveForDeckOrder(deck, 's-t-c', [tab])).toEqual({
      tabId: 't',
      pageId: 'c',
      unitIndex: 1,
    });
  });

  it('moves it first when no page slide comes before it, past other slides', () => {
    const deck: Deck = {
      slides: [
        elementSlide('x', 't'),
        pageSlide('t', 'b'),
        pageSlide('t', 'a'),
        pageSlide('t', 'c'),
      ],
    };
    expect(pageMoveForDeckOrder(deck, 's-t-b', [tab])).toEqual({
      tabId: 't',
      pageId: 'b',
      unitIndex: 0,
    });
  });

  it('is null when the page is already there, or the slide is no followed page slide', () => {
    const deck: Deck = {
      slides: [
        pageSlide('t', 'a'),
        pageSlide('t', 'b'),
        elementSlide('x', 't'),
        pageSlide('t', 'gone'),
      ],
    };
    // b after a, with the infographic page between them in the tab: already in place.
    expect(pageMoveForDeckOrder(deck, 's-t-b', [tab])).toBeNull();
    expect(pageMoveForDeckOrder(deck, 'x', [tab])).toBeNull();
    expect(pageMoveForDeckOrder(deck, 's-t-gone', [tab])).toBeNull();
    expect(pageMoveForDeckOrder(deck, 's-t-a', [deckTab('t', undefined)])).toBeNull();
  });
});

describe('slidePageOwnSlideIds', () => {
  it("holds a slide page's only slide, not a copy's pair or another page's", () => {
    const tab = deckTab('t', [slidePage('a'), infoPage('i'), slidePage('b')]);
    const deck: Deck = {
      slides: [
        pageSlide('t', 'a'),
        pageSlide('t', 'i'),
        pageSlide('t', 'b'),
        pageSlide('t', 'b', { id: 'copy' }),
        pageSlide('t', 'gone'),
        elementSlide('x', 't'),
      ],
    };
    expect([...slidePageOwnSlideIds(deck, [tab])]).toEqual(['s-t-a']);
  });
});

// A deleted page's slides are remembered for the session, so the page coming back (an undo, a peer's) brings them
// back as they were: hidden, copied, added for a page that is not a slide page.
describe('GoneSlides', () => {
  const tabWith = (pages: Page[]) => deckTab('t', pages);

  it("brings a deleted page's slides back as they were when the page returns", () => {
    const gone = new GoneSlides();
    const start: Deck = {
      slides: [
        pageSlide('t', 'a', { hidden: true }),
        pageSlide('t', 'a', { id: 'copy' }),
        pageSlide('t', 'i'),
        pageSlide('t', 'b'),
      ],
    };
    const pages = [slidePage('a'), infoPage('i'), slidePage('b')];
    const deleted = deckFollowingPages(start, [tabWith([slidePage('b')])], gone);
    expect(deleted.slides.map((s) => s.id)).toEqual(['s-t-b']);
    const undone = deckFollowingPages(deleted, [tabWith(pages)], gone);
    expect(undone.slides).toEqual(start.slides);
  });

  it('hands back the same slides when an update runs twice over the same deck', () => {
    const gone = new GoneSlides();
    const start: Deck = { slides: [pageSlide('t', 'i'), pageSlide('t', 'b')] };
    const deleted = deckFollowingPages(start, [tabWith([slidePage('b')])], gone);
    const back = [infoPage('i'), slidePage('b')];
    const once = deckFollowingPages(deleted, [tabWith(back)], gone);
    const twice = deckFollowingPages(deleted, [tabWith(back)], gone);
    expect(twice.slides).toEqual(once.slides);
    expect(once.slides.map((s) => s.id)).toEqual(['s-t-i', 's-t-b']);
  });

  it('leaves a slide deleted by hand after it came back deleted', () => {
    const gone = new GoneSlides();
    const start: Deck = { slides: [pageSlide('t', 'i'), pageSlide('t', 'b')] };
    const pages = [infoPage('i'), slidePage('b')];
    const deleted = deckFollowingPages(start, [tabWith([slidePage('b')])], gone);
    const back = deckFollowingPages(deleted, [tabWith(pages)], gone);
    // The person deletes the infographic page's slide by hand; a later change to the pages keeps it gone.
    const byHand: Deck = { slides: back.slides.filter((s) => s.id !== 's-t-i') };
    const later = deckFollowingPages(byHand, [tabWith([...pages, slidePage('c')])], gone);
    expect(later.slides.map((s) => s.pageId)).toEqual(['b', 'c']);
  });

  it(`forgets the oldest past ${GONE_SLIDES_MAX} slides`, () => {
    const gone = new GoneSlides();
    for (let i = 0; i <= GONE_SLIDES_MAX; i++) gone.remember(pageSlide('t', `p${i}`));
    expect(gone.take('t', 'p0', [], [])).toEqual([]);
    expect(gone.take('t', `p${GONE_SLIDES_MAX}`, [], [])).toHaveLength(1);
  });
});
