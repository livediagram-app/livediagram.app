import { describe, expect, it } from 'vitest';
import type { PathAnchor } from '@livediagram/document';
import { pathEditKey } from './path-edit-keys';

const corner = (x: number, y: number): PathAnchor => ({ x, y, mode: 'corner' });
const three = [corner(0, 0), corner(10, 0), corner(10, 10)];
const press = (key: string, selected: number[], mods: { shift?: boolean; mod?: boolean } = {}) =>
  pathEditKey({ key, shiftKey: !!mods.shift, mod: !!mods.mod }, three, false, new Set(selected));

describe('pathEditKey', () => {
  it('Escape clears the nodes, then leaves; Enter leaves', () => {
    expect(press('Escape', [1]).select?.size).toBe(0);
    expect(press('Escape', [])).toEqual({ claim: true, leave: 'escape' });
    expect(press('Enter', [1])).toEqual({ claim: true, leave: 'enter' });
  });

  it('deletes and nudges the selected nodes, and claims the key with none', () => {
    expect(press('Delete', [1]).land!.anchors).toHaveLength(2);
    expect(press('ArrowDown', [2], { shift: true }).land!.anchors[2]).toEqual(corner(10, 20));
    expect(press('Backspace', [])).toEqual({ claim: true });
  });

  it('walks the nodes with Tab, then on into the toolbar', () => {
    expect([...press('Tab', []).select!]).toEqual([0]);
    expect([...press('Tab', [0], { shift: true }).select!]).toEqual([2]);
    expect(press('Tab', [2])).toEqual({ claim: true, focusToolbar: true });
  });

  it('joins with J only when both ends are selected', () => {
    expect(press('j', [0, 2]).land).toMatchObject({ closed: true, kind: 'join' });
    expect(press('j', [0]).land).toBeUndefined();
  });

  it('leaves undo to the editor and reopens after it; leaves other keys alone', () => {
    expect(press('z', [], { mod: true })).toEqual({ claim: false, reopen: true });
    expect(press('a', [], { mod: true }).select!.size).toBe(3);
    expect(press('x', [1])).toEqual({ claim: false });
  });
});
