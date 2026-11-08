import { describe, expect, it } from 'vitest';
import { createSticky, createText, type Element } from '@livehuddle/document';
import { arrowBetween, retiredShapeAt, shapeAt } from './__fixtures__/build';
import { countElements, headerLine, threadCounts, viewHeader, type HeaderFacts } from './header';

const facts = (over: Partial<HeaderFacts> = {}): HeaderFacts => ({
  tab: { id: 't', ref: '0b34', name: 'Checkout platform', kind: 'diagram' },
  elements: 30,
  counts: { boxes: 19, arrows: 11 },
  unknown: 0,
  threads: { open: 1, total: 2 },
  rev: 41,
  ...over,
});

describe('headerLine (R16, VW8)', () => {
  it('names the tab, its buckets, threads and revision', () => {
    expect(headerLine(facts())).toBe(
      'tab 0b34 "Checkout platform" · 30 elements: 19 boxes, 11 arrows · threads 1 open/2 · rev 41',
    );
  });

  it('prints the singulars and the unknown count, and leaves absent segments out', () => {
    const line = headerLine(
      facts({
        tab: { id: 't', ref: 'b1', name: 'Board "1"', kind: 'diagram' },
        elements: 1,
        counts: { boxes: 1, arrows: 1 },
        unknown: 1,
        threads: { open: 0, total: 0 },
        rev: null,
      }),
    );
    expect(line).toBe('tab b1 "Board \\"1\\"" · 1 element: 1 box, 1 arrow · 1 unknown');
  });

  it('names a set finish', () => {
    expect(headerLine(facts({ finish: 'sketch', threads: { open: 0, total: 0 } }))).toBe(
      'tab 0b34 "Checkout platform" · 30 elements: 19 boxes, 11 arrows · finish=sketch · rev 41',
    );
  });

  it('says 0 elements for an empty tab (E1)', () => {
    const empty = facts({
      elements: 0,
      counts: { boxes: 0, arrows: 0 },
      threads: { open: 0, total: 0 },
    });
    expect(headerLine(empty)).toBe('tab 0b34 "Checkout platform" · 0 elements · rev 41');
  });

  it('carries the view name in JSON', () => {
    expect(viewHeader('graph', facts()).view).toBe('graph');
  });
});

describe('countElements (VW9) and threadCounts (VW11)', () => {
  // A stored boundary or lane is a box like any other (docs/specs/002-project-scope/not-in-livehuddle.md "The element
  // engine", part 3).
  it('counts arrows, and everything else as boxes, a stored boundary and lane among them', () => {
    const els: Element[] = [
      retiredShapeAt('boundary', 'f', 0, 0),
      retiredShapeAt('lane', 'l', 0, 0),
      shapeAt('square', 's', 0, 0),
      createText(0, 0),
      { id: 'u', type: 'hologram' } as unknown as Element,
      arrowBetween('a', 's', 'f'),
    ];
    expect(countElements(els)).toEqual({ boxes: 5, arrows: 1 });
  });

  it('counts threads with comments, open when unresolved (E21)', () => {
    const comment = { id: 'c', text: 't', createdAt: 0, authorName: 'A', authorColor: '#000' };
    const els = [
      { ...createSticky(0, 0), commentThread: { comments: [comment], resolved: false } },
      { ...createSticky(0, 0), commentThread: { comments: [comment], resolved: true } },
      { ...createSticky(0, 0), commentThread: { comments: [], resolved: false } },
    ] as Element[];
    expect(threadCounts(els)).toEqual({ open: 1, total: 2 });
  });
});
