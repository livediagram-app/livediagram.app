import {
  createShape,
  INK_PEN_COLOUR,
  isPenColourName,
  nearestBorderStroke,
  packFreehandPoints,
  PEN_STREAMLINE,
  type FreehandElement,
  type PenColour,
  type RecognisedShape,
  type ShapeElement,
} from '@livediagram/document';
import { recogniseBoardStroke } from '@/lib/recognition-preview';
import { WHITEBOARD_PEN_WIDTHS, type WhiteboardPenId } from '@/lib/whiteboard-prefs';
import type { CursorTarget, Point, ReplayDock } from '../topic';

// What Draw's topics share (docs/specs/007-editor/watch-it-built.md "The curriculum", Draw): pen strokes drawn under
// the cursor exactly as a whiteboard pen lands them (hooks/canvas/commit-freehand.ts whiteboardStroke), a stroke
// snapped to its recognised shape, the dock's buttons and flyout options, and the dock as a topic shows it.

/** A marker's colour and width: null is the board's ink (the main pen's). */
export type Pen = { readonly colour: PenColour | null; readonly width: number };

const widthOf = (id: string) => WHITEBOARD_PEN_WIDTHS.find((w) => w.id === id)!.px;
// Every marker starts at Medium (lib/whiteboard-prefs.ts DEFAULT_WHITEBOARD_PREFS).
export const INK_PEN: Pen = { colour: null, width: widthOf('medium') };
export const THICK_PX = widthOf('thick');

/** A stroke a topic draws: its points, when it is drawn (ms into its chapter) and in what pen. */
export type Stroke = {
  readonly id: string;
  readonly points: readonly Point[];
  readonly from: number;
  readonly to: number;
  readonly pen: Pen;
};

// A pen's colour as a stroke stores it: none for the ink (it follows the board), a stock colour by name, a custom one
// by hex (commit-freehand.ts penColourFields).
function penColourFields(
  colour: PenColour | null,
): Pick<FreehandElement, 'penColour' | 'strokeColor'> {
  if (colour === null) return {};
  return isPenColourName(colour) ? { penColour: colour } : { strokeColor: colour };
}

/** A whiteboard pen stroke as it lands from a mouse: its raw points, the pen's width, the mouse's streamline. */
export function penStroke(id: string, points: readonly Point[], pen: Pen): FreehandElement {
  return {
    id,
    type: 'freehand',
    ...packFreehandPoints(points),
    closed: false,
    penWidth: pen.width,
    streamline: PEN_STREAMLINE.mouse,
    ...penColourFields(pen.colour),
  };
}

/**
 * The strokes as drawn by `ms`: each grows point by point between its beats, and while one is being drawn Example
 * holds the pen on its tip.
 */
export function inkAt(strokes: readonly Stroke[], ms: number) {
  const elements: FreehandElement[] = [];
  let hold: Point | null = null;
  for (const s of strokes) {
    if (ms < s.from) continue;
    const p = Math.min(1, (ms - s.from) / Math.max(1, s.to - s.from));
    const count = Math.max(2, Math.ceil(p * s.points.length));
    const drawn = s.points.slice(0, count);
    elements.push(penStroke(s.id, drawn, s.pen));
    if (ms < s.to) hold = drawn[drawn.length - 1]!;
  }
  return { elements, hold };
}

/** The shape a stroke reads as, by the board's own test (lib/recognition-preview.ts), or null. */
export function recognised(points: readonly Point[], pen: Pen): RecognisedShape | null {
  return recogniseBoardStroke({
    points: [...points],
    width: pen.width,
    streamline: PEN_STREAMLINE.mouse,
  });
}

/**
 * A stroke snapped to its shape, as the pen lands it (commit-freehand.ts whiteboardStroke): the clean shape over the
 * recognised box, unfilled, the pen's colour by name (the ink's as Ink) and its nearest border width.
 */
export function snappedShape(id: string, detected: RecognisedShape, pen: Pen): ShapeElement {
  const kind = detected.kind === 'line' ? 'square' : detected.kind;
  return {
    ...createShape(kind, detected.bbox.x, detected.bbox.y),
    id,
    x: detected.bbox.x,
    y: detected.bbox.y,
    width: Math.max(16, detected.bbox.width),
    height: Math.max(16, detected.bbox.height),
    fillColor: 'transparent',
    strokeWidth: nearestBorderStroke(pen.width),
    ...penColourFields(pen.colour ?? INK_PEN_COLOUR),
  };
}

// A hand's wobble, the same every time (frames are pure): a few px off the ideal line.
export const wobble = (i: number, amp: number) =>
  amp * (Math.sin(i * 1.7) * 0.6 + Math.sin(i * 0.53 + 1) * 0.4);

/** Points along a path through `corners`, `per` to a side, each nudged by the hand's wobble. */
export function handLine(corners: readonly Point[], per: number, amp = 1.5): Point[] {
  const out: Point[] = [];
  for (let k = 0; k + 1 < corners.length; k++) {
    const a = corners[k]!;
    const b = corners[k + 1]!;
    for (let j = k === 0 ? 0 : 1; j <= per; j++) {
      const t = j / per;
      const i = out.length;
      out.push({
        x: a.x + (b.x - a.x) * t + wobble(i, amp),
        y: a.y + (b.y - a.y) * t + wobble(i + 7, amp),
      });
    }
  }
  return out;
}

/** A Draw dock button by its `data-dock-item` (DockToolbar.tsx DockButton), inside the dock. */
export const dockItemSelector = (key: string) => `[data-whiteboard-dock] [data-dock-item="${key}"]`;
export const dockItem = (key: string): CursorTarget => ({
  kind: 'find',
  selector: dockItemSelector(key),
});

/** An option in an open dock flyout by its accessible name (WhiteboardFlyout.tsx FlyoutOption's aria-label). */
export const flyoutOption = (kind: string, label: string): CursorTarget => ({
  kind: 'find',
  selector: `#whiteboard-flyout-${kind} button[aria-label="${label}"]`,
});

/** A marker in hand on the dock, as a frame's `dock` shows it. */
export const penInHand = (id: WhiteboardPenId, rest: ReplayDock = {}): ReplayDock => ({
  ...rest,
  tool: 'pen',
  prefs: { ...rest.prefs, activePenId: id },
});
