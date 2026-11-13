import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';

import { pressLedger } from '../../lib/double-press';

// The parts of an arrow's view every product's ArrowView draws alike: the mask that breaks the line round
// boxes and labels (docs/specs/008-canvas/arrow-route-behind.md, arrow-labels.md), the double-press rule
// its presses pass (docs/specs/008-canvas/arrow-bending.md), the flow's style on the line and the ends
// that wear a head (docs/specs/008-canvas/canvas-and-palette.md). Plain functions, called inside each
// ArrowView's render, so the per-element tree gains no component level.

// The vast mask region + backdrop for route-behind and label knockouts, for a line whose geometry
// arrowMaskRegion cannot read: a curve can bow well outside its chord, and a region that ends where
// the chord does clips the drawing instead of the boxes.
export const ARROW_MASK_SPAN = { origin: -100000, size: 200000 } as const;

/** One cut in the line: a box it runs behind, or a label's knockout, with its corner radius. */
export type ArrowMaskHole = { x: number; y: number; width: number; height: number; rx: number };

/** Where a mask paints, in canvas units. */
export type ArrowMaskRegion = { x: number; y: number; width: number; height: number };

// How far past its paths' control points an arrow's ink can reach, in stroke widths and canvas units: a head is its
// marker size in stroke widths (12 at the largest, ARROWHEAD_SIZE_PX), the width flows swell the line to 2.2 times,
// the selection halo adds 2, and a glow's drop-shadow blurs up to 5 px (canvas-motion.css), so 14 widths and 24 units
// hold every one of them with room to spare.
const MASK_PAD_WIDTHS = 14;
const MASK_PAD_UNITS = 24;

const isCommand = (t: string) => /^[A-Za-z]$/.test(t);

/**
 * The mask region one arrow needs (docs/specs/008-canvas/canvas-performance.md "A masked arrow paints its own box"):
 * the box round every point of `paths` (the line, the sketch's strokes and heads), padded for heads, flows and the
 * selection halo. Each path is the editor's own absolute `M L C Q Z` geometry (arrow-path.ts, hand-drawn.ts), and a
 * Bézier stays inside its control points, so the box holds the whole curve. A mask's region is what the browser
 * composites for it: the vast one made every arrow that runs behind a box cost a screen of raster on every repaint.
 * Answers null (the vast region) for a path it cannot read: another command, or an odd count of numbers.
 */
export function arrowMaskRegion(
  paths: readonly (string | undefined)[],
  strokeWidth: number,
): ArrowMaskRegion | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const d of paths) {
    if (!d) continue;
    let coords = 0;
    for (const t of d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? []) {
      if (isCommand(t)) {
        if (!'MLCQZ'.includes(t)) return null;
        continue;
      }
      const v = Number(t);
      if (coords % 2 === 0) {
        minX = Math.min(minX, v);
        maxX = Math.max(maxX, v);
      } else {
        minY = Math.min(minY, v);
        maxY = Math.max(maxY, v);
      }
      coords++;
    }
    if (coords % 2 !== 0) return null;
  }
  // Every path held an even count of numbers, so a box with an x has a y.
  if (minX === Infinity) return null;
  const pad = MASK_PAD_UNITS + MASK_PAD_WIDTHS * Math.max(1, strokeWidth);
  return {
    x: minX - pad,
    y: minY - pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  };
}

const VAST_REGION: ArrowMaskRegion = {
  x: ARROW_MASK_SPAN.origin,
  y: ARROW_MASK_SPAN.origin,
  width: ARROW_MASK_SPAN.size,
  height: ARROW_MASK_SPAN.size,
};

/**
 * The `<mask>` that cuts `holes` out of the line, for the ArrowView to reference by `id`, over `region`
 * (arrowMaskRegion), or the vast one when that is null.
 */
