import type { BoxedElement, Tab } from '@livediagram/document';
import { buildDrawnBoxed } from '@/lib/draw-commit';
import type { PendingDraw } from '@/lib/draw-mode';
import {
  between,
  centreOf,
  lerp,
  type CursorTarget,
  type Point,
  type ScreenProbe,
  type TopicEnv,
} from '../topic';

// What the Workshop topics share (docs/specs/007-editor/watch-it-built.md "The curriculum", Workshop): the category
// bar's buttons and the flyout's tiles as Example finds them, demo elements made exactly as a palette drop makes them,
// and a carry from a tile to where it lands.

/** A category on the bar, by its own anchor (CategoryBar.tsx CategoryBarButtons: `bar-<category id>`). */
export const bar = (id: string): CursorTarget => ({ kind: 'tour', id });

/** A tile in the open flyout, by the label its button carries (category-flyout-items.tsx useFlyoutItem `aria-label`,
 *  StickerPickerTab.tsx StickerTile `aria-label`): a card's words also hold its glyph and blurb. */
export const tile = (label: string): CursorTarget => ({
  kind: 'find',
  selector: `[data-tour-id="palette-category-menu"] [aria-label="${label}"]`,
});

/** A group's row on the open flyout's rail (PaletteCategoryRail.tsx `<nav aria-label="<things> groups">`), by place. */
export const railRow = (things: string, n: number): CursorTarget => ({
  kind: 'find',
  selector: `nav[aria-label="${things} groups"] > button:nth-child(${n})`,
});

/** The Session strip (SessionClusterStrip.tsx `<ClusterStrip dataTourId="session-tools">`), and its buttons. */
export const SESSION_STRIP: CursorTarget = { kind: 'tour', id: 'session-tools' };
export const STRIP_VOTE: CursorTarget = {
  kind: 'find',
  selector: '[data-tour-id="session-tools"] button[aria-label*="Vote"]',
};

/** The view's width in canvas units, when the engine says (TopicEnv `size`), else room for the brief's 560. */
export function viewWidth(env: TopicEnv): number {
  const size = (env as TopicEnv & { size?: { readonly width: number } }).size;
  return size?.width ?? 600;
}

type Placeable = Extract<PendingDraw, { type: 'shape' | 'sticky' }>;

/** A demo element as the palette's drop makes it on this tab (draw-commit.ts buildDrawnBoxed, the palette's own
 *  builder: colours, session choice, reaction, sticker), centred on `cx` with its top at `top`, at its own size
 *  unless a drag would have sized it. */
export function placed<T extends BoxedElement>(
  tab: Tab,
  id: string,
  intent: Placeable,
  cx: number,
  top: number,
  size?: { width: number; height: number },
): T {
  const el = buildDrawnBoxed(intent, cx, top, cx, top, null, tab) as unknown as T;
  const width = size?.width ?? el.width;
  const height = size?.height ?? el.height;
  return { ...el, id, width, height, x: cx - width / 2, y: top };
}

type Box = { x: number; y: number; width: number; height: number };

/** An element carried from a tile (its centre under the cursor) to where it lands, between two beats: not there
 *  before, held while carried, landed after. With the tile never seen it simply lands when the carry starts. */
export function carryAt<T extends Box>(
  el: T,
  from: Point | undefined,
  ms: number,
  span: readonly [number, number],
): { el: T | null; hold: Point | null } {
  if (ms < span[0]) return { el: null, hold: null };
  if (!from || ms >= span[1]) return { el, hold: null };
  const p = between(ms, span[0], span[1]);
  const moved = {
    ...el,
    x: lerp(from.x - el.width / 2, el.x, p),
    y: lerp(from.y - el.height / 2, el.y, p),
  };
  return { el: moved, hold: centreOf(moved) };
}

/** Whether `ms` falls in any of the windows. */
export const within = (ms: number, windows: readonly (readonly [number, number])[]) =>
  windows.some(([from, to]) => ms >= from && ms < to);

/** A carry a topic makes: from which tile (its label), in which chapter, starting when. */
export type Carry = { readonly tile: string; readonly chapter: number; readonly at: number };

/** Layouts that remember where their tiles were seen on the canvas, by label. */
export type TileMemory = { readonly tiles: Readonly<Record<string, Point>> };

// Where each carry's tile is, read while its flyout is open before the carry starts (it can still be settling as it
// opens), then kept: the same rule as The Basics' measure.
export function learnTiles<L extends TileMemory>(
  layout: L,
  carries: readonly Carry[],
  index: number,
  ms: number,
  screen: ScreenProbe,
): L | null {
  let tiles = layout.tiles;
  for (const c of carries) {
    if (c.chapter !== index || ms > c.at) continue;
    const point = screen.find(tile(c.tile));
    if (!point) continue;
    const seen = screen.toCanvas(point);
    const was = tiles[c.tile];
    if (was && was.x === seen.x && was.y === seen.y) continue;
    tiles = { ...tiles, [c.tile]: seen };
  }
  return tiles === layout.tiles ? null : { ...layout, tiles };
}
