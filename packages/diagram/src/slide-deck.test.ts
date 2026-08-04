import { describe, expect, it } from 'vitest';

import {
  deckTabIds,
  firstDeck,
  parseStoredPresentation,
  presentableSlides,
  resolveSlide,
  slideBounds,
  slideName,
  storePresentation,
  type Deck,
  type Slide,
} from './slide-deck';
import type { ArrowElement, Element, ShapeElement, Tab } from './index';

const shape = (id: string, over: Partial<ShapeElement> = {}): ShapeElement =>
  ({
    id,
    type: 'shape',
    shape: 'square',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    ...over,
  }) as ShapeElement;

const arrow = (id: string, from: string, to: string): ArrowElement =>
  ({
    id,
    type: 'arrow',
    from: { kind: 'pinned', elementId: from, anchor: 'right' },
    to: { kind: 'pinned', elementId: to, anchor: 'left' },
  }) as unknown as ArrowElement;

const tab = (id: string, elements: Element[]): Tab => ({ id, name: id, elements });

const slide = (over: Partial<Slide> = {}): Slide => ({
  id: 's1',
  tabId: 't1',
  elementIds: [],
  ...over,
});

describe('resolveSlide', () => {
  it('returns the chosen elements', () => {
    const t = tab('t1', [shape('a'), shape('b'), shape('c')]);
    const got = resolveSlide(slide({ elementIds: ['a', 'c'] }), t);
    expect(got.map((e) => e.id)).toEqual(['a', 'c']);
  });

  // Paint order is the diagram's business, not the order you happened to
  // click things in while building the slide.
  it('uses the tab’s paint order, not the slide’s list order', () => {
    const t = tab('t1', [shape('a'), shape('b'), shape('c')]);
    const got = resolveSlide(slide({ elementIds: ['c', 'a'] }), t);
    expect(got.map((e) => e.id)).toEqual(['a', 'c']);
  });

  it('skips ids that no longer exist, keeping the rest', () => {
    const t = tab('t1', [shape('a')]);
    const got = resolveSlide(slide({ elementIds: ['a', 'gone'] }), t);
    expect(got.map((e) => e.id)).toEqual(['a']);
  });

  // The whole reason references resolve at read time: the slide was never
  // rewritten when the element was deleted, so undo restores membership.
  it('shows an element again once it is restored', () => {
    const s = slide({ elementIds: ['a', 'b'] });
    expect(resolveSlide(s, tab('t1', [shape('a')])).map((e) => e.id)).toEqual(['a']);
    expect(resolveSlide(s, tab('t1', [shape('a'), shape('b')])).map((e) => e.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('is empty for a missing tab or an empty slide', () => {
    expect(resolveSlide(slide({ elementIds: ['a'] }), undefined)).toEqual([]);
    expect(resolveSlide(slide(), tab('t1', [shape('a')]))).toEqual([]);
  });

  describe('implied arrows', () => {
    it('includes an arrow whose ends are both on the slide', () => {
      const t = tab('t1', [shape('a'), shape('b'), arrow('r', 'a', 'b')]);
      const got = resolveSlide(slide({ elementIds: ['a', 'b'] }), t);
      expect(got.map((e) => e.id)).toEqual(['a', 'b', 'r']);
    });

    it('leaves out an arrow with one end off the slide', () => {
      const t = tab('t1', [shape('a'), shape('b'), arrow('r', 'a', 'b')]);
      const got = resolveSlide(slide({ elementIds: ['a'] }), t);
      expect(got.map((e) => e.id)).toEqual(['a']);
    });

    it('keeps an explicitly chosen arrow whatever its ends do', () => {
      const t = tab('t1', [shape('a'), shape('b'), arrow('r', 'a', 'b')]);
      const got = resolveSlide(slide({ elementIds: ['r'] }), t);
      expect(got.map((e) => e.id)).toEqual(['r']);
    });

    it('follows an arrow pinned onto another arrow', () => {
      const onArrow = {
        id: 'r2',
        type: 'arrow',
        from: { kind: 'on-arrow', arrowId: 'r', t: 0.5 },
        to: { kind: 'pinned', elementId: 'c', anchor: 'left' },
      } as unknown as ArrowElement;
      const t = tab('t1', [shape('a'), shape('b'), shape('c'), arrow('r', 'a', 'b'), onArrow]);
      const got = resolveSlide(slide({ elementIds: ['a', 'b', 'c', 'r'] }), t);
      expect(got.map((e) => e.id)).toContain('r2');
    });

    it('never pulls in an arrow with a free end', () => {
      const floating = {
        id: 'r',
        type: 'arrow',
        from: { kind: 'free', x: 0, y: 0 },
        to: { kind: 'pinned', elementId: 'a', anchor: 'left' },
      } as unknown as ArrowElement;
      const t = tab('t1', [shape('a'), floating]);
      expect(resolveSlide(slide({ elementIds: ['a'] }), t).map((e) => e.id)).toEqual(['a']);
    });
  });
});

describe('slideBounds', () => {
  it('is null for an empty slide', () => {
    expect(slideBounds([])).toBeNull();
  });

  it('fits the content when there is no frame', () => {
    const got = slideBounds([shape('a', { x: 0, y: 0 }), shape('b', { x: 200, y: 100 })]);
    expect(got).toEqual({ x: 0, y: 0, w: 300, h: 200 });
  });

  it('uses a single frame’s own bounds', () => {
    const frame = shape('f', { shape: 'frame', x: -50, y: -20, width: 800, height: 450 });
    const got = slideBounds([frame, shape('a', { x: 0, y: 0 })]);
    expect(got).toEqual({ x: -50, y: -20, w: 800, h: 450 });
  });

  it('falls back to content bounds when two frames are ambiguous', () => {
    const f1 = shape('f1', { shape: 'frame', x: 0, y: 0, width: 100, height: 100 });
    const f2 = shape('f2', { shape: 'frame', x: 400, y: 0, width: 100, height: 100 });
    expect(slideBounds([f1, f2])).toEqual({ x: 0, y: 0, w: 500, h: 100 });
  });
});

describe('presentableSlides', () => {
  it('pairs slides with their tab and keeps deck order', () => {
    const deck: Deck = {
      slides: [
        slide({ id: 's1', tabId: 'a' }),
        slide({ id: 's2', tabId: 'c' }),
        slide({ id: 's3', tabId: 'a' }),
      ],
    };
    const got = presentableSlides(deck, [tab('a', []), tab('c', [])]);
    expect(got.map((r) => `${r.slide.id}@${r.tab.id}`)).toEqual(['s1@a', 's2@c', 's3@a']);
  });

  it('drops a slide whose tab is gone rather than blocking the deck', () => {
    const deck: Deck = {
      slides: [slide({ id: 's1', tabId: 'a' }), slide({ id: 's2', tabId: 'x' })],
    };
    expect(presentableSlides(deck, [tab('a', [])]).map((r) => r.slide.id)).toEqual(['s1']);
  });

  it('keeps a slide whose elements have all gone', () => {
    const deck: Deck = { slides: [slide({ tabId: 'a', elementIds: ['dead'] })] };
    expect(presentableSlides(deck, [tab('a', [])])).toHaveLength(1);
  });
});

describe('slideName', () => {
  it('falls back to the position', () => {
    expect(slideName(slide(), 0)).toBe('Slide 1');
    expect(slideName(slide({ name: '   ' }), 6)).toBe('Slide 7');
  });
  it('uses the given name', () => {
    expect(slideName(slide({ name: 'Why now' }), 3)).toBe('Why now');
  });
});

describe('deckTabIds', () => {
  it('is every tab the deck reaches, de-duplicated', () => {
    const deck: Deck = {
      slides: [slide({ tabId: 'a' }), slide({ tabId: 'c' }), slide({ tabId: 'a' })],
    };
    expect([...deckTabIds(deck)].sort()).toEqual(['a', 'c']);
  });
});

describe('parseStoredPresentation', () => {
  it('round-trips through the stored envelope', () => {
    const deck: Deck = { slides: [slide({ name: 'One', notes: 'say this' })] };
    const stored = storePresentation(deck)!;
    const back = parseStoredPresentation(JSON.stringify(stored));
    expect(firstDeck(back).slides[0]).toEqual(deck.slides[0]);
  });

  it('stores nothing for an empty deck', () => {
    expect(storePresentation({ slides: [] })).toBeNull();
  });

  it('is null for absent or unreadable input, never throwing', () => {
    expect(parseStoredPresentation(null)).toBeNull();
    expect(parseStoredPresentation(undefined)).toBeNull();
    expect(parseStoredPresentation('')).toBeNull();
    expect(parseStoredPresentation('not json')).toBeNull();
    expect(parseStoredPresentation('[]')).toBeNull();
    expect(parseStoredPresentation('{"nope":1}')).toBeNull();
  });

  // A diagram whose deck is unreadable must still open, so bad slides are
  // dropped one at a time rather than failing the whole payload.
  it('drops malformed slides and keeps the good ones', () => {
    const raw = JSON.stringify({
      decks: [
        {
          slides: [
            { id: 's1', tabId: 't1', elementIds: ['a'] },
            { id: 's2' },
            { tabId: 't1', elementIds: [] },
            { id: 's3', tabId: 't1', elementIds: [7] },
            { id: 's4', tabId: 't1', elementIds: [], name: 5 },
            { id: 's5', tabId: 't1', elementIds: [], notes: 'ok' },
          ],
        },
      ],
    });
    const back = parseStoredPresentation(raw);
    expect(firstDeck(back).slides.map((s) => s.id)).toEqual(['s1', 's5']);
  });

  it('accepts an already-parsed object as well as text', () => {
    const stored = { decks: [{ slides: [slide()] }] };
    expect(firstDeck(parseStoredPresentation(stored)).slides).toHaveLength(1);
  });

  it('gives an empty deck when there are none', () => {
    expect(firstDeck(parseStoredPresentation('{"decks":[]}')).slides).toEqual([]);
    expect(firstDeck(null).slides).toEqual([]);
  });
});
