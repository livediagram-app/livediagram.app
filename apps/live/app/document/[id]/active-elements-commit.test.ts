import { describe, expect, it } from 'vitest';
import type { ArrowElement, Element, Tab } from '@livediagram/document';
import { activeElementsCommit } from './active-elements-commit';

// Shift-chaining arrows (docs/specs/008-canvas/canvas-and-palette.md quick-connect): the release lands the
// drawn arrow (a queued tick) and, in the same event, the next arrow is committed. React applies the queued
// updates in order, so the commit must build on the landed arrow, never on the last render.
const arrow = (id: string, x: number): ArrowElement => ({
  id,
  type: 'arrow',
  from: { kind: 'pinned', elementId: 'src', anchor: 'e' },
  to: { kind: 'free', x, y: 50 },
});
const tabs = (els: Element[]): Tab[] => [{ id: 't', name: 'T', elements: els } as Tab];
const toX = (ts: Tab[], id: string) =>
  ((ts[0]!.elements.find((e) => e.id === id) as ArrowElement).to as { x: number }).x;

describe('activeElementsCommit', () => {
  it('keeps the landed arrow when the next one is added in the same event', () => {
    const rendered = tabs([arrow('a1', 100)]); // the drag began with a stub at the anchor
    const landing = (ts: Tab[]) =>
      ts.map((t) => ({
        ...t,
        elements: t.elements.map((e) => (e.id === 'a1' ? arrow('a1', 300) : e)),
      }));
    const addNext = (els: Element[]) => [...els, arrow('a2', 300)];
    // Queued in order, applied in order.
    const after = activeElementsCommit('t', addNext)(landing(rendered));
    expect(toX(after, 'a1')).toBe(300);
    expect(after[0]!.elements.map((e) => e.id)).toEqual(['a1', 'a2']);
    // What building from the last render did: the landed arrow snapped back to its stub.
    const stale = addNext(rendered[0]!.elements);
    const old = landing(rendered).map((t) => ({ ...t, elements: stale }));
    expect(toX(old, 'a1')).toBe(100);
  });

  it('leaves the tabs as they are when the mapper changes nothing, or the tab is gone', () => {
    const ts = tabs([arrow('a1', 1)]);
    expect(activeElementsCommit('t', (els) => els)(ts)).toBe(ts);
    expect(activeElementsCommit('gone', (els) => [...els])(ts)).toBe(ts);
  });
});
