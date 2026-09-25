import { useEffect, useRef, useState } from 'react';
import {
  isLaneBand,
  laneEdgeOfElement,
  laneGutterEdge,
  laneSizeOfElement,
  type LaneGutterEdge,
  type LaneLike,
  type TextAlignX,
  type TextAlignY,
} from '@livediagram/diagram';

// A lane's title gutter (spec/119): the tinted strip behind its title, with a
// divider where it meets the body.
//
// Only the strip and the rule are drawn here. The TITLE is the element's
// ordinary label, so it edits, formats, aligns and exports exactly like every
// other label — the swimlane template's separate "gutter cells" existed
// precisely because there was nowhere for a title to live on a frame.
//
// The gutter runs along whichever EDGE the title is pinned to, so re-aligning
// the title takes its backdrop with it.

// The geometry (which edge, how thick) lives in @livediagram/diagram, because
// the headless renderer has to draw the same strip on the same edge or an
// exported swimlane is a plain box with its title floating in the work.
// Re-exported so this module stays the one import a lane view needs.
export {
  isLaneBand,
  LANE_BAND_PX,
  LANE_GUTTER_PX,
  laneEdgeOfElement,
  laneGutterEdge,
  laneSizeOfElement,
  type LaneGutterEdge,
  type LaneLike,
} from '@livediagram/diagram';

// A gutter narrower than this has no room for a title; wider than the lane
// itself is not a gutter any more, it is the lane. Clamped on both sides so a
// wild drag cannot make the element unusable.
const MIN_GUTTER_PX = 28;

