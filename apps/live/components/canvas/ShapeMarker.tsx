'use client';

// Shape status markers (spec/49): a small glyph rendered inside a shape, just
// left of its label (or centred when there's no label). Three traffic-light
// dots + a checkbox (unchecked / checked). Shared by the canvas renderer
// (BoxedElementView) and the context-menu Markers tiles so both draw the same
// glyph; the image export draws its own primitives (canvas/SVG strings).

import type { ShapeMarker } from '@livediagram/diagram';

// Fixed fill for the traffic-light dots; checkboxes tint with the passed
// colour (the element's text colour on canvas, currentColor in menu tiles).
const CIRCLE_FILL: Partial<Record<ShapeMarker, string>> = {
  'green-circle': '#22c55e',
  'orange-circle': '#f59e0b',
  'red-circle': '#ef4444',
};

// Human labels for the context-menu tiles.
export const MARKER_LABELS: Record<ShapeMarker, string> = {
  'green-circle': 'Green',
  'orange-circle': 'Orange',
  'red-circle': 'Red',
  'checkbox-unchecked': 'To do',
  'checkbox-checked': 'Done',
};

export function ShapeMarkerGlyph({
  marker,
  size,
  color = 'currentColor',
}: {
  marker: ShapeMarker;
  size: number;
  // Checkbox tint (circles use their fixed fill). Defaults to currentColor so
  // menu tiles inherit the button's tone.
  color?: string;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    'aria-hidden': true as const,
  };
  const fill = CIRCLE_FILL[marker];
  if (fill) {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" fill={fill} />
      </svg>
    );
  }
  if (marker === 'checkbox-unchecked') {
    return (
      <svg {...common} fill="none" stroke={color} strokeWidth="2.5">
        <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      </svg>
    );
  }
  // checkbox-checked: filled box + a white tick.
  return (
    <svg {...common}>
      <rect
        x="3.5"
        y="3.5"
        width="17"
        height="17"
        rx="4"
        fill={color}
        stroke={color}
        strokeWidth="2.5"
      />
      <path
        d="M7.5 12.5 L10.5 15.5 L16.5 8.5"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
