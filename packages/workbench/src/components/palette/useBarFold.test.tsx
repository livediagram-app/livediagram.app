// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { barFold, useBarFold, type BarMeasure } from './useBarFold';

// docs/specs/007-editor/toolbar-layout.md "The strip's room": a category bar still wider than its room once its names
// are gone shows its first categories and folds the rest behind More, so the strip never runs under the menu box.

// Ten 36px buttons with 2px between, from 8px in; Search and padding past the last.
const BUTTON = 36;
const ends = Array.from({ length: 10 }, (_, i) => 8 + (i + 1) * BUTTON + i * 2);
const whole: BarMeasure = { ends, trailing: 60, button: BUTTON };
const width = ends.at(-1)! + whole.trailing;

describe('barFold', () => {
  it('shows every category while the whole strip fits its room', () => {
    expect(barFold(whole, width)).toBeNull();
    expect(barFold(whole, 2000)).toBeNull();
  });

  it('folds from the end, leaving room for More', () => {
    const shown = barFold(whole, width - 1)!;
    // A pixel short: More takes the last category's place.
    expect(shown).toBe(9);
    // What shows, More and the trailing part fit the room.
    expect(ends[shown - 1]! + BUTTON + whole.trailing).toBeLessThanOrEqual(width - 1);
  });

  it('never runs past its room, however narrow', () => {
    for (let room = 0; room < width; room += 7) {
      const shown = barFold(whole, room)!;
      expect(shown).toBeGreaterThanOrEqual(0);
      if (shown > 0) expect(ends[shown - 1]! + BUTTON + whole.trailing).toBeLessThanOrEqual(room);
    }
  });

  it('shows nothing to fold with no categories', () => {
    expect(barFold({ ends: [], trailing: 60, button: BUTTON }, 10)).toBeNull();
  });
});

// The hook, at a 700px window beside a docked Contents: the joined menu box takes the strip's left.
let fire: () => void = () => {};
const MENU_RIGHT = 260;

beforeEach(() => {
  globalThis.ResizeObserver = class {
    constructor(cb: () => void) {
      fire = cb;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  const menu = document.createElement('div');
  menu.setAttribute('data-toolbar-menu', '');
  menu.setAttribute('data-menu-joined', '');
  vi.spyOn(menu, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(12, 12, MENU_RIGHT - 12, 44),
  );
  document.body.append(menu);
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

function Strip({
  enabled = true,
  categories = 'a|b',
  scale = 1,
  onShown,
}: {
  enabled?: boolean;
  categories?: string;
  scale?: number;
  onShown: (n: number | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const shown = useBarFold(ref, { enabled, categoriesKey: categories, scale });
  onShown(shown);
  const count = shown ?? ends.length;
  return (
    <div
      ref={(el) => {
        ref.current = el;
        if (el) el.getBoundingClientRect = () => new DOMRect(0, 12, width, 50);
      }}
    >
      {ends.slice(0, count).map((end, i) => (
        <button
          key={i}
          data-category-bar-button=""
          ref={(el) => {
            if (el) el.getBoundingClientRect = () => new DOMRect(end - BUTTON, 12, BUTTON, 36);
          }}
        />
      ))}
      {shown === null ? null : <button data-category-bar-button="" data-category-bar-more="" />}
    </div>
  );
}

const at = (w: number) => {
  vi.stubGlobal('innerWidth', w);
  act(() => fire());
};

describe('useBarFold', () => {
  it('keeps every category with room, and folds beside the joined menu', () => {
    vi.stubGlobal('innerWidth', 1440);
    const seen: (number | null)[] = [];
    render(<Strip onShown={(n) => seen.push(n)} />);
    expect(seen.at(-1)).toBeNull();
    at(700);
    const shown = seen.at(-1)!;
    expect(shown).not.toBeNull();
    // The room beside the joined menu box: the window less its right edge and the 8px gap, and a gap on the right.
    const room = 700 - MENU_RIGHT - 8 - 8;
    expect(ends[shown - 1]! + BUTTON + whole.trailing).toBeLessThanOrEqual(room);
    // Room again: every category comes back.
    at(1440);
    expect(seen.at(-1)).toBeNull();
  });

  it('measures afresh for other categories, and is off when disabled', () => {
    vi.stubGlobal('innerWidth', 700);
    const seen: (number | null)[] = [];
    const { rerender } = render(<Strip onShown={(n) => seen.push(n)} />);
    expect(seen.at(-1)).not.toBeNull();
    rerender(<Strip categories="c|d" onShown={(n) => seen.push(n)} />);
    act(() => fire());
    expect(seen.at(-1)).not.toBeNull();
    rerender(<Strip enabled={false} onShown={(n) => seen.push(n)} />);
    expect(seen.at(-1)).toBeNull();
  });
});
