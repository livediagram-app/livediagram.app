// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { useBarLabels } from './useBarLabels';

// Whether the category bar names its categories (docs/specs/007-editor/toolbar-layout.md "The category bar"): from
// the strip's width with names against the room the menu card leaves it on both sides.

let fire: () => void = () => {};
let window_ = 1440;
const MENU_RIGHT = 200;

beforeEach(() => {
  globalThis.ResizeObserver = class {
    constructor(cb: () => void) {
      fire = cb;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  window_ = 1440;
  const menu = document.createElement('div');
  menu.setAttribute('data-toolbar-menu', '');
  vi.spyOn(menu, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(12, 12, MENU_RIGHT - 12, 44),
  );
  document.body.append(menu);
  vi.stubGlobal('innerWidth', window_);
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

// A strip whose card is `named` px wide with names and `bare` px without.
function Strip({
  named,
  bare,
  keyName = 'a',
  enabled = true,
  onLabels,
}: {
  named: number;
  bare: number;
  keyName?: string;
  enabled?: boolean;
  onLabels: (on: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const labels = useBarLabels(ref, { enabled, categoriesKey: keyName, scale: 1 });
  onLabels(labels);
  return (
    <div
      ref={(el) => {
        ref.current = el;
        if (el)
          el.getBoundingClientRect = () =>
            new DOMRect(0, 12, el.dataset.labels === 'on' ? named : bare, 50);
      }}
      data-labels={labels ? 'on' : 'off'}
    />
  );
}

function resize(width: number) {
  window_ = width;
  vi.stubGlobal('innerWidth', width);
  act(() => fire());
}

describe('the category bar’s names', () => {
  it('shows them while the named strip fits between the menu card on both sides', () => {
    const seen: boolean[] = [];
    // Room: 1440 less (200 + 8) on each side = 1024.
    render(<Strip named={1000} bare={500} onLabels={(on) => seen.push(on)} />);
    expect(seen.at(-1)).toBe(true);
  });

  it('drops them once the named strip no longer fits, and brings them back when it does', () => {
    const seen: boolean[] = [];
    render(<Strip named={1000} bare={500} onLabels={(on) => seen.push(on)} />);
    resize(1200);
    expect(seen.at(-1)).toBe(false);
    // Narrower still: no flicker back on.
    resize(1100);
    expect(seen.at(-1)).toBe(false);
    resize(1440);
    expect(seen.at(-1)).toBe(true);
  });

  it('is off where the bar is not one (a phone, another mode)', () => {
    const seen: boolean[] = [];
    render(<Strip named={100} bare={50} enabled={false} onLabels={(on) => seen.push(on)} />);
    expect(seen.every((on) => !on)).toBe(true);
  });

  it('measures the names afresh for another set of categories', () => {
    const seen: boolean[] = [];
    const view = render(<Strip named={1300} bare={500} onLabels={(on) => seen.push(on)} />);
    expect(seen.at(-1)).toBe(false);
    view.rerender(<Strip named={900} bare={500} keyName="b" onLabels={(on) => seen.push(on)} />);
    act(() => fire());
    expect(seen.at(-1)).toBe(true);
  });
});
