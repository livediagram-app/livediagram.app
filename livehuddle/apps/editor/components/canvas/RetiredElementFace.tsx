'use client';

import {
  RETIRED_PLACEHOLDER_COLOURS,
  retiredPlaceholderLayout,
  type ShapeElement,
} from '@livehuddle/document';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';

// A retired element's placeholder (docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements"): a stored
// shape whose kind livehuddle no longer has (one of the Collaborate elements Work Tracker #423 part 4 deleted, or a
// kind it never had) draws as a plain card in its own box. A dashed outline, a muted fill, the kind's name, "Not in
// livehuddle" beneath it and the stored label beneath that when it has one. It presses nothing and opens nothing:
// the element still selects, moves, resizes, copies, locks, layers, deletes and takes comments through the wrapper
// around it, like any element.
//
// The card is laid out once, in @livehuddle/document (retiredPlaceholderLayout), and drawn here from the same layout
// and colours the export and the thumbnail draw it from (svg-render-retired.ts), so the canvas and an exported image
// never disagree. Nothing here reads or writes the element's own fields beyond its kind, label and size, so whatever
// it carries (a poll's question, a board's notes) rides through untouched.

export function RetiredElementFace({
  element,
  fontFamily,
}: {
  element: ShapeElement;
  // The label font the element would letter in (the tab's, or its own).
  fontFamily?: string;
}) {
  const colours = RETIRED_PLACEHOLDER_COLOURS[useCanvasSurface()];
  const card = retiredPlaceholderLayout(element);
  const width = Math.max(0, element.width);
  const height = Math.max(0, element.height);
  return (
    <svg
      // Inert: the wrapper around it selects and drags the element, and nothing on the card is pressable.
      className="pointer-events-none absolute inset-0 overflow-visible"
      data-retired-element={element.shape}
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
  );
}
