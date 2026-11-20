import { describe, expect, it } from 'vitest';
import { find, mentionsAll, pagesOf, runChecks } from './checks.mjs';
import { parseTabHeader } from './snapshot.mjs';

const box = (id: string, label: string, x = 0, y = 0) => ({
  id,
  type: 'shape',
  shape: 'square',
  label,
  x,
  y,
  width: 100,
  height: 40,
});
const made = {
  documents: [
    {
      id: 'd1',
      name: 'Flow',
      tabs: [
        {
          id: 't1',
          name: 'Tab',
          elements: [box('a', 'Cart'), box('b', 'Pay'), box('c', 'Email receipt', 20, 220)],
        },
      ],
    },
  ],
};

describe('readers', () => {
  it('finds elements by their words, and names what is missing', () => {
    expect(find(made, /cart/i).map((e) => e.id)).toEqual(['a']);
    expect(mentionsAll(made, [/flow/i, /receipt/i]).pass).toBe(true);
    expect(mentionsAll(made, [/refund/i])).toEqual({ pass: false, detail: 'missing: refund' });
  });
});

describe('pagesOf', () => {
  it('reads every kind of page line', () => {
    const pages = [
      'page 1 page-1 · slide Slide (16:9) · at -960,-540 1920x1080 · 3 elements',
      'page 2 "Tip 2" page-99 · infographic Square · at 636,-540 1080x1080 · 16 elements',
      'page 3 "Badge" page-3 · infographic Square · at -540,-540 1080x1080 · background #fdf3e3 · 5 elements',
      'page 4 page-4 · article A4 · at -397,-561 794x1123 · article art-55 · its writing below',
    ].join('\n');
    const snap = { documents: [{ id: 'd', tabs: [{ id: 't', elements: [], pages }] }] };
    expect(pagesOf(snap)).toEqual([
      {
        tabId: 't',
        n: 1,
        name: null,
        kind: 'slide',
        format: 'Slide (16:9)',
        x: -960,
        y: -540,
        width: 1920,
        height: 1080,
        elements: 3,
      },
      {
        tabId: 't',
        n: 2,
        name: 'Tip 2',
        kind: 'infographic',
        format: 'Square',
        x: 636,
        y: -540,
        width: 1080,
        height: 1080,
        elements: 16,
      },
      {
        tabId: 't',
        n: 3,
        name: 'Badge',
        kind: 'infographic',
        format: 'Square',
        x: -540,
        y: -540,
        width: 1080,
        height: 1080,
        elements: 5,
      },
      {
        tabId: 't',
        n: 4,
        name: null,
        kind: 'article',
        format: 'A4',
        x: -397,
        y: -561,
        width: 794,
        height: 1123,
        elements: null,
      },
    ]);
  });
});

describe('parseTabHeader', () => {
  it('reads a tab’s pages', () => {
    expect(
      parseTabHeader(
        'tab 3be5 "Deck" · 53 elements: 53 boxes · 6 pages: 5 slide, 1 infographic (view pages) · rev 5',
      ),
    ).toEqual({
      pageCount: 6,
      pageKinds: { slide: 5, infographic: 1 },
    });
  });
});

describe('runChecks', () => {
  it('adds the base checks, keeps a reason and fails a check that throws', () => {
    const task = {
      checks: [
        ['has cart', ({ snap }: { snap: typeof made }) => find(snap, /cart/i).length > 0],
        [
          'throws',
          () => {
            throw new Error('boom');
          },
        ],
      ],
    };
    expect(runChecks(task, { snap: made, run: { finalText: 'Done' } })).toEqual([
      { name: 'made something', pass: true, detail: null },
      { name: 'replied', pass: true, detail: null },
      { name: 'has cart', pass: true, detail: null },
      { name: 'throws', pass: false, detail: 'check threw: boom' },
    ]);
    expect(
      runChecks({ checks: [] }, { snap: { documents: [] }, run: { finalText: ' ' } }).map(
        (c: { pass: boolean }) => c.pass,
      ),
    ).toEqual([false, false]);
  });
});
