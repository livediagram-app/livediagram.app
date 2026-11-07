'use client';

import {
  RETIRED_PLACEHOLDER_COLOURS,
  retiredElementName,
  retiredPlaceholderLayout,
  type BoxedElement,
  type RetiredPlaceholderLayout,
} from '@livehuddle/document';
import { useRef } from 'react';
import { Glyph, Prims, Tooltip } from '@livehuddle/ui';
import { lucideTrash2 } from '@liveworkspace/icons/lucide';
import { useCanvasZoom } from '@liveworkspace/workbench/components/canvas/CanvasZoomContext';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { ADORNMENT_MIN_ZOOM } from '@/components/canvas/element-badges';

// A retired element's placeholder (docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements"): a stored
// element whose kind or type livehuddle no longer has (a Collaborate element Work Tracker #423 part 4 deleted, a
// diagram tool #459 deleted, or a kind it never had) draws as a plain card in its own box. A dashed outline, a muted
// fill, the kind's name, "No longer supported in livehuddle" beneath it and the stored label beneath that when it has
// one. It opens nothing: the element still selects, moves, resizes, copies, layers, deletes and takes comments through
// the wrapper around it, like any element.
//
// An Editor also gets a Delete button on the card ("Deleting it"): the one action the placeholder offers, so a board
// can be cleared of what it can no longer show without hunting for the menu. It shows on hover, on keyboard focus and
// while the element is selected (so a touch, which has no hover, finds it after the tap that selects). It keeps one
// size on screen at every zoom, stays clear of the selection grips and steps left of the element's indicators; on a
// card with no room for it, the selection toolbar's Delete removes the card.
//
// The card is laid out once, in @livehuddle/document (retiredPlaceholderLayout), and drawn here from the same layout
// and colours the export and the thumbnail draw it from (svg-render-retired.ts), so the canvas and an exported image
// never disagree. Nothing here reads or writes the element's own fields beyond its kind, label and size, so whatever
// it carries (a poll's question, a chart's rows) rides through untouched.

// The button keeps one size on screen at every zoom, as the selection grips do: it is drawn in screen pixels and
// counter-scaled inside the zoomed card. Every measure below is in screen pixels. It only ever shows inside the
// card: on a card too small on screen to hold it (a phone at its Fit zoom, say), the selection toolbar's Delete
// removes the selected card instead.
//
// The smallest card, on screen, that can hold the button.
export const RETIRED_DELETE_MIN_WIDTH = 72;
export const RETIRED_DELETE_MIN_HEIGHT = 48;

// A 24px square, 12px in from the top and right edges, plus a 4px gap it keeps from the words and the indicators.
// The 12px keeps it clear of the selection grips' touch pads, which reach at most 10px into a card at a corner and
// 7px at an edge's middle (element-parts.tsx, HIT_PAD_INWARD), so a tap on the button is never a resize.
export const RETIRED_DELETE_SIZE = 24;
export const RETIRED_DELETE_INSET = 12;
export const RETIRED_DELETE_GAP = 4;

// A box in the card's own units, from its top-left corner (what indicatorClusterRect gives).
type CardRect = { x: number; y: number; width: number; height: number };

// Where the button goes on a card of this size at this zoom, as a box in screen pixels from the card's top-left
// corner, or null when it has no room. It sits in the top-right corner; when the element's indicators (its comment
// pip, its link, note or action, docs/specs/008-canvas/element-indicators.md) are drawn across that corner, it steps
// left of the whole cluster. It shows only where it also keeps clear of the words.
export type RetiredDeletePlacement = { left: number; top: number; size: number };

export function retiredDeletePlacement(
  card: RetiredPlaceholderLayout,
  width: number,
  height: number,
  zoom: number,
  indicators: CardRect | null = null,
): RetiredDeletePlacement | null {
  const screenWidth = width * zoom;
  const screenHeight = height * zoom;
  if (screenWidth < RETIRED_DELETE_MIN_WIDTH || screenHeight < RETIRED_DELETE_MIN_HEIGHT)
    return null;
  const top = RETIRED_DELETE_INSET;
  let right = screenWidth - RETIRED_DELETE_INSET;
  // The cluster hides below the zoom the adornments stop at, so it is only stepped round where it is drawn.
  if (indicators && zoom >= ADORNMENT_MIN_ZOOM) {
    const x0 = indicators.x * zoom - RETIRED_DELETE_GAP;
    const x1 = (indicators.x + indicators.width) * zoom + RETIRED_DELETE_GAP;
    const y0 = indicators.y * zoom - RETIRED_DELETE_GAP;
    const y1 = (indicators.y + indicators.height) * zoom + RETIRED_DELETE_GAP;
    const overlaps =
      right - RETIRED_DELETE_SIZE < x1 && x0 < right && top < y1 && y0 < top + RETIRED_DELETE_SIZE;
    if (overlaps) right = Math.min(right, x0);
  }
  const left = right - RETIRED_DELETE_SIZE;
  // Never past the top-left corner's grip.
  if (left < RETIRED_DELETE_INSET) return null;
  if (!wordsClearOfDelete(card, width, zoom, right)) return null;
  return { left, top, size: RETIRED_DELETE_SIZE };
}

