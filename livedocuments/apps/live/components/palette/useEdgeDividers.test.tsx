// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { useRef } from 'react';
import { afterAll, describe, expect, it } from 'vitest';
import { STRIP_DIVIDER_ATTR, useEdgeDividers } from './useEdgeDividers';

// A swiping strip's dividers (docs/specs/007-editor/toolbar-layout.md "On a phone"): one shows
// only while a tile on each side of it is in view.

globalThis.ResizeObserver ??= class {
  observe() {}
  disconnect() {}
  unobserve() {}
} as unknown as typeof ResizeObserver;

// jsdom lays nothing out: each item's place and the rail's view are set by hand. Tiles are 40px
// wide, one after another; the rail shows 100px.
const TILE = 40;
const VIEW = 100;

function Rail({ count, dividersAfter }: { count: number; dividersAfter: number[] }) {
  const rail = useRef<HTMLDivElement>(null);
  useEdgeDividers(rail, true, `${count}`);
  return (
    <div ref={rail} data-testid="rail">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} data-rail-key={`t${i}`} data-i={i}>
          tile {i}
          {dividersAfter.includes(i) ? (
            <span data-testid={`divider-${i}`} {...{ [STRIP_DIVIDER_ATTR]: '' }} />
          ) : null}
        </span>
      ))}
    </div>
  );
}

function place() {
  for (const el of document.querySelectorAll<HTMLElement>('[data-rail-key]')) {
    const i = Number(el.dataset.i);
    Object.defineProperty(el, 'offsetLeft', { value: i * TILE, configurable: true });
    Object.defineProperty(el, 'offsetWidth', { value: TILE, configurable: true });
  }
}

function setup(scrollLeft: number) {
  // The hook measures on mount, so the layout is defined on the prototype first.
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { value: VIEW, configurable: true });
  const view = render(<Rail count={6} dividersAfter={[1, 3]} />);
  place();
  const rail = view.getByTestId('rail');
  rail.scrollLeft = scrollLeft;
  rail.dispatchEvent(new Event('scroll'));
  return view;
}

const shown = (el: HTMLElement) => el.style.visibility !== 'hidden';

afterAll(() => {
  delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
});

describe('useEdgeDividers', () => {
  it('hides a divider whose next tile is scrolled out of view', () => {
    // In view: tiles 0 to 2 (0..100px). Divider after tile 1 sits between two visible tiles;
    // the one after tile 3 has nothing in view on either side.
    const view = setup(0);
    expect(shown(view.getByTestId('divider-1'))).toBe(true);
    expect(shown(view.getByTestId('divider-3'))).toBe(false);
  });

  it('shows it again once the tiles on both sides scroll into view', () => {
    // In view: 100..200px, tiles 2 to 4.
    const view = setup(100);
    expect(shown(view.getByTestId('divider-1'))).toBe(false);
    expect(shown(view.getByTestId('divider-3'))).toBe(true);
  });
});
