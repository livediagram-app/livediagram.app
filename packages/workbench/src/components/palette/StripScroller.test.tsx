// @vitest-environment jsdom

// A swiping strip shows it swipes (docs/specs/007-editor/toolbar-layout.md "Names fit or go"): a fade and a scroll
// button at each edge with more beyond it, sized to hide the item it cuts whole, and a press moves most of a view.

import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  STRIP_SCROLL_EDGE_PX,
  StripRail,
  StripScroller,
  stripEdgeCovers,
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

describe('stripEdgeCovers', () => {
  const view = (scrollLeft: number, clientWidth = 250) => ({
    scrollLeft,
    clientWidth,
    scrollWidth: 500,
  });

  it("covers the item an edge cuts whole, from that item's near side to the edge", () => {
    // 0..250: the item at 200 is cut, so the end fade reaches back to its start.
    expect(stripEdgeCovers(view(0), items)).toEqual({ start: 0, end: 50 });
    // 120..370: the item at 100 is cut at the start, the one at 300 at the end.
    expect(stripEdgeCovers(view(120), items)).toEqual({ start: 80, end: 70 });
  });

  it("covers an item under the button's room too, and never less than that room", () => {
    // 0..230: the item at 100..200 ends under the button (186..230), so it is covered with the one at 200.
    expect(stripEdgeCovers(view(0, 230), items).end).toBe(130);
    // Nothing to cover (no items given): the button's room alone.
    expect(stripEdgeCovers(view(0), [])).toEqual({ start: 0, end: STRIP_SCROLL_EDGE_PX });
    expect(stripEdgeCovers(view(250), [])).toEqual({ start: STRIP_SCROLL_EDGE_PX, end: 0 });
  });

  it('never takes more than the view less the other edge, and nothing where it all fits', () => {
    const wide = [{ offsetLeft: 0, offsetWidth: 500 }];
    expect(stripEdgeCovers(view(0, 100), wide).end).toBe(100 - STRIP_SCROLL_EDGE_PX);
    expect(stripEdgeCovers({ scrollLeft: 0, clientWidth: 250, scrollWidth: 250 }, items)).toEqual({
      start: 0,
      end: 0,
    });
  });
});

// The phone's palette bar: 177px wide, its items 48 to 66px with small gaps.
const phone = [0, 52, 110, 175, 240, 300, 362].map((offsetLeft, i) => ({
  offsetLeft,
  offsetWidth: [48, 54, 61, 61, 56, 58, 66][i]!,
}));
const PHONE = { clientWidth: 177, scrollWidth: 428 };

// Every item either shows whole, clear of both fades, or lies wholly under one.
function noneShowCut(scrollLeft: number) {
  const el = { scrollLeft, ...PHONE };
  const { start, end } = stripEdgeCovers(el, phone);
  const shownFrom = scrollLeft + start;
  const shownTo = scrollLeft + PHONE.clientWidth - end;
  for (const item of phone) {
    const right = item.offsetLeft + item.offsetWidth;
    // A pixel of slack, as stripOverflowOf allows.
    const whole = item.offsetLeft >= shownFrom - 1 && right <= shownTo + 1;
    const covered = (start > 0 && right <= shownFrom) || (end > 0 && item.offsetLeft >= shownTo);
    const outside = right <= scrollLeft || item.offsetLeft >= scrollLeft + PHONE.clientWidth;
    expect(whole || covered || outside, `${scrollLeft}: item at ${item.offsetLeft}`).toBe(true);
  }
}

describe('a phone-width bar', () => {
  it('never shows a label cut, wherever it is scrolled', () => {
    for (let scrollLeft = 0; scrollLeft <= 251; scrollLeft += 1) noneShowCut(scrollLeft);
  });

  it('walks every item into view, press by press, both ways, each press past everything shown', () => {
    const seen = new Set<number>();
    const note = (scrollLeft: number) => {
      const { start, end } = stripEdgeCovers({ scrollLeft, ...PHONE }, phone);
      for (const item of phone)
        if (
          item.offsetLeft >= scrollLeft + start &&
          item.offsetLeft + item.offsetWidth <= scrollLeft + PHONE.clientWidth - end
        )
          seen.add(item.offsetLeft);
    };
    let at = 0;
    note(at);
    const max = PHONE.scrollWidth - PHONE.clientWidth;
    for (let presses = 0; at < max && presses < 10; presses++) {
      const to = Math.min(max, stripScrollTarget({ scrollLeft: at, ...PHONE }, phone, 'end'));
      expect(to).toBeGreaterThan(at);
      at = to;
      note(at);
    }
    expect(at).toBe(max);
    expect([...seen].sort((a, b) => a - b)).toEqual(phone.map((i) => i.offsetLeft));
    seen.clear();
    note(at);
    for (let presses = 0; at > 0 && presses < 10; presses++) {
      const to = Math.max(0, stripScrollTarget({ scrollLeft: at, ...PHONE }, phone, 'start'));
      expect(to).toBeLessThan(at);
      at = to;
      note(at);
    }
    expect(at).toBe(0);
    expect([...seen].sort((a, b) => a - b)).toEqual(phone.map((i) => i.offsetLeft));
  });
});

describe('stripScrollTarget', () => {
  it('lands the item the fade hid first, whole, past the other edge', () => {
    // 0..250: the end fade hides the item at 200; a press lays it just past the start's button room.
    expect(stripScrollTarget({ scrollLeft: 0, clientWidth: 250 }, items, 'end')).toBe(
      200 - STRIP_SCROLL_EDGE_PX,
    );
    // Back from 300: the start fade hides the item at 300..400; it lands just before the end's button room.
    expect(stripScrollTarget({ scrollLeft: 300, clientWidth: 250 }, items, 'start')).toBe(
      400 + STRIP_SCROLL_EDGE_PX - 250,
    );
  });

  it('pages by the view less both buttons where no item is hidden', () => {
    expect(stripScrollTarget({ scrollLeft: 0, clientWidth: 400 }, [], 'end')).toBe(312);
    expect(stripScrollTarget({ scrollLeft: 400, clientWidth: 400 }, [], 'start')).toBe(88);
    // An item wider than the view still moves on.
    const wide = [{ offsetLeft: 0, offsetWidth: 900 }];
    expect(stripScrollTarget({ scrollLeft: 0, clientWidth: 400 }, wide, 'end')).toBe(312);
    expect(stripScrollTarget({ scrollLeft: 400, clientWidth: 400 }, wide, 'start')).toBe(88);
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
    // A press never takes the focus from where it was.
    expect(fireEvent.pointerDown(getByRole('button', { name: 'Scroll Left' }))).toBe(false);
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
