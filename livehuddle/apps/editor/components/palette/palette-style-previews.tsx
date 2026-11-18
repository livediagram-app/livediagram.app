// Style-value previews for the palette and context menus: each draws the value it picks (a border
// weight or dash) at its real proportions, so
// they keep their own strokes rather than the house icon weight
// (docs/specs/004-interface-design/iconography.md, "Art").

import { useId } from 'react';
import { BORDER_STROKE_PX, FLOOR_TILES, type RoomFloor } from '@livehuddle/document';
import type { BorderStroke, BorderStyle } from '@livehuddle/document';

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

// A room's floor type in miniature (docs/specs/009-elements/office.md "Floors"): a swatch of the room's own floor colour with that type's pattern laid on it, scaled
// down (boards drawn as rows of planks), so the tiles show the floor you would get.
export function FloorTypeSwatch({ floor, fill }: { floor: RoomFloor; fill: string }) {
  const id = useId();
  const tile = floor === 'boards' ? null : FLOOR_TILES[floor];
  return (
    <svg aria-hidden width={20} height={20} viewBox="0 0 20 20" className="rounded-[4px]">
      <rect width={20} height={20} fill={fill} />
      {tile ? (
        <>
          <defs>
            <pattern
              id={id}
              width={tile.w}
              height={tile.h}
              patternUnits="userSpaceOnUse"
              patternTransform={`scale(${floor === 'carpet' ? 0.8 : floor === 'concrete' ? 0.3 : 0.4})`}
            >
              {tile.marks.map((m, i) => (
                <path
                  key={i}
                  d={m.d}
                  fill={m.light ? '#fff' : '#000'}
                  fillOpacity={Math.min(1, m.opacity * 2.5)}
                />
              ))}
            </pattern>
          </defs>
          <rect width={20} height={20} fill={`url(#${id})`} />
        </>
      ) : (
        <path
          d="M0 5h20M0 10h20M0 15h20M8 0v5M14 5v5M5 10v5M12 15v5"
          stroke="#000"
          strokeOpacity={0.3}
          strokeWidth={0.8}
        />
      )}
      <rect
        x={0.5}
        y={0.5}
        width={19}
        height={19}
        rx={3.5}
        fill="none"
        stroke="#000"
        strokeOpacity={0.15}
      />
    </svg>
  );
}
