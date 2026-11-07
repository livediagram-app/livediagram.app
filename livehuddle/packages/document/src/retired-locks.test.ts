import { describe, expect, it } from 'vitest';
import { dropRetiredLocks } from './retired-locks';
import { migrateStoredTab } from './stored-tab';

// docs/specs/002-project-scope/not-in-livehuddle.md "Element and Tab Locking": a tab or element saved locked still
// opens, unlocked, and is never dropped.
const square = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  ...extra,
});

describe('dropRetiredLocks', () => {
  it('hands back the same tab when nothing on it is locked', () => {
    const tab = { id: 't', name: 'T', elements: [square('a')] };
    expect(dropRetiredLocks(tab)).toBe(tab);
  });

  it('hands back the same tab when it has no elements array', () => {
    const tab = { id: 't', name: 'T' };
    expect(dropRetiredLocks(tab)).toBe(tab);
  });

  it("drops the tab's own lock and keeps the rest", () => {
    expect(dropRetiredLocks({ id: 't', name: 'T', locked: true, elements: [] })).toEqual({
      id: 't',
      name: 'T',
      elements: [],
    });
  });

  it("drops every element's lock, true or false, keeping every element", () => {
    const plain = square('c');
    const out = dropRetiredLocks({
      id: 't',
      name: 'T',
      elements: [square('a', { locked: true }), square('b', { locked: false }), plain, 'junk'],
    }) as unknown as { elements: unknown[] };
    expect(out.elements).toEqual([square('a'), square('b'), plain, 'junk']);
    expect(out.elements[2]).toBe(plain);
  });

  it('runs in the stored-tab migration, so a locked tab and its locked elements load unlocked', () => {
    const tab = {
      id: 't',
      name: 'T',
      locked: true,
      elements: [square('a', { locked: true }), square('b', { locked: true })],
    };
    const out = migrateStoredTab(tab as never) as unknown as Record<string, unknown>;
    expect('locked' in out).toBe(false);
    const els = out.elements as Record<string, unknown>[];
    expect(els.map((el) => el.id)).toEqual(['a', 'b']);
    expect(els.some((el) => 'locked' in el)).toBe(false);
  });
});
