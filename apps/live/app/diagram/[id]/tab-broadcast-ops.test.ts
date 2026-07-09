import { describe, it, expect } from 'vitest';
import type { Element, Tab } from '@livediagram/diagram';
import { EL_OP_BROADCAST_LIMIT, tabBroadcastOps } from './tab-broadcast-ops';

const el = (id: string, over: Partial<Element> = {}): Element =>
  ({ id, type: 'shape', shape: 'square', x: 0, y: 0, width: 10, height: 10, ...over }) as Element;

const tab = (over: Partial<Tab> = {}): Tab => ({
  id: 't1',
  name: 'Tab 1',
  elements: [el('a'), el('b')],
  ...over,
});

describe('tabBroadcastOps', () => {
  it('sends a whole-tab op when peers have no prior copy', () => {
    const after = tab();
    expect(tabBroadcastOps(undefined, after)).toEqual([{ kind: 'tab', tabId: 't1', tab: after }]);
  });

  it('emits one el op for a single moved element', () => {
    const before = tab();
    const after = tab({ elements: [el('a', { x: 50 }), el('b')] });
    expect(tabBroadcastOps(before, after)).toEqual([
      { kind: 'el', tabId: 't1', op: { kind: 'update', element: el('a', { x: 50 }) } },
    ]);
  });

  it('emits an el add op for a new element', () => {
    const before = tab();
    const after = tab({ elements: [el('a'), el('b'), el('c', { x: 3 })] });
    expect(tabBroadcastOps(before, after)).toEqual([
      { kind: 'el', tabId: 't1', op: { kind: 'add', element: el('c', { x: 3 }), at: 2 } },
    ]);
  });

  it('emits a tab-meta patch for a background change with no element change', () => {
    const before = tab();
    const after = tab({ backgroundColor: '#111' });
    expect(tabBroadcastOps(before, after)).toEqual([
      { kind: 'tab-meta', tabId: 't1', patch: { backgroundColor: '#111' } },
    ]);
  });

  it('emits the tab-meta patch before the el ops when both changed', () => {
    const before = tab();
    const after = tab({ name: 'Renamed', elements: [el('a', { x: 9 }), el('b')] });
    expect(tabBroadcastOps(before, after)).toEqual([
      { kind: 'tab-meta', tabId: 't1', patch: { name: 'Renamed' } },
      { kind: 'el', tabId: 't1', op: { kind: 'update', element: el('a', { x: 9 }) } },
    ]);
  });

  it('never puts folder in a tab-meta patch (diagram-meta owns it)', () => {
    const before = tab({ folder: 'A' });
    const after = tab({ folder: 'B', backgroundColor: '#222' });
    expect(tabBroadcastOps(before, after)).toEqual([
      { kind: 'tab-meta', tabId: 't1', patch: { backgroundColor: '#222' } },
    ]);
  });

  it('falls back to a whole-tab op for a bulk element change', () => {
    const before = tab({ elements: [] });
    const many = Array.from({ length: EL_OP_BROADCAST_LIMIT + 1 }, (_, i) => el(`n${i}`));
    const after = tab({ elements: many });
    expect(tabBroadcastOps(before, after)).toEqual([{ kind: 'tab', tabId: 't1', tab: after }]);
  });

  it('falls back to a whole-tab op when a meta field is cleared', () => {
    // Clearing a field yields patch[k] = undefined, which JSON.stringify drops
    // on the wire, so a granular tab-meta op could never carry the clear. The
    // whole-tab op carries the field's absence instead.
    const before = tab({ backgroundColor: '#111' });
    const after = tab(); // backgroundColor removed
    expect(tabBroadcastOps(before, after)).toEqual([{ kind: 'tab', tabId: 't1', tab: after }]);
  });

  it('emits nothing when a changed tab turns out identical', () => {
    const before = tab();
    expect(tabBroadcastOps(before, tab())).toEqual([]);
  });
});
