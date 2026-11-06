// How the whiteboard dock fits its room (docs/specs/023-draw-mode/draw-mode.md "When the bar is too
// wide"): the drawing tools in runs, the bar's width by arithmetic on the dock's fixed sizes, and the
// fit, which takes pins off the bar first and then folds the least-used drawing tools into More
// Tools, one step at a time and only as far as it must. Pure; the dock measures the room
// (useDockRoom) and renders what this returns.
import type { WhiteboardPenId } from './whiteboard-prefs';

export type DrawingTool = 'select' | WhiteboardPenId | 'text' | 'path' | 'fill' | 'eraser';
export type FoldableTool = Exclude<DrawingTool, 'select'>;

// The least-used first: the specialist tools before the everyday ones (blueprints/DEFAULTS.md D39).
// Marker 1 folds last of all, only where nothing else is left to fold (a large toolbar UI scale in a
// narrow window); Select, Shapes and Settings never fold.
export const DOCK_FOLD_ORDER: readonly FoldableTool[] = [
  'path',
  'fill',
  'third',
  'eraser',
  'second',
  'text',
  'main',
];

const NOTHING_FOLDED: ReadonlySet<FoldableTool> = new Set();

// The dock's fixed sizes, in dock px (the toolbar UI scale's units): a tile (DockButton, h-9 w-9),
// the gap between a row's children (gap-0.5), a hairline (TOOLBAR_DIVIDER: w-px mx-0.5) and the
// card's chrome (TOOLBAR_CARD: p-1 and a 1 px border, both sides).
export const DOCK_TILE_PX = 36;
export const DOCK_GAP_PX = 2;
export const DOCK_DIVIDER_PX = 5;
export const DOCK_CARD_CHROME_PX = 10;

// The drawing tools as the bar shows them: runs with a hairline between each (Select; the markers;
// Text and the Path tool; Fill and the Eraser), folded tools left out and a run left empty dropped.
export function drawingRuns(
  pens: readonly WhiteboardPenId[],
  folded: ReadonlySet<FoldableTool>,
): DrawingTool[][] {
  const runs: DrawingTool[][] = [['select'], [...pens], ['text', 'path'], ['fill', 'eraser']];
  return runs
    .map((run) => run.filter((tool) => tool === 'select' || !folded.has(tool)))
    .filter((run) => run.length > 0);
}

/** The folded tools in bar order (which is not the fold order), as More Tools lists them. */
export function foldedInBarOrder(
  pens: readonly WhiteboardPenId[],
  folded: ReadonlySet<FoldableTool>,
): FoldableTool[] {
  return drawingRuns(pens, NOTHING_FOLDED)
    .flat()
    .filter((tool): tool is FoldableTool => folded.has(tool as FoldableTool));
}

// A row's width: its children side by side, a gap between each.
const row = (widths: readonly number[]) =>
  widths.reduce((sum, w) => sum + w, 0) + DOCK_GAP_PX * Math.max(0, widths.length - 1);

/**
 * The bar's outer width, in dock px, with `pins` pinned shapes on it and `folded` in More Tools.
 * `dragSeparator`: shapes drag on and off this bar, so the pinned side's separator shows even with
 * no pins.
 */
export function dockBarWidth(
  pens: readonly WhiteboardPenId[],
  pins: number,
  folded: ReadonlySet<FoldableTool>,
  dragSeparator = false,
): number {
  const runs = drawingRuns(pens, folded);
  const drawing: number[] = [];
  runs.forEach((run, i) => {
    if (i > 0) drawing.push(DOCK_DIVIDER_PX);
    drawing.push(...run.map(() => DOCK_TILE_PX));
  });
  // More Tools sits at the end of the last run.
  if (folded.size > 0) drawing.push(DOCK_TILE_PX);
  // The pinned shapes, the separator (shown with a pin on the bar, or where shapes drag), then Shapes.
  const separator = pins > 0 || dragSeparator ? [DOCK_DIVIDER_PX] : [];
  const shapes = [...Array<number>(pins).fill(DOCK_TILE_PX), ...separator, DOCK_TILE_PX];
  const settings = [DOCK_TILE_PX];
  return (
    DOCK_CARD_CHROME_PX +
    row([row(drawing), DOCK_DIVIDER_PX, row(shapes), DOCK_DIVIDER_PX, row(settings)])
  );
}

