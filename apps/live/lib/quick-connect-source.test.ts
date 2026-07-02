import { type Element, type ShapeElement } from '@livediagram/diagram';
import { describe, expect, it } from 'vitest';
import { quickConnectGroupStart, quickConnectSourceId } from './quick-connect-source';

const box = (id: string, overrides: Partial<ShapeElement> = {}): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 60,
  ...overrides,
});

describe('quickConnectSourceId', () => {
  it('returns the element itself for an ungrouped selection', () => {
    const els: Element[] = [box('a'), box('b', { x: 200 })];
    expect(quickConnectSourceId(els, 'a', 'right')).toBe('a');
  });

  it('picks the group member nearest the picked side', () => {
    // Two-column group: a on the left, b on the right.
    const els: Element[] = [
      box('a', { groupId: 'g' }),
      box('b', { x: 300, groupId: 'g' }),
      box('loose', { y: 500 }),
    ];
    // Selecting either member, the right-side plus pins to b, left to a.
    expect(quickConnectSourceId(els, 'a', 'right')).toBe('b');
    expect(quickConnectSourceId(els, 'b', 'right')).toBe('b');
    expect(quickConnectSourceId(els, 'b', 'left')).toBe('a');
  });

  it('resolves above/below against the vertical layout', () => {
    const els: Element[] = [box('top', { groupId: 'g' }), box('bottom', { y: 300, groupId: 'g' })];
    expect(quickConnectSourceId(els, 'top', 'below')).toBe('bottom');
    expect(quickConnectSourceId(els, 'bottom', 'above')).toBe('top');
  });
});

describe('quickConnectGroupStart', () => {
  it('returns the union side midpoint for a group, null for a lone element', () => {
    const els: Element[] = [box('a', { groupId: 'g' }), box('b', { x: 300, groupId: 'g' })];
    // Union spans x 0..400, y 0..60; the groupId rides along so the
    // arrow can pin to the group's union box (spec/09).
    expect(quickConnectGroupStart(els, 'a', 'right')).toEqual({ groupId: 'g', x: 400, y: 30 });
    expect(quickConnectGroupStart(els, 'a', 'below')).toEqual({ groupId: 'g', x: 200, y: 60 });
    expect(quickConnectGroupStart([box('solo')], 'solo', 'right')).toBeNull();
  });
});