export function LaneGutter({
  stroke,
  headerFill,
  headerSize,
  alignX,
  alignY,
  width,
  height,
  zoom,
  onCommitSize,
  onSnapSeam,
  elementId,
  elementX,
  elementY,
}: {
  stroke: string;
  // An explicit heading background (spec/119). Unset keeps the historical
  // look: a 10% wash of the lane's own stroke, so a recoloured lane carries
  // its gutter with it.
  headerFill?: string;
  // Thickness in element-space px, from dragging the seam. Unset uses the
  // default for this orientation.
  headerSize?: number;
  alignX: TextAlignX;
  alignY: TextAlignY;
  // The lane's own size, to clamp the seam against.
  width: number;
  height: number;
  // Canvas scale, so a pixel of pointer travel is a pixel of gutter.
  zoom: number;
  // Commit on release. Absent (read-only, exports, the minimap) leaves the
  // seam inert and undraggable, which is what those surfaces want.
  onCommitSize?: (px: number) => void;
  // Resolves a seam coordinate against the alignment grid and other lanes'
  // seams. Absent leaves the drag free.
  onSnapSeam?: (
    candidate: number,
    axis: 'x' | 'y',
    excludeId: string,
    edgeOf: (el: LaneLike) => LaneGutterEdge,
    sizeOf: (el: LaneLike) => number,
  ) => number;
  elementId: string;
  elementX: number;
  elementY: number;
}) {
  // The gutter FOLLOWS the title. Pinning it left while the text moved right
  // left the strip sitting behind nothing and the title floating over the
  // work — the tinted band is the title's backdrop, so it goes where the
  // title goes.
  const edge = laneGutterEdge(alignX, alignY);
  const band = isLaneBand(edge);

  // Live size during a drag, so the strip follows the pointer without a
  // commit per frame; released value is what lands in the element.
  const [dragSize, setDragSize] = useState<number | null>(null);
  const dragRef = useRef<{ start: number; from: number } | null>(null);
  // The same live size in a ref. Release has to read the size the pointer
  // last reached, and neither alternative works: a setState UPDATER runs
  // during React's render phase, so committing from inside one updates the
  // page while the gutter is rendering (React says so, loudly), and the
  // effect's closed-over `dragSize` can lag a frame because pointermove is
  // not a discrete event and its re-render may not have flushed yet.
  const liveSizeRef = useRef<number | null>(null);
  const setLiveSize = (px: number | null) => {
    liveSizeRef.current = px;
    setDragSize(px);
  };
  const size =
    dragSize ?? laneSizeOfElement({ textAlignX: alignX, textAlignY: alignY, headerSize });
  const maxSize = Math.max(MIN_GUTTER_PX, (band ? height : width) - MIN_GUTTER_PX);

  // Only an edge-hugging gutter inherits the lane's corner radius; a centred
  // one has square sides by definition.
  const radius =
    edge === 'right'
      ? 'rounded-r-[inherit]'
      : edge === 'left'
        ? 'rounded-l-[inherit]'
        : edge === 'top'
          ? 'rounded-t-[inherit]'
          : edge === 'bottom'
            ? 'rounded-b-[inherit]'
            : '';

  const placement =
    edge === 'right'
      ? { right: 0, borderLeft: `1px solid ${stroke}` }
      : edge === 'left'
        ? { left: 0, borderRight: `1px solid ${stroke}` }
        : edge === 'top'
          ? { top: 0, borderBottom: `1px solid ${stroke}` }
          : edge === 'bottom'
            ? { bottom: 0, borderTop: `1px solid ${stroke}` }
            : // A centred strip gets a rule on BOTH sides: it has two seams
              // with the body, not one.
              {
                left: `calc(50% - ${size / 2}px)`,
                borderLeft: `1px solid ${stroke}`,
                borderRight: `1px solid ${stroke}`,
              };

  // Pointer handling lives on window so a fast drag that leaves the seam (or
  // the element) keeps tracking, and so release always commits.
  useEffect(() => {
    if (dragSize === null) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const travel = (band ? e.clientY : e.clientX) - d.start;
      // A gutter on the far edge grows as the pointer moves TOWARDS the
      // element, so its travel is inverted. A CENTRED strip is driven from
      // its right-hand seam and grows both ways at once, so a pixel of
      // pointer travel is two pixels of width.
      const signed =
        edge === 'centre-x' ? travel * 2 : edge === 'right' || edge === 'bottom' ? -travel : travel;
      const raw = Math.min(maxSize, Math.max(MIN_GUTTER_PX, d.from + signed / (zoom || 1)));
      // Snap in ABSOLUTE canvas space, where the targets live, then convert
      // the result back into a thickness.
      // A centred strip has no single seam to line anything up with, so it
      // is sized freely rather than snapped.
      if (!onSnapSeam || edge === 'centre-x') {
        setLiveSize(raw);
        return;
      }
      const axis = band ? 'y' : 'x';
      const origin = band ? elementY : elementX;
      const span = band ? height : width;
      const far = edge === 'right' || edge === 'bottom';
      const seam = far ? origin + span - raw : origin + raw;
      const snapped = onSnapSeam(seam, axis, elementId, laneEdgeOfElement, laneSizeOfElement);
      const back = far ? origin + span - snapped : snapped - origin;
      setLiveSize(Math.min(maxSize, Math.max(MIN_GUTTER_PX, back)));
    };
    const onUp = () => {
      const current = liveSizeRef.current;
      setLiveSize(null);
      dragRef.current = null;
      if (current !== null) onCommitSize?.(Math.round(current));
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [
    dragSize,
    band,
    edge,
    maxSize,
    zoom,
    onCommitSize,
    onSnapSeam,
    elementId,
    elementX,
    elementY,
    width,
    height,
  ]);

  const startDrag = (e: React.PointerEvent) => {
    // Stop the canvas reading this as a drag of the element itself.
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { start: band ? e.clientY : e.clientX, from: size };
    setLiveSize(size);
  };

  return (
    <>
      <div
        // Inert: the label sits on top of this and the canvas owns the rest.
        className={`pointer-events-none absolute ${band ? 'inset-x-0' : 'inset-y-0'} ${radius}`}
        style={{
          ...(band ? { height: size } : { width: size }),
          // An explicit heading colour paints at full strength (you picked it,
          // you get it); with none set it stays the 10% wash of the lane's own
          // stroke, so a recoloured lane keeps its gutter in the family.
          backgroundColor: headerFill ?? stroke,
          ...(headerFill ? null : { opacity: 0.1 }),
          ...placement,
        }}
        aria-hidden
      />
      {/* The seam. Dragging it sets how much of the lane the title gets: 132
          across and 64 down were only ever the sizes that suited the titles
          they were measured against, and a lane holding "Q3 Marketing
          Programme" wants more than one holding "Q3". A centred gutter has
          two seams and no obvious owner, so it stays fixed. */}
      {onCommitSize ? (
        <div
          role="separator"
          aria-orientation={band ? 'horizontal' : 'vertical'}
          aria-label="Resize the lane's title area"
          onPointerDown={startDrag}
          className={`absolute z-10 ${
            band ? 'inset-x-0 h-2 cursor-ns-resize' : 'inset-y-0 w-2 cursor-ew-resize'
          } ${dragSize !== null ? 'bg-brand-400/40' : 'hover:bg-brand-400/30'}`}
          style={
            edge === 'left'
              ? { left: size - 4 }
              : edge === 'right'
                ? { right: size - 4 }
                : edge === 'top'
                  ? { top: size - 4 }
                  : edge === 'bottom'
                    ? { bottom: size - 4 }
                    : // Centred: the right-hand seam of the middle strip.
                      { left: `calc(50% + ${size / 2 - 4}px)` }
          }
        />
      ) : null}
    </>
  );
}