export type DockFit = { pins: number; folded: ReadonlySet<FoldableTool> };

// Half a pixel of give: the room is a rounded measurement.
const FIT_SLACK_PX = 0.5;

/**
 * What the bar shows in `room` dock px: the most of its `pins` and the fewest folded tools that fit.
 * Pins leave first, the last first; then DOCK_FOLD_ORDER, one tool at a time. With no room measured
 * (null) nothing folds; a room too small for even the fully folded bar gets the fully folded bar.
 */
export function fitDock({
  room,
  pens,
  pins,
  canDrag,
}: {
  room: number | null;
  pens: readonly WhiteboardPenId[];
  pins: number;
  // Shapes drag on and off the bar while every pin is on it (not on a phone or a tablet).
  canDrag: boolean;
}): DockFit {
  if (room === null) return { pins, folded: NOTHING_FOLDED };
  const fits = (p: number, folded: ReadonlySet<FoldableTool>) =>
    dockBarWidth(pens, p, folded, canDrag && p === pins) <= room + FIT_SLACK_PX;
  for (let p = pins; p >= 0; p--) {
    if (fits(p, NOTHING_FOLDED)) return { pins: p, folded: NOTHING_FOLDED };
  }
  // Only the tools this bar has fold (a marker it does not show is not counted).
  const order = DOCK_FOLD_ORDER.filter((tool) => !isPen(tool) || pens.includes(tool));
  let folded: Set<FoldableTool> = new Set();
  for (const tool of order) {
    folded = new Set([...folded, tool]);
    if (fits(0, folded)) break;
  }
  return { pins: 0, folded };
}

const isPen = (tool: FoldableTool): tool is WhiteboardPenId =>
  tool === 'main' || tool === 'second' || tool === 'third';

// How far a fit folded: the pins it took off the bar and the tools it folded.
const depthOf = (fit: DockFit, pins: number) => pins - fit.pins + fit.folded.size;

/**
 * Where a top dock sits and what it shows (docs/specs/023-draw-mode/draw-mode.md "Where the dock
 * sits"): from `wide` (lg, 1024 px) it is centred, with the menu card's clearance on both sides, only
 * when that folds no more than beside the menu card would; otherwise it stays beside the card, whose
 * room is larger by the clearance less the 12 px right margin. `leftRoom` is the room beside the card
 * and `clear` the clearance, both in dock px; with no room measured it centres from `wide`, folding
 * nothing, as before measuring.
 */
export function placeTopDock({
  leftRoom,
  clear,
  wide,
  pens,
  pins,
  canDrag,
}: {
  leftRoom: number | null;
  clear: number;
  wide: boolean;
  pens: readonly WhiteboardPenId[];
  pins: number;
  canDrag: boolean;
}): { centred: boolean; fit: DockFit } {
  const beside = fitDock({ room: leftRoom, pens, pins, canDrag });
  if (!wide || leftRoom === null) return { centred: wide, fit: beside };
  const centredRoom = leftRoom - clear + DOCK_RIGHT_MARGIN_PX;
  const centred = fitDock({ room: centredRoom, pens, pins, canDrag });
  return depthOf(centred, pins) <= depthOf(beside, pins)
    ? { centred: true, fit: centred }
    : { centred: false, fit: beside };
}

// A top dock beside the menu card keeps 12 px (0.75rem) from the right edge.
export const DOCK_RIGHT_MARGIN_PX = 12;