export function arrowBehindMask(
  id: string,
  holes: readonly ArrowMaskHole[],
  region: ArrowMaskRegion | null = null,
) {
  const r = region ?? VAST_REGION;
  return (
    // White paints, black cuts. The backdrop covers the whole region, which holds the curve's bow (its control
    // points), not only the chord: a mask that ended where the chord does would clip the bow instead of the boxes.
    <mask
      id={id}
      maskUnits="userSpaceOnUse"
      // The mask REGION, stated explicitly. Without x/y/width/height a
      // mask defaults to -10%/120% of the referencing element's bounding
      // box, and anything outside that region is masked away. A straight
      // horizontal (or vertical) arrow has a zero-height bbox, so the
      // default region collapsed to a hairline and swallowed the
      // arrowhead (which sticks out above and below the line) along
      // with part of the stroke. Same box as the backdrop below.
      x={r.x}
      y={r.y}
      width={r.width}
      height={r.height}
    >
      <rect x={r.x} y={r.y} width={r.width} height={r.height} fill="white" />
      {holes.map((h, i) => (
        <rect key={i} x={h.x} y={h.y} width={h.width} height={h.height} fill="black" rx={h.rx} />
      ))}
    </mask>
  );
}

/**
 * The double-press rule for one arrow's presses (line, label, handles, move frame): a press that pairs
 * with the one before never drags, and opens the label editor instead.
 */
export function arrowPressGuards({
  id,
  isSelected,
  blocked,
  onBeginEdit,
}: {
  id: string;
  isSelected: boolean;
  // The arrow takes no label edit (locked, or the paint brush is on).
  blocked: boolean;
  onBeginEdit: (id: string) => void;
}) {
  const pairsWithLast = (e: ReactPointerEvent): boolean =>
    pressLedger.press({
      id,
      t: e.timeStamp,
      x: e.clientX,
      y: e.clientY,
      wasSelected: isSelected,
    }).pairs;
  // Opened on the RELEASE of the second press, not its pointerdown: the
  // browser moves focus as that press's default action, which would blur (and
  // so commit) an editor opened a moment earlier.
  const openEditor = () => {
    if (blocked) return;
    const done = () => {
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', done);
    };
    // A cancelled press (a pinch, a lost pointer) opens nothing.
    const onUp = () => {
      done();
      onBeginEdit(id);
    };
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', done);
  };
  // For presses that do not select (label, handles, frame): true when it was
  // the second of a double, which then opens the editor.
  const guardPress = (e: ReactPointerEvent): boolean => {
    if (!pairsWithLast(e)) return false;
    openEditor();
    return true;
  };
  return { pairsWithLast, openEditor, guardPress };
}

/** The visible line's style: no hit-testing, and the flow's custom properties for its animation. */
export function arrowFlowStyle({
  flow,
  flowRepeat,
  flowPathClass,
  flowFactor,
  strokeWidth,
  baseStroke,
}: {
  flow: string | undefined;
  flowRepeat: boolean | undefined;
  flowPathClass: string | undefined;
  flowFactor: number;
  strokeWidth: number;
  baseStroke: string;
}): CSSProperties {
  return {
    pointerEvents: 'none',
    // Flow speed scales each path animation's duration; phase-sync
    // across arrows is pinned via the Web Animations API in useArrowFlow,
    // not animation-delay. The width-breathing flows (grow /
    // heartbeat / breathe) need the base stroke width to swell relative
    // to it; the halo flows (glow / shimmer) need the stroke colour to
    // tint it.
    ...(flowPathClass ? { '--lvd-flow-speed': flowFactor } : {}),
    ...(flow === 'grow' || flow === 'heartbeat' || flow === 'breathe'
      ? { '--lvd-flow-w': `${strokeWidth}px` }
      : {}),
    ...(flow === 'glow' || flow === 'shimmer' ? { '--lvd-flow-color': baseStroke } : {}),
    // Repeat off = the flow plays once and holds (docs/specs/008-canvas/canvas-and-palette.md).
    ...(flowRepeat === false ? { '--lvd-flow-iter': 1 } : {}),
  };
}

/** Which ends of the line wear a head: the start for `from` and `both`, the end for `to`, `both` and unset. */
export function arrowEndMarkers(
  arrowEnds: string | undefined,
  startMarker: string | undefined,
  headMarker: string | undefined,
): { markerStart: string | undefined; markerEnd: string | undefined } {
  return {
    markerStart: arrowEnds === 'from' || arrowEnds === 'both' ? startMarker : undefined,
    markerEnd:
      arrowEnds === 'to' || arrowEnds === 'both' || arrowEnds === undefined
        ? headMarker
        : undefined,
  };
}
