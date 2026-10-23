import { describe, expect, it } from 'vitest';
import {
  allLinked,
  elementsFor,
  flows,
  inside,
  linked,
  mentionsAll,
  pagesOf,
  runChecks,
  sketched,
} from './checks.mjs';
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
const arrow = (from: string, to: string) => ({
  id: `${from}-${to}`,
  type: 'arrow',
  from: { kind: 'pinned', elementId: from },
  to: { kind: 'pinned', elementId: to },
});

const diagram = {
  documents: [
    {
      id: 'd1',
      name: 'Flow',
      tabs: [
        {
          id: 't1',
          name: 'Tab',
          outline: 'tab t1 "Tab" · 4 elements · finish=sketch · rev 1',
          elements: [
            {
              id: 'g',
              type: 'shape',
              shape: 'stack',
              label: 'Notifications',
              x: 0,
              y: 200,
              width: 400,
              height: 200,
            },
            box('a', 'Cart'),
            box('b', 'Pay'),
            box('c', 'Email receipt', 20, 220),
            arrow('a', 'b'),
            arrow('b', 'c'),
          ],
        },
      ],
    },
  ],
};

describe('diagram readers', () => {
  it('finds arrows either way round, or only forwards with flows', () => {
    expect(linked(diagram, /pay/i, /cart/i)).toBe(true);
    expect(flows(diagram, /pay/i, /cart/i)).toBe(false);
    expect(flows(diagram, /cart/i, /pay/i)).toBe(true);
  });

  it('names what is missing', () => {
    expect(elementsFor(diagram, [/cart/i, /refund/i])).toEqual({
      pass: false,
      detail: 'no element for: refund',
    });
    expect(allLinked(diagram, [[/cart/i, /receipt/i]], { directed: true }).detail).toBe(
      'not joined: cart → receipt',
    );
    expect(mentionsAll(diagram, [/flow/i, /receipt/i]).pass).toBe(true);
  });

  it('sees a box inside a frame by its bounds', () => {
    expect(inside(diagram, /receipt/i, /notifications/i)).toBe(true);
    expect(inside(diagram, /cart/i, /notifications/i)).toBe(false);
  });

  it('reads a sketch finish from the tab header', () => {
    expect(sketched(diagram.documents[0].tabs[0])).toBe(true);
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
        ['has cart', ({ snap }: { snap: typeof diagram }) => elementsFor(snap, [/cart/i])],
        [
          'throws',
          () => {
            throw new Error('boom');
          },
        ],
      ],
    };
    expect(runChecks(task, { snap: diagram, run: { finalText: 'Done' } })).toEqual([
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
