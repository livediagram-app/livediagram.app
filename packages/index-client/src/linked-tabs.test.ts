// Connect as tabs' wire (liveworkspace/docs/specs/004-index/connected-tabs.md "Linked from a Send to").
import { describe, expect, it } from 'vitest';
import { itemConnectedTabPath, linkedTabHeld, readLinkedTabsInput } from './linked-tabs';

describe('linked tabs', () => {
  it('reads exactly a target id, and refuses anything else', () => {
    expect(readLinkedTabsInput({ targetId: 'p_1', extra: 1 })).toEqual({ targetId: 'p_1' });
    for (const bad of [null, [], 'p1', {}, { targetId: '' }, { targetId: 'a/b' }, { targetId: 7 }])
      expect(readLinkedTabsInput(bad)).toBeNull();
    expect(readLinkedTabsInput({ targetId: 'x'.repeat(201) })).toBeNull();
  });

  it('holds a tab when made or already there', () => {
    expect(linkedTabHeld('made')).toBe(true);
    expect(linkedTabHeld('connected')).toBe(true);
    for (const o of ['cannot', 'full', 'unreached'] as const) expect(linkedTabHeld(o)).toBe(false);
  });

  it("names the app's removal door", () => {
    expect(itemConnectedTabPath('d 1', 'cn_abc')).toBe('/items/d%201/connected-tabs/cn_abc');
  });
});
