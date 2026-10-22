import { describe, expect, it } from 'vitest';
import { createArrow, createShape, type ShapeElement, type Tab } from '@livepages/document';
import { settleChipsInTabs } from './settle-tabs';

const tab = (id: string, elements: Tab['elements']) => ({ id, name: id, elements }) as Tab;

describe('settleChipsInTabs (docs/specs/009-elements/badge.md "Attachment")', () => {
  it('settles only the tabs a write changed, against how each was', () => {
    const host = { ...createShape('square', 0, 0), id: 'h', x: 0, y: 0 };
    const badge = {
      ...createShape('badge', 0, 0),
      id: 'b',
      attachedTo: 'h',
      attachAt: 'top-left' as const,
    };
    const untouched = tab('a', [badge]);
    const before = [untouched, tab('b', [host, badge])];
    const after = [untouched, tab('b', [{ ...host, x: 50 }, badge])];
    const out = settleChipsInTabs(before, after);
    expect(out[0]).toBe(untouched);
    const settled = out[1]!.elements.find((e) => e.id === 'b') as ShapeElement;
    expect(settled.x + settled.width / 2).toBe(50);
  });

  it('fits a key to its rows before the stack holding it lays out, so a second settle changes nothing', () => {
    const stack = {
      ...createShape('stack', 0, 0),
      id: 's',
      x: 0,
      y: 0,
      width: 400,
      height: 400,
      stackDirection: 'column' as const,
    };
    const key = { ...createShape('diagram-key', 0, 0), id: 'k', x: 40, y: 40 };
    const below = { ...createShape('square', 0, 0), id: 'q', x: 40, y: 300 };
    const first = settleChipsInTabs([], [tab('a', [stack, key, below])]);
    // Two line styles take the key past the one row an empty key keeps, so the square under it must move down.
    const solid = { ...createArrow(500, 500, 600, 600), id: 'x' };
    const dashed = { ...solid, id: 'y', strokeStyle: 'dashed' as const };
    const after = [tab('a', [...first[0]!.elements, solid, dashed])];
    const out = settleChipsInTabs(first, after);
    const k = out[0]!.elements.find((e) => e.id === 'k') as ShapeElement;
    const q = out[0]!.elements.find((e) => e.id === 'q') as ShapeElement;
    expect(q.y).toBe(k.y + k.height + 16);
    expect(settleChipsInTabs(out, [tab('a', [...out[0]!.elements])])[0]!.elements).toEqual(
      out[0]!.elements,
    );
  });

  it('returns the same list when nothing needs settling', () => {
    const ts = [tab('a', [createShape('square', 0, 0)])];
    const after = [tab('a', [createShape('circle', 0, 0)])];
    expect(settleChipsInTabs(ts, after)).toBe(after);
  });
});
