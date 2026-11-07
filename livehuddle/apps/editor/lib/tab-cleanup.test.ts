import { describe, expect, it } from 'vitest';
import { createPinnedArrow, createShape, type Element } from '@livehuddle/document';
import { cleanupElements } from './tab-cleanup';

// docs/specs/008-canvas/layout-cleanup.md: Auto-align grid-snaps the whole tab. An element saved locked before
// locking left (docs/specs/002-project-scope/not-in-livehuddle.md "Element and Tab Locking") snaps like any other.

const at = (id: string, x: number, y: number, extra: Record<string, unknown> = {}): Element => ({
  ...createShape('square', x, y),
  id,
  width: 123,
  height: 57,
  ...extra,
});
const link = (from: string, to: string): Element => ({
  ...createPinnedArrow(from, 's', to, 'n'),
  id: `arr-${from}-${to}`,
});

describe('cleanupElements', () => {
  it('snaps every box, one saved locked included', () => {
    const before = [
      at('a', 3, 7),
      at('b', 403, 207),
      at('old-lock', 803, 13, { locked: true }),
      link('a', 'b'),
      link('b', 'old-lock'),
    ];
    const byId = new Map(cleanupElements(before).map((e) => [e.id, e]));
    expect(byId.get('a')).not.toEqual(before[0]);
    expect(byId.get('old-lock')).not.toBe(before[2]);
    expect(byId.get('old-lock')).toMatchObject({ x: 800, y: 10 });
  });

  it('leaves an empty tab as it is', () => {
    const none: Element[] = [];
    expect(cleanupElements(none)).toBe(none);
  });
});
