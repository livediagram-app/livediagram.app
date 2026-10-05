import { describe, expect, it } from 'vitest';
import { createSticky, createText, type Element } from '@livediagram/document';
import { arrowBetween, shapeAt } from './__fixtures__/build';
import { countElements, headerLine, threadCounts, viewHeader, type HeaderFacts } from './header';

const facts = (over: Partial<HeaderFacts> = {}): HeaderFacts => ({
  tab: { id: 't', ref: '0b34', name: 'Checkout platform', kind: 'diagram' },
  elements: 30,
  counts: { boxes: 16, frames: 3, lanes: 0, arrows: 11 },
  hidden: 0,
  unknown: 0,
  threads: { open: 1, total: 2 },
  rev: 41,
  ...over,
});

describe('headerLine (R16, VW8)', () => {
  it('names the tab, its buckets, threads and revision', () => {
    expect(headerLine(facts())).toBe(
      'tab 0b34 "Checkout platform" · 30 elements: 16 boxes, 3 frames, 11 arrows · threads 1 open/2 · rev 41',
    );
  });

  it('prints the singulars, the kind, hidden and unknown counts, and leaves absent segments out', () => {
    const line = headerLine(
      facts({
        tab: { id: 't', ref: 'es', name: 'Board "1"', kind: 'event-storming' },
        elements: 1,
        counts: { boxes: 1, frames: 1, lanes: 1, arrows: 1 },
        hidden: 2,
        unknown: 1,
        threads: { open: 0, total: 0 },
        rev: null,
      }),
    );
    expect(line).toBe(
      'tab es "Board \\"1\\"" · 1 element: 1 box, 1 frame, 1 lane, 1 arrow · kind=event-storming · 2 hidden · 1 unknown',
    );
  });

  it('says 0 elements for an empty tab (E1)', () => {
    const empty = facts({
      elements: 0,
      counts: { boxes: 0, frames: 0, lanes: 0, arrows: 0 },
      threads: { open: 0, total: 0 },
    });
    expect(headerLine(empty)).toBe('tab 0b34 "Checkout platform" · 0 elements · rev 41');
  });

  it('carries the view name in JSON', () => {
    expect(viewHeader('graph', facts()).view).toBe('graph');
  });
});

describe('countElements (VW9) and threadCounts (VW11)', () => {
  it('buckets frames, lanes, arrows and everything else as boxes', () => {
    const els: Element[] = [
      shapeAt('frame', 'f', 0, 0),
      shapeAt('lane', 'l', 0, 0),
      shapeAt('square', 's', 0, 0),
      createText(0, 0),
      { id: 'u', type: 'hologram' } as unknown as Element,
      arrowBetween('a', 's', 'f'),
    ];
    expect(countElements(els)).toEqual({ boxes: 3, frames: 1, lanes: 1, arrows: 1 });
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
