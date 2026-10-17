import { describe, expect, it } from 'vitest';
import {
  deckFollowingPages,
  deckPagesKey,
  isSlidePageOwnSlide,
  pageMoveForDeckOrder,
  pageSlideIdFor,
} from './slide-deck-pages';
import type { Deck, Slide } from './slide-deck';
import type { IllustratePage } from './illustrate-page';
import type { Tab } from './index';

// docs/specs/007-editor/illustrate-pages.md "Slides": slide pages are in the deck, in page order.

const slidePage = (id: string): IllustratePage => ({ id, orientation: 'landscape', kind: 'slide' });
const infoPage = (id: string): IllustratePage => ({
  id,
  orientation: 'portrait',
  kind: 'infographic',
});
const deckTab = (id: string, pages: IllustratePage[] | undefined, mode = 'illustrate'): Tab =>
  ({ id, name: id, elements: [], opensIn: mode, ...(pages ? { pages } : {}) }) as Tab;
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

  it('keeps a duplicated slide beside its page, and a slide of a deleted page where it is', () => {
    const copy = pageSlide('t', 'a', { id: 'copy' });
    const before: Deck = {
      slides: [pageSlide('t', 'b'), pageSlide('t', 'gone'), pageSlide('t', 'a'), copy],
    };
    const tab = deckTab('t', [slidePage('a'), slidePage('b')]);
    const after = deckFollowingPages(before, [tab]);
    expect(after.slides.map((s) => s.id)).toEqual(['s-t-a', 's-t-gone', 'copy', 's-t-b']);
  });

  it('leaves alone a tab not in Illustrate, a tab not yet loaded, and a deck already in step', () => {
    const before: Deck = { slides: [pageSlide('t', 'b'), pageSlide('t', 'a')] };
    const pages = [slidePage('a'), slidePage('b')];
    expect(deckFollowingPages(before, [deckTab('t', pages, 'diagram')])).toBe(before);
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
    expect(deckPagesKey([deckTab('t', [slidePage('a')], 'diagram')])).toBe('');
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

describe('isSlidePageOwnSlide', () => {
  it("holds for a slide page's only slide, not a copy's pair, another page's, or an unfollowed tab's", () => {
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
    expect(isSlidePageOwnSlide(deck, 's-t-a', [tab])).toBe(true);
    expect(isSlidePageOwnSlide(deck, 's-t-i', [tab])).toBe(false);
    expect(isSlidePageOwnSlide(deck, 's-t-b', [tab])).toBe(false);
    expect(isSlidePageOwnSlide(deck, 'copy', [tab])).toBe(false);
    expect(isSlidePageOwnSlide(deck, 's-t-gone', [tab])).toBe(false);
    expect(isSlidePageOwnSlide(deck, 'x', [tab])).toBe(false);
    expect(isSlidePageOwnSlide(deck, 's-t-a', [deckTab('t', [slidePage('a')], 'diagram')])).toBe(
      false,
    );
  });
});
