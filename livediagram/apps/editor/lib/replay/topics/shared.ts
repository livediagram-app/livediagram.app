import { createShape, type ShapeElement, type ShapeKind, type Tab } from '@livediagram/document';
import { deriveNewBoxedColours } from '@/lib/themes';
import { lerp, type CursorTarget, type Point, type ScreenProbe } from '../topic';

// What the topics share: a boxed shape in the tab's own colours, and the palette's first tile.

/** Where a palette tile was on the canvas, for a carried shape to start from. Null before it was seen. */
export type Tile = Point | null;

/** The open palette category's first tile (its Shapes' Square, Ask's Timer): where a carry starts. */
export const PALETTE_TILE: CursorTarget = {
  kind: 'find',
  selector:
    '[data-tour-id="palette-category-menu"] [draggable="true"], [data-tour-id="palette-category-menu"] button',
};

/** A new shape as the palette would make it on this tab: centred on `cx`, its top at `y`, in the tab's colours. */
export function boxedShape(
  tab: Pick<Tab, 'backgroundColor' | 'patternColor' | 'theme'>,
  id: string,
  label: string,
  width: number,
  height: number,
  cx: number,
  y: number,
  kind: ShapeKind = 'square',
): ShapeElement {
  const base = createShape(kind, 0, 0);
  const colours = deriveNewBoxedColours(base, {
    backgroundColor: tab.backgroundColor,
    patternColor: tab.patternColor,
    theme: tab.theme,
  });
  return { ...base, ...colours, id, label, width, height, x: cx - width / 2, y };
}

// A shape carried from a palette tile to where it lands, its centre under the cursor. With no tile seen it is simply
// where it lands.
export function carried(el: ShapeElement, tile: Tile, p: number): ShapeElement {
  if (!tile || p >= 1) return el;
  const startX = tile.x - el.width / 2;
  const startY = tile.y - el.height / 2;
  return { ...el, x: lerp(startX, el.x, p), y: lerp(startY, el.y, p) };
}

/** Where a tile is on the canvas now, if it is on screen and has moved since `was` (a flyout still settling). */
export function tileMoved(screen: ScreenProbe, target: CursorTarget, was: Tile): Tile | undefined {
  const point = screen.find(target);
  if (!point) return undefined;
  const tile = screen.toCanvas(point);
  return was && was.x === tile.x && was.y === tile.y ? undefined : tile;
}
