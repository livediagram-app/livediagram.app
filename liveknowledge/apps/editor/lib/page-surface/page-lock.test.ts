import { describe, expect, it } from 'vitest';
import {
  computePageLock,
  PAGE_MIN_SCALE,
  PAGE_SIDE_ROOM,
  PAGE_SIDE_ROOM_PHONE,
  PAGE_FOOT_ROOM,
  PAGE_TOP_ROOM,
  pageFreeHeight,
  worldHeight,
} from './page-lock';

// docs/specs/030-knowledgebase/page-surface.md "A reading column": one centred column, 760 px at most, 48 px of
// room either side on a desktop and 20 px on a phone, at every window width down to 320 px.
const PAGE = { x: -428, y: -560, width: 856 };
const MARGIN = 48;
const COLUMN = PAGE.width - 2 * MARGIN;
const NO_SIDES = { left: 0, right: 0 };

// Where a canvas point stands on the surface under a view: the canvas world's own transform.
const onScreen = (
  lock: ReturnType<typeof computePageLock>,
  size: { width: number; height: number },
  p: { x: number; y: number },
) => ({
  x: lock.view.zoom * (p.x + lock.view.offset.x) + (size.width / 2) * (1 - lock.view.zoom),
  y: lock.view.zoom * (p.y + lock.view.offset.y) + (size.height / 2) * (1 - lock.view.zoom),
});

describe('computePageLock', () => {
  it('shows the column at 100%, centred, with the side room, on a desktop', () => {
    const size = { width: 1400, height: 900 };
    const lock = computePageLock({
      ...size,
      sides: NO_SIDES,
      page: PAGE,
      margin: MARGIN,
      phone: false,
    });
    expect(lock.view.zoom).toBe(1);
    expect(lock.columnWidth).toBe(COLUMN);
    expect(lock.columnWidth).toBeLessThanOrEqual(760);
    expect(lock.columnLeft).toBe((1400 - COLUMN) / 2);
    expect(lock.columnLeft).toBeGreaterThanOrEqual(PAGE_SIDE_ROOM);
    const corner = onScreen(lock, size, { x: PAGE.x, y: PAGE.y });
    expect(corner.x).toBeCloseTo(lock.left);
    expect(corner.y).toBeCloseTo(PAGE_TOP_ROOM);
  });

  it('centres the column in the room the side chrome leaves', () => {
    const size = { width: 1600, height: 900 };
    const lock = computePageLock({
      ...size,
      sides: { left: 264, right: 280 },
      page: PAGE,
      margin: MARGIN,
      phone: false,
    });
    expect(lock.view.zoom).toBe(1);
    expect(lock.columnLeft).toBe(264 + (1600 - 264 - 280 - COLUMN) / 2);
    expect(lock.columnLeft + lock.columnWidth).toBeLessThanOrEqual(1600 - 280 - PAGE_SIDE_ROOM);
  });

  it('never scales the writing up, however wide the window', () => {
    const lock = computePageLock({
      width: 3840,
      height: 2160,
      sides: NO_SIDES,
      page: PAGE,
      margin: MARGIN,
      phone: false,
    });
    expect(lock.view.zoom).toBe(1);
  });

  it.each([320, 360, 390, 430, 600, 768, 819])(
    'keeps the column inside a %i px window with its side room, nothing off the side',
    (width) => {
      const phone = width <= 640;
      const room = phone ? PAGE_SIDE_ROOM_PHONE : PAGE_SIDE_ROOM;
      const size = { width, height: 700 };
      const lock = computePageLock({ ...size, sides: NO_SIDES, page: PAGE, margin: MARGIN, phone });
      expect(lock.view.zoom).toBeLessThan(1);
      expect(lock.view.zoom).toBeGreaterThanOrEqual(PAGE_MIN_SCALE);
      expect(lock.columnLeft).toBeGreaterThanOrEqual(room - 1);
      expect(lock.columnLeft + lock.columnWidth).toBeLessThanOrEqual(width - room + 1);
      // The column's left edge is where the page's corner plus its margin lands.
      const column = onScreen(lock, size, { x: PAGE.x + MARGIN, y: PAGE.y });
      expect(column.x).toBeCloseTo(lock.columnLeft, 5);
      expect(column.y).toBeCloseTo(PAGE_TOP_ROOM, 5);
    },
  );

  it('holds the least scale in a window too narrow for anything', () => {
    const lock = computePageLock({
      width: 40,
      height: 40,
      sides: NO_SIDES,
      page: PAGE,
      margin: MARGIN,
      phone: true,
    });
    expect(lock.view.zoom).toBe(PAGE_MIN_SCALE);
  });

  it('answers the same view for the same numbers, so a lock set again tells nobody', () => {
    const input = {
      width: 1280,
      height: 800,
      sides: NO_SIDES,
      page: PAGE,
      margin: MARGIN,
      phone: false,
    };
    expect(computePageLock(input).view).toEqual(computePageLock(input).view);
  });
});

// A short page must not scroll: the canvas world's own box, moved by its transform, is something the scroll container
// scrolls to, so it is PAGE_TOP_ROOM shorter than the container and a continuous page's top stands on the canvas's
// axis (page.y 0).
describe("the world's box inside the scroll container", () => {
  it.each([
    [1440, 852],
    [1280, 672],
    [1024, 640],
    [390, 740],
    [320, 500],
  ])('never reaches past the container’s foot at %i x %i', (width, height) => {
    const size = { width, height: worldHeight(height) };
    const lock = computePageLock({
      ...size,
      sides: NO_SIDES,
      page: { x: -428, y: 0, width: 856 },
      margin: MARGIN,
      phone: width < 640,
    });
    const { zoom, offset } = lock.view;
    // The box's foot under `scale(z) translate(o)` about its centre.
    const foot = zoom * (size.height + offset.y) + (size.height / 2) * (1 - zoom);
    expect(foot).toBeLessThanOrEqual(height + 1e-6);
    // And the page's top is where the lock says: PAGE_TOP_ROOM under the top of what scrolls.
    expect(zoom * (0 + offset.y) + (size.height / 2) * (1 - zoom)).toBeCloseTo(PAGE_TOP_ROOM, 6);
  });

  it('leaves a page the window’s height less its top and foot room, in canvas px', () => {
    expect(pageFreeHeight(624, 1)).toBe(624 - PAGE_TOP_ROOM - PAGE_FOOT_ROOM);
    expect(pageFreeHeight(624, 0.5)).toBe((624 - PAGE_TOP_ROOM - PAGE_FOOT_ROOM) * 2);
    expect(pageFreeHeight(40, 1)).toBe(0);
  });
});
