// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { KeyboardEvent } from 'react';
import { moveAmongTiles, stepFrom } from './gallery-keys';

// docs/specs/026-plan/board-widgets.md "Keyboard", item-types.md "Fields and Tabs": Add Field: the galleries' tile keys.
function tiles(n: number, laidOut = true): HTMLButtonElement[] {
  return Array.from({ length: n }, (_, i) => {
    const b = document.createElement('button');
    document.body.append(b);
    if (laidOut)
      b.getBoundingClientRect = () =>
        ({
          top: Math.floor(i / 2) * 100,
          bottom: Math.floor(i / 2) * 100 + 90,
          left: (i % 2) * 200,
          height: 90,
        }) as DOMRect;
    return b;
  });
}

const press = (key: string) => {
  let prevented = false;
  const e = { key, preventDefault: () => (prevented = true) } as unknown as KeyboardEvent;
  return { e, prevented: () => prevented };
};

describe('stepFrom', () => {
  it('moves by where the tiles sit, and says when Up leaves the top row', () => {
    const t = tiles(5);
    expect(stepFrom(t, 0, 'ArrowRight')).toBe(1);
    expect(stepFrom(t, 4, 'ArrowRight')).toBe(4);
    expect(stepFrom(t, 0, 'ArrowLeft')).toBe(0);
    expect(stepFrom(t, 1, 'ArrowDown')).toBe(3);
    // The last row is short: down from its right column lands on the nearest below.
    expect(stepFrom(t, 3, 'ArrowDown')).toBe(4);
    expect(stepFrom(t, 4, 'ArrowDown')).toBe(4);
    expect(stepFrom(t, 3, 'ArrowUp')).toBe(1);
    expect(stepFrom(t, 1, 'ArrowUp')).toBe(-1);
  });

  it('steps two at a time with no layout', () => {
    const t = tiles(5, false);
    expect(stepFrom(t, 1, 'ArrowDown')).toBe(3);
    expect(stepFrom(t, 4, 'ArrowDown')).toBe(4);
    expect(stepFrom(t, 2, 'ArrowUp')).toBe(0);
    expect(stepFrom(t, 1, 'ArrowUp')).toBe(-1);
  });
});

describe('moveAmongTiles', () => {
  it('focuses the next tile, the first and last, and the search off the top row', () => {
    const t = tiles(4);
    const search = document.createElement('input');
    document.body.append(search);
    t[0]!.focus();
    const end = press('End');
    moveAmongTiles(end.e, t, search);
    expect(document.activeElement).toBe(t[3]);
    expect(end.prevented()).toBe(true);
    moveAmongTiles(press('Home').e, t, search);
    expect(document.activeElement).toBe(t[0]);
    moveAmongTiles(press('ArrowUp').e, t, search);
    expect(document.activeElement).toBe(search);
  });

  it('leaves other keys, focus outside the tiles, and no search alone', () => {
    const t = tiles(2);
    t[0]!.focus();
    const other = press('a');
    moveAmongTiles(other.e, t, null);
    expect(other.prevented()).toBe(false);
    const up = press('ArrowUp');
    moveAmongTiles(up.e, t, null);
    expect(up.prevented()).toBe(false);
    expect(document.activeElement).toBe(t[0]);
    (document.activeElement as HTMLElement).blur();
    const off = press('ArrowDown');
    moveAmongTiles(off.e, t, null);
    expect(off.prevented()).toBe(false);
  });
});
