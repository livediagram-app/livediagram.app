// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { KeyboardEvent } from 'react';
import { firstStop, flyoutKeyTarget, onFlyoutArrowKey, sideRowFor } from './category-flyout-keys';

// The category flyout's keyboard (each editor's docs/specs/007-editor/toolbar-layout.md "Opening a flyout" and "A
// tile's side panel"), every editor's one copy.

afterEach(() => {
  document.body.innerHTML = '';
});

describe('arrow keys in a flyout', () => {
  // Two rows of three, then a lone fourth row item under the middle.
  const points = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 200, y: 0 },
    { x: 0, y: 60 },
    { x: 100, y: 60 },
    { x: 200, y: 60 },
    { x: 110, y: 140 },
  ];

  it('steps through the list with Left and Right, stopping at the ends', () => {
    expect(flyoutKeyTarget('ArrowRight', 0, points)).toBe(1);
    expect(flyoutKeyTarget('ArrowRight', 6, points)).toBeNull();
    expect(flyoutKeyTarget('ArrowLeft', 3, points)).toBe(2);
    expect(flyoutKeyTarget('ArrowLeft', 0, points)).toBeNull();
  });

  it('moves a row with Up and Down, to the nearest item, across groups', () => {
    expect(flyoutKeyTarget('ArrowDown', 1, points)).toBe(4);
    expect(flyoutKeyTarget('ArrowDown', 5, points)).toBe(6);
    expect(flyoutKeyTarget('ArrowUp', 6, points)).toBe(4);
    expect(flyoutKeyTarget('ArrowUp', 0, points)).toBeNull();
    expect(flyoutKeyTarget('ArrowDown', 6, points)).toBeNull();
  });

  it('jumps to the ends with Home and End, and ignores other keys', () => {
    expect(flyoutKeyTarget('Home', 4, points)).toBe(0);
    expect(flyoutKeyTarget('End', 0, points)).toBe(6);
    expect(flyoutKeyTarget('Enter', 0, points)).toBeNull();
    expect(flyoutKeyTarget('ArrowRight', 0, [])).toBeNull();
    expect(flyoutKeyTarget('ArrowRight', 9, points)).toBeNull();
  });
});

// A body of items at known places: two in a row, a third under the first.
function body() {
  const el = document.createElement('div');
  const places = [
    [0, 0],
    [100, 0],
    [0, 60],
  ] as const;
  const items = places.map(([x, y]) => {
    const b = document.createElement('button');
    b.setAttribute('data-flyout-item', '');
    vi.spyOn(b, 'getBoundingClientRect').mockReturnValue(new DOMRect(x, y, 40, 40));
    el.append(b);
    return b;
  });
  document.body.append(el);
  return { el, items };
}

const key = (k: string, target: unknown = document.activeElement) => {
  const preventDefault = vi.fn();
  return {
    e: { key: k, target, preventDefault } as unknown as KeyboardEvent<HTMLElement>,
    preventDefault,
  };
};

describe('onFlyoutArrowKey', () => {
  it('moves the focus by position and takes the key', () => {
    const { el, items } = body();
    items[0]!.focus();
    const down = key('ArrowDown');
    onFlyoutArrowKey(down.e, el);
    expect(document.activeElement).toBe(items[2]);
    expect(down.preventDefault).toHaveBeenCalled();
  });

  it('leaves the key alone at an end, off an item, or without a body', () => {
    const { el, items } = body();
    items[2]!.focus();
    const right = key('ArrowRight');
    onFlyoutArrowKey(right.e, el);
    expect(document.activeElement).toBe(items[2]);
    expect(right.preventDefault).not.toHaveBeenCalled();
    items[2]!.blur();
    const off = key('ArrowLeft');
    onFlyoutArrowKey(off.e, el);
    expect(off.preventDefault).not.toHaveBeenCalled();
    const none = key('ArrowLeft');
    onFlyoutArrowKey(none.e, null);
    expect(none.preventDefault).not.toHaveBeenCalled();
  });
});

describe('sideRowFor', () => {
  const tiles = [{ id: 'card' }, { id: 'square' }];
  const row = (id?: string) => {
    const b = document.createElement('button');
    if (id) b.dataset.sideRow = id;
    return b;
  };

  it('finds the side-panel tile ArrowRight is pressed on', () => {
    const el = row('card');
    expect(sideRowFor(key('ArrowRight', el).e, tiles)).toEqual({ def: tiles[0], el });
  });

  it('is nothing for another key, a tile without a panel, an unknown one, or no tiles', () => {
    expect(sideRowFor(key('ArrowDown', row('card')).e, tiles)).toBeNull();
    expect(sideRowFor(key('ArrowRight', row()).e, tiles)).toBeNull();
    expect(sideRowFor(key('ArrowRight', row('gone')).e, tiles)).toBeNull();
    expect(sideRowFor(key('ArrowRight', row('card')).e, null)).toBeNull();
    expect(sideRowFor(key('ArrowRight', {}).e, tiles)).toBeNull();
  });
});

describe('firstStop', () => {
  it('is the first card, else the first control, else nothing', () => {
    const el = document.createElement('div');
    expect(firstStop(null)).toBeNull();
    expect(firstStop(el)).toBeNull();
    const input = document.createElement('input');
    el.append(input);
    expect(firstStop(el)).toBe(input);
    const card = document.createElement('button');
    card.setAttribute('data-flyout-item', '');
    el.append(card);
    expect(firstStop(el)).toBe(card);
  });
});
