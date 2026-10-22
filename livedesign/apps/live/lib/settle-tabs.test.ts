import { describe, expect, it } from 'vitest';
import { createShape, type ShapeElement, type Tab } from '@livedesign/document';
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

  it('returns the same list when nothing needs settling', () => {
    const ts = [tab('a', [createShape('square', 0, 0)])];
    const after = [tab('a', [createShape('circle', 0, 0)])];
    expect(settleChipsInTabs(ts, after)).toBe(after);
  });
});
