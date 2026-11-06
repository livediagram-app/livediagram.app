import { describe, expect, it } from 'vitest';
import { createPinnedArrow, createShape, type Element } from '@livehuddle/document';
import { cleanupElements, lockedElementIds } from './tab-cleanup';

// docs/specs/008-canvas/layout-cleanup.md "Locked elements stay put": Auto-align never moves or
// resizes a locked element.

const at = (id: string, x: number, y: number, extra: Partial<Element> = {}): Element =>
  ({ ...createShape('square', x, y), id, width: 123, height: 57, ...extra }) as Element;
const link = (from: string, to: string): Element => ({
  ...createPinnedArrow(from, 's', to, 'n'),
  id: `arr-${from}-${to}`,
});

const elements = (): Element[] => [
  at('a', 3, 7),
  at('b', 403, 207),
  at('own-lock', 803, 13, { locked: true }),
  link('a', 'b'),
  link('b', 'own-lock'),
];

describe('cleanup leaves locked elements alone', () => {
  it('keeps locked elements in place', () => {
    const before = elements();
    const after = cleanupElements(before);
    const byId = new Map(after.map((e) => [e.id, e]));
    expect(byId.get('own-lock')).toBe(before[2]);
    // Something unlocked still moved, so the cleanup ran.
    expect(byId.get('a')).not.toEqual(before[0]);
  });

  it('leaves an empty tab as it is', () => {
    const none: Element[] = [];
    expect(cleanupElements(none)).toBe(none);
  });

  it('collects element locks', () => {
    expect([...lockedElementIds(elements())]).toEqual(['own-lock']);
  });

  it('collects nothing when nothing is locked', () => {
    expect(lockedElementIds([at('a', 0, 0)]).size).toBe(0);
  });
});
