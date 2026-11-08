import { describe, expect, it } from 'vitest';
import { createShape, type Element, type ShapeElement } from '@livehuddle/document';
import { cleanupVerdict, verdictNotice } from './tidy-verdict';

// docs/specs/008-canvas/layout-cleanup.md "A tidy never trashes the work".

const box = (id: string, x: number, y: number, w = 100, h = 50) =>
  ({ ...createShape('square', x, y), id, width: w, height: h }) as ShapeElement;
// A stored (retired) arrow (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine").
const arrow = (from: string, to: string) =>
  ({
    id: `${from}>${to}`,
    type: 'arrow',
    from: { kind: 'pinned', elementId: from, anchor: 's' },
    to: { kind: 'pinned', elementId: to, anchor: 'n' },
  }) as Element;
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
});

describe('verdict copy', () => {
  it('has a notice for every verdict but ok', () => {
    expect(verdictNotice('Auto-align', { kind: 'ok' })).toBeNull();
    expect(verdictNotice('Auto-align', { kind: 'covers', count: 1 })).toBe(
      'Auto-align would cover a shape, so nothing moved.',
    );
    expect(verdictNotice('Auto-align', { kind: 'covers', count: 3 })).toBe(
      'Auto-align would cover 3 shapes, so nothing moved.',
    );
    expect(verdictNotice('Auto-align', { kind: 'unchanged' })).toBe(
      'Auto-align: the tab is already tidy, so nothing moved.',
    );
    const v = { kind: 'leaves-container', count: 2 } as const;
    expect(verdictNotice('Auto-align', v)).toMatch(/^Auto-align .*nothing moved\.$/);
  });
});
