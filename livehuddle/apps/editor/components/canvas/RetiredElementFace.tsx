'use client';

import {
  RETIRED_PLACEHOLDER_COLOURS,
  retiredElementName,
  retiredPlaceholderLayout,
  rotationOf,
  type BoxedElement,
  type RetiredPlaceholderLayout,
} from '@livehuddle/document';
import { Glyph, Prims, Tooltip } from '@livehuddle/ui';
import { lucideTrash2 } from '@liveworkspace/icons/lucide';
import { useCanvasZoom } from '@liveworkspace/workbench/components/canvas/CanvasZoomContext';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { BoxGripsPortal } from '@/components/canvas/SelectionGripsLayer';

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
// size on screen at every zoom and stays clear of the selection grips; on a card too small on screen to hold it clear
// of the words, it shows just outside the card's top-right corner while the card is selected.
//
// The card is laid out once, in @livehuddle/document (retiredPlaceholderLayout), and drawn here from the same layout
// and colours the export and the thumbnail draw it from (svg-render-retired.ts), so the canvas and an exported image
// never disagree. Nothing here reads or writes the element's own fields beyond its kind, label and size, so whatever
// it carries (a poll's question, a chart's rows) rides through untouched.

// The button keeps one size on screen at every zoom, as the selection grips do: it is drawn in screen pixels and
// counter-scaled inside the zoomed card. Every measure below is in screen pixels.
//
// The smallest card, on screen, that holds the button inside it: below it (a card at a phone's Fit zoom, say) the
// button shows outside the card while it is selected, and not at all otherwise.
export const RETIRED_DELETE_MIN_WIDTH = 72;
export const RETIRED_DELETE_MIN_HEIGHT = 48;

// A 24px square, 12px in from the top and right edges, plus a 4px gap the words must keep from it. The 12px keeps it
// clear of the selection grips' touch pads, which reach at most 10px into a card at a corner and 7px at an edge's
// middle (element-parts.tsx, HIT_PAD_INWARD), so a tap on the button on a selected card is never a resize.
export const RETIRED_DELETE_SIZE = 24;
export const RETIRED_DELETE_INSET = 12;
const DELETE_GAP = 4;
// Outside the card, the button sits past the top-right corner's touch pad, which reaches 22px out (a 6px half grip
// and its 16px pad), with 4px to spare.
export const RETIRED_DELETE_OUTSIDE = 26;

// Where the button goes on a card of this size at this zoom, as a box in screen pixels from the card's top-left
// corner: inside the card's top-right corner when it fits clear of the words, else outside the card, past its
// top-right corner, while it is selected (the only way a touch reaches it), else nowhere.
export type RetiredDeletePlacement = {
  where: 'inside' | 'outside';
  left: number;
  top: number;
  size: number;
};

export function retiredDeletePlacement(
  card: RetiredPlaceholderLayout,
  width: number,
  height: number,
  zoom: number,
  selected: boolean,
): RetiredDeletePlacement | null {
  const screenWidth = width * zoom;
  const screenHeight = height * zoom;
  if (
    screenWidth >= RETIRED_DELETE_MIN_WIDTH &&
    screenHeight >= RETIRED_DELETE_MIN_HEIGHT &&
    wordsClearOfDelete(card, width, zoom)
  ) {
    return {
      where: 'inside',
      left: screenWidth - RETIRED_DELETE_INSET - RETIRED_DELETE_SIZE,
      top: RETIRED_DELETE_INSET,
      size: RETIRED_DELETE_SIZE,
    };
  }
  if (selected && width > 0 && height > 0) {
    return {
      where: 'outside',
      left: screenWidth + RETIRED_DELETE_OUTSIDE,
      top: 0,
      size: RETIRED_DELETE_SIZE,
    };
  }
  return null;
}

// Does every line of words keep clear of the button's corner, at this zoom? The words are laid out in the card's own
// units and the button in screen pixels, so the button's corner is measured back into the card's units. A line is
// clear when it starts below the button or ends left of it; the lines are centred across the box, so a long name on
// a small card reaches the corner and the button stays away rather than sit on the words.
export function wordsClearOfDelete(
  card: RetiredPlaceholderLayout,
  width: number,
  zoom = 1,
): boolean {
  const reach = (RETIRED_DELETE_INSET + RETIRED_DELETE_SIZE + DELETE_GAP) / zoom;
  const left = width - reach;
  return card.lines.every((line) => line.top >= reach || (width + line.width) / 2 <= left);
}

export function RetiredElementFace({
  element,
  fontFamily,
  selected = false,
  onDelete,
}: {
  element: BoxedElement;
  // The label font the element would letter in (the tab's, or its own).
  fontFamily?: string;
  // Whether the element is selected: the Delete button shows without a hover.
  selected?: boolean;
  // Removes the element; given only to an Editor (docs/specs/013-workspace/share-roles.md).
  onDelete?: (elementId: string) => void;
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
  onDelete,
}: {
  element: BoxedElement;
  card: RetiredPlaceholderLayout;
  selected: boolean;
  ink: string;
  onDelete: (elementId: string) => void;
}) {
  const zoom = useCanvasZoom();
  const width = Math.max(0, element.width);
  const height = Math.max(0, element.height);
  const place = retiredDeletePlacement(card, width, height, zoom, selected);
  if (!place) return null;
  const label = `Delete ${retiredElementName(element)}`;
  const button = (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        data-retired-delete={place.where}
        // The canvas reads a press on an element as select-and-maybe-drag: stop it here, or the press that deletes
        // would first start a drag of the card it removes.
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onDelete(element.id);
        }}
        className={`pointer-events-auto flex h-6 w-6 cursor-pointer items-center justify-center rounded-md transition hover:bg-black/10 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-white/10 ${
          place.where === 'outside'
            ? 'border border-slate-300 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-900'
            : selected
              ? 'opacity-100'
              : 'opacity-0 group-hover/el:opacity-100'
        }`}
        style={{ color: place.where === 'outside' ? undefined : ink }}
      >
        <Glyph size={14} units={24}>
          <Prims prims={lucideTrash2} />
        </Glyph>
      </button>
    </Tooltip>
  );
  // Counter-scaled about its top-left corner, so it keeps its size on screen and its place on the card.
  const slot = (
    <span
      className="absolute"
      data-retired-delete-slot=""
      style={{
        left: place.left / zoom,
        top: place.top / zoom,
        transform: `scale(${1 / zoom})`,
        transformOrigin: '0 0',
      }}
    >
      {button}
    </span>
  );
  if (place.where === 'inside')
    return <span className="pointer-events-none absolute inset-0 z-10">{slot}</span>;
  // Outside the card it would sit under any element drawn after this one, so it goes up into the grips layer with the
  // selection's own grips, on a frame turned and moved as the element is (as SelectionChromeLayer's is).
  const rotation = rotationOf(element);
  return (
    <BoxGripsPortal>
      <div
        data-ride-id={element.id}
        className="pointer-events-none absolute"
        style={{
          left: element.x,
          top: element.y,
          width,
          height,
          transform: rotation % 360 !== 0 ? `rotate(${rotation}deg)` : undefined,
          transformOrigin: 'center',
        }}
      >
        {slot}
      </div>
    </BoxGripsPortal>
  );
}
