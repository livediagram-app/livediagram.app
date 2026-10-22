import { describe, expect, it } from 'vitest';
import {
  createPinnedArrow,
  createShape,
  type ArrowElement,
  type Element,
  type ShapeElement,
} from '@livedocuments/document';
import { cleanupVerdict, verdictLine, verdictNotice } from './tidy-verdict';

// docs/specs/008-canvas/layout-cleanup.md "A tidy never trashes the work".

const box = (id: string, x: number, y: number, w = 100, h = 50) =>
  ({ ...createShape('square', x, y), id, width: w, height: h }) as ShapeElement;
const arrow = (from: string, to: string): ArrowElement => ({
  ...createPinnedArrow(from, 's', to, 'n'),
  id: `${from}>${to}`,
});
const moved = (els: Element[], id: string, dx: number, dy: number) =>
  els.map((e) =>
    e.id === id
      ? ({ ...e, x: (e as ShapeElement).x + dx, y: (e as ShapeElement).y + dy } as Element)
      : e,
  );

describe('cleanupVerdict', () => {
  const base = [box('a', 0, 0), box('b', 0, 200), box('c', 300, 0), arrow('a', 'b')];

  it('is unchanged when nothing moves', () => {
    expect(cleanupVerdict(base, [...base])).toEqual({ kind: 'unchanged' });
  });

  it('is ok for a move that covers nothing', () => {
    expect(cleanupVerdict(base, moved(base, 'b', 0, 40))).toEqual({ kind: 'ok' });
  });

  it('counts the shapes a move newly covers', () => {
    expect(cleanupVerdict(base, moved(base, 'b', 300, -200))).toEqual({ kind: 'covers', count: 1 });
  });

  it('catches a shape pulled out of the box that held it', () => {
    const els = [box('lane', 0, 0, 400, 100), box('a', 10, 10), box('b', 10, 300), arrow('a', 'b')];
    expect(cleanupVerdict(els, moved(els, 'a', 0, 150))).toEqual({
      kind: 'leaves-container',
      count: 1,
    });
  });

  it('catches lanes strung out of their stack', () => {
    const els = [
      box('lane1', 0, 0, 600, 100),
      box('lane2', 0, 120, 600, 100),
      box('a', 10, 10),
      box('b', 10, 130),
      arrow('a', 'b'),
    ];
    // Both lanes move as blocks (their shapes inside), the second ending up beside the first.
    const after = moved(moved(els, 'lane2', 700, -120), 'b', 700, -120);
    expect(cleanupVerdict(els, after)).toEqual({ kind: 'rearranges-lanes' });
  });
});

describe('verdict copy', () => {
  it('has a line and a notice for every verdict but ok', () => {
    expect(verdictLine({ kind: 'ok' })).toBeNull();
    expect(verdictNotice('Smart', { kind: 'ok' })).toBeNull();
    expect(verdictLine({ kind: 'covers', count: 1 })).toBe('Would cover a shape');
    expect(verdictLine({ kind: 'covers', count: 3 })).toBe('Would cover 3 shapes');
    expect(verdictNotice('Tree', { kind: 'unchanged' })).toBe(
      'Tree: the tab is already tidy, so nothing moved.',
    );
    for (const v of [
      { kind: 'leaves-container', count: 2 },
      { kind: 'rearranges-lanes' },
      { kind: 'unsuited' },
    ] as const) {
      expect(verdictLine(v)).toBeTruthy();
      expect(verdictNotice('Mindmap', v)).toMatch(/^Mindmap .*nothing moved\.$/);
    }
  });
});
