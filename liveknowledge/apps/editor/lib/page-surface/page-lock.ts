// Where a knowledgebase page stands on screen (docs/specs/030-knowledgebase/page-surface.md "What a page looks
// like"; blueprint: docs/specs/030-knowledgebase/blueprints/page-surface.md "The lock"). The canvas engine still
// draws the page, but its view is never a person's to move: one fixed view puts the writing's column in the middle
// of the room there is, at 100% always, and the window scrolls down it. Pure: the numbers in, the view out.
import type { View } from '@liveworkspace/workbench/lib/viewport-store';

/** Screen px of room either side of the writing's column: on a desktop, and on a phone. */
export const PAGE_SIDE_ROOM = 48;
export const PAGE_SIDE_ROOM_PHONE = 20;
/** Screen px between the top of what scrolls (under the top row) and the page's own top. */
export const PAGE_TOP_ROOM = 24;
/** Screen px left under the page's foot, so its last line never sits on the window's edge. */
export const PAGE_FOOT_ROOM = 96;
/** A page cover's band (docs/specs/030-knowledgebase/page-surface.md "The cover"): screen px tall on a desktop and
 *  on a phone, over the page's top room. Screen px, never scaled with the page. */
export const COVER_HEIGHT = 220;
export const COVER_HEIGHT_PHONE = 140;
/** Screen px between a cover's band and the page's first line (owner, 2026-11-21: "too much space between cover and
 *  title"): the page's blank top margin tucks under the band, so the Title stands this far below it. */
export const COVER_TITLE_GAP = 36;
/** The band's height for a page with a cover or none. */
export const coverHeightOf = (hasCover: boolean, phone: boolean): number =>
  hasCover ? (phone ? COVER_HEIGHT_PHONE : COVER_HEIGHT) : 0;
/** What the scroll container carries for the band: its height, and where the side chrome leaves it to stand. */
export const PAGE_COVER_HEIGHT_VAR = '--page-cover-height';
export const PAGE_COVER_LEFT_VAR = '--page-cover-left';
export const PAGE_COVER_RIGHT_VAR = '--page-cover-right';
export type PageLockInput = {
  /** The surface's size on screen (the canvas element's layout box). The height is the world's box (worldHeight); at
   *  100% the view does not depend on it, and it is kept so callers say what they lock. */
  width: number;
  height: number;
  /** Screen px of chrome standing over the surface's left and right (a sidebar, the rail). */
  sides: { left: number; right: number };
  /** The page's sheet in canvas px, and its side margin (the room its writing keeps inside it). */
  page: { x: number; y: number; width: number };
  margin: number;
  phone: boolean;
  /** Screen px of cover band over the page's top room (coverHeightOf); none by default. */
  cover?: number;
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

/** The side room on a desktop or on a phone. */
const sideRoomOf = (phone: boolean): number => (phone ? PAGE_SIDE_ROOM_PHONE : PAGE_SIDE_ROOM);

/** The widest column the window allows (page-surface.md "A narrow window reflows the writing"): the room the side
 *  chrome leaves, less the side room either side, in whole px. The narrow view (page-view-lens.ts) narrows a page
 *  whose column is wider than this. */
export function roomColumnOf(input: Pick<PageLockInput, 'width' | 'sides' | 'phone'>): number {
  const available = input.width - input.sides.left - input.sides.right;
  return Math.max(1, Math.floor(available - 2 * sideRoomOf(input.phone)));
}

/**
 * The one view a page is shown at: always 100% (owner 2026-11-21: "render normally without zoom like a news
 * webpage"). The column (the page less its margins) is centred in the room the side chrome leaves; a narrow window
 * narrows the drawn page itself (the narrow view), so the column fits the room. A column still wider than the room
 * (for the moment before the narrow view has narrowed it) starts at the side room, its overflow clipped. The canvas
 * world's transform is `scale(1) translate(o)`, so a canvas point p stands at `p + o`; the offset is that solved for
 * the page's corner.
 */
export function computePageLock(input: PageLockInput): PageLock {
  const { sides, page, margin, phone, cover = 0 } = input;
  const room = sideRoomOf(phone);
  const available = Math.max(1, input.width - sides.left - sides.right);
  const columnWidth = Math.max(1, page.width - 2 * margin);
  // Whole px, so the writing's glyphs land on the pixel grid.
  const columnLeft = Math.round(sides.left + Math.max(room, (available - columnWidth) / 2));
  const left = columnLeft - margin;
  // Under a cover, the page's blank top room and margin tuck under the band (which stands over the world), leaving
  // COVER_TITLE_GAP between the band and the first line.
  const tuck = cover > 0 ? Math.max(0, PAGE_TOP_ROOM + margin - COVER_TITLE_GAP) : 0;
  const top = PAGE_TOP_ROOM + cover - tuck;
  return {
    view: { zoom: 1, offset: { x: left - page.x, y: top - page.y } },
    left,
    top,
    columnLeft,
    columnWidth,
  };
}

/** The custom property the scroll container carries: the canvas px of height the window leaves a page, top room and
 *  foot room taken off. A page's paper is at least this tall on screen (ArticleFlows), so a press under
 *  a short page's last line still lands in the writing. A view concern: the stored page is as short as its writing. */
/**
 * The canvas world's box inside the scroll container: the container's, less PAGE_TOP_ROOM at its foot. The world is
 * drawn `scale(z) translate(o)` about its own centre, and a transformed box is something the container scrolls to;
 * a continuous page's top stands on the canvas's axis (page-layout.ts), so the box moves down by PAGE_TOP_ROOM at
 * most, and that much shorter it never reaches past the container's foot. The lock is solved for this height.
 */
export const worldHeight = (scrollerHeight: number, cover = 0): number =>
  Math.max(1, scrollerHeight - PAGE_TOP_ROOM - cover);
/** The same as the world element's CSS height: a cover's band moves the page down by its height, so the box is that
 *  much shorter again. */
export const WORLD_HEIGHT_CSS = `calc(100% - ${PAGE_TOP_ROOM}px - var(${PAGE_COVER_HEIGHT_VAR}, 0px))`;

export const PAGE_FREE_HEIGHT_VAR = '--page-free-height';

/** That height for a scroll container `height` screen px tall (a page is shown at 100%, so canvas px are screen px). */
export function pageFreeHeight(height: number, cover = 0): number {
  return Math.max(0, Math.floor(height - PAGE_TOP_ROOM - cover - PAGE_FOOT_ROOM));
}

export const sameView = (a: View, b: View): boolean =>
  a.zoom === b.zoom && a.offset.x === b.offset.x && a.offset.y === b.offset.y;
