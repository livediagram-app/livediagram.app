'use client';

import {
  RETIRED_PLACEHOLDER_COLOURS,
  retiredElementName,
  retiredPlaceholderLayout,
  type BoxedElement,
  type RetiredPlaceholderLayout,
} from '@livehuddle/document';
import { Glyph, Prims, Tooltip } from '@livehuddle/ui';
import { lucideTrash2 } from '@liveworkspace/icons/lucide';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';

// A retired element's placeholder (docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements"): a stored
// element whose kind or type livehuddle no longer has (a Collaborate element Work Tracker #423 part 4 deleted, a
// diagram tool #459 deleted, or a kind it never had) draws as a plain card in its own box. A dashed outline, a muted
// fill, the kind's name, "No longer supported in livehuddle" beneath it and the stored label beneath that when it has
// one. It opens nothing: the element still selects, moves, resizes, copies, layers, deletes and takes comments through
// the wrapper around it, like any element.
//
// An Editor also gets a Delete button on the card ("Deleting it"): the one action the placeholder offers, so a board
// can be cleared of what it can no longer show without hunting for the menu. It shows on hover, on keyboard focus and
// while the element is selected (so a touch, which has no hover, finds it after the tap that selects), and only on a
// card big enough to hold it clear of the words.
//
// The card is laid out once, in @livehuddle/document (retiredPlaceholderLayout), and drawn here from the same layout
// and colours the export and the thumbnail draw it from (svg-render-retired.ts), so the canvas and an exported image
// never disagree. Nothing here reads or writes the element's own fields beyond its kind, label and size, so whatever
// it carries (a poll's question, a chart's rows) rides through untouched.

// The smallest box that holds the button clear of the name: below it the card shows words only, and the element
// still deletes from its menu and the Delete key.
export const RETIRED_DELETE_MIN_WIDTH = 72;
export const RETIRED_DELETE_MIN_HEIGHT = 40;

// The button's corner of the card, in the card's own box: a 24px square 6px in from the top and right edges (the
// `top-1.5 right-1.5` below, which keeps its focus ring off the outline), plus a 4px gap the words must keep from it.
const DELETE_SIZE = 24;
const DELETE_EDGE = 6;
const DELETE_GAP = 4;

// Does every line of words keep clear of the button's corner? A line is clear when it starts below the button or ends
// left of it; the lines are centred across the box, so a long name on a small card reaches the corner and the button
// stays away rather than sit on the words.
export function wordsClearOfDelete(card: RetiredPlaceholderLayout, width: number): boolean {
  const left = width - DELETE_EDGE - DELETE_SIZE - DELETE_GAP;
  const bottom = DELETE_EDGE + DELETE_SIZE + DELETE_GAP;
  return card.lines.every((line) => line.top >= bottom || (width + line.width) / 2 <= left);
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
  const canDelete =
    !!onDelete &&
    width >= RETIRED_DELETE_MIN_WIDTH &&
    height >= RETIRED_DELETE_MIN_HEIGHT &&
    wordsClearOfDelete(card, width);
  const deleteLabel = `Delete ${retiredElementName(element)}`;
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
      {canDelete ? (
        <span className="absolute right-1.5 top-1.5 z-10">
          <Tooltip label={deleteLabel}>
            <button
              type="button"
              aria-label={deleteLabel}
              data-retired-delete
              // The canvas reads a press on an element as select-and-maybe-drag: stop it here, or the press that
              // deletes would first start a drag of the card it removes.
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(element.id);
              }}
              className={`pointer-events-auto flex h-6 w-6 cursor-pointer items-center justify-center rounded-md transition hover:bg-black/10 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-white/10 ${
                selected ? 'opacity-100' : 'opacity-0 group-hover/el:opacity-100'
              }`}
              style={{ color: colours.ink }}
            >
              <Glyph size={14} units={24}>
                <Prims prims={lucideTrash2} />
              </Glyph>
            </button>
          </Tooltip>
        </span>
      ) : null}
    </>
  );
}
