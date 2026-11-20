// Where a knowledgebase page stands on screen (docs/specs/030-knowledgebase/page-surface.md "What a page looks
// like"; blueprint: docs/specs/030-knowledgebase/blueprints/page-surface.md "The lock"). The canvas engine still
// draws the page, but its view is never a person's to move: one fixed view puts the writing's column in the middle
// of the room there is, at 100%, and the window scrolls down it. Pure: the numbers in, the view out.
import type { View } from '@liveworkspace/workbench/lib/viewport-store';

/** Screen px of room either side of the writing's column: on a desktop, and on a phone. */
export const PAGE_SIDE_ROOM = 48;
export const PAGE_SIDE_ROOM_PHONE = 20;
/** Screen px between the top of what scrolls (under the top row) and the page's own top. */
export const PAGE_TOP_ROOM = 24;
/** Screen px left under the page's foot, so its last line never sits on the window's edge. */
export const PAGE_FOOT_ROOM = 96;
/** The least the page is ever scaled to: a window narrower than this allows is narrower than any phone. */
export const PAGE_MIN_SCALE = 0.25;

export type PageLockInput = {
  /** The surface's size on screen (the canvas element's layout box). */
  width: number;
  height: number;
  /** Screen px of chrome standing over the surface's left and right (a sidebar, the rail). */
  sides: { left: number; right: number };
  /** The page's sheet in canvas px, and its side margin (the room its writing keeps inside it). */
  page: { x: number; y: number; width: number };
  margin: number;
  phone: boolean;
};

export type PageLock = {
  view: View;
  /** The page's left and top on the surface, screen px. */
  left: number;
  top: number;
  /** The writing's column on the surface: its left and its width, screen px. */
  columnLeft: number;
  columnWidth: number;
};

/**
 * The one view a page is shown at. The column (the page less its margins) is centred in the room the side chrome
 * leaves, at 100% while that room holds it with the spec's side room, scaled down to fit when it does not (a narrow
 * window, a phone); never scaled up. The canvas world's transform is `scale(z) translate(o)` about the surface's
 * centre, so a canvas point p stands at `z * (p + o) + (size / 2) * (1 - z)`; the offset is that solved for the
 * page's corner.
 */
export function computePageLock(input: PageLockInput): PageLock {
  const { width, height, sides, page, margin, phone } = input;
  const room = phone ? PAGE_SIDE_ROOM_PHONE : PAGE_SIDE_ROOM;
  const available = Math.max(1, width - sides.left - sides.right);
  const column = Math.max(1, page.width - 2 * margin);
  const fit = (available - 2 * room) / column;
  const zoom = Math.max(PAGE_MIN_SCALE, Math.min(1, Number.isFinite(fit) ? fit : 1));
  const columnWidth = column * zoom;
  // Whole px, so the writing's glyphs land on the pixel grid.
  const columnLeft = Math.round(sides.left + (available - columnWidth) / 2);
  const left = columnLeft - margin * zoom;
  const top = PAGE_TOP_ROOM;
  return {
    view: {
      zoom,
      offset: {
        x: (left - (width / 2) * (1 - zoom)) / zoom - page.x,
        y: (top - (height / 2) * (1 - zoom)) / zoom - page.y,
      },
    },
    left,
    top,
    columnLeft,
    columnWidth,
  };
}

export const sameView = (a: View, b: View): boolean =>
  a.zoom === b.zoom && a.offset.x === b.offset.x && a.offset.y === b.offset.y;