// Does every line of words keep clear of the button, at this zoom, with its right edge `right` screen pixels from the
// card's left (the top-right corner's place by default)? The words are laid out in the card's own units and the button
// in screen pixels, so the button is measured back into the card's units. A line is clear when it starts below the
// button or ends left of it; the lines are centred across the box, so a long name on a small card reaches the corner
// and the button stays away rather than sit on the words.
export function wordsClearOfDelete(
  card: RetiredPlaceholderLayout,
  width: number,
  zoom = 1,
  right = width * zoom - RETIRED_DELETE_INSET,
): boolean {
  const below = (RETIRED_DELETE_INSET + RETIRED_DELETE_SIZE + RETIRED_DELETE_GAP) / zoom;
  const left = (right - RETIRED_DELETE_SIZE - RETIRED_DELETE_GAP) / zoom;
  return card.lines.every((line) => line.top >= below || (width + line.width) / 2 <= left);
}

export function RetiredElementFace({
  element,
  fontFamily,
  selected = false,
  onDelete,
  indicators = null,
}: {
  element: BoxedElement;
  // The label font the element would letter in (the tab's, or its own).
  fontFamily?: string;
  // Whether the element is selected: the Delete button shows without a hover.
  selected?: boolean;
  // Removes the element; given only to an Editor (docs/specs/013-workspace/share-roles.md).
  onDelete?: (elementId: string) => void;
  // The box the element's indicators take, in its own units (indicatorClusterRect), when it has any.
  indicators?: CardRect | null;
}) {
  const colours = RETIRED_PLACEHOLDER_COLOURS[useCanvasSurface()];
  const card = retiredPlaceholderLayout(element);
  const width = Math.max(0, element.width);
  const height = Math.max(0, element.height);
  const kind = element.type === 'shape' ? element.shape : element.type;
  return (
    <>
      <svg
        // Inert: the wrapper around it selects and drags the element.
        className="pointer-events-none absolute inset-0 overflow-visible"
        data-retired-element={kind}
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden
        style={fontFamily ? { fontFamily } : undefined}
      >
        <rect
          x={card.inset}
          y={card.inset}
          width={Math.max(0, width - card.inset * 2)}
          height={Math.max(0, height - card.inset * 2)}
          rx={Math.max(0, card.radius - card.inset)}
          fill={colours.fill}
          stroke={colours.stroke}
          strokeWidth={card.strokeWidth}
          strokeDasharray={card.dash.join(' ')}
        />
        {card.lines.map((line) => (
          <text
            key={line.role}
            data-retired-line={line.role}
            x={width / 2}
            y={line.baseline}
            textAnchor="middle"
            fontSize={line.size}
            fontWeight={line.weight}
            fill={colours.ink}
            {...(line.opacity !== 1 ? { fillOpacity: line.opacity } : {})}
          >
            {line.text}
          </text>
        ))}
      </svg>
      {onDelete ? (
        <RetiredDeleteButton
          element={element}
          card={card}
          selected={selected}
          ink={colours.ink}
          indicators={indicators}
          onDelete={onDelete}
        />
      ) : null}
    </>
  );
}

// The button, apart from the card so that only it re-renders as the zoom changes.
function RetiredDeleteButton({
  element,
  card,
  selected,
  ink,
  indicators,
  onDelete,
}: {
  element: BoxedElement;
  card: RetiredPlaceholderLayout;
  selected: boolean;
  ink: string;
  indicators: CardRect | null;
  onDelete: (elementId: string) => void;
}) {
  const zoom = useCanvasZoom();
  // Whether the press now ending began on the button. A tap that selects the card shows the button under the
  // finger before the tap's click lands, so that click must not count: only a press that started on the button,
  // or the keyboard (a click with no pointer, detail 0), deletes.
  const pressed = useRef(false);
  const width = Math.max(0, element.width);
  const height = Math.max(0, element.height);
  const place = retiredDeletePlacement(card, width, height, zoom, indicators);
  if (!place) return null;
  const label = `Delete ${retiredElementName(element)}`;
  return (
    <span className="pointer-events-none absolute inset-0 z-10">
      <span
        className="absolute"
        data-retired-delete-slot=""
        // Counter-scaled about its top-left corner, so it keeps its size on screen and its place on the card.
        style={{
          left: place.left / zoom,
          top: place.top / zoom,
          transform: `scale(${1 / zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <Tooltip label={label}>
          <button
            type="button"
            aria-label={label}
            data-retired-delete=""
            // The canvas reads a press on an element as select-and-maybe-drag: stop it here, or the press that
            // deletes would first start a drag of the card it removes.
            onPointerDown={(e) => {
              e.stopPropagation();
              pressed.current = true;
            }}
            onPointerCancel={() => {
              pressed.current = false;
            }}
            onClick={(e) => {
              e.stopPropagation();
              const fromPress = pressed.current;
              pressed.current = false;
              if (e.detail !== 0 && !fromPress) return;
              onDelete(element.id);
            }}
            // Hidden, it takes no press: a touch has no hover, so a tap on an unselected card where the button
            // sits would otherwise delete a card the user never saw a Delete on. A pointer that can hover shows
            // it first; a keyboard still reaches it, since focus ignores pointer-events.
            className={`flex h-6 w-6 cursor-pointer items-center justify-center rounded-md transition hover:bg-black/10 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-white/10 ${
              selected
                ? 'pointer-events-auto opacity-100'
                : 'pointer-events-none opacity-0 group-hover/el:pointer-events-auto group-hover/el:opacity-100'
            }`}
            style={{ color: ink }}
          >
            <Glyph size={14} units={24}>
              <Prims prims={lucideTrash2} />
            </Glyph>
          </button>
        </Tooltip>
      </span>
    </span>
  );
}
