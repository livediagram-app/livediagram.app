// @vitest-environment jsdom

// A swiping strip shows it swipes (docs/specs/007-editor/toolbar-layout.md "Names fit or go"): a fade and a scroll
// button at each edge with more beyond it, and a press brings the next whole item past the edge.

import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  STRIP_SCROLL_EDGE_PX,
  StripRail,
  StripScroller,
  stripOverflowOf,
  stripScrollTarget,
} from './StripScroller';

afterEach(cleanup);

// Five 100px items in a 250px window.
const items = [0, 100, 200, 300, 400].map((offsetLeft) => ({ offsetLeft, offsetWidth: 100 }));

describe('stripOverflowOf', () => {
  it('says which edges have more beyond them', () => {
    expect(stripOverflowOf({ scrollLeft: 0, scrollWidth: 250, clientWidth: 250 })).toEqual({
      start: false,
      end: false,
    });
    expect(stripOverflowOf({ scrollLeft: 0, scrollWidth: 500, clientWidth: 250 })).toEqual({
      start: false,
      end: true,
    });
    expect(stripOverflowOf({ scrollLeft: 120, scrollWidth: 500, clientWidth: 250 })).toEqual({
      start: true,
      end: true,
    });
    expect(stripOverflowOf({ scrollLeft: 250, scrollWidth: 500, clientWidth: 250 })).toEqual({
      start: true,
      end: false,
    });
    // A fraction of a pixel to spare is no overflow.
    expect(stripOverflowOf({ scrollLeft: 0, scrollWidth: 250.6, clientWidth: 250 })).toEqual({
      start: false,
      end: false,
    });
  });
});

describe('stripScrollTarget', () => {
  it('lays the first item the far edge cuts whole past the fade', () => {
    // Visible 0..206 before the fade: the item at 200 is cut, so it lands at the start, past the start fade.
    expect(stripScrollTarget({ scrollLeft: 0, clientWidth: 250 }, items, 'end')).toBe(
      200 - STRIP_SCROLL_EDGE_PX,
    );
    // Back: the item the start fade cuts (100..200 from 150) ends just before the end fade.
    expect(stripScrollTarget({ scrollLeft: 150, clientWidth: 250 }, items, 'start')).toBe(
      200 - 250 + STRIP_SCROLL_EDGE_PX,
    );
  });

  it('pages by the window where no item is cut', () => {
    expect(stripScrollTarget({ scrollLeft: 0, clientWidth: 250 }, [], 'end')).toBe(250);
    expect(stripScrollTarget({ scrollLeft: 300, clientWidth: 250 }, [], 'start')).toBe(50);
  });
});

// jsdom lays nothing out: the scroller's sizes are set by hand.
function sized(el: HTMLElement, size: { scrollWidth: number; clientWidth: number }) {
  Object.defineProperty(el, 'scrollWidth', { configurable: true, value: size.scrollWidth });
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: size.clientWidth });
}

describe('StripScroller', () => {
  it('shows the end edge while there is more, then both, and scrolls on a press', () => {
    const { container, getByRole, rerender } = render(
      <StripScroller label="Palette categories" itemsKey="a">
        <button type="button">A</button>
        <button type="button">B</button>
      </StripScroller>,
    );
    const scroller = getByRole('toolbar', { name: 'Palette categories' });
    sized(scroller, { scrollWidth: 500, clientWidth: 250 });
    // A new set of items is measured at once.
    rerender(
      <StripScroller label="Palette categories" itemsKey="a,b">
        <button type="button">A</button>
        <button type="button">B</button>
      </StripScroller>,
    );
    expect(container.querySelector('[data-strip-edge="end"]')).not.toBeNull();
    expect(container.querySelector('[data-strip-edge="start"]')).toBeNull();
    scroller.scrollTo = vi.fn();
    fireEvent.click(getByRole('button', { name: 'Scroll Right' }));
    expect(scroller.scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ left: expect.any(Number) }),
    );
    act(() => {
      scroller.scrollLeft = 120;
      fireEvent.scroll(scroller);
    });
    expect(container.querySelector('[data-strip-edge="start"]')).not.toBeNull();
    fireEvent.click(getByRole('button', { name: 'Scroll Left' }));
    expect(scroller.scrollTo).toHaveBeenCalledTimes(2);
    // The buttons stay out of the Tab order: the arrow keys walk the bar.
    expect(getByRole('button', { name: 'Scroll Left' }).tabIndex).toBe(-1);
  });

  it('is a plain toolbar where the strip fits', () => {
    const { container, getByRole } = render(
      <StripRail scrollable={false} label="Palette categories" itemsKey="a">
        <button type="button">A</button>
      </StripRail>,
    );
    expect(getByRole('toolbar', { name: 'Palette categories' })).toBeTruthy();
    expect(container.querySelector('[data-strip-rail]')).toBeNull();
    cleanup();
    const swiping = render(
      <StripRail scrollable label="Palette categories" itemsKey="a">
        <button type="button">A</button>
      </StripRail>,
    );
    expect(swiping.container.querySelector('[data-strip-rail]')).not.toBeNull();
  });
});
