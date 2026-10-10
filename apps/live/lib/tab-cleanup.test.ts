import { describe, expect, it } from 'vitest';
import { createPinnedArrow, createShape, type Element, type Layer } from '@livediagram/document';
import { cleanupElements, lockedElementIds } from './tab-cleanup';

// docs/specs/008-canvas/layout-cleanup.md "Locked elements stay put": neither cleanup moves or
// resizes a locked element, or anything on a locked layer.

const at = (id: string, x: number, y: number, extra: Partial<Element> = {}): Element =>
  ({ ...createShape('square', x, y), id, width: 123, height: 57, ...extra }) as Element;
const link = (from: string, to: string): Element => ({
  ...createPinnedArrow(from, 's', to, 'n'),
  id: `arr-${from}-${to}`,
});

const LAYERS: Layer[] = [
  { id: 'base', name: 'Layer 1' },
  { id: 'frozen', name: 'Frozen', locked: true },
];

const elements = (): Element[] => [
  at('a', 3, 7),
  at('b', 403, 207),
  at('own-lock', 803, 13, { locked: true }),
  at('layer-lock', 1203, 413, { layerId: 'frozen' }),
  link('a', 'b'),
  link('b', 'own-lock'),
  link('own-lock', 'layer-lock'),
];

describe('cleanup leaves locked elements alone', () => {
  for (const kind of ['align', 'smart', 'tree', 'mindmap'] as const) {
    it(`${kind} keeps locked and locked-layer elements in place`, () => {
      const before = elements();
      const after = cleanupElements(before, kind, LAYERS);
      const byId = new Map(after.map((e) => [e.id, e]));
      expect(byId.get('own-lock')).toBe(before[2]);
      expect(byId.get('layer-lock')).toBe(before[3]);
      // Something unlocked still moved, so the cleanup ran.
      expect(byId.get('a')).not.toEqual(before[0]);
    });
  }

  it('collects element locks and layer locks', () => {
    expect([...lockedElementIds(elements(), LAYERS)].sort()).toEqual(['layer-lock', 'own-lock']);
  });

  it('collects nothing when nothing is locked', () => {
    expect(lockedElementIds([at('a', 0, 0)], undefined).size).toBe(0);
  });
});
