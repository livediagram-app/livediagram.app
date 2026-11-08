// Style-value previews for the palette and context menus: each draws the value it picks (a border
// weight, dash or radius) at its real proportions, so
// they keep their own strokes rather than the house icon weight
// (docs/specs/004-interface-design/iconography.md, "Art").

import { BORDER_STROKE_PX } from '@livehuddle/document';
import type { BorderRadius, BorderStroke, BorderStyle } from '@livehuddle/document';
import { Glyph } from '@livehuddle/ui';

export function BorderStrokeIcon({ value }: { value: BorderStroke }) {
  if (value === 'none') {
    // "No border" glyph: a small dashed outline rendered at low
    // opacity so it reads as "absence of a border" rather than as
    // a fifth thickness preset.
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <rect
          x="3"
          y="3"
          width="12"
          height="12"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeDasharray="2 2"
          opacity="0.55"
        />
      </svg>
    );
  }
  // Reuse the renderer's canonical stroke-weight scale so the preview line
  // can't drift from the real border widths. `value` is never 'none' here
  // (handled above), so the px is always defined.
  return <StrokeWeightIcon px={BORDER_STROKE_PX[value]} />;
}

/** A line at a stroke weight, the picture every width choice wears (borders, marker widths). */
export function StrokeWeightIcon({ px, inset = 2 }: { px: number; inset?: number }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <line
        x1={inset}
        y1="9"
        x2={18 - inset}
        y2="9"
        stroke="currentColor"
        strokeWidth={px}
        strokeLinecap="round"
      />
    </svg>
  );
}

// Icon-scale dash patterns (tuned for an 18px line at strokeWidth 2),
// not the renderer's user-unit BORDER_DASH_ARRAY.
const BORDER_ICON_DASH: Record<BorderStyle, string | undefined> = {
  solid: undefined,
  dashed: '4 3',
  // round linecap (below) turns the ~0-length segment into a true dot
  dotted: '0.5 3',
  'long-dash': '9 4',
  'dash-dot': '5 2.5 0.5 2.5',
  'dash-dot-dot': '5 2.5 0.5 2.5 0.5 2.5',
};

export function BorderStyleIcon({ value }: { value: BorderStyle }) {
  const dash = BORDER_ICON_DASH[value];
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <line
        x1="2"
        y1="9"
        x2="16"
        y2="9"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray={dash}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BorderRadiusIcon({ value }: { value: BorderRadius }) {
  // 'full' → half the 12-wide rect, so the preview reads as a circle/pill.
  const rx = { none: 0, sm: 2, md: 4.5, lg: 7, full: 6 }[value];
  return (
    <Glyph size={18} units={18}>
      <rect x="3" y="3" width="12" height="12" rx={rx} />
    </Glyph>
  );
}
